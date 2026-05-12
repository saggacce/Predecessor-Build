import { Router } from 'express';
import { db } from '../db.js';
import { logger } from '../logger.js';
import { requireAuth } from '../middleware/require-auth.js';
import { exchangeToken } from './auth.js';
import { syncRecentMatchesForPlayer } from '../services/sync-service.js';
import type { SessionUser } from '../middleware/require-auth.js';

export const syncRouter = Router();

const RATE_LIMIT_MS = 5 * 60 * 1000;
const userLastSync = new Map<string, number>();

/**
 * POST /sync/my-matches
 * Syncs recent matches for the authenticated user's linked player.
 * Rate-limited to 1 request per 5 minutes per user.
 */
syncRouter.post('/my-matches', requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as SessionUser;
    const userId = user.userId;
    const memberships = user.memberships;

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

    const playerId = memberships.find((m) => m.playerId)?.playerId;
    if (!playerId) {
      res.status(400).json({ error: { message: 'No player linked to your account. Contact your manager.', code: 'NO_PLAYER_LINKED' } });
      return;
    }

    const player = await db.player.findUnique({ where: { id: playerId }, select: { predggId: true, displayName: true } });
    if (!player) {
      res.status(404).json({ error: { message: 'Player not found', code: 'PLAYER_NOT_FOUND' } });
      return;
    }

    const cred = await db.platformCredential.findUnique({ where: { key: 'predgg_refresh_token' } });
    if (!cred) {
      res.status(503).json({ error: { message: 'Platform sync not configured. Contact your admin.', code: 'PLATFORM_CRED_NOT_CONFIGURED' } });
      return;
    }

    const tokenResult = await exchangeToken({ grant_type: 'refresh_token', refresh_token: cred.value });
    if (!tokenResult.ok || !tokenResult.data.access_token) {
      res.status(503).json({ error: { message: 'Could not connect to pred.gg. Contact your admin.', code: 'PREDGG_TOKEN_ERROR' } });
      return;
    }

    userLastSync.set(userId, Date.now());

    const result = await syncRecentMatchesForPlayer(db, player.predggId, tokenResult.data.access_token, 20);

    logger.info({ userId, predggId: player.predggId, ...result }, 'user-triggered match sync complete');

    res.json({
      newMatches: result.newMatches,
      message: result.newMatches > 0
        ? `${result.newMatches} new match${result.newMatches === 1 ? '' : 'es'} synced`
        : 'Already up to date',
    });
  } catch (err) {
    next(err);
  }
});
