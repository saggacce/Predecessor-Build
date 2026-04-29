import { PrismaClient } from '@prisma/client';
import { gql } from '../client.js';

const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

interface PredggPlayer {
  id: string;
  uuid: string;
  name: string;
  blockSearch: boolean;
}

const PLAYER_QUERY = `
  query SearchPlayer($name: String!) {
    playersPaginated(filter: { search: $name }, limit: 1) {
      results {
        id
        uuid
        name
        blockSearch
      }
    }
  }
`;

export async function syncPlayer(db: PrismaClient, playerName: string): Promise<string | null> {
  const data = await gql<{ playersPaginated: { results: PredggPlayer[] } }>(PLAYER_QUERY, { name: playerName });

  const p = data?.playersPaginated?.results?.[0];

  if (!p) {
    await db.syncLog.create({
      data: { entity: 'player', entityId: playerName, operation: 'fetch', status: 'skipped', error: 'not found' },
    });
    return null;
  }

  const now = new Date();
  const isPrivate = p.blockSearch || p.name === 'HIDDEN';

  const player = await db.player.upsert({
    where: { predggId: p.id },
    update: { displayName: p.name, isPrivate, lastSynced: now },
    create: {
      predggId: p.id,
      predggUuid: p.uuid ?? p.id,
      displayName: p.name,
      isPrivate,
      lastSynced: now,
    },
  });

  // Snapshot de stats actuales (minimal for MVP since API changed)
  await db.playerSnapshot.create({
    data: {
      playerId: player.id,
      syncedAt: now,
      generalStats: {},
      heroStats: [],
      roleStats: [],
    },
  });

  await db.syncLog.create({
    data: { entity: 'player', entityId: p.id, operation: 'upsert', status: 'ok' },
  });

  return player.id;
}

export async function syncStalePlayers(db: PrismaClient): Promise<number> {
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);

  const stalePlayers = await db.player.findMany({
    where: { lastSynced: { lt: staleThreshold } },
    select: { displayName: true },
  });

  let synced = 0;
  for (const player of stalePlayers) {
    try {
      await syncPlayer(db, player.displayName);
      synced++;
    } catch (err) {
      await db.syncLog.create({
        data: {
          entity: 'player',
          entityId: player.displayName,
          operation: 'upsert',
          status: 'error',
          error: String(err),
        },
      });
    }
  }

  return synced;
}
