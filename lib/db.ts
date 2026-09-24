import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, PoolConfig } from 'pg';

const globalForPrisma = globalThis as unknown as { __pool?: Pool; __prisma?: PrismaClient };

function create(): PrismaClient {
  let poolConfig: PoolConfig = {
    host: process.env.PGHOST || 'shared-postgres',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'shared_postgres_secret_2026',
    database: process.env.PGDATABASE || 'nyuchat',
    max: 10,
  };

  if (process.env.DATABASE_URL) {
    try {
      const parsed = new URL(process.env.DATABASE_URL);
      poolConfig = {
        host: parsed.hostname || poolConfig.host,
        port: parsed.port ? Number(parsed.port) : poolConfig.port,
        user: parsed.username ? decodeURIComponent(parsed.username) : poolConfig.user,
        password: parsed.password ? decodeURIComponent(parsed.password) : poolConfig.password,
        database: parsed.pathname ? parsed.pathname.replace(/^\//, '') : poolConfig.database,
        max: 10,
      };
    } catch {
      poolConfig = { connectionString: process.env.DATABASE_URL, max: 10 };
    }
  }

  const pool = globalForPrisma.__pool ?? new Pool(poolConfig);
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
