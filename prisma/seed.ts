import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const pool = new Pool({ host: '127.0.0.1', port: 5433, user: 'uchat', database: 'uchat' });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const characters = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'prisma/data/characters.json'), 'utf8')
) as Record<string, string>[];

async function main() {
  const existing = await prisma.character.deleteMany({});
  console.log(`cleared ${existing.count} characters`);

  let created = 0;
  for (const c of characters) {
    await prisma.character.create({
      data: {
        name: c.name,
        avatar_url: c.avatar_url ?? null,
        gender: c.gender ?? 'Not specified',
        persona: c.persona,
        greeting: c.greeting,
        backstory: c.backstory,
        key_memories: c.key_memories,
        scenario: c.scenario,
        response_directives: c.response_directives,
        example_dialogue: c.example_dialogue,
      },
    });
    created++;
    console.log(`seeded: ${c.name}`);
  }

  await prisma.userProfile.upsert({
    where: { id: 'me' },
    update: {},
    create: {
      id: 'me',
      display_name: 'User',
      gender: 'Not specified',
      persona: 'A quiet, observant person who says little but notices everything.',
      response_style: 'Short, casual messages. Often uses action tags to describe actions instead of words.',
    },
  });
  console.log('seeded: default UserProfile');

  console.log(`done — ${created} characters`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
