import path from 'node:path';
import * as ort from 'onnxruntime-node';
import { makeTokenizer, type AnyTokenizer } from './tok';

// bge-reranker-v2-m3 ONNX (own export, see scripts/build_reranker_onnx.py).
// transformers.js v2 can't run this architecture natively (it drops
// token_type_ids), so we load the exported graph via onnxruntime-node and
// tokenize with the shared on-disk XLM-R reader (lib/tok.ts).
const MODEL_DIR = path.resolve(process.cwd(), 'onnx', 'reranker');

let tokPromise: Promise<AnyTokenizer> | null = null;
let sessPromise: Promise<ort.InferenceSession> | null = null;

function tokenizer(): Promise<AnyTokenizer> {
  if (!tokPromise) {
    tokPromise = Promise.resolve(makeTokenizer(MODEL_DIR));
  }
  return tokPromise as Promise<AnyTokenizer>;
}

function session(): Promise<ort.InferenceSession> {
  if (!sessPromise) {
    // fp16 build (scripts/to_fp16_stream.py): half the RAM, same ranking
    // scores within 0.0001, ~1.5-2x faster than fp32 on this 4-core box.
    const file = path.join(MODEL_DIR, 'reranker_fp16.onnx');
    sessPromise = ort.InferenceSession.create(file, {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
      intraOpNumThreads: 0,
      interOpNumThreads: 0,
    });
  }
  return sessPromise;
}

export interface RerankHit {
  /** 0..1 relevance score from the cross-encoder sigmoid. */
  score: number;
  index: number;
}

/** Score query/passage pairs with the cross-encoder, returns sigmoid(logits). */
export async function rerank(query: string, passages: string[]): Promise<RerankHit[]> {
  if (passages.length === 0) return [];
  const tok = await tokenizer()!;
  const sess = await session();

  // XLM-R tokenizer only accepts one (text, text_pair) at a time, so encode
  // per pair and pad to the longest sequence in the batch.
  const encs = await Promise.all(
    passages.map((p) =>
      tok(query, { text_pair: p, truncation: true, add_special_tokens: true })
    )
  );
  const len = Math.max(...encs.map((e) => e.input_ids.size));

  const ids = new BigInt64Array(passages.length * len);
  const mask = new BigInt64Array(passages.length * len);
  const ttid = new BigInt64Array(passages.length * len);
  encs.forEach((e, i) => {
    const n = e.input_ids.size;
    const idsArr = Array.from(e.input_ids.data).map((x) => Number(x));
    const maskArr = Array.from(e.attention_mask.data).map((x) => Number(x));
    for (let j = 0; j < len; j++) {
      const off = i * len + j;
      ids[off] = j < n ? BigInt(idsArr[j]) : 0n;
      mask[off] = j < n ? BigInt(maskArr[j]) : 0n;
      ttid[off] = 0n;
    }
  });

  const idsT = new ort.Tensor('int64', ids, [passages.length, len]);
  const maskT = new ort.Tensor('int64', mask, [passages.length, len]);
  const ttidT = new ort.Tensor('int64', ttid, [passages.length, len]);

  const out = await sess.run({ input_ids: idsT, attention_mask: maskT, token_type_ids: ttidT });
  const logits = (out.logits?.data as Float32Array) ?? (Object.values(out)[0].data as Float32Array);

  // bge-reranker-v2-m3 raw logits sit in a narrow band; map to 0..1 with a
  // centered sigmoid (robust to score drift) then sort.
  const raw = Array.from({ length: passages.length }, (_, i) => logits[i] ?? -10);
  const lo = Math.min(...raw);
  const hi = Math.max(...raw);
  const mid = (lo + hi) / 2;
  const span = hi - lo || 1;
  const scaled = raw.map((x) => 4 * (x - mid) / span); // ~[-4,4]

  return raw
    .map((_, i) => ({
      score: 1 / (1 + Math.exp(-scaled[i])),
      index: i,
    }))
    .sort((a, b) => b.score - a.score);
}

export async function rerankerReady(): Promise<boolean> {
  try {
    await session();
    return true;
  } catch {
    return false;
  }
}
