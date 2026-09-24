import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    let profile = await prisma.userProfile.findUnique({
      where: { id: 'me' },
    });

    if (!profile) {
      profile = await prisma.userProfile.create({
        data: {
          id: 'me',
          display_name: 'User',
          gender: 'Not specified',
          persona: 'A quiet, observant person who says little but notices everything.',
          response_style: 'Short, casual messages. Often uses action tags to describe actions instead of words.',
        },
      });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { display_name, gender, persona, response_style } = body;

    const updated = await prisma.userProfile.upsert({
      where: { id: 'me' },
      update: {
        display_name: display_name ?? 'User',
        gender: gender ?? 'Not specified',
        persona: persona ?? '',
        response_style: response_style ?? '',
      },
      create: {
        id: 'me',
        display_name: display_name ?? 'User',
        gender: gender ?? 'Not specified',
        persona: persona ?? '',
        response_style: response_style ?? '',
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
