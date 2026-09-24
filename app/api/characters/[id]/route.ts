import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const character = await prisma.character.findUnique({
      where: { id },
    });

    if (!character) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }

    return NextResponse.json(character);
  } catch (error) {
    console.error('Error fetching character:', error);
    return NextResponse.json({ error: 'Failed to fetch character' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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

    const updated = await prisma.character.update({
      where: { id },
      data: {
        name,
        avatar_url: avatar_url || null,
        gender: gender || 'Not specified',
        persona,
        greeting,
        backstory: backstory || null,
        key_memories: key_memories || null,
        scenario: scenario || null,
        response_directives: response_directives || null,
        example_dialogue: example_dialogue || null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating character:', error);
    return NextResponse.json({ error: 'Failed to update character' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.character.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting character:', error);
    return NextResponse.json({ error: 'Failed to delete character' }, { status: 500 });
  }
}
