import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db.js';
import { logger } from '../logger.js';
import {
  repairEventStreamPlayerIds,
  syncVersionsFromPredgg,
  syncStalePlayers,
  syncIncompleteMatches,
  syncRecentMatchesForPlayer,
  syncMatchEventStream,
  resyncMatch,
  cleanupOldData,
} from '../services/sync-service.js';
import { syncHeroMeta } from '../services/hero-meta-service.js';
import { invalidateHeroMetaCache } from './hero-meta.js';
import { getAllConfig, updateConfigValue, resetConfigValue } from '../services/config-service.js';
import { getValidToken, exchangeToken, COOKIE_REFRESH } from './auth.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requirePlatformAdmin } from '../middleware/require-platform-admin.js';

export const adminRouter = Router();

/**
 * Returns a valid pred.gg Bearer token — user OAuth session first,
 * then falls back to stored platform refresh token.
 */
async function getTokenForSync(req: Request, res: Response): Promise<string | null> {
  const userToken = await getValidToken(req, res);
  if (userToken) return userToken;

  try {
    const cred = await db.platformCredential.findUnique({ where: { key: 'predgg_refresh_token' } });
    if (!cred) return null;
    const result = await exchangeToken({ grant_type: 'refresh_token', refresh_token: cred.value });
    if (!result.ok || !result.data.access_token) return null;
    return result.data.access_token;
  } catch {
    return null;
  }
}

function requireAdminKey(req: Request, res: Response, next: NextFunction) {
  const key = process.env.ADMIN_API_KEY;
  if (!key) return next();
  if (req.headers['x-admin-key'] !== key) {
    res.status(401).json({ error: { message: 'Unauthorized', code: 'ADMIN_KEY_REQUIRED' } });
    return;
  }
  next();
}

adminRouter.use(requireAdminKey);
adminRouter.use(requireAuth, requirePlatformAdmin);

/**
 * POST /admin/sync-versions
 * Fetches all game versions from pred.gg and upserts into local DB.
 */
adminRouter.post('/sync-versions', async (_req, res, next) => {
  try {
    const start = Date.now();
    logger.info('admin: sync-versions started');
    const count = await syncVersionsFromPredgg(db);
    const elapsed = Date.now() - start;
    logger.info({ count, elapsed }, 'admin: sync-versions complete');
    res.json({ synced: count, elapsed, timestamp: new Date() });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /admin/sync-stale
 * Re-syncs all players whose data is older than 1 hour.
 */
adminRouter.post('/sync-stale', async (req, res, next) => {
  try {
    const start = Date.now();
    const userToken = await getTokenForSync(req, res);
    if (!userToken) {
      logger.warn('sync-stale called without user token — player queries will fail (login required)');
    }
    logger.info({ hasToken: !!userToken }, 'admin: sync-stale started');
    const result = await syncStalePlayers(db, userToken);
    const elapsed = Date.now() - start;
    logger.info({ ...result, elapsed }, 'admin: sync-stale complete');
    res.json({ ...result, elapsed, timestamp: new Date() });
  } catch (err) {
    next(err);
  }
});

const logsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).default(50),
  entity: z.string().optional(),
  status: z.string().optional(),
});

/**
 * POST /admin/sync-stale-all
 * Syncs ALL stale players in batches of 30 with 2s delays between batches.
 * Long-running — streams progress via SSE or just returns when done.
 */
