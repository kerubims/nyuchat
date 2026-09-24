import { rerank } from '../lib/reranker';

(async () => {
  const q = 'What does Vey think of Zack?';
  const p = [
    'Vey is 24 years old and lives next door to Zack.',
    'Zack is 19 and asleep on the couch.',
    'Paris is the capital of France.',
    'Vey used to babysit Zack when he was a child.',
  ];
  const h = await rerank(q, p);
  for (const x of h) console.log(x.score.toFixed(4), p[x.index].slice(0, 55));
  process.exit(0);
})().catch((e) => {
  console.log('FAIL', e.message.split('\n')[0]);
  process.exit(1);
});
