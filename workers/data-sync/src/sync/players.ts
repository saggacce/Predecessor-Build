import { PrismaClient } from '@prisma/client';
import { gql } from '../client.js';

const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

interface PredggPlayer {
  id: string;
  uuid: string;
  name: string;
  blockSearch: boolean;
  generalStatistic: {
    wins: number;
    losses: number;
    kills: number;
    deaths: number;
    assists: number;
    goldEarned: number;
    heroDamage: number;
    wardsPlaced: number;
    matches: number;
  } | null;
  heroStatistics: Array<{
    heroData: { slug: string; name: string };
    wins: number;
    losses: number;
    kills: number;
    deaths: number;
    assists: number;
  }>;
  roleStatistics: Array<{
    role: string;
    wins: number;
    losses: number;
    matches: number;
  }>;
  ratings: Array<{
    rank: { label: string } | null;
    points: number;
    rating: { name: string } | null;
  }>;
}

const PLAYER_QUERY = `
  query GetPlayer($name: String!) {
    player(by: { name: $name }) {
      id
      uuid: legacyUuid
      name
      blockSearch
      generalStatistic(filter: { gameModes: [RANKED, STANDARD] }) {
        wins
        losses
        kills
        deaths
        assists
        goldEarned
        heroDamage
        wardsPlaced
        matches
      }
      heroStatistics(filter: { gameModes: [RANKED, STANDARD] }) {
        heroData { slug name }
        wins
        losses
        kills
        deaths
        assists
      }
      roleStatistics(filter: { gameModes: [RANKED, STANDARD] }) {
        role
        wins
        losses
        matches
      }
      ratings {
        rank { label }
        points
        rating { name }
      }
    }
  }
`;

export async function syncPlayer(db: PrismaClient, playerName: string): Promise<string | null> {
  const data = await gql<{ player: PredggPlayer | null }>(PLAYER_QUERY, { name: playerName });

  if (!data.player) {
    await db.syncLog.create({
      data: { entity: 'player', entityId: playerName, operation: 'fetch', status: 'skipped', error: 'not found' },
    });
    return null;
  }

  const p = data.player;
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

  // Snapshot de stats actuales
  const currentRating = p.ratings?.[0];
  await db.playerSnapshot.create({
    data: {
      playerId: player.id,
      syncedAt: now,
      generalStats: p.generalStatistic ?? {},
      heroStats: p.heroStatistics ?? [],
      roleStats: p.roleStatistics ?? [],
      rankLabel: currentRating?.rank?.label ?? null,
      ratingPoints: currentRating?.points ?? null,
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
