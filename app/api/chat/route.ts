import { prisma } from '@/lib/db';
import { assemble } from '@/lib/rag';
import { extractAndStoreFacts, directorLine, MODEL_ID } from '@/lib/memory';

// Streaming chat completion (SSE). PRD §6.6: Stheno TTFT < 1.0s.
const NOVITA_URL = 'https://api.novita.ai/v3/openai/chat/completions';

export async function POST(req: Request) {
  const { sessionId, message } = (await req.json()) as { sessionId?: string; message?: string };
  if (!sessionId || !message?.trim()) {
    return Response.json({ error: 'sessionId and message required' }, { status: 400 });
  }

  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: { character: true },
  });
  if (!session) return Response.json({ error: 'session not found' }, { status: 404 });

  const user = await prisma.userProfile.findFirst();
  const profile = {
    name: user?.display_name ?? 'User',
    persona: user?.persona ?? 'Unknown user.',
  };

  // Persist the (already English) user message before generation.
  await prisma.chatMessage.create({
    data: { chat_session_id: sessionId, sender: 'user', content: message },
  });

  // Background: mine durable facts from the user's side of the conversation.
  const recentUser = await prisma.chatMessage.findMany({
    where: { chat_session_id: sessionId, sender: 'user' },
    orderBy: { created_at: 'asc' },
    take: 8,
  });
  void extractAndStoreFacts('me', session.character_id, recentUser.map((m) => m.content));

  const ctx = await assemble({
    sessionId,
    character: session.character,
    user: profile,
    userInput: message,
  });

  const key = process.env.NOVITA_API_KEY;
  if (!key) return Response.json({ error: 'NOVITA_API_KEY not set' }, { status: 500 });

  // Director mode: the user cued a third character without writing dialogue.
  // Generate that character's line first (Stheno 8B can't do both in one call),
  // let Vey react to it, and surface both to the client.
  const directorLineText = ctx.director ? await directorLine(message) : '';
  if (directorLineText) {
    ctx.messages.push({ role: 'user', content: `${message} ${directorLineText}` });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      let full = '';
      try {
        if (directorLineText) send({ token: directorLineText + ' ' });
        const res = await fetch(NOVITA_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: MODEL_ID,
            messages: [{ role: 'system', content: ctx.system }, ...ctx.messages],
            temperature: 0.8,
            top_p: 0.95,
            max_tokens: 320,
            stream: true,
          }),
        });

        if (!res.ok || !res.body) {
          const t = await res.text().catch(() => '');
          send({ error: `Novita ${res.status}: ${t.slice(0, 160)}` });
          controller.close();
          return;
        }

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            const s = line.trim();
            if (!s.startsWith('data:')) continue;
            const payload = s.slice(5).trim();
            if (payload === '[DONE]') continue;
            try {
              const j = JSON.parse(payload) as {
                choices?: { delta?: { content?: string }; finish_reason?: string }[];
              };
              const delta = j.choices?.[0]?.delta?.content;
              if (delta) {
                full += delta;
                send({ token: delta });
              }
            } catch {
              /* keepalive / partial — ignore */
            }
          }
        }
      } catch (e) {
        send({ error: e instanceof Error ? e.message : 'stream failed' });
      }

      if (full.trim()) {
        await prisma.chatMessage.create({
          data: { chat_session_id: sessionId, sender: 'assistant', content: full },
        });
        await prisma.chatSession.update({
          where: { id: sessionId },
          data: { msg_since_summary: { increment: 1 }, updated_at: new Date() },
        });
      }

      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
