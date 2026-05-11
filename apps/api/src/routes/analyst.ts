import { Router } from 'express';
import { z } from 'zod';
import { getTeamInsights } from '../services/analyst-service.js';
import { streamLlmSummary, saveLlmFeedback } from '../services/llm-service.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { db } from '../db.js';

export const analystRouter = Router();

const staffRoles = ['COACH', 'ANALISTA', 'MANAGER'];

analystRouter.get('/insights/:teamId', requireAuth, requireRole(staffRoles), async (req, res, next) => {
  try {
    const insights = await getTeamInsights(req.params.teamId);
    res.json({ insights });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /analysis/insights/:teamId/summary
 * Streams an LLM-generated coaching summary based on team insights.
 * Response: text/event-stream with { delta } chunks, ends with { done: true } or { error }.
 */
analystRouter.get('/insights/:teamId/summary', requireAuth, requireRole(staffRoles), async (req, res, next) => {
  try {
    const team = await db.team.findUnique({ where: { id: req.params.teamId }, select: { name: true } });
    if (!team) { res.status(404).json({ error: { message: 'Team not found', code: 'TEAM_NOT_FOUND' } }); return; }

    const insights = await getTeamInsights(req.params.teamId);
    await streamLlmSummary(req.params.teamId, team.name, insights, res);
  } catch (err) {
    next(err);
  }
});

const feedbackSchema = z.object({
  feedback: z.enum(['positive', 'negative']),
  correction: z.string().max(2000).optional(),
});

/**
 * PATCH /analysis/insights/summary/:id/feedback
 * Saves coach feedback on an LLM analysis. Used to build fine-tuning dataset.
 */
analystRouter.patch('/insights/summary/:id/feedback', requireAuth, requireRole(staffRoles), async (req, res, next) => {
  try {
    const { feedback, correction } = feedbackSchema.parse(req.body);
    await saveLlmFeedback(req.params.id, feedback, correction);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
