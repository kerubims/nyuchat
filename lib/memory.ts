import { prisma } from './db';
import { embed, embedBatch, toPgVector } from './embed';
import { rerank } from './reranker';

// PRD §7: 3-tier memory. This module owns Semantic Memory (vector facts) and
// the summary half of Episodic Memory; Working Memory is assembled in rag.ts.

const FACT_WINDOW = 8; // recent user turns scanned for fact extraction
const MIN_RR_SCORE = 0.7; // PRD §6.5: reranker >= 0.70 guarantees precision
const CANDIDATES = 12; // fused candidates before reranking

export interface Fact {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  raw_fact: string;
  score?: number;
}

/** Extract & persist (subject, predicate, object) facts from recent user messages. */
export async function extractAndStoreFacts(
  userId: string,
  characterId: string,
  recentUserMsgs: string[]
): Promise<number> {
  if (recentUserMsgs.length === 0) return 0;
  const text = recentUserMsgs.slice(-FACT_WINDOW).join('\n');

  const prompt = `Extract durable facts about the user from the messages below as JSON {"facts":[{"s":"subject","p":"predicate","o":"object"}]}.
Rules: subject = the user or a person/thing the user talked about; predicate = simple verb/relation; o = object/value.
Only facts that will matter in later conversation. Skip moods, greetings, one-off actions. Max 5 facts. Reply JSON only.

Messages:
${text}`;

  const facts = await callSthenoJson<{ facts: { s: string; p: string; o: string }[] }>(prompt);
  if (!facts?.facts?.length) return 0;

  const rows = facts.facts.filter((f) => f.s && f.p && f.o).slice(0, 5);
  if (rows.length === 0) return 0;

  const vecs = await embedBatch(rows.map((r) => `${r.s} ${r.p} ${r.o}`));
  let n = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const raw = `${r.s} ${r.p} ${r.o}`;
    const dup = await prisma.$queryRaw<{ id: string }[]>`
      select id from user_facts
      where user_id = ${userId} and character_id = ${characterId}
        and raw_fact ilike ${'%' + raw.slice(0, 80) + '%'}
      limit 1`;
    if (dup.length) continue;
    await prisma.$executeRaw`
      insert into user_facts (id, user_id, character_id, subject, predicate, object, raw_fact, embedding)
      values (${crypto.randomUUID()}, ${userId}, ${characterId}, ${r.s}, ${r.p}, ${r.o}, ${raw}, ${toPgVector(vecs[i])}::vector)`;
    n++;
  }
  return n;
}

/** 2-stage hybrid retrieval: pgvector HNSW + pg_trgm GIN fused by RRF, then cross-encoder rerank. */
export async function retrieveFacts(
  userId: string,
  characterId: string,
  query: string,
  topK = 4
): Promise<Fact[]> {
  const qv = toPgVector(await embed(query, true));

  const rows = await prisma.$queryRawUnsafe<Fact[]>(
    `with dense as (
      select id, raw_fact, 1.0 / (row_number() over (order by embedding <=> $1::vector)) as rrf
      from user_facts
      where user_id = $2 and character_id = $3
      order by embedding <=> $1::vector
      limit $4
    ),
    lex as (
      select id, raw_fact, 1.0 / (row_number() over (order by similarity(raw_fact, $5) desc)) as rrf
      from user_facts
      where user_id = $2 and character_id = $3
        and raw_fact % $5
      order by similarity(raw_fact, $5) desc
      limit $4
    )
    select f.id, f.subject, f.predicate, f.object, f.raw_fact,
           coalesce(d.rrf, 0) + coalesce(l.rrf, 0) as score
    from user_facts as f
    left join dense as d on d.id = f.id
    left join lex  as l on l.id = f.id
    where d.id is not null or l.id is not null
    order by coalesce(d.rrf, 0) + coalesce(l.rrf, 0) desc
    limit $4`,
    qv,
    userId,
    characterId,
    CANDIDATES,
    query
  );

  if (rows.length === 0) return [];
  // ponytail: reranker on CPU costs ~2-6s per pair, so cap candidates and keep
  // them short. Upgrade path: GPU provider or ONNX fp16 + dynamic shapes.
  const cands = rows.slice(0, 8).map((r) => r.raw_fact.slice(0, 160));
  const hits = await rerank(query, cands);
  const out: Fact[] = [];
  for (const h of hits.slice(0, topK)) {
    if (h.score < MIN_RR_SCORE) continue;
    out.push({ ...rows[h.index], score: h.score });
  }
  return out;
}

/** PRD §6.5 benchmark: report precision-relevant stats for a probe query. */
export async function benchmarkRag(
  userId: string,
  characterId: string,
  query: string
): Promise<{ retrieved: Fact[]; best: number; pass: boolean }> {
  const qv = toPgVector(await embed(query, true));
  const rows = await prisma.$queryRaw<Fact[]>`
    select id, subject, predicate, object, raw_fact
    from user_facts
    where user_id = ${userId} and character_id = ${characterId}
    order by embedding <=> ${qv}::vector limit 20`;
  if (!rows.length) return { retrieved: [], best: 0, pass: false };
  const hits = await rerank(query, rows.map((r) => r.raw_fact));
  const best = hits[0]?.score ?? 0;
  return {
    retrieved: hits.slice(0, 4).map((h) => ({ ...rows[h.index], score: h.score })),
    best,
    pass: best >= MIN_RR_SCORE && (hits[0]?.index ?? -1) >= 0,
  };
}

// --- LLM helper (Stheno via Novita) ---------------------------------------
const NOVITA_URL = 'https://api.novita.ai/v3/openai/chat/completions';

export interface SthenoOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  /** emit tokens as they arrive (client-side SSE bridge uses this) */
  stream?: boolean;
}

/** Single non-streaming Stheno completion. */
export async function callStheno(
  userPrompt: string,
  temperature = 0.8,
  maxTokens = 350,
  system?: string
): Promise<string> {
  const key = process.env.NOVITA_API_KEY;
  if (!key) throw new Error('NOVITA_API_KEY not set');
  const res = await fetch(NOVITA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL_ID,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
      stream: false,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Novita ${res.status}: ${t.slice(0, 200)}`);
  }
  const j = (await res.json()) as { choices: { message: { content?: string } }[] };
  return j.choices?.[0]?.message?.content ?? '';
}

export async function callSthenoJson<T>(userPrompt: string): Promise<T | null> {
  try {
    const txt = await callStheno(userPrompt, 0.2, 400, 'You are a JSON-only extraction assistant. Output valid JSON, nothing else.');
    const m = txt.match(/\{[\s\S]*\}/);
    return m ? (JSON.parse(m[0]) as T) : null;
  } catch {
    return null;
  }
}

export const MODEL_ID = 'Sao10K/L3-8B-Stheno-v3.2';
