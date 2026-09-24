import { prisma } from '@/lib/db';

export async function GET() {
  const characters = await prisma.character.findMany({
    orderBy: { created_at: 'asc' },
    select: {
      id: true,
      name: true,
      avatar_url: true,
      gender: true,
      persona: true,
      greeting: true,
      scenario: true,
    },
  });
  return Response.json(characters);
}
