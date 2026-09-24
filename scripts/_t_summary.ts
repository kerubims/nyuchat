import { prisma } from '../lib/db';
import { assemble } from '../lib/rag';

// Verifies the episodic-summary path: seed 30 messages, run assemble(),
// confirm a summary is generated, old messages dropped, and the summary
// survives into the assembled context.
async function main() {
  const char = await prisma.character.findFirstOrThrow();
  const session = await prisma.chatSession.create({
    data: { character_id: char.id, title: 'summary test' },
  });

  const lines = [
    'Vey and Zack talked about the old oak tree behind the house.',
    'Zack mentioned his roommate Tyler is majoring in chemistry.',
    'Vey said she broke her wrist climbing that tree at age eleven.',
    'They planned to visit the diner on Fifth Street on Saturday.',
    "Zack's favorite class is Professor Okonkwo's twentieth-century history.",
    'Vey admitted she is afraid of deep water and never learned to swim.',
    'They found Sarah old photo album in the hallway closet.',
    'Zack wants to adopt a dog when he gets his own apartment.',
    'Vey works as a freelance graphic designer between contracts.',
    'They agreed to keep the housesitting week secret from Sarah.',
  ];

  for (let rep = 0; rep < 3; rep++) {
    for (let i = 0; i < lines.length; i++) {
      await prisma.chatMessage.create({
        data: {
          chat_session_id: session.id,
          sender: i % 2 === 0 ? 'user' : 'assistant',
          content: lines[i] + (rep ? ` (encounter ${rep + 1})` : ''),
        },
      });
    }
  }

  const seeded = await prisma.chatMessage.count({ where: { chat_session_id: session.id } });
  console.log('seeded', seeded, 'messages');

  const ctx = await assemble({
    sessionId: session.id,
    character: {
      id: char.id,
      name: char.name,
      gender: char.gender,
      persona: char.persona,
      backstory: char.persona,
      key_memories: (char as { key_memories?: string }).key_memories ?? '',
      scenario: (char as { scenario?: string }).scenario ?? '',
      response_directives: (char as { response_directives?: string }).response_directives ?? '',
      example_dialogue: (char as { example_dialogue?: string }).example_dialogue ?? '',
    },
    user: { name: 'User', persona: '' },
    userInput: 'What do you remember about our conversation?',
  });

  const after = await prisma.chatSession.findUniqueOrThrow({ where: { id: session.id } });
  console.log('\n=== summary after assemble ===');
  console.log(after.global_summary ?? '(none)');
  console.log('\nmsg_since_summary:', after.msg_since_summary);

  const remaining = await prisma.chatMessage.count({ where: { chat_session_id: session.id } });
  console.log('messages remaining:', remaining);

  console.log('\n=== assembled context ===');
  for (const m of ctx.messages) {
    console.log(`[${m.role}] ${m.content.slice(0, 110)}`);
  }

  console.log('\n=== cleanup ===');
  await prisma.chatMessage.deleteMany({ where: { chat_session_id: session.id } });
  await prisma.chatSession.delete({ where: { id: session.id } });
  console.log('cleaned');
}

main().catch((e) => {
  console.log('FAIL', e);
  process.exit(1);
});
