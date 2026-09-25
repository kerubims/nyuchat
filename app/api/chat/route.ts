import { prisma } from '@/lib/db';
import { assemble } from '@/lib/rag';
import { extractAndStoreFacts, directorLine, MODEL_ID } from '@/lib/memory';
import { updateSceneState, generateTitle } from '@/lib/state';

// Streaming chat completion (SSE). PRD §6.6: Stheno TTFT < 1.0s.
const NOVITA_URL = 'https://api.novita.ai/v3/openai/chat/completions';

export async function POST(req: Request) {
  const {
    sessionId,
    message,
    temperature = 0.8,
    editMessageId,
    regenerateMessageId,
    clientMsgId,
  } = (await req.json()) as {
    sessionId?: string;
    message?: string;
    temperature?: number;
    editMessageId?: string;
    regenerateMessageId?: string;
    clientMsgId?: string;
  };

  if (!sessionId) {
    return Response.json({ error: 'sessionId required' }, { status: 400 });
  }

  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: { character: true },
  });
  if (!session) return Response.json({ error: 'session not found' }, { status: 404 });

  let userInput = message?.trim() || '';
  const newMsgId = clientMsgId || crypto.randomUUID();

  // Helper to delete target message and all subsequent messages in session
  const deleteFromMessageOnward = async (targetId: string) => {
    const allMsgs = await prisma.chatMessage.findMany({
      where: { chat_session_id: sessionId },
      orderBy: { created_at: 'asc' },
    });

    const targetIdx = allMsgs.findIndex((m) => m.id === targetId);
    if (targetIdx !== -1) {
      const idsToDelete = allMsgs.slice(targetIdx).map((m) => m.id);
      await prisma.chatMessage.deleteMany({
        where: { id: { in: idsToDelete } },
      });
      return true;
    }

    // Fallback: try by timestamp if ID match failed
    const targetMsg = allMsgs.find((m) => m.id === targetId);
    if (targetMsg) {
      await prisma.chatMessage.deleteMany({
        where: {
          chat_session_id: sessionId,
          created_at: { gte: targetMsg.created_at },
        },
      });
      return true;
    }
    return false;
  };

  // Case A: Regenerating an assistant response
  if (regenerateMessageId) {
    const deleted = await deleteFromMessageOnward(regenerateMessageId);
    if (!deleted) {
      // Fallback if ID was lost: delete last assistant message
      const lastAssistant = await prisma.chatMessage.findFirst({
        where: { chat_session_id: sessionId, sender: 'assistant' },
        orderBy: { created_at: 'desc' },
      });
      if (lastAssistant) {
        await deleteFromMessageOnward(lastAssistant.id);
      }
    }

    const lastUserMsg = await prisma.chatMessage.findFirst({
      where: { chat_session_id: sessionId, sender: 'user' },
      orderBy: { created_at: 'desc' },
    });
    if (!lastUserMsg) {
      return Response.json({ error: 'No preceding user message to regenerate' }, { status: 400 });
    }
    userInput = lastUserMsg.content;
  }
  // Case B: Editing an existing user message
  else if (editMessageId) {
    if (!userInput) {
      return Response.json({ error: 'message required' }, { status: 400 });
    }

    const deleted = await deleteFromMessageOnward(editMessageId);
    if (!deleted) {
      // Fallback: delete the last user message and anything after
      const lastUser = await prisma.chatMessage.findFirst({
        where: { chat_session_id: sessionId, sender: 'user' },
        orderBy: { created_at: 'desc' },
      });
      if (lastUser) {
        await deleteFromMessageOnward(lastUser.id);
      }
    }

    // Reset episodic summary and scene state since storyline was edited
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        global_summary: null,
        current_state: `Location: living room | Time: evening | Actors: ${session.character.name}, User`,
        msg_since_summary: 0,
      },
    });

    await prisma.chatMessage.create({
      data: { id: newMsgId, chat_session_id: sessionId, sender: 'user', content: userInput },
    });
  }
  // Case C: Normal new user message
  else {
    if (!userInput) {
      return Response.json({ error: 'message required' }, { status: 400 });
    }
    await prisma.chatMessage.create({
      data: { id: newMsgId, chat_session_id: sessionId, sender: 'user', content: userInput },
    });
  }

  const user = await prisma.userProfile.findFirst();
  const profile = {
    name: user?.display_name ?? 'User',
    persona: user?.persona ?? 'Unknown user.',
  };

  const recentUser = await prisma.chatMessage.findMany({
    where: { chat_session_id: sessionId, sender: 'user' },
    orderBy: { created_at: 'asc' },
    take: 8,
  });
  extractAndStoreFacts(
    user?.id ?? 'me',
    session.character_id,
    recentUser.map((m) => m.content)
  ).catch(console.error);

  const ctx = await assemble({
    sessionId,
    character: session.character,
    user: profile,
    userInput,
  });

  const body = {
    model: MODEL_ID,
    messages: [{ role: 'system', content: ctx.system }, ...ctx.messages],
    stream: true,
    stream_options: { include_usage: true },
    temperature: Math.max(0.1, Math.min(1.5, temperature)),
    max_tokens: 450,
  };

  const nRes = await fetch(NOVITA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.NOVITA_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!nRes.ok) {
    const errText = await nRes.text();
    return Response.json({ error: `Novita API error: ${errText}` }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const reader = nRes.body!.getReader();
  const dec = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      let full = '';
      let buf = '';
      let promptTokens = 0;
      let completionTokens = 0;
      let costUSD = 0;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed === 'data: [DONE]') {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            continue;
          }
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const parsed = JSON.parse(trimmed.slice(6));
            if (parsed.usage) {
              promptTokens = parsed.usage.prompt_tokens || 0;
              completionTokens = parsed.usage.completion_tokens || 0;
              costUSD = (promptTokens * 0.00000005) + (completionTokens * 0.00000008);
            }
            const token = parsed.choices?.[0]?.delta?.content;
            if (token) {
              full += token;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
            }
          } catch {
            /* skip unparseable SSE lines */
          }
        }
      }

      if (full.trim()) {
        const cleaned = ctx.director ? await directorLine(full) : full;
        await prisma.chatMessage.create({
          data: {
            chat_session_id: sessionId,
            sender: 'assistant',
            content: cleaned,
          },
        });

        if (promptTokens === 0) {
          promptTokens = Math.ceil((ctx.system.length + JSON.stringify(ctx.messages).length) / 4);
          completionTokens = Math.ceil(cleaned.length / 4);
          costUSD = (promptTokens * 0.00000005) + (completionTokens * 0.00000008);
        }

        await prisma.chatSession.update({
          where: { id: sessionId },
          data: {
            msg_since_summary: { increment: 1 },
            total_prompt_tokens: { increment: promptTokens },
            total_completion_tokens: { increment: completionTokens },
            total_cost_usd: { increment: costUSD },
            updated_at: new Date(),
          },
        });

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              usage: {
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens,
                cost_usd: costUSD,
              },
            })}\n\n`
          )
        );

        updateSceneState(sessionId, session.current_state, userInput, cleaned).catch(console.error);
        if (!session.title || session.title === 'Chat Baru' || session.title === 'Perkenalan') {
          generateTitle(session.character.name, userInput, cleaned).then((newTitle) => {
            if (newTitle) {
              prisma.chatSession.update({ where: { id: sessionId }, data: { title: newTitle } }).catch(console.error);
            }
          }).catch(console.error);
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
