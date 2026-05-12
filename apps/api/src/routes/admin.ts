import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { logger } from '../logger.js';
import {
  repairEventStreamPlayerIds,
  syncVersionsFromPredgg,
  syncStalePlayers,
  syncIncompleteMatches,
  resyncMatch,
} from '../services/sync-service.js';
import { getValidToken, exchangeToken, COOKIE_REFRESH } from './auth.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requirePlatformAdmin } from '../middleware/require-platform-admin.js';

export const adminRouter = Router();

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
    const userToken = await getValidToken(req, res);
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
  status: z.enum(['ok', 'error', 'skipped']).optional(),
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
      matchesNoPlayers,
    ] = await Promise.all([
      db.player.count(),
      db.player.count({ where: { lastSynced: { lt: staleThreshold }, displayName: { not: 'HIDDEN' } } }),
      db.player.count({ where: { displayName: 'HIDDEN' } }),
      db.match.count(),
      db.match.count({ where: { eventStreamSynced: true } }),
      db.match.count({ where: { matchPlayers: { none: {} } } }),
    ]);

    const matchesWithPlayers = totalMatches - matchesNoPlayers;
    const matchesPartial = matchesWithPlayers - matchesWithStream;

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
        incomplete: matchesNoPlayers,
      },
      eventStreamJob: eventStreamJob,
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

  const total = await db.match.count({ where: { eventStreamSynced: false, matchPlayers: { some: {} } } });
  eventStreamJob = { running: true, total, synced: 0, errors: 0, skipped: 0, startedAt: new Date().toISOString(), lastActivity: new Date().toISOString(), tokenError: false };

  logger.info({ total }, 'event stream background sync started');

  let activeToken = userToken;
  let lastTokenRefresh = Date.now();
  let consecutiveErrors = 0;

  while (eventStreamJob.running) {
    // Refresh token proactively every 50 min
    if (predggRefreshToken && Date.now() - lastTokenRefresh > TOKEN_REFRESH_INTERVAL_MS) {
      const newToken = await refreshPredggToken(predggRefreshToken);
      if (newToken) {
        activeToken = newToken;
        lastTokenRefresh = Date.now();
        consecutiveErrors = 0;
      } else {
        logger.warn('event stream sync: could not refresh token, continuing with existing');
      }
    }

    const pending = await db.match.findMany({
      where: { eventStreamSynced: false, matchPlayers: { some: {} } },
      select: { predggUuid: true },
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
        chunk.map((m) => resyncMatch(db, m.predggUuid, activeToken, true))
      );
      for (const r of results) {
        if (r.status === 'fulfilled') { eventStreamJob.synced++; batchSynced++; }
        else eventStreamJob.errors++;
      }
      eventStreamJob.lastActivity = new Date().toISOString();
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    // If the entire batch failed, the token is likely expired
    if (batchSynced === 0 && pending.length > 0) {
      consecutiveErrors++;
      if (consecutiveErrors >= 3) {
        // Try emergency token refresh
        if (predggRefreshToken) {
          logger.warn('event stream sync: 3 consecutive empty batches — refreshing token');
          const newToken = await refreshPredggToken(predggRefreshToken);
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
          logger.error('event stream sync: token expired and no refresh token available — stopping');
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
    const userToken = await getValidToken(req, res);
    if (!userToken) {
      res.status(400).json({ error: { message: 'pred.gg session required — log in via pred.gg first', code: 'PREDGG_AUTH_REQUIRED' } });
      return;
    }
    // Capture refresh token so the background job can renew the Bearer token automatically
    const predggRefreshToken = (req as any).cookies?.[COOKIE_REFRESH] as string | undefined;
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
 * GET /admin/sync-logs?limit=50&entity=player&status=error
 */
adminRouter.get('/sync-logs', async (req, res, next) => {
  try {
    const { limit, entity, status } = logsQuerySchema.parse(req.query);
    const logs = await db.syncLog.findMany({
      where: {
        ...(entity && { entity }),
        ...(status && { status }),
      },
      orderBy: { syncedAt: 'desc' },
      take: limit,
    });
    res.json({ logs, total: logs.length });
  } catch (err) {
    next(err);
  }
});