adminRouter.post('/sync-stale-all', requireAuth, requirePlatformAdmin, async (req, res, next) => {
  try {
    const userToken = await getTokenForSync(req, res);
    if (!userToken) {
      res.status(400).json({ error: { message: 'pred.gg session required', code: 'NO_TOKEN' } });
      return;
    }

    const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const totalStale = await db.player.count({
      where: { lastSynced: { lt: staleThreshold }, displayName: { not: 'HIDDEN' } },
    });

    let totalSynced = 0;
    let totalErrors = 0;
    let batches = 0;

    while (true) {
      const result = await syncStalePlayers(db, userToken);
      totalSynced += result.synced;
      totalErrors += result.errors;
      batches++;
      if (result.synced === 0 && result.skipped === 0) break; // no more stale
      if (batches > 2000) break; // safety cap
      await new Promise((resolve) => setTimeout(resolve, 1500)); // 1.5s between batches
    }

    await db.syncLog.create({
      data: {
        entity: 'player', entityId: 'all-stale',
        operation: 'sync-stale-all', status: totalErrors > 0 ? 'partial' : 'ok',
        error: totalErrors > 0 ? `${totalErrors} errors` : null,
        source: 'admin',
      },
    });

    res.json({ ok: true, totalStale, totalSynced, totalErrors, batches });
  } catch (err) { next(err); }
});


/**
 * POST /admin/sync-incomplete-matches
 * Re-fetches all matches that have fewer than 10 MatchPlayers.
 */
