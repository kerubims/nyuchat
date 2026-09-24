import { NextResponse } from 'next/server';
import { MODEL_ID } from '@/lib/memory';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const novitaKey = process.env.NOVITA_API_KEY;
    if (!novitaKey) {
      return NextResponse.json({ error: 'NOVITA_API_KEY is not configured' }, { status: 500 });
    }

    const systemPrompt = `You are a master character designer for stateful roleplay.
Given a user idea, generate a detailed persona character JSON object.
Output ONLY raw, valid JSON matching this exact structure (no markdown wrappers, no extra explanation text):
{
  "name": "Character Name",
  "gender": "Female",
  "avatar_url": "https://i.pravatar.cc/150?u=unique_name",
  "persona": "[Personality: ...][Background: ...][Traits: ...]",
  "greeting": "*Action description in asterisk.* \\"Dialogue in quotes.\\"",
  "backstory": "Detailed backstory...",
  "key_memories": "- Memory point 1\\n- Memory point 2",
  "scenario": "Setting and environment scenario...",
  "response_directives": "- Directive 1\\n- Directive 2",
  "example_dialogue": "User: \\"...\\"\\nCharacter: *...* \\"...\\""
}`;

    const authHeader = ['Bearer', novitaKey].join(' ');

    const res = await fetch('https://api.novita.ai/v3/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Create character persona for: ' + prompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Novita API error: ${err}` }, { status: 500 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to extract JSON from AI response: ' + content }, { status: 500 });
    }

    const json = JSON.parse(jsonMatch[0]);
    return NextResponse.json(json);
  } catch (error) {
    console.error('Error generating character:', error);
    return NextResponse.json({ error: 'Failed to generate character: ' + String(error) }, { status: 500 });
  }
}
