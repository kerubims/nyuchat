import { prisma } from '@/lib/db';

export async function GET() {
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE chatsession ADD COLUMN IF NOT EXISTS total_prompt_tokens INT DEFAULT 0;
      ALTER TABLE chatsession ADD COLUMN IF NOT EXISTS total_completion_tokens INT DEFAULT 0;
      ALTER TABLE chatsession ADD COLUMN IF NOT EXISTS total_cost_usd DOUBLE PRECISION DEFAULT 0;
    `);
  } catch (e) {
    console.error('Auto migration failed:', e);
  }

  const sessions = await prisma.chatSession.findMany({
    include: {
      character: { select: { id: true, name: true, avatar_url: true } },
    },
    orderBy: { updated_at: 'desc' },
  });
  return Response.json(sessions);
}

export async function POST(req: Request) {
  const { characterId } = (await req.json()) as { characterId?: string };
  if (!characterId) return Response.json({ error: 'characterId required' }, { status: 400 });

  const character = await prisma.character.findUniqueOrThrow({ where: { id: characterId } });

  const session = await prisma.chatSession.create({
    data: {
      character_id: characterId,
      title: character.name,
      current_state: `Location: unspecified | Time: evening | Actors: ${character.name}, User`,
    },
  });

  await prisma.chatMessage.create({
    data: { chat_session_id: session.id, sender: 'assistant', content: character.greeting },
  });

  return Response.json(session, { status: 201 });
}
