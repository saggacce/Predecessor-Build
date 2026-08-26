import { Router } from 'express';
import { db } from '../db.js';
import { logger } from '../logger.js';
import { requireAuth } from '../middleware/require-auth.js';
import { getPlatformAccessToken } from '../services/predgg-token-service.js';
import {
  getPlayerMatchEnrichmentStatus,
  startPlayerMatchEnrichment,
} from '../services/player-match-enrichment-service.js';
import { syncRecentMatchesForPlayer } from '../services/sync-service.js';
import type { SessionUser } from '../middleware/require-auth.js';

export const syncRouter = Router();

const RATE_LIMIT_MS = 5 * 60 * 1000;
const MAX_MATCHES_PER_SYNC = 1000;
const userLastSync = new Map<string, number>();

async function findLinkedPlayer(user: SessionUser) {
  const account = await db.user.findUnique({
    where: { id: user.userId },
    select: { linkedPlayerId: true },
  });
  const playerId = account?.linkedPlayerId ?? user.memberships.find((membership) => membership.playerId)?.playerId;
  if (!playerId) return null;

  const player = await db.player.findUnique({
    where: { id: playerId },
    select: { id: true, predggId: true, displayName: true },
  });
  return player ? { ...player, playerId } : null;
}

/** GET /sync/my-matches/coverage — quality and enrichment status for the personal coach sample. */
syncRouter.get('/my-matches/coverage', requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as SessionUser;
    const player = await findLinkedPlayer(user);
    if (!player) {
      res.status(400).json({ error: { message: 'No player linked to your account.', code: 'NO_PLAYER_LINKED' } });
      return;
    }

    res.json(await getPlayerMatchEnrichmentStatus(db, player.playerId));
  } catch (err) {
    next(err);
  }
});

/** POST /sync/my-matches/enrich — starts/reuses a personal background enrichment job. */
syncRouter.post('/my-matches/enrich', requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as SessionUser;
    const player = await findLinkedPlayer(user);
    if (!player) {
      res.status(400).json({ error: { message: 'No player linked to your account.', code: 'NO_PLAYER_LINKED' } });
      return;
    }

    const platformToken = await getPlatformAccessToken();
    if (!platformToken) {
      res.status(503).json({ error: { message: 'Could not connect to pred.gg. Contact your admin.', code: 'PREDGG_TOKEN_ERROR' } });
      return;
    }

    const status = await startPlayerMatchEnrichment(db, player.playerId, platformToken.accessToken, {
      retryFailed: req.body?.retryFailed === true,
      userName: player.displayName,
    });
    res.status(status.job?.running ? 202 : 200).json(status);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /sync/my-matches
 * Syncs recent matches for the authenticated user's linked player.
 * Rate-limited to 1 request per 5 minutes per user.
 */
syncRouter.post('/my-matches', requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as SessionUser;
    const userId = user.userId;

    const lastSync = userLastSync.get(userId) ?? 0;
    if (Date.now() - lastSync < RATE_LIMIT_MS) {
      const retryAfterSeconds = Math.ceil((lastSync + RATE_LIMIT_MS - Date.now()) / 1000);
      res.status(429).json({
        error: {
          message: `Too many requests. Try again in ${retryAfterSeconds} seconds`,
          code: 'RATE_LIMITED',
          retryAfterSeconds,
        },
      });
      return;
    }

    const player = await findLinkedPlayer(user);
    if (!player) {
      res.status(400).json({ error: { message: 'No player linked to your account.', code: 'NO_PLAYER_LINKED' } });
      return;
    }

    const platformToken = await getPlatformAccessToken();
    if (!platformToken) {
      res.status(503).json({ error: { message: 'Could not connect to pred.gg. Contact your admin.', code: 'PREDGG_TOKEN_ERROR' } });
      return;
    }

    const result = await syncRecentMatchesForPlayer(
      db,
      player.predggId,
      platformToken.accessToken,
      MAX_MATCHES_PER_SYNC,
    );
    const enrichment = await startPlayerMatchEnrichment(db, player.playerId, platformToken.accessToken, {
      userName: player.displayName,
    });
    userLastSync.set(userId, Date.now());

    logger.info({ userId, predggId: player.predggId, ...result }, 'user-triggered match sync complete');
    await db.syncLog.create({
      data: { entity: 'sync:on-demand', entityId: player.predggId, operation: 'run', status: 'ok', source: 'user', userName: player.displayName },
    }).catch(() => null);

    res.json({
      newMatches: result.newMatches,
      syncedMatches: result.syncedMatches,
      enrichment,
      message: result.newMatches > 0
        ? `${result.newMatches} new match${result.newMatches === 1 ? '' : 'es'} synced`
        : 'Already up to date',
    });
  } catch (err) {
    next(err);
  }
});
