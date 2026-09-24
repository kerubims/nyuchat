import { prisma } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await prisma.chatSession.findUnique({
    where: { id },
    include: { character: true },
  });
  if (!session) return Response.json({ error: 'not found' }, { status: 404 });

  const messages = await prisma.chatMessage.findMany({
    where: { chat_session_id: id },
    orderBy: { created_at: 'asc' },
  });

  return Response.json({ session, messages });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.chatSession.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
