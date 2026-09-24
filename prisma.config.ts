import path from 'node:path';
import { defineConfig } from 'prisma/config';

// The client adapter is wired in lib/db.ts (new PrismaPg(pool)), so nothing
// driver-specific is needed here. Prisma 7's PrismaConfig type has no
// `adapter` key; the runtime picked it up from the CLI only.
export default defineConfig({
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  migrations: { path: path.join(__dirname, 'prisma', 'migrations') },
  datasource: { url: process.env.DATABASE_URL },
});
