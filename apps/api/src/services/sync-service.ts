/**
 * Sync service — calls pred.gg GraphQL directly and persists to the local DB.
 * No child processes. No external CLI. Called directly from API route handlers.
 */
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/error-handler.js';
import { logger } from '../logger.js';

const GQL_URL = process.env.PRED_GG_GQL_URL ?? 'https://pred.gg/gql';
const API_KEY = process.env.PRED_GG_CLIENT_SECRET;
const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

async function predggQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_KEY) headers['X-Api-Key'] = API_KEY;

  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) throw new Error(`pred.gg HTTP ${res.status}: ${await res.text()}`);

  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join(', '));
  return json.data as T;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface SyncedPlayer {
  id: string;
  predggId: string;
  displayName: string;
  isPrivate: boolean;
  inferredRegion: string | null;
  lastSynced: Date;
}

export interface SyncResult {
  synced: number;
  skipped: number;
  errors: number;
}

// ── Player sync ───────────────────────────────────────────────────────────────

interface PredggPlayerResult {
  id: string;
  uuid: string;
  name: string;
  blockSearch: boolean;
}

const PLAYER_SEARCH_QUERY = `
  query SearchPlayer($name: String!) {
    playersPaginated(filter: { search: $name }, limit: 1) {
      results { id uuid name blockSearch }
    }
  }
`;

/**
 * Fetches a player by name from pred.gg and upserts into local DB.
 * Returns the synced player record, or null if not found on pred.gg.
 */
export async function syncPlayerByName(
  db: PrismaClient,
  name: string,
): Promise<SyncedPlayer | null> {
  const start = Date.now();
  logger.info({ name }, 'syncing player from pred.gg');

  let data: { playersPaginated: { results: PredggPlayerResult[] } };
  try {
    data = await predggQuery<{ playersPaginated: { results: PredggPlayerResult[] } }>(
      PLAYER_SEARCH_QUERY,
      { name },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // pred.gg requires user-level OAuth to search players by name.
    // Return a clear 503 so the UI can show a meaningful message.
    if (message === 'Forbidden') {
      logger.warn({ name }, 'pred.gg player search requires OAuth — not available server-side');
      await db.syncLog.create({
        data: { entity: 'player', entityId: name, operation: 'fetch', status: 'error', error: 'pred.gg auth required' },
      });
      throw new AppError(
        503,
        'pred.gg requires user authentication to search players. This feature will be available once OAuth login is implemented.',
        'PREDGG_AUTH_REQUIRED',
      );
    }
    logger.error({ name, err }, 'pred.gg query failed');
    await db.syncLog.create({
      data: { entity: 'player', entityId: name, operation: 'fetch', status: 'error', error: message },
    });
    throw err;
  }

  const p = data?.playersPaginated?.results?.[0];

  if (!p) {
    logger.info({ name, elapsed: Date.now() - start }, 'player not found on pred.gg');
    await db.syncLog.create({
      data: { entity: 'player', entityId: name, operation: 'fetch', status: 'skipped', error: 'not found' },
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

  // Create a snapshot so the profile endpoint has something to return
  await db.playerSnapshot.create({
    data: { playerId: player.id, syncedAt: now, generalStats: {}, heroStats: [], roleStats: [] },
  });

  await db.syncLog.create({
    data: { entity: 'player', entityId: p.id, operation: 'upsert', status: 'ok' },
  });

  logger.info({ name, playerId: player.id, elapsed: Date.now() - start }, 'player synced');

  return {
    id: player.id,
    predggId: p.id,
    displayName: p.name,
    isPrivate,
    inferredRegion: null,
    lastSynced: now,
  };
}

/**
 * Re-syncs all players whose lastSynced is older than STALE_THRESHOLD_MS.
 */
export async function syncStalePlayers(db: PrismaClient): Promise<SyncResult> {
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);
  const stalePlayers = await db.player.findMany({
    where: { lastSynced: { lt: staleThreshold } },
    select: { displayName: true },
  });

  const result: SyncResult = { synced: 0, skipped: 0, errors: 0 };

  for (const player of stalePlayers) {
    try {
      const synced = await syncPlayerByName(db, player.displayName);
      if (synced) result.synced++;
      else result.skipped++;
    } catch {
      result.errors++;
    }
  }

  logger.info(result, 'stale player sync complete');
  return result;
}

// ── Version sync ─────────────────────────────────────────────────────────────

interface PredggVersion {
  id: string;
  name: string;
  releaseDate: string;
  patchType: string;
}

const VERSIONS_QUERY = `{ versions { id name releaseDate patchType } }`;

/**
 * Fetches all game versions from pred.gg and upserts into local DB.
 */
export async function syncVersionsFromPredgg(db: PrismaClient): Promise<number> {
  const start = Date.now();
  logger.info('syncing versions from pred.gg');

  const data = await predggQuery<{ versions: PredggVersion[] }>(VERSIONS_QUERY);
  const now = new Date();
  let upserted = 0;

  for (const v of data.versions) {
    await db.version.upsert({
      where: { predggId: v.id },
      update: { name: v.name || 'Unknown', patchType: v.patchType || 'UNKNOWN', syncedAt: now },
      create: {
        predggId: v.id,
        name: v.name || 'Unknown',
        releaseDate: new Date(v.releaseDate),
        patchType: v.patchType || 'UNKNOWN',
        syncedAt: now,
      },
    });
    upserted++;
  }

  await db.syncLog.create({
    data: { entity: 'version', entityId: 'all', operation: 'upsert', status: 'ok' },
  });

  logger.info({ upserted, elapsed: Date.now() - start }, 'versions sync complete');
  return upserted;
}
