import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/require-auth.js';
import { tryCompleteMission } from '../services/missions-service.js';
import { evaluateWeeklyGoals } from '../services/weekly-goal-evaluation-service.js';

export const weeklyGoalsRouter = Router();

function currentWeekStart(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff));
  return monday;
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  metricKey: z.enum([
    'winrate', 'kda', 'cs_per_min', 'gpm', 'dpm', 'deaths_per_match',
    'wards_per_min', 'kill_participation', 'objective_damage_per_min',
    'structure_damage_per_min', 'custom',
  ]).default('custom'),
  targetValue: z.number().positive().optional(),
  playerId: z.string().optional(),
});

const updateSchema = z.object({
  currentValue: z.number().min(0).optional(),
  status: z.enum(['ACTIVE', 'ACHIEVED', 'FAILED']).optional(),
  title: z.string().min(1).max(200).optional(),
  targetValue: z.number().positive().optional().nullable(),
});

weeklyGoalsRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const weekStart = currentWeekStart();
    const goals = await db.weeklyGoal.findMany({
      where: { userId: req.user!.userId, weekStart },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ goals, weekStart });
  } catch (err) { next(err); }
});

weeklyGoalsRouter.get('/me/progress', requireAuth, async (req, res, next) => {
  try {
    const weekStart = currentWeekStart();
    const account = await db.user.findUnique({
      where: { id: req.user!.userId },
      select: { linkedPlayerId: true },
    });
    const playerId = account?.linkedPlayerId
      ?? req.user!.memberships.find((membership) => membership.playerId)?.playerId
      ?? null;
    const evaluations = await evaluateWeeklyGoals(db, req.user!.userId, playerId, weekStart);
    res.json({ evaluations, weekStart });
  } catch (err) { next(err); }
});

weeklyGoalsRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const weekStart = currentWeekStart();
    const goal = await db.weeklyGoal.create({
      data: {
        userId: req.user!.userId,
        playerId: data.playerId ?? null,
        title: data.title,
        metricKey: data.metricKey,
        targetValue: data.targetValue ?? null,
        weekStart,
      },
    });
    res.status(201).json({ goal });
    void tryCompleteMission(db, req.user!.userId, 'SET_WEEKLY_GOAL');
  } catch (err) { next(err); }
});

weeklyGoalsRouter.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const existing = await db.weeklyGoal.findUnique({ where: { id: String(req.params.id) } });
    if (!existing || existing.userId !== req.user!.userId) {
      res.status(404).json({ error: { message: 'Goal not found', code: 'NOT_FOUND' } }); return;
    }
    const goal = await db.weeklyGoal.update({
      where: { id: String(req.params.id) },
      data: {
        ...(data.currentValue !== undefined && { currentValue: data.currentValue }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.targetValue !== undefined && { targetValue: data.targetValue }),
      },
    });
    res.json({ goal });
  } catch (err) { next(err); }
});

weeklyGoalsRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const existing = await db.weeklyGoal.findUnique({ where: { id: String(req.params.id) } });
    if (!existing || existing.userId !== req.user!.userId) {
      res.status(404).json({ error: { message: 'Goal not found', code: 'NOT_FOUND' } }); return;
    }
    await db.weeklyGoal.delete({ where: { id: String(req.params.id) } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
