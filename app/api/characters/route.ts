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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      avatar_url,
      gender,
      persona,
      greeting,
      backstory,
      key_memories,
      scenario,
      response_directives,
      example_dialogue,
    } = body;

    if (!name || !persona || !greeting) {
      return Response.json({ error: 'Name, Persona, and Greeting are required.' }, { status: 400 });
    }

    const created = await prisma.character.create({
      data: {
        name,
        avatar_url: avatar_url || `https://i.pravatar.cc/150?u=${encodeURIComponent(name)}`,
        gender: gender || 'Female',
        persona,
        greeting,
        backstory: backstory || '',
        key_memories: key_memories || '',
        scenario: scenario || '',
        response_directives: response_directives || '',
        example_dialogue: example_dialogue || '',
      },
    });

    return Response.json(created);
  } catch (err) {
    console.error('Failed to create character:', err);
    return Response.json({ error: 'Failed to create character: ' + String(err) }, { status: 500 });
  }
}
