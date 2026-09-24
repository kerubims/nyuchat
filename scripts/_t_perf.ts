import { embed, embedBatch } from '../lib/embed';
import { rerank } from '../lib/reranker';

const passages = [
  'Zack is sleeping on the couch in the living room.',
  'Vey is housesitting for her friend Sarah this week.',
  'The weather in the hometown has been warm all summer.',
  'Sarah is away on a business trip until Friday morning.',
  'Vey used to babysit Zack when he was a scrawny 12-year-old.',
  'A recipe for chocolate chip cookies uses two cups of flour.',
  'Zack just finished his first year of college.',
];

(async () => {
  const t0 = Date.now();
  const q = await embed('What does Vey think of Zack?');
  console.log(`embed query: ${Date.now() - t0}ms`);

  const t1 = Date.now();
  const vecs = await embedBatch(passages);
  console.log(`embed 7 passages: ${Date.now() - t1}ms (dim ${vecs[0].length})`);

  const t2 = Date.now();
  const hits = await rerank('What does Vey think of Zack?', passages);
  console.log(`rerank 7 passages: ${Date.now() - t2}ms`);
  for (const h of hits.slice(0, 5)) console.log(`  ${h.score.toFixed(3)}  ${h.passage.slice(0, 60)}`);

  const t3 = Date.now();
  await rerank('What does Vey think of Zack?', passages.slice(0, 3));
  console.log(`rerank 3 passages: ${Date.now() - t3}ms`);
})().catch((e) => console.log('FAIL', e));
