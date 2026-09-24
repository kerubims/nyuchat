import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await prisma.chatSession.findUnique({
      where: { id },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const facts = await prisma.userFact.findMany({
      where: { character_id: session.character_id },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      global_summary: session.global_summary,
      current_state: session.current_state,
      facts,
    });
  } catch (error) {
    console.error('Error fetching session facts:', error);
    return NextResponse.json({ error: 'Failed to fetch session facts' }, { status: 500 });
  }
}
