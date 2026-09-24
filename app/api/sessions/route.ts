import { prisma } from '@/lib/db';
import { extractAndStoreFacts } from '@/lib/memory';

export async function GET() {
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

  // Seed the greeting so the RAG window has context from turn one
  await prisma.chatMessage.create({
    data: { chat_session_id: session.id, sender: 'assistant', content: character.greeting },
  });

  return Response.json(session, { status: 201 });
}
