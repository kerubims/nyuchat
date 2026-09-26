import { NextResponse } from 'next/server';
import { MODEL_ID } from '@/lib/memory';

export async function POST(req: Request) {
  try {
    const { field, context } = await req.json();
    if (!field) {
      return NextResponse.json({ error: 'Field is required' }, { status: 400 });
    }

    const novitaKey = process.env.NOVITA_API_KEY;
    if (!novitaKey) {
      return NextResponse.json({ error: 'NOVITA_API_KEY is not configured' }, { status: 500 });
    }

    let instruction = '';
    switch (field) {
      case 'backstory':
        instruction = 'Write a rich, detailed, multi-paragraph backstory (2-3 paragraphs) for the character. Include their history, core personality, secret desires, past turning points, and motivations. Be evocative and thorough.';
        break;
      case 'persona':
        instruction = 'Write an extensive psychological and physical persona profile (2-3 paragraphs). Include their core personality traits, speech quirks, physical appearance, emotional triggers, and subtle habits.';
        break;
      case 'greeting':
        instruction = 'Write an immersive opening greeting message for the character starting a chat with {{user}}. Format: Start with an action tag in *asterisks*, followed by spoken dialogue in "quotes". E.g., *She tilts her head, watching you closely.* "Hello..."';
        break;
      case 'key_memories':
        instruction = 'Write a bulleted list (- Memory 1...) of 3-5 important facts, secrets, past traumatic events, or memories the character must always remember.';
        break;
      case 'scenario':
        instruction = 'Write a vivid paragraph describing the current setting, atmosphere, location, time of day, and initial situation where the roleplay with {{user}} begins.';
        break;
      case 'response_directives':
        instruction = 'Write a bulleted list of 4-6 specific behavioral and formatting directives for how the character speaks, reacts, and formats their responses with {{user}}.';
        break;
      case 'example_dialogue':
        instruction = 'Write 2-3 short sample dialogue exchanges between User: {{user}} and {{char}} matching dialogue-dominant short roleplay format (70% dialogue in quotes, 30% action in asterisks).';
        break;
      default:
        instruction = `Write detailed, high-quality content for the character field: "${field}".`;
    }

    const systemPrompt = `You are a master character designer and narrative author for uncensored, immersive stateful roleplay.
Your task is to generate ONLY the content for the requested character field: "${field}".
Use the placeholder "{{user}}" whenever referring to the human user.

CURRENT CHARACTER CONTEXT:
${JSON.stringify(context, null, 2)}

INSTRUCTIONS FOR FIELD "${field}":
${instruction}

CRITICAL RULES:
1. ONLY return the clean text content for the field.
2. Do NOT wrap in JSON, quotes, or markdown code blocks (no \`\`\`text).
3. Ensure high narrative quality, rich detail, and complete consistency with the character's existing context.`;

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
          { role: 'user', content: `Generate the ${field} content now.` },
        ],
        temperature: 0.85,
        max_tokens: 900,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Novita API error: ${err}` }, { status: 500 });
    }

    const data = await res.json();
    let content: string = data.choices?.[0]?.message?.content || '';

    // Clean up potential markdown formatting block
    content = content.replace(/^```[\s\S]*?\n/, '').replace(/```$/, '').trim();

    return NextResponse.json({ content });
  } catch (error) {
    console.error(`Generate Field API error (${req.url}):`, error);
    return NextResponse.json({ error: 'Failed to generate field content: ' + String(error) }, { status: 500 });
  }
}
