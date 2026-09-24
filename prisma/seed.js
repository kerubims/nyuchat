const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.PGHOST || 'shared-postgres',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'shared_postgres_secret_2026',
  database: process.env.PGDATABASE || 'nyuchat',
});

const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const characters = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'prisma/data/characters.json'), 'utf8')
);

async function main() {
  await prisma.character.deleteMany({});
  let created = 0;
  for (const c of characters) {
    await prisma.character.create({
      data: {
        id: c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
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
  console.log(`done — seeded ${created} characters`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
