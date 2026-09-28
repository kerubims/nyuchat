import { translate } from '@vitalets/google-translate-api';

// PRD §2: Client-Side Ephemeral UI Translation.
// MyMemory fallback: google-translate endpoint can rate-limit (429) or be
// unreachable from the deployment network; keep translation functional.
async function mymemoryTranslate(text: string, to: string, from?: string) {
  const lang = from ? `${from}|${to}` : `autodetect|${to}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(lang)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);
  const data = (await res.json()) as { responseData?: { translatedText?: string } };
  const out = data.responseData?.translatedText;
  if (!out) throw new Error('MyMemory returned no translation');
  return out;
}

export async function POST(req: Request) {
  const { text, to = 'id', from } = (await req.json()) as { text?: string; to?: string; from?: string };
  if (!text || !text.trim()) {
    return Response.json({ error: 'text required' }, { status: 400 });
  }

  const opts: { to: string; from?: string } = { to };
  if (from) opts.from = from;

  // Primary: google translate
  try {
    const res = await translate(text.trim(), opts);
    return Response.json({
      source: text.trim(),
      translation: res.text,
      detected: (res as { from?: { language?: { iso?: string } } }).from?.language?.iso ?? 'en',
    });
  } catch (e) {
    console.error('google translate failed, falling back to MyMemory:', e instanceof Error ? e.message : e);
  }

  // Fallback: MyMemory
  try {
    const translation = await mymemoryTranslate(text.trim(), to, from);
    return Response.json({ source: text.trim(), translation, detected: from ?? 'en' });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'translation failed' },
      { status: 502 }
    );
  }
}
