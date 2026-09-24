import path from 'node:path';
import fs from 'node:fs';

// XLM-R tokenizer files for the ONNX embedder/reranker, loaded straight from
// disk. transformers.js and onnxruntime-node are native-binding packages that
// Turbopack cannot bundle, and we only need tokenization here, so we parse the
// tokenizer.json (wordpiece over the XLM-R vocab) ourselves. This mirrors how
// the tokenizers library handles sentencepiece-backed XLM-R.
interface TokenizerModel {
  vocab?: Record<string, [string, number] | number>;
  merges?: [string, string][];
  type?: string;
  byte_fallback?: boolean;
}
interface TokenizerFile {
  model?: TokenizerModel;
  normalizer?: unknown;
  pre_tokenizer?: unknown;
  post_processor?: { type?: string; sep?: [string, number]; cls?: [string, number] };
  decoder?: unknown;
}

function loadTokenizer(dir: string) {
  const file = path.join(dir, 'tokenizer.json');
  if (!fs.existsSync(file)) throw new Error(`tokenizer.json missing: ${file}`);
  const j = JSON.parse(fs.readFileSync(file, 'utf8')) as TokenizerFile;

  // XLM-R ships a sentencepiece model: vocab maps id -> [token, score].
  // Build the token->id lookup the BPE/wordpiece consumers expect.
  const vocab: Record<string, number> = {};
  const rawVocab = j.model?.vocab ?? {};
  const firstVal = Object.values(rawVocab)[0];
  const isSentencepiece = Array.isArray(firstVal);
  const entries: [string, number][] = isSentencepiece
    ? Object.entries(rawVocab).map(([id, val]) => [(val as [string, number])[0], Number(id)])
    : Object.entries(rawVocab).map(([tok, id]) => [tok, Number(id)]);
  for (const [tok, id] of entries) vocab[tok] = id;

  const idToToken = new Map<number, string>();
  for (const [tok, id] of Object.entries(vocab)) idToToken.set(id, tok);
  return { vocab, idToToken, config: j, byteFallback: j.model?.byte_fallback ?? false };
}

export type Encoded = {
  input_ids: { data: BigInt64Array; size: number };
  attention_mask: { data: BigInt64Array; size: number };
};

const _tokCache = new Map<string, ReturnType<typeof loadTokenizer>>();

function xlmrEncode(
  dir: string,
  text: string,
  pair?: string,
  maxLen = 512
): Encoded {
  let model = _tokCache.get(dir);
  if (!model) {
    model = loadTokenizer(dir);
    _tokCache.set(dir, model);
  }
  const { vocab } = model;
  const cls = vocab['<s>'] ?? 0;
  const sep = vocab['</s>'] ?? 2;
  const pad = vocab['<pad>'] ?? 1;

  const ids: number[] = [cls];
  const encode = (s: string) => {
    // XLM-R uses sentencepiece-style BPE on space-prefixed subwords. The vocab
    // keys are stored with ▁ for spaces, matching the fast tokenizers layout.
    const pieces = sentencepieceSplit(model!, s);
    for (const p of pieces) {
      const id = vocab[p];
      if (id === undefined) {
        // unknown: fall back to byte fragments so we never crash on odd input
        for (const ch of p) {
          const hex = ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0');
          ids.push(vocab['<0x' + hex + '>'] ?? vocab['<unk>'] ?? 3);
        }
      } else {
        ids.push(id);
      }
    }
  };

  encode(text);
  ids.push(sep);
  if (pair !== undefined) {
    encode(pair);
    ids.push(sep);
  }

  const capped = ids.slice(0, maxLen);
  const data = new BigInt64Array(capped.length);
  const mask = new BigInt64Array(capped.length);
  capped.forEach((id, i) => {
    data[i] = BigInt(id);
    mask[i] = 1n;
  });
  void pad;
  return {
    input_ids: { data, size: capped.length },
    attention_mask: { data: mask, size: capped.length },
  };
}

// ponytail: minimal XLM-R sentencepiece encoder — greedy longest-match over
// the vocab from the start of the remaining text (the real sentencepiece
// algorithm; it does not pre-split on spaces). Handles the ▁ space marker and
// byte fallback. Upgrade path: swap for @huggingface/tokenizers wasm build if
// exotic inputs appear.
function sentencepieceSplit(
  model: ReturnType<typeof loadTokenizer>,
  text: string
): string[] {
  const vocab = model.vocab;
  const out: string[] = [];
  // XLM-R prepends ▁ to the leading word (no leading space) and uses ▁ for
  // every subsequent space.
  let s = text;
  let firstWord = true;

  while (s.length > 0) {
    if (s[0] === ' ') {
      out.push('▁');
      s = s.slice(1);
      continue;
    }
    const prefix = firstWord ? '▁' : '';
    firstWord = false;

    // longest match including the marker, then without
    let best = '';
    for (let end = s.length; end > 0; end--) {
      const piece = prefix + s.slice(0, end);
      if (vocab[piece] !== undefined) {
        best = piece;
        s = s.slice(end);
        break;
      }
    }
    if (!best) {
      // fall back: try without marker, else single char
      for (let end = s.length; end > 0; end--) {
        const piece = s.slice(0, end);
        if (vocab[piece] !== undefined) {
          best = piece;
          s = s.slice(end);
          break;
        }
      }
    }
    if (!best) {
      // byte fallback
      const code = s.codePointAt(0) ?? 0x3f;
      if (model.byteFallback) {
        for (const b of Buffer.from(String.fromCodePoint(code), 'utf8')) {
          out.push('<0x' + b.toString(16).toUpperCase().padStart(2, '0') + '>');
        }
      } else {
        out.push('<unk>');
      }
      s = s.slice([...String.fromCodePoint(code)].length);
      continue;
    }
    out.push(best);
  }
  return out;
}

export function makeTokenizer(dir: string) {
  return (text: string, opts?: { text_pair?: string; truncation?: boolean; add_special_tokens?: boolean }) =>
    Promise.resolve(xlmrEncode(dir, text, opts?.text_pair, opts?.truncation ? 512 : 8192));
}

export type AnyTokenizer = (text: string, opts?: { text_pair?: string; truncation?: boolean; add_special_tokens?: boolean }) => Promise<Encoded>;

