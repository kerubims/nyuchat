import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await prisma.chatSession.findUnique({
      where: { id },
      include: { character: true },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { chat_session_id: id },
      orderBy: { created_at: 'asc' },
    });

    const chapters = [
      {
        id: 'c-0',
        title: 'Prologue & Initial Encounter',
        content: session.character.greeting || 'Story started.',
      },
    ];

    if (messages.length > 5) {
      chapters.push({
        id: 'c-1',
        title: 'Chapter 1: Developing Connection',
        content: messages.slice(0, 5).map((m) => `${m.sender === 'user' ? 'User' : session.character.name}: ${m.content}`).join('\n\n'),
      });
    }

    return NextResponse.json({ chapters });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
