import { PrismaClient } from '@prisma/client';

if (process.env.NODE_ENV === 'test') {
  const databaseUrl = process.env.DATABASE_URL;
  let databaseName = '';
  try {
    databaseName = databaseUrl ? new URL(databaseUrl).pathname.split('/').filter(Boolean).at(-1) ?? '' : '';
  } catch {
    // Invalid URLs are rejected below as well.
  }

  if (!databaseName.endsWith('_test')) {
    throw new Error('Refusing to create PrismaClient in tests unless DATABASE_URL names a *_test database');
  }
}

/**
 * Shared Prisma client instance for the API.
 * Re-uses the same schema as data-sync worker.
 */
export const db = new PrismaClient();

export async function disconnectDb(): Promise<void> {
  await db.$disconnect();
}
