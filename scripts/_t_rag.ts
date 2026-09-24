import { prisma } from '../lib/db';
import { embed, embedBatch, toPgVector } from '../lib/embed';
import { retrieveFacts, extractAndStoreFacts } from '../lib/memory';
import { rerankerReady } from '../lib/reranker';

(async () => {
  console.log('== reranker ==', (await rerankerReady()) ? 'loaded' : 'MISSING');

  const chars = await prisma.character.findMany();
  const vey = chars.find((c) => c.name === 'Vey');
  if (!vey) throw new Error('Vey not seeded');

  const facts = [
    'User prefers slow-burn roleplay',
    'User asked Vey to be gentler',
    'User character Zack is nineteen years old',
    'User likes teasing dialogue',
  ];
  console.log('embedding', facts.length, 'facts (BGE-M3 1024-dim)...');
  const vecs = await embedBatch(facts);
  console.log('dim', vecs[0].length);
  for (let i = 0; i < facts.length; i++) {
    await prisma.$executeRaw`
      insert into user_facts (id, user_id, character_id, subject, predicate, object, raw_fact, embedding)
      values (${crypto.randomUUID()}, ${'me'}, ${vey.id}, ${'user'}, ${'prefers'}, ${facts[i]}, ${facts[i]}, ${toPgVector(vecs[i])}::vector)`;
  }
  console.log('inserted');

  const q = 'How old is Zack and what does the user like?';
  console.log('\n== retrieveFacts("' + q + '") ==');
  const hits = await retrieveFacts('me', vey.id, q);
  for (const h of hits) console.log(`  ${(h.score ?? 0).toFixed(3)}  ${h.raw_fact}`);

  console.log('\n== extractAndStoreFacts ==');
  const n = await extractAndStoreFacts('me', vey.id, [
    'My name is Alex and I am twenty-five years old.',
    'I work as a librarian downtown.',
  ]);
  console.log('extracted', n);
  const all = await prisma.$queryRaw<{ raw_fact: string }[]>`select raw_fact from user_facts`;
  for (const r of all) console.log('  -', r.raw_fact);

  // cleanup so the e2e chat test starts fresh
  await prisma.$executeRaw`delete from user_facts`;
  console.log('\ncleaned facts');
  process.exit(0);
})().catch((e) => {
  console.error('FAIL', e.message.split('\n').slice(0, 5).join(' | '));
  process.exit(1);
});