adminRouter.post('/sync-incomplete-matches', async (_req, res, next) => {
  try {
    const start = Date.now();
    logger.info('admin: sync-incomplete-matches started');
    const result = await syncIncompleteMatches(db);
    const elapsed = Date.now() - start;
    logger.info({ ...result, elapsed }, 'admin: sync-incomplete-matches complete');
    res.json({ ...result, elapsed, timestamp: new Date() });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /admin/fix-herokill-player-ids
 * Converts event-stream pred.gg player IDs into internal Player.id references.
 */
adminRouter.post('/fix-herokill-player-ids', async (_req, res, next) => {
  try {
    const start = Date.now();
    logger.info('admin: fix-herokill-player-ids started');
    const result = await repairEventStreamPlayerIds(db);
    const elapsed = Date.now() - start;
    logger.info({ ...result, elapsed }, 'admin: fix-herokill-player-ids complete');
    res.json({ ...result, elapsed, timestamp: new Date() });
  } catch (err) {
    next(err);
  }
});

// ── Global auto-sync cron ─────────────────────────────────────────────────────

interface CronJob {
  enabled: boolean;
  running: boolean;
  lastRunAt: string | null;
  lastRunResult: { newMatches: number; players: number; errors: number } | null;
  nextRunAt: string | null;
}

let cronJob: CronJob = {
  enabled: false, running: false, lastRunAt: null, lastRunResult: null, nextRunAt: null,
};
let cronTimer: ReturnType<typeof setInterval> | null = null;
const CRON_INTERVAL_MS = parseInt(process.env.SYNC_CRON_INTERVAL_MS ?? String(2 * 60 * 60 * 1000), 10);

async function runGlobalSync(): Promise<void> {
  if (cronJob.running) return;
  cronJob.running = true;
  cronJob.lastRunAt = new Date().toISOString();
  logger.info({ intervalMs: CRON_INTERVAL_MS }, 'global sync cron: run started');

  try {
    const cred = await db.platformCredential.findUnique({ where: { key: 'predgg_refresh_token' } });
    if (!cred) {
      logger.warn('global sync cron: no platform credential stored — skipping');
      return;
    }

    const tokenResult = await exchangeToken({ grant_type: 'refresh_token', refresh_token: cred.value });
    if (!tokenResult.ok || !tokenResult.data.access_token) {
      logger.warn({ error: tokenResult.data.error }, 'global sync cron: token refresh failed — skipping');
      await db.syncLog.create({
        data: { entity: 'sync:cron', entityId: 'global', operation: 'run', status: 'error', error: 'token refresh failed — re-inicia el Event Stream Sync para renovar' },
      }).catch(() => null);
      return;
    }
    const token = tokenResult.data.access_token;

    const players = await db.player.findMany({
      where: { displayName: { not: 'HIDDEN' }, predggId: { not: '' } },
      select: { predggId: true, displayName: true },
    });

    let totalNewMatches = 0;
    let eventStreamSynced = 0;
    let errors = 0;
    const canSyncEventStream = !eventStreamJob.running;

    if (!canSyncEventStream) {
      logger.info('global sync cron: event stream sync is running — skipping event stream for new matches');
    }

    for (const player of players) {
      try {
        const result = await syncRecentMatchesForPlayer(db, player.predggId, token, 10);
        totalNewMatches += result.newMatches;

        // Sync event stream for newly discovered matches (only if event stream sync is not running)
        if (canSyncEventStream && result.newMatchUuids.length > 0) {
          for (const uuid of result.newMatchUuids) {
            const match = await db.match.findUnique({ where: { predggUuid: uuid }, select: { id: true } });
            if (!match) continue;
            try {
              await syncMatchEventStream(db, match.id, uuid, token);
              eventStreamSynced++;
            } catch (err) {
              logger.warn({ uuid, err }, 'global sync cron: event stream sync failed for new match');
            }
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (err) {
        logger.warn({ predggId: player.predggId, err }, 'global sync cron: failed to sync player');
        errors++;
      }
    }

    const result = { newMatches: totalNewMatches, eventStreamSynced, players: players.length, errors };
    cronJob.lastRunResult = result;
    logger.info(result, 'global sync cron: run complete');
    await db.syncLog.create({
      data: {
        entity: 'sync:cron',
        entityId: 'global',
        operation: 'run',
        status: errors > 0 ? 'partial' : 'ok',
        error: errors > 0 ? `${errors} jugadores fallaron` : null,
        source: 'cron',
      },
    }).catch((err) => logger.warn({ err }, 'failed to write cron sync log'));
  } finally {
    cronJob.running = false;
    if (cronJob.enabled) {
      cronJob.nextRunAt = new Date(Date.now() + CRON_INTERVAL_MS).toISOString();
    }
  }
}

function startGlobalCron(): void {
  if (cronTimer) clearInterval(cronTimer);
  cronJob.enabled = true;
  cronJob.nextRunAt = new Date(Date.now() + CRON_INTERVAL_MS).toISOString();
  cronTimer = setInterval(() => { void runGlobalSync(); }, CRON_INTERVAL_MS);
  logger.info({ intervalMs: CRON_INTERVAL_MS }, 'global sync cron started');
}

function stopGlobalCron(): void {
  if (cronTimer) { clearInterval(cronTimer); cronTimer = null; }
  cronJob.enabled = false;
  cronJob.nextRunAt = null;
  logger.info('global sync cron stopped');
}

adminRouter.post('/sync-cron/start', (_req, res) => {
  startGlobalCron();
  res.json({ ok: true, cron: cronJob });
});

adminRouter.post('/sync-cron/stop', (_req, res) => {
  stopGlobalCron();
  res.json({ ok: true, cron: cronJob });
});

adminRouter.post('/sync-cron/run-now', async (_req, res, next) => {
  try {
    void runGlobalSync();
    res.json({ ok: true, message: 'Manual sync triggered' });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/sync-cron/status', (_req, res) => {
  res.json(cronJob);
});

/**
 * GET /admin/sync-status
 * Returns player and match sync statistics for the admin dashboard.
 */
adminRouter.get('/sync-status', async (_req, res, next) => {
  try {
    const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      totalPlayers,
      stalePlayers,
      hiddenPlayers,
      totalMatches,
      matchesWithStream,
      noPlayersResult,
    ] = await Promise.all([
      db.player.count(),
      db.player.count({ where: { lastSynced: { lt: staleThreshold }, displayName: { not: 'HIDDEN' } } }),
      db.player.count({ where: { displayName: 'HIDDEN' } }),
      db.match.count(),
      db.match.count({ where: { eventStreamSynced: true } }),
      db.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint AS count FROM "Match" m
        WHERE NOT EXISTS (SELECT 1 FROM "MatchPlayer" mp WHERE mp."matchId" = m.id)
      `,
    ]);
    const matchesNoPlayers = Number(noPlayersResult[0]?.count ?? 0);

    const matchesWithPlayers = totalMatches - matchesNoPlayers;
    const matchesFailed = await db.match.count({ where: { eventStreamFailed: true } });
    const matchesPartial = Math.max(0, matchesWithPlayers - matchesWithStream - matchesFailed);

    res.json({
      players: {
        total: totalPlayers,
        synced: totalPlayers - stalePlayers - hiddenPlayers,
        stale: stalePlayers,
        hidden: hiddenPlayers,
      },
      matches: {
        total: totalMatches,
        complete: matchesWithStream,
        partial: matchesPartial,
        failed: matchesFailed,
        incomplete: matchesNoPlayers,
      },
      eventStreamJob: eventStreamJob,
      cronJob: cronJob,
    });
  } catch (err) {
    next(err);
  }
});

// ── Background event stream sync job ─────────────────────────────────────────

interface EventStreamJob {
  running: boolean;
  total: number;
  synced: number;
  errors: number;
  skipped: number;
  startedAt: string | null;
  lastActivity: string | null;
  tokenError: boolean;
}

let eventStreamJob: EventStreamJob = {
  running: false, total: 0, synced: 0, errors: 0, skipped: 0,
  startedAt: null, lastActivity: null, tokenError: false,
};

async function refreshPredggToken(refreshToken: string): Promise<string | null> {
  const result = await exchangeToken({ grant_type: 'refresh_token', refresh_token: refreshToken });
  if (result.ok && result.data.access_token) {
    logger.info('event stream sync: pred.gg token refreshed successfully');
    return result.data.access_token;
  }
  logger.warn({ error: result.data.error }, 'event stream sync: token refresh failed');
  return null;
}

async function runEventStreamSync(userToken: string, predggRefreshToken: string | undefined) {
  const BATCH = 20;
  const CONCURRENCY = 3;
  // Refresh token every 50 minutes (pred.gg tokens last ~1h)
  const TOKEN_REFRESH_INTERVAL_MS = 50 * 60 * 1000;

  const total = await db.match.count({ where: { eventStreamSynced: false, eventStreamFailed: false, matchPlayers: { some: {} } } });
  eventStreamJob = { running: true, total, synced: 0, errors: 0, skipped: 0, startedAt: new Date().toISOString(), lastActivity: new Date().toISOString(), tokenError: false };

  logger.info({ total }, 'event stream background sync started');

  let activeToken = userToken;
  let lastTokenRefresh = Date.now();
  let consecutiveErrors = 0;
  let tokenRefreshAttempts = 0;
  const MAX_TOKEN_REFRESH_ATTEMPTS = 3;

  while (eventStreamJob.running) {
    // Refresh token proactively every 50 min
    if (predggRefreshToken && Date.now() - lastTokenRefresh > TOKEN_REFRESH_INTERVAL_MS) {
      const newToken = await refreshPredggToken(predggRefreshToken);
      if (newToken) {
        activeToken = newToken;
        lastTokenRefresh = Date.now();
        consecutiveErrors = 0;
        tokenRefreshAttempts = 0;
      } else {
        logger.warn('event stream sync: could not refresh token, continuing with existing');
      }
    }

    const pending = await db.match.findMany({
      where: { eventStreamSynced: false, eventStreamFailed: false, matchPlayers: { some: {} } },
      select: { id: true, predggUuid: true },
      orderBy: { startTime: 'desc' },
      take: BATCH,
    });

    if (pending.length === 0) {
      eventStreamJob.running = false;
      logger.info(eventStreamJob, 'event stream background sync complete');
      break;
    }

    let batchSynced = 0;
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      if (!eventStreamJob.running) break;
      const chunk = pending.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map((m) => syncMatchEventStream(db, m.id, m.predggUuid, activeToken))
      );
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === 'fulfilled') {
          eventStreamJob.synced++;
          batchSynced++;
        } else {
          const errMsg = r.reason instanceof Error ? r.reason.message : String(r.reason);
          const isNotFound = errMsg.includes('not found');
          logger.warn({ uuid: chunk[j].predggUuid, error: errMsg }, 'event stream: match sync failed');
          if (isNotFound) {
            eventStreamJob.skipped++;
          } else {
            eventStreamJob.errors++;
          }
          // Log to SyncLog for audit trail
          await db.syncLog.create({
            data: { entity: 'match', entityId: chunk[j].predggUuid, operation: 'event-stream', status: 'error', error: errMsg.slice(0, 500), source: 'event-stream' },
          }).catch(() => null);
        }
      }
      eventStreamJob.lastActivity = new Date().toISOString();
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    // If the entire batch failed, the token is likely expired
    if (batchSynced === 0 && pending.length > 0) {
      consecutiveErrors++;
      if (consecutiveErrors >= 3) {
        // Try emergency token refresh
        if (predggRefreshToken && tokenRefreshAttempts < MAX_TOKEN_REFRESH_ATTEMPTS) {
          logger.warn({ tokenRefreshAttempts }, 'event stream sync: 3 consecutive empty batches — refreshing token');
          const newToken = await refreshPredggToken(predggRefreshToken);
          tokenRefreshAttempts++;
          if (newToken) {
            activeToken = newToken;
            lastTokenRefresh = Date.now();
            consecutiveErrors = 0;
          } else {
            logger.error('event stream sync: token expired and refresh failed — stopping');
            eventStreamJob.running = false;
            eventStreamJob.tokenError = true;
            break;
          }
        } else {
          logger.error({ tokenRefreshAttempts }, 'event stream sync: max token refresh attempts reached or no refresh token — stopping');
          eventStreamJob.running = false;
          eventStreamJob.tokenError = true;
          break;
        }
      }
    } else {
      consecutiveErrors = 0;
    }
  }
}

/**
 * POST /admin/sync-event-streams/start
 * Starts a background job that syncs event streams for all unsynced matches.
 * Requires active pred.gg session (Bearer token from cookies).
 */
adminRouter.post('/sync-event-streams/start', async (req, res, next) => {
  try {
    if (eventStreamJob.running) {
      res.json({ ok: true, message: 'Already running', job: eventStreamJob });
      return;
    }
    const userToken = await getTokenForSync(req, res);
    if (!userToken) {
      res.status(400).json({ error: { message: 'pred.gg session required — log in via pred.gg first', code: 'PREDGG_AUTH_REQUIRED' } });
      return;
    }
    // Capture refresh token so the background job can renew the Bearer token automatically
    const predggRefreshToken = (req as any).cookies?.[COOKIE_REFRESH] as string | undefined;
    // Persist refresh token as platform credential for cron and on-demand sync
    if (predggRefreshToken) {
      await db.platformCredential.upsert({
        where: { key: 'predgg_refresh_token' },
        update: { value: predggRefreshToken },
        create: { key: 'predgg_refresh_token', value: predggRefreshToken },
      }).catch((err) => logger.warn({ err }, 'failed to save platform credential'));
    }
    // Fire and forget — runs in background
    void runEventStreamSync(userToken, predggRefreshToken).catch((err) => {
      logger.error({ err }, 'event stream background sync crashed');
      eventStreamJob.running = false;
    });
    res.json({ ok: true, message: 'Background sync started', job: eventStreamJob });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /admin/sync-event-streams/stop
 */
adminRouter.post('/sync-event-streams/stop', async (_req, res) => {
  eventStreamJob.running = false;
  res.json({ ok: true, job: eventStreamJob });
});

/**
 * GET /admin/sync-event-streams/status
 */
adminRouter.get('/sync-event-streams/status', async (_req, res) => {
  res.json(eventStreamJob);
});

/**
 * GET /admin/sync-logs?limit=50&entity=player&status=error&source=cron
 */
const logsQuerySchemaFull = logsQuerySchema.extend({ source: z.string().optional() });

// Map source filter to entity patterns for logs that predate the source field
function sourceToEntityFilter(source: string): object {
  const map: Record<string, string> = {
    'cron': 'sync:cron',
    'user': 'sync:on-demand',
  };
  if (map[source]) {
    return { OR: [{ source }, { entity: map[source] }] };
  }
  if (source === 'event-stream') {
    return { OR: [{ source }, { entity: 'match', operation: 'event-stream' }] };
  }
  if (source === 'admin') {
    return { OR: [{ source }, { entity: { in: ['player', 'match', 'version', 'Invitation'] }, source: null }] };
  }
  return { source };
}

adminRouter.get('/sync-logs', async (req, res, next) => {
  try {
    const { limit, entity, status, source } = logsQuerySchemaFull.parse(req.query);
    const where = {
      ...(entity && { entity }),
      ...(status && { status }),
      ...(source && sourceToEntityFilter(source)),
    };
    const [total, logs] = await Promise.all([
      db.syncLog.count({ where }),
      db.syncLog.findMany({ where, orderBy: { syncedAt: 'desc' }, take: limit }),
    ]);
    res.json({ logs, total });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /admin/users — list all platform users with memberships
 */
adminRouter.get('/users', async (_req, res, next) => {
  try {
    const users = await db.user.findMany({
      include: {
        memberships: { include: { team: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ users });
  } catch (err) { next(err); }
});

/**
 * PATCH /admin/users/:id — update user fields (name, email, globalRole, isActive, tier)
 */
adminRouter.patch('/users/:id', async (req, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(2).max(60).optional(),
      email: z.string().email().optional(),
      isActive: z.boolean().optional(),
      globalRole: z.enum(['PLATFORM_ADMIN', 'VIEWER']).optional(),
      playerTier: z.enum(['FREE', 'PRO', 'PREMIUM']).optional(),
      playerTierExpiresAt: z.string().datetime().optional().nullable(),
    }).parse(req.body);

    const user = await db.user.update({
      where: { id: req.params.id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.email && { email: body.email }),
        ...(typeof body.isActive === 'boolean' && { isActive: body.isActive }),
        ...(body.globalRole && { globalRole: body.globalRole }),
        ...(body.playerTier && { playerTier: body.playerTier }),
        ...(body.playerTierExpiresAt !== undefined && { playerTierExpiresAt: body.playerTierExpiresAt ? new Date(body.playerTierExpiresAt) : null }),
      },
      include: { memberships: { include: { team: { select: { id: true, name: true, teamTier: true } } } } },
    });
    res.json({ user });
  } catch (err) { next(err); }
});

/**
 * GET /admin/api-status — pred.gg connectivity + sync error stats
 */
adminRouter.get('/api-status', async (_req, res, next) => {
  try {
    const GQL_URL = process.env.PRED_GG_GQL_URL ?? 'https://pred.gg/gql';
    const pingStart = Date.now();
    let predggStatus: 'ok' | 'error' = 'error';
    let predggMs: number | null = null;
    let predggError: string | null = null;
    try {
      const r = await fetch(GQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '{ versions { id } }' }),
        signal: AbortSignal.timeout(5000),
      });
      predggMs = Date.now() - pingStart;
      predggStatus = r.ok ? 'ok' : 'error';
      if (!r.ok) predggError = `HTTP ${r.status}`;
    } catch (err) {
      predggMs = Date.now() - pingStart;
      predggError = err instanceof Error ? err.message : 'Connection failed';
    }

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [totalErrors, recentErrors, lastSuccess, recentBySource] = await Promise.all([
      db.syncLog.count({ where: { status: 'error' } }),
      db.syncLog.count({ where: { status: 'error', syncedAt: { gte: dayAgo } } }),
      db.syncLog.findFirst({ where: { status: { in: ['ok', 'success'] } }, orderBy: { syncedAt: 'desc' }, select: { syncedAt: true, entity: true, source: true } }),
      db.syncLog.groupBy({ by: ['source'], where: { status: 'error', syncedAt: { gte: dayAgo } }, _count: { id: true } }),
    ]);

    res.json({
      predgg: { status: predggStatus, responseMs: predggMs, error: predggError, endpoint: GQL_URL },
      syncErrors: { total: totalErrors, last24h: recentErrors, bySource: recentBySource },
      lastSuccessfulSync: lastSuccess,
    });
  } catch (err) { next(err); }
});

/**
 * POST /admin/sync-heroes
 * Fetch all heroes from omeda.city and upsert into HeroMeta table.
 */
adminRouter.post('/sync-heroes', requireAuth, requirePlatformAdmin, async (_req, res, next) => {
  try {
    const result = await syncHeroMeta(db);
    invalidateHeroMetaCache();
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /admin/config
 * Returns all platform config entries.
 */
adminRouter.get('/config', requireAuth, requirePlatformAdmin, async (_req, res, next) => {
  try {
    const config = await getAllConfig(db);
    res.json({ config });
  } catch (err) { next(err); }
});

/**
 * PATCH /admin/config/:key
 * Update a single config value.
 */
adminRouter.patch('/config/:key', requireAuth, requirePlatformAdmin, async (req, res, next) => {
  try {
    const { value } = z.object({ value: z.number() }).parse(req.body);
    const userId = (req as { user?: { id: string } }).user?.id ?? 'unknown';
    const updated = await updateConfigValue(db, req.params.key, value, userId);
    res.json({ config: updated });
  } catch (err) { next(err); }
});

/**
 * POST /admin/config/:key/reset
 * Reset a single config value to its default.
 */
adminRouter.post('/config/:key/reset', requireAuth, requirePlatformAdmin, async (req, res, next) => {
  try {
    const userId = (req as { user?: { id: string } }).user?.id ?? 'unknown';
    const updated = await resetConfigValue(db, req.params.key, userId);
    res.json({ config: updated });
  } catch (err) { next(err); }
});

/**
 * PATCH /admin/teams/:id/tier — update a team's tier (PLATFORM_ADMIN only)
 */
adminRouter.patch('/teams/:id/tier', async (req, res, next) => {
  try {
    const body = z.object({
      teamTier: z.enum(['FREE', 'PRO', 'TEAM', 'ENTERPRISE']),
      teamTierExpiresAt: z.string().datetime().optional().nullable(),
    }).parse(req.body);

    const team = await db.team.update({
      where: { id: req.params.id },
      data: {
        teamTier: body.teamTier,
        ...(body.teamTierExpiresAt !== undefined && {
          teamTierExpiresAt: body.teamTierExpiresAt ? new Date(body.teamTierExpiresAt) : null,
        }),
      },
      select: { id: true, name: true, type: true, teamTier: true, teamTierExpiresAt: true },
    });
    res.json({ team });
  } catch (err) { next(err); }
});

/**
 * POST /admin/users/:id/reset-password
 * Admin sets a new password for any user.
 */
adminRouter.post('/users/:id/reset-password', async (req, res, next) => {
  try {
    const { newPassword } = z.object({
      newPassword: z.string().min(8, 'Minimum 8 characters'),
    }).parse(req.body);

    const hash = await bcrypt.hash(newPassword, 12);
    await db.user.update({
      where: { id: req.params.id },
      data: { passwordHash: hash },
    });

    logger.info({ targetUserId: req.params.id }, 'admin: password reset');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/**
 * POST /admin/cleanup-old-data
 * Deletes data older than DATA_RETENTION_MONTHS (default 3).
 * Also triggered automatically by the monthly cron.
 */
adminRouter.post('/cleanup-old-data', async (_req, res, next) => {
  try {
    const result = await cleanupOldData(db);
    res.json({ ok: true, result });
  } catch (err) { next(err); }
});
