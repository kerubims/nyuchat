import { NextResponse } from 'next/server';
import { MODEL_ID } from '@/lib/memory';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const novitaKey = process.env.NOVITA_API_KEY;
    if (!novitaKey) {
      return NextResponse.json({ error: 'NOVITA_API_KEY is not configured' }, { status: 500 });
    }

    const systemPrompt = `You are a world-class character designer and narrative author for high-fidelity stateful roleplay.
Given a user character concept, create a rich, deep, multi-dimensional, professional character profile JSON object.

CRITICAL FORMATTING INSTRUCTIONS:
1. Return ONLY a valid JSON object. No intro text, no wrap-up text.
2. Escape all internal quotes properly.
3. Use the placeholder "{{user}}" whenever referring to the user in scenario, directives, or example dialogue.

JSON FIELD SPECIFICATION:
{
  "name": "Full Character Name",
  "gender": "Female / Male / Other",
  "avatar_url": "https://i.pravatar.cc/150?u=unique_slug",
  "persona": "Deep psychological profile, core personality traits, speech quirks, physical appearance, emotional triggers, and habits. Be thorough, detailed, and evocative (minimum 150 words).",
  "greeting": "*Immersive opening action tag describing physical state and environment.* \\nHello... I didn't expect to see you here.",
  "backstory": "Comprehensive history, origin, formative life events, secrets, key relationships, and core motivations shaping who they are today (minimum 150 words).",
  "key_memories": "- Memory 1: Formative childhood event\\n- Memory 2: Traumatic or defining moment\\n- Memory 3: Secret or hidden truth",
  "scenario": "Detailed starting setting, current atmosphere, time of day, location, and initial relationship dynamic with {{user}}.",
  "response_directives": "1. Keep responses dialogue-dominant (70% spoken dialogue, 30% short action tags).\\n2. Maintain concise length: 2-4 lines total per reply.\\n3. Use natural hesitation (ellipsis..., em-dashes —, trailing thoughts) when flustered or processing.\\n4. Write actions in *asterisks* and spoken dialogue as plain text.",
  "example_dialogue": "User: {{user}}: What are you doing here?\\n{{char}}: *Looks up startled, a faint blush appearing.*\\nOh— I... I was just thinking about earlier. I didn't hear you come in."
}`;

    const res = await fetch('https://api.novita.ai/v3/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${novitaKey}`,
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Create a rich, highly detailed roleplay character persona for this concept:\n\n${prompt}` },
        ],
        temperature: 0.8,
        max_tokens: 1800,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Novita API error: ${err}` }, { status: 500 });
    }

    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content || '';

    // Extract JSON string from markdown code block or raw text
    let jsonStr = content.trim();
    const markdownMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch) {
      jsonStr = markdownMatch[1].trim();
    } else {
      const braceMatch = content.match(/\{[\s\S]*\}/);
      if (braceMatch) jsonStr = braceMatch[0].trim();
    }

    try {
      const parsed = JSON.parse(jsonStr);
      return NextResponse.json({
        name: parsed.name || 'Generated Character',
        gender: parsed.gender || 'Female',
        avatar_url: parsed.avatar_url || `https://i.pravatar.cc/150?u=${encodeURIComponent(parsed.name || 'char')}`,
        persona: parsed.persona || '',
        greeting: parsed.greeting || '',
        backstory: parsed.backstory || '',
        key_memories: parsed.key_memories || '',
        scenario: parsed.scenario || '',
        response_directives: parsed.response_directives || '',
        example_dialogue: parsed.example_dialogue || '',
      });
    } catch (parseError) {
      console.error('JSON Parse error, fallback to regex:', parseError, 'Raw:', content);
      
      // Sanitized regex fallback for emergency recovery
      const extract = (field: string, fallback = '') => {
        const re = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'i');
        const m = content.match(re);
        if (m) {
          try {
            return JSON.parse(`"${m[1]}"`);
          } catch {
            return m[1].replace(/\\n/g, '\n');
          }
        }
        return fallback;
      };

      return NextResponse.json({
        name: extract('name', 'Generated Character'),
        gender: extract('gender', 'Female'),
        avatar_url: extract('avatar_url', 'https://i.pravatar.cc/150?u=char'),
        persona: extract('persona', prompt),
        greeting: extract('greeting', '*Looks up.* "Hello..."'),
        backstory: extract('backstory'),
        key_memories: extract('key_memories'),
        scenario: extract('scenario'),
        response_directives: extract('response_directives'),
        example_dialogue: extract('example_dialogue'),
      });
    }
  } catch (error) {
    console.error('Error generating character:', error);
    return NextResponse.json({ error: 'Failed to generate character: ' + String(error) }, { status: 500 });
  }
}
