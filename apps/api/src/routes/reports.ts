import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { generateScrimReport } from '../services/report-service.js';
import { generatePlayerWeeklyReport } from '../services/player-weekly-report-service.js';
import { answerPlayerCoachQuestion } from '../services/player-coach-chat-service.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { db } from '../db.js';

export const reportsRouter = Router();
const coachChatLastRequest = new Map<string, number>();
const COACH_CHAT_RATE_LIMIT_MS = 10_000;

const coachChatSchema = z.object({
  question: z.string().trim().min(2).max(500),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(800),
  })).max(6).default([]),
});

async function canAccessPlayer(req: Request, playerId: string): Promise<boolean> {
  const user = req.user!;
  if (user.globalRole === 'PLATFORM_ADMIN' || user.globalRole === 'SUPER_ADMIN') return true;
  const account = await db.user.findUnique({
    where: { id: user.userId },
    select: { linkedPlayerId: true },
  });
  const membershipPlayerIds = user.memberships.map((membership) => membership.playerId).filter(Boolean);
  return account?.linkedPlayerId === playerId || membershipPlayerIds.includes(playerId);
}

function attachOwnTeamId(req: Request, _res: Response, next: NextFunction): void {
  if (req.body?.ownTeamId && !req.body.teamId) {
    req.body = { ...req.body, teamId: req.body.ownTeamId };
  }
  next();
}

/**
 * POST /reports/scrim
 * Body: { ownTeamId: string, rivalTeamId: string }
 * Generate a pre-scrim intelligence report.
 */
reportsRouter.post('/scrim', requireAuth, attachOwnTeamId, requireRole(['COACH', 'ANALISTA', 'MANAGER']), async (req, res, next) => {
  try {
    const body = z.object({
      ownTeamId: z.string().min(1),
      rivalTeamId: z.string().min(1),
    }).parse(req.body);

    const report = await generateScrimReport(body.ownTeamId, body.rivalTeamId);
    res.json(report);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /reports/player-weekly/:playerId
 * Personal seven-day report compared with the trailing 30-day baseline.
 * A normal account can only request its own linked player; platform admins can
 * preview any player report for support and QA.
 */
reportsRouter.get('/player-weekly/:playerId', requireAuth, async (req, res, next) => {
  try {
    const playerId = z.string().min(1).parse(req.params.playerId);
    if (!await canAccessPlayer(req, playerId)) {
      res.status(403).json({ error: { message: 'You can only view your own weekly report', code: 'FORBIDDEN' } });
      return;
    }

    res.json(await generatePlayerWeeklyReport(playerId));
  } catch (err) {
    next(err);
  }
});

/** POST /reports/player-coach/:playerId/chat — evidence-grounded personal coach conversation. */
reportsRouter.post('/player-coach/:playerId/chat', requireAuth, async (req, res, next) => {
  try {
    const playerId = z.string().min(1).parse(req.params.playerId);
    if (!await canAccessPlayer(req, playerId)) {
      res.status(403).json({ error: { message: 'You can only use the coach for your own linked player', code: 'FORBIDDEN' } });
      return;
    }

    const now = Date.now();
    const lastRequest = coachChatLastRequest.get(req.user!.userId) ?? 0;
    if (now - lastRequest < COACH_CHAT_RATE_LIMIT_MS) {
      const retryAfterSeconds = Math.ceil((lastRequest + COACH_CHAT_RATE_LIMIT_MS - now) / 1000);
      res.status(429).json({ error: { message: `Espera ${retryAfterSeconds} segundos antes de volver a preguntar.`, code: 'RATE_LIMITED', retryAfterSeconds } });
      return;
    }

    const body = coachChatSchema.parse(req.body);
    coachChatLastRequest.set(req.user!.userId, now);
    res.json(await answerPlayerCoachQuestion(playerId, req.user!.userId, body.question, body.history));
  } catch (err) {
    next(err);
  }
});
