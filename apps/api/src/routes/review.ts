import { Router } from 'express';
import { z } from 'zod';
import {
  createReviewItem, listReviewItems, updateReviewItem, deleteReviewItem,
  createTeamGoal, listTeamGoals, updateTeamGoal, deleteTeamGoal,
  createPlayerGoal, listPlayerGoals, updatePlayerGoal,
} from '../services/review-service.js';

export const reviewRouter = Router();

// ── Review Items ──────────────────────────────────────────────────────────────

const createReviewSchema = z.object({
  teamId: z.string().min(1),
  matchId: z.string().optional(),
  playerId: z.string().optional(),
  insightId: z.string().optional(),
  gameTime: z.number().int().optional(),
  eventType: z.string().min(1),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('high'),
  reason: z.string().min(1).max(500),
});

const updateReviewSchema = z.object({
  status: z.enum(['PENDING','IN_REVIEW','REVIEWED','FALSE_POSITIVE','TEAM_ISSUE','PLAYER_ISSUE','DRAFT_ISSUE','ADDED_TO_TRAINING']).optional(),
  tag: z.enum(['bad_objective_setup','facecheck','bad_reset','late_rotation','bad_engage','ignored_call','bad_secure','poor_conversion']).nullable().optional(),
  coachComment: z.string().max(1000).nullable().optional(),
  assignedTo: z.string().max(100).nullable().optional(),
  actionItem: z.string().max(500).nullable().optional(),
  vodUrl: z.string().url().nullable().optional(),
  vodTimestamp: z.number().int().nullable().optional(),
});

reviewRouter.get('/items', async (req, res, next) => {
  try {
    const teamId = String(req.query.teamId ?? '');
    if (!teamId) { res.status(400).json({ error: { message: 'teamId required' } }); return; }
    const result = await listReviewItems({
      teamId,
      status: req.query.status ? String(req.query.status) : undefined,
      priority: req.query.priority ? String(req.query.priority) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 50,
      offset: req.query.offset ? Number(req.query.offset) : 0,
    });
    res.json(result);
  } catch (err) { next(err); }
});

reviewRouter.post('/items', async (req, res, next) => {
  try {
    const data = createReviewSchema.parse(req.body);
    const item = await createReviewItem(data);
    res.status(201).json(item);
  } catch (err) { next(err); }
});

reviewRouter.patch('/items/:id', async (req, res, next) => {
  try {
    const data = updateReviewSchema.parse(req.body);
    const item = await updateReviewItem(req.params.id, data);
    res.json(item);
  } catch (err) { next(err); }
});

reviewRouter.delete('/items/:id', async (req, res, next) => {
  try {
    await deleteReviewItem(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Team Goals ────────────────────────────────────────────────────────────────

const createGoalSchema = z.object({
  teamId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  metricId: z.string().optional(),
  baselineValue: z.number().optional(),
  targetValue: z.number().optional(),
  timeframe: z.string().max(100).optional(),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
});

const updateGoalSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  targetValue: z.number().nullable().optional(),
  currentValue: z.number().nullable().optional(),
  timeframe: z.string().max(100).nullable().optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ACHIEVED', 'FAILED', 'PAUSED', 'ARCHIVED']).optional(),
});

reviewRouter.get('/goals/team/:teamId', async (req, res, next) => {
  try {
    const goals = await listTeamGoals(req.params.teamId);
    res.json({ goals });
  } catch (err) { next(err); }
});

reviewRouter.post('/goals/team', async (req, res, next) => {
  try {
    const data = createGoalSchema.parse(req.body);
    const goal = await createTeamGoal(data);
    res.status(201).json(goal);
  } catch (err) { next(err); }
});

reviewRouter.patch('/goals/team/:id', async (req, res, next) => {
  try {
    const data = updateGoalSchema.parse(req.body);
    const goal = await updateTeamGoal(req.params.id, data);
    res.json(goal);
  } catch (err) { next(err); }
});

reviewRouter.delete('/goals/team/:id', async (req, res, next) => {
  try {
    await deleteTeamGoal(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Player Goals ──────────────────────────────────────────────────────────────

const createPlayerGoalSchema = z.object({
  playerId: z.string().min(1),
  teamId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  metricId: z.string().optional(),
  baselineValue: z.number().optional(),
  targetValue: z.number().optional(),
  coachNote: z.string().max(500).optional(),
  visibility: z.enum(['staff', 'player', 'all']).default('staff'),
});

reviewRouter.get('/goals/player/:teamId', async (req, res, next) => {
  try {
    const playerId = req.query.playerId ? String(req.query.playerId) : undefined;
    const goals = await listPlayerGoals(req.params.teamId, playerId);
    res.json({ goals });
  } catch (err) { next(err); }
});

reviewRouter.post('/goals/player', async (req, res, next) => {
  try {
    const data = createPlayerGoalSchema.parse(req.body);
    const goal = await createPlayerGoal(data);
    res.status(201).json(goal);
  } catch (err) { next(err); }
});

reviewRouter.patch('/goals/player/:id', async (req, res, next) => {
  try {
    const goal = await updatePlayerGoal(req.params.id, req.body);
    res.json(goal);
  } catch (err) { next(err); }
});
