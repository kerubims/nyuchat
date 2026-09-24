import * as ort from 'onnxruntime-node';
import path from 'node:path';
import fs from 'node:fs';
import { rerank } from './reranker';
import { makeTokenizer, type AnyTokenizer } from './tok';

// BGE-M3 dense embeddings, 1024-dim (PRD §7 / §1.8).
// transformers.js cannot load the official repo's ONNX (its graph stores weights
// in an external .onnx_data file the v2 runtime fails to resolve), so we fetch
// the raw HF files and run the graph through onnxruntime-node.
// NOTE: do NOT set env.allowLocalModels=false globally here; the tokenizer must
// still resolve from disk (see tokenizer() below).

const EMBED_DIR = path.resolve(process.cwd(), 'onnx', 'embedder');
export const EMBED_DIM = 1024;
const MAX_POOL = 64;

let tokPromise: Promise<AnyTokenizer> | null = null;
let sessPromise: Promise<ort.InferenceSession> | null = null;

function snapshotDir(): string {
  if (!fs.existsSync(EMBED_DIR)) {
    throw new Error(`BGE-M3 not downloaded. Run: npm run fetch:models (scripts/fetch_bge_m3.sh)`);
  }
  return EMBED_DIR;
}

function tokenizer(): Promise<AnyTokenizer> {
  if (!tokPromise) {
    const dir = snapshotDir();
    tokPromise = Promise.resolve(makeTokenizer(dir));
  }
  return tokPromise as Promise<AnyTokenizer>;
}

function session(): Promise<ort.InferenceSession> {
  if (!sessPromise) {
    const file = path.join(snapshotDir(), 'onnx', 'model.onnx');
    if (!fs.existsSync(file)) throw new Error(`embedding ONNX missing: ${file}`);
    sessPromise = ort.InferenceSession.create(file, {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
    });
  }
  return sessPromise;
}
export function reranker(): typeof rerank {
  return rerank;
}

function meanPool(tokens: number[][], mask: number[][]): number[] {
  const dim = tokens[0].length;
  const out = new Array(dim).fill(0);
  let n = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (!mask[i][0]) continue;
    n++;
    for (let j = 0; j < dim; j++) out[j] += tokens[i][j];
  }
  if (n === 0) n = 1;
  for (let j = 0; j < dim; j++) out[j] /= n;
  return out;
}

function normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1;
  return v.map((x) => x / norm);
}

async function runEmbed(texts: string[]): Promise<number[][]> {
  const tok = await tokenizer()!;
  const sess = await session()!;
  const encs = await Promise.all(
    texts.map((t) => tok(t, { truncation: true, add_special_tokens: true }))
  );
  const len = Math.max(...encs.map((e) => e.input_ids.size));

  const ids = new BigInt64Array(texts.length * len);
  const mask = new BigInt64Array(texts.length * len);
  const ttid = new BigInt64Array(texts.length * len);
  encs.forEach((e, i) => {
    const idsArr = Array.from(e.input_ids.data).map((x) => Number(x));
    const maskArr = Array.from(e.attention_mask.data).map((x) => Number(x));
    const n = e.input_ids.size;
    for (let j = 0; j < len; j++) {
      const off = i * len + j;
      ids[off] = j < n ? BigInt(idsArr[j]) : 0n;
      mask[off] = j < n ? BigInt(maskArr[j]) : 0n;
      ttid[off] = 0n;
    }
  });

  const out = await sess.run({
    input_ids: new ort.Tensor('int64', ids, [texts.length, len]),
    attention_mask: new ort.Tensor('int64', mask, [texts.length, len]),
    token_type_ids: new ort.Tensor('int64', ttid, [texts.length, len]),
  });

  const hidden = (out.last_hidden_state?.data as Float32Array) ??
    (out[Object.keys(out)[0]].data as Float32Array);
  const dim = (out.last_hidden_state?.dims ?? out[Object.keys(out)[0]].dims)[2];

  return encs.map((_e, i) => {
    const toks: number[][] = [];
    const m: number[][] = [];
    for (let t = 0; t < len; t++) {
      const off = (i * len + t) * dim;
      toks.push(Array.from(hidden.slice(off, off + dim)));
      m.push([Number(mask[i * len + t])]);
    }
    return normalize(meanPool(toks, m));
  });
}

export async function embed(text: string, _query = false): Promise<number[]> {
  return (await runEmbed([text]))[0];
}

export async function embedBatch(texts: string[], _query = false): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += MAX_POOL) {
    out.push(...(await runEmbed(texts.slice(i, i + MAX_POOL))));
  }
  return out;
}

export function toPgVector(v: number[]): string {
  return `[${v.map((x) => (Math.round(x * 1e6) / 1e6).toString()).join(',')}]`;
}

export { rerank } from './reranker';
export type { RerankHit } from './reranker';

