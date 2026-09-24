import { prisma } from '../lib/db';
import { assemble } from '../lib/rag';
import { extractAndStoreFacts, retrieveFacts, callStheno, MODEL_ID } from '../lib/memory';

// End-to-end smoke test: session -> assemble -> Stheno -> persist.
// Run after `npm run db:seed` with NOVITA_API_KEY set.

(async () => {
  const vey = await prisma.character.findFirst({ where: { name: 'Vey' } });
  if (!vey) throw new Error('seed characters first: npm run db:seed');

  const session = await prisma.chatSession.create({
    data: {
      character_id: vey.id,
      title: 'e2e smoke',
      current_state: 'Location: living room | Time: late evening | Actors: Vey, Zack',
    },
  });
  await prisma.chatMessage.create({
    data: { chat_session_id: session.id, sender: 'assistant', content: vey.greeting },
  });

  // Mine facts from a synthetic user turn so retrieval has something to find.
  await prisma.chatMessage.create({
    data: { chat_session_id: session.id, sender: 'user', content: 'My name is Alex. I am twenty-five.' },
  });
  const n = await extractAndStoreFacts('me', vey.id, [
    'My name is Alex. I am twenty-five years old.',
  ]);
  console.log('facts extracted:', n);

  const hits = await retrieveFacts('me', vey.id, 'What is my name and how old am I?');
  console.log('retrieved:', hits.map((h) => h.raw_fact));

  const ctx = await assemble({
    sessionId: session.id,
    character: vey,
    user: { name: 'User', persona: 'A quiet, observant person.' },
    userInput: '*Vey leans closer, curious about the boy sleeping on the couch.*',
  });
  console.log('\n--- system prompt (head) ---');
  console.log(ctx.system.slice(0, 400).replace(/\n/g, '\n  '));
  console.log('\n--- in-context msgs:', ctx.messages.length);

  const t0 = Date.now();
  const reply = await callStheno(
    '*Vey leans closer, curious about the young man sleeping on the couch.*',
    0.8,
    320,
    ctx.system
  );
  const ms = Date.now() - t0;
  console.log(`\n--- Stheno reply (${ms}ms, ${reply.split(/\s+/).length} words) ---`);
  console.log(reply);

  // PRD §4.1-4.2 quality checks
  const words = reply.split(/\s+/).filter(Boolean);
  const inQuotes = (reply.match(/"([^"]*)"/g) || []).join(' ').split(/\s+/).filter(Boolean).length;
  const ratio = words.length ? inQuotes / words.length : 0;
  console.log(`\ndialogue ratio: ${(ratio * 100).toFixed(0)}% (target 60-70%)`);
  console.log(`word count: ${words.length} (target 45-90)`);
  console.log(`has question: ${/\?/.test(reply)}`);

  await prisma.chatMessage.create({ data: { chat_session_id: session.id, sender: 'assistant', content: reply } });
  await prisma.chatSession.delete({ where: { id: session.id } });
  await prisma.$executeRaw`delete from user_facts`;
  console.log('\ncleaned');
  process.exit(0);
})().catch((e) => {
  console.error('FAIL', e.message.split('\n').slice(0, 6).join(' | '));
  process.exit(1);
});
