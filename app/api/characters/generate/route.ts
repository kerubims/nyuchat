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
CRITICAL: Output ONLY valid single-line JSON strings with no unescaped newlines.
Output structure:
{
  "name": "Character Name",
  "gender": "Female",
  "avatar_url": "https://i.pravatar.cc/150?u=unique_name",
  "persona": "[Personality: ...][Background: ...]",
  "greeting": "*Action* 'Dialogue'",
  "backstory": "Backstory...",
  "key_memories": "Key memories...",
  "scenario": "Scenario...",
  "response_directives": "Directives...",
  "example_dialogue": "Example dialogue..."
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
    const content: string = data.choices?.[0]?.message?.content || '';

    // Sanitize control newlines inside quotes
    const sanitized = content.replace(/[\r\n]+/g, ' ');

    const jsonMatch = sanitized.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const json = JSON.parse(jsonMatch[0]);
        return NextResponse.json(json);
      } catch {
        /* try fallback regex below */
      }
    }

    // Field-level regex extraction fallback
    const extractField = (field: string, fallback = '') => {
      const re = new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`, 'i');
      const m = content.match(re);
      return m ? m[1].replace(/\\n/g, '\n') : fallback;
    };

    const name = extractField('name', 'Generated Persona');
    const gender = extractField('gender', 'Female');
    const avatar_url = extractField('avatar_url', `https://i.pravatar.cc/150?u=${encodeURIComponent(name)}`);
    const persona = extractField('persona', prompt);
    const greeting = extractField('greeting', `*Smiles warmly.* "Hello!"`);
    const backstory = extractField('backstory');
    const key_memories = extractField('key_memories');
    const scenario = extractField('scenario');
    const response_directives = extractField('response_directives');
    const example_dialogue = extractField('example_dialogue');

    return NextResponse.json({
      name,
      gender,
      avatar_url,
      persona,
      greeting,
      backstory,
      key_memories,
      scenario,
      response_directives,
      example_dialogue,
    });
  } catch (error) {
    console.error('Error generating character:', error);
    return NextResponse.json({ error: 'Failed to generate character: ' + String(error) }, { status: 500 });
  }
}
