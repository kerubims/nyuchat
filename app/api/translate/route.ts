import { translate } from '@vitalets/google-translate-api';

// PRD §2: Client-Side Ephemeral UI Translation.
export async function POST(req: Request) {
  const { text, to = 'id', from } = (await req.json()) as { text?: string; to?: string; from?: string };
  if (!text || !text.trim()) {
    return Response.json({ error: 'text required' }, { status: 400 });
  }

  try {
    const opts: { to: string; from?: string } = { to };
    if (from) opts.from = from;
    const res = await translate(text.trim(), opts);
    return Response.json({
      source: text.trim(),
      translation: res.text,
      detected: (res as { from?: { language?: { iso?: string } } }).from?.language?.iso ?? 'en',
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'translation failed' },
      { status: 502 }
    );
  }
}
