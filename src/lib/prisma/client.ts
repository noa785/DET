// src/lib/prisma/client.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/**
 * Pages run several queries at once (Promise.all). With connection_limit=1 they queue behind each other and,
 * when the database is busy, fail after 10 seconds ("Timed out fetching a new connection").
 * Allow a few connections per server instance and wait longer before giving up.
 */
function dbUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    const limit = Number(u.searchParams.get('connection_limit') ?? '0');
    if (!limit || limit < 4) u.searchParams.set('connection_limit', '4');
    if (Number(u.searchParams.get('pool_timeout') ?? '0') < 30) u.searchParams.set('pool_timeout', '30');
    return u.toString();
  } catch { return raw; }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: dbUrl(),
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'warn', 'error']
      : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
