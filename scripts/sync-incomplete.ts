/**
 * One-time script: sync all matches with missing MatchPlayers.
 * No Bearer token required — uses X-Api-Key (public).
 * Run: cd /var/opt/Predecessor-Build && npx tsx scripts/sync-incomplete.ts
 */
import { PrismaClient } from '@prisma/client';
import { syncIncompleteMatches } from '../apps/api/src/services/sync-service.js';

const db = new PrismaClient();

async function main() {
  console.log('🔄 Starting incomplete match sync (no Bearer required)...');
  const result = await syncIncompleteMatches(db);
  console.log(`✅ Done: ${result.synced} synced, ${result.errors} errors`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
