import { PrismaClient } from '@prisma/client';

/**
 * Shared Prisma client instance for the API.
 * Re-uses the same schema as data-sync worker.
 */
export const db = new PrismaClient();

export async function disconnectDb(): Promise<void> {
  await db.$disconnect();
}
