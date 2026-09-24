import { assemble } from '../lib/rag';
import { prisma } from '../lib/db';

async function main() {
  const s = await prisma.chatSession.findFirstOrThrow({
    orderBy: { updated_at: 'desc' },
    include: { character: true },
  });
  const c = await assemble({
    sessionId: s.id,
    character: s.character,
    user: { name: 'User', persona: '' },
    userInput: '*her husband say to her*',
  });
  console.log('=== SYSTEM PROMPT ===');
  console.log(c.system);
  process.exit(0);
}
main().catch((e) => { console.log('FAIL', e); process.exit(1); });
