import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// ponytail: single Pool/PrismaClient per process; scale out with a pool per
// serverless isolate if this ever runs on edge.
const globalForPrisma = globalThis as unknown as { __pool?: Pool; __prisma?: PrismaClient };

function create(): PrismaClient {
  const pool =
    globalForPrisma.__pool ??
    new Pool({
      host: process.env.PGHOST || '127.0.0.1',
      port: Number(process.env.PGPORT || 5433),
      user: process.env.PGUSER || 'uchat',
      password: process.env.PGPASSWORD || undefined,
      database: process.env.PGDATABASE || 'uchat',
      max: 10,
    });
  globalForPrisma.__pool = pool;

  const prisma =
    globalForPrisma.__prisma ??
    new PrismaClient({
      adapter: new PrismaPg(pool),
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  globalForPrisma.__prisma = prisma;
  return prisma;
}

export const prisma = create();
