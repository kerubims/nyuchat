import { prisma } from '@/lib/db';

// Feature: session branching. Fork a session at a chosen character message:
// copy every message up to and including that message, plus the session's
// summary/state/counters and its session-scoped facts (embeddings included),
// into a brand-new session. The original is untouched.

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { upToMessageId?: string } | null;
  if (!body) return Response.json({ error: 'invalid request body' }, { status: 400 });

  const { upToMessageId } = body;

  if (!upToMessageId) {
    return Response.json({ error: 'upToMessageId required' }, { status: 400 });
  }

  const source = await prisma.chatSession.findUnique({
    where: { id },
    include: { character: { select: { name: true } } },
  });
  if (!source) return Response.json({ error: 'session not found' }, { status: 404 });

  const pivot = await prisma.chatMessage.findUnique({ where: { id: upToMessageId } });
  if (!pivot || pivot.chat_session_id !== id) {
    return Response.json({ error: 'message does not belong to this session' }, { status: 400 });
  }
  if (pivot.sender !== 'assistant') {
    return Response.json({ error: 'can only branch from a character message' }, { status: 400 });
  }

  // Count existing branches of this parent → "Branch N" label, 1-based.
  const siblings = await prisma.chatSession.count({ where: { parent_session_id: id } });
  const label = `Branch ${siblings + 1}`;

  const branch = await prisma.chatSession.create({
    data: {
      character_id: source.character_id,
      title: `${source.character.name} — ${label}`,
      global_summary: source.global_summary,
      current_state: source.current_state,
      msg_since_summary: source.msg_since_summary,
      total_prompt_tokens: source.total_prompt_tokens,
      total_completion_tokens: source.total_completion_tokens,
      total_cost_usd: source.total_cost_usd,
      parent_session_id: id,
      branch_label: label,
    },
  });

  // Copy messages up to the pivot (inclusive), preserving created_at so the
  // ordering in the fork is identical to the original thread.
  await prisma.$executeRaw`
    insert into chatmessage (id, chat_session_id, sender, content, created_at)
    select gen_random_uuid(), ${branch.id}, sender, content, created_at
    from chatmessage
    where chat_session_id = ${id} and created_at <= ${pivot.created_at}
    order by created_at, id`;

  // Copy the session's own facts, embeddings included — no re-embed cost.
  await prisma.$executeRaw`
    insert into user_facts (id, user_id, character_id, session_id, subject, predicate, object, raw_fact, embedding, created_at)
    select gen_random_uuid(), user_id, character_id, ${branch.id}, subject, predicate, object, raw_fact, embedding, created_at
    from user_facts
    where session_id = ${id}
    order by created_at`;

  return Response.json({ branch }, { status: 201 });
}
