import { translate } from '@vitalets/google-translate-api';

// PRD §2: Client-Side Ephemeral UI Translation. This endpoint only feeds the
// draft-preview box — nothing it returns is ever stored.
export async function POST(req: Request) {
  const { text } = (await req.json()) as { text?: string };
  if (!text || !text.trim()) {
    return Response.json({ error: 'text required' }, { status: 400 });
  }

  try {
    const res = await translate(text.trim(), { to: 'en' });
    return Response.json({
      source: text.trim(),
      translation: res.text,
      detected: (res as { from?: { language?: { iso?: string } } }).from?.language?.iso ?? 'id',
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'translation failed' },
      { status: 502 }
    );
  }
}
