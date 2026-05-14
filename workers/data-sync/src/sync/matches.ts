import { PrismaClient } from '@prisma/client';
import { gql } from '../client.js';

interface PredggMatchPlayer {
  id: string;
  name: string;
  team: string;
  role: string | null;
  kills: number;
  deaths: number;
  assists: number;
  heroDamage: number | null;
  totalDamageDealt: number | null;
  gold: number | null;
  wardsPlaced: number | null;
  heroData: { slug: string } | null;
  perkData: { slug: string } | null;
  inventoryItemData: Array<{ slug: string }>;
  abilityOrder: Array<{ ability: string; gameTime: number }> | null;
  player: { id: string; uuid: string; name: string } | null;
}

interface PredggMatch {
  id: string;
  uuid: string;
  startTime: string;
  duration: number;
  gameMode: string;
  region: string | null;
  winningTeam: string | null;
  version: { id: string } | null;
  matchPlayers: PredggMatchPlayer[];
}

const MATCH_QUERY = `
  query GetMatch($uuid: String!) {
    match(by: { uuid: $uuid }) {
      id
      uuid
      startTime
      duration
      gameMode
      region
      winningTeam
      version { id }
      matchPlayers {
        id
        name
        team
        role
        kills
        deaths
        assists
        heroDamage
        totalDamageDealt
        gold
        wardsPlaced
        heroData { slug }
        perkData { slug }
        inventoryItemData { slug }
        abilityOrder { ability gameTime }
        player { id legacyUuid name }
      }
    }
  }
`;

const PLAYER_MATCHES_QUERY = `
  query GetPlayerMatches($playerId: ID!, $limit: Int!, $offset: Int!) {
    player(by: { id: $playerId }) {
      matchesPaginated(
        limit: $limit
        offset: $offset
        filter: { gameModes: [RANKED, STANDARD] }
      ) {
        nodes { uuid }
        totalCount
      }
    }
  }
`;

export async function syncMatch(db: PrismaClient, uuid: string): Promise<string | null> {
  const existing = await db.match.findUnique({
    where: { predggUuid: uuid },
    include: { _count: { select: { matchPlayers: true } } },
  });
  // Skip re-sync only if match has a full roster (≥10 players across both teams)
  if (existing && existing._count.matchPlayers >= 10) return existing.id;
  // Incomplete match — delete existing MatchPlayers and re-sync
  if (existing) {
    await db.matchPlayer.deleteMany({ where: { matchId: existing.id } });
  }

  const data = await gql<{ match: PredggMatch | null }>(MATCH_QUERY, { uuid });
  if (!data.match) return null;

  const m = data.match;
  const now = new Date();

  const version = m.version
    ? await db.version.findUnique({ where: { predggId: m.version.id } })
    : null;

  const match = await db.match.upsert({
    where: { predggUuid: m.uuid },
    create: {
      predggUuid: m.uuid,
      startTime: new Date(m.startTime),
      duration: m.duration,
      gameMode: m.gameMode,
      region: m.region,
      winningTeam: m.winningTeam,
      versionId: version?.id ?? null,
      syncedAt: now,
    },
    update: { syncedAt: now },
  });

  for (const mp of m.matchPlayers) {
    let playerId: string | null = null;

    if (mp.player?.id) {
      const dbPlayer = await db.player.findUnique({ where: { predggId: mp.player.id } });
      playerId = dbPlayer?.id ?? null;
    }

    await db.matchPlayer.create({
      data: {
        matchId: match.id,
        playerId,
        playerName: mp.name ?? 'HIDDEN',
        team: mp.team,
        role: mp.role,
        heroSlug: mp.heroData?.slug ?? 'unknown',
        kills: mp.kills,
        deaths: mp.deaths,
        assists: mp.assists,
        heroDamage: mp.heroDamage,
        totalDamage: mp.totalDamageDealt,
        gold: mp.gold,
        wardsPlaced: mp.wardsPlaced,
        inventoryItems: mp.inventoryItemData.map((i) => i.slug),
        perkSlug: mp.perkData?.slug ?? null,
        abilityOrder: mp.abilityOrder ?? [],
      },
    });
  }

  await db.syncLog.create({
    data: { entity: 'match', entityId: m.uuid, operation: 'upsert', status: 'ok' },
  });

  return match.id;
}

const DATA_RETENTION_MONTHS = parseInt(process.env.DATA_RETENTION_MONTHS ?? '3', 10);

export async function syncPlayerMatches(
  db: PrismaClient,
  predggPlayerId: string,
  limit = 20,
): Promise<number> {
  const data = await gql<{
    player: { matchesPaginated: { nodes: { uuid: string }[] } } | null;
  }>(PLAYER_MATCHES_QUERY, { playerId: predggPlayerId, limit, offset: 0 });

  if (!data.player) return 0;

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - DATA_RETENTION_MONTHS);

  let synced = 0;
  for (const node of data.player.matchesPaginated.nodes) {
    try {
      const matchId = await syncMatch(db, node.uuid);
      if (matchId === null) continue;

      // Matches come ordered by recency — once we hit one older than the cutoff, stop.
      const match = await db.match.findUnique({ where: { id: matchId }, select: { startTime: true } });
      if (match && match.startTime < cutoff) break;

      synced++;
    } catch (err) {
      await db.syncLog.create({
        data: {
          entity: 'match',
          entityId: node.uuid,
          operation: 'upsert',
          status: 'error',
          error: String(err),
        },
      });
    }
  }

  return synced;
}
