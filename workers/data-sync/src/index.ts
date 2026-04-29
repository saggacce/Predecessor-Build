import { PrismaClient } from '@prisma/client';
import { syncVersions } from './sync/versions.js';
import { syncPlayer, syncStalePlayers } from './sync/players.js';
import { syncMatch, syncPlayerMatches } from './sync/matches.js';

const db = new PrismaClient();

type Command = 'sync-all' | 'sync-versions' | 'sync-player' | 'sync-stale' | 'sync-match' | 'sync-player-matches';

async function main() {
  const [command, ...args] = process.argv.slice(2) as [Command, ...string[]];

  if (!command) {
    console.log(`
Usage:
  npm run sync -- sync-all
  npm run sync -- sync-versions
  npm run sync -- sync-player <playerName>
  npm run sync -- sync-stale
  npm run sync -- sync-match <matchUuid>
  npm run sync -- sync-player-matches <predggPlayerId> [limit]
`);
    process.exit(0);
  }

  console.log(`[data-sync] command=${command} args=${JSON.stringify(args)}`);
  const start = Date.now();

  try {
    switch (command) {
      case 'sync-all': {
        const versions = await syncVersions(db);
        console.log(`  ✓ versions: ${versions} upserted`);

        const stale = await syncStalePlayers(db);
        console.log(`  ✓ stale players refreshed: ${stale}`);
        break;
      }

      case 'sync-versions': {
        const count = await syncVersions(db);
        console.log(`  ✓ versions: ${count} upserted`);
        break;
      }

      case 'sync-player': {
        const name = args[0];
        if (!name) {
          console.error('  ✗ missing player name');
          process.exit(1);
        }
        const id = await syncPlayer(db, name);
        console.log(id ? `  ✓ player synced: ${id}` : `  ⚠ player not found: ${name}`);
        break;
      }

      case 'sync-stale': {
        const count = await syncStalePlayers(db);
        console.log(`  ✓ stale players refreshed: ${count}`);
        break;
      }

      case 'sync-match': {
        const uuid = args[0];
        if (!uuid) {
          console.error('  ✗ missing match UUID');
          process.exit(1);
        }
        const id = await syncMatch(db, uuid);
        console.log(id ? `  ✓ match synced: ${id}` : `  ⚠ match not found: ${uuid}`);
        break;
      }

      case 'sync-player-matches': {
        const playerId = args[0];
        if (!playerId) {
          console.error('  ✗ missing pred.gg player ID');
          process.exit(1);
        }
        const limit = args[1] ? parseInt(args[1], 10) : 20;
        const count = await syncPlayerMatches(db, playerId, limit);
        console.log(`  ✓ player matches synced: ${count}`);
        break;
      }

      default:
        console.error(`  ✗ unknown command: ${command}`);
        process.exit(1);
    }
  } catch (err) {
    console.error(`  ✗ error:`, err);

    await db.syncLog.create({
      data: {
        entity: 'system',
        entityId: command,
        operation: command,
        status: 'error',
        error: String(err),
      },
    });

    process.exit(1);
  } finally {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[data-sync] done in ${elapsed}s`);
    await db.$disconnect();
  }
}

main();
