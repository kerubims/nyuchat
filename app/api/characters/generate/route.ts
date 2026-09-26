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

    const systemPrompt = `You are an elite narrative author and character designer for immersive stateful roleplay.
Given a user character concept, create a rich, deep, multi-dimensional, professional character profile JSON object.

CRITICAL INSTRUCTIONS:
1. Write extensive, highly descriptive, multi-paragraph content for persona and backstory.
2. Use the placeholder "{{user}}" whenever referring to the user in scenario, directives, or example dialogue.
3. Return ONLY valid JSON with no markdown wrapping.

JSON FIELD SPECIFICATION:
{
  "name": "Full Character Name",
  "gender": "Female / Male / Other",
  "avatar_url": "https://i.pravatar.cc/150?u=unique_slug",
  "persona": "Extensive psychological profile: core traits, speech patterns, emotional triggers, physical appearance, internal conflicts, and subtle habits. Write a rich, detailed description (at least 2-3 detailed paragraphs).",
  "greeting": "*Immersive opening scene setter describing physical state, atmosphere, and body language.* \\nSpoken opening line directly to {{user}}.",
  "backstory": "Rich narrative history: childhood origins, pivotal turning points, secret motivations, family/past trauma, and key relationships shaping present behavior (at least 2-3 detailed paragraphs).",
  "key_memories": "- Fact 1: Age, role, and current goal/secret\\n- Fact 2: Exact relationship dynamic with {{user}}\\n- Fact 3: Secret feelings toward {{user}}\\n- Fact 4: Defining past event/trauma shaping their behavior\\n- Fact 5: What triggers vulnerability or emotional closeness",
  "scenario": "Rich starting setting, current atmosphere, location details, and initial relationship dynamic with {{user}}.",
  "response_directives": "1. Keep responses dialogue-dominant (70% dialogue, 30% action tags).\\n2. Maintain concise length per turn: 2-4 lines total.\\n3. Use natural hesitation (ellipsis..., em-dashes —, trailing thoughts) when flustered or processing.\\n4. Format actions in *asterisks* and spoken dialogue as plain text.",
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
