import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';

export const scheduleRouter = Router();

const staffRoles = ['MANAGER', 'COACH', 'ANALISTA'];

const createSchema = z.object({
  teamId: z.string().min(1),
  rivalTeamId: z.string().min(1).optional(),
  rivalName: z.string().max(100).optional(),
  scheduledAt: z.string().datetime(),
  type: z.enum(['SCRIM', 'OFFICIAL', 'PRACTICE']).default('SCRIM'),
  notes: z.string().max(500).optional(),
});

const updateSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
  rivalTeamId: z.string().min(1).optional().nullable(),
  rivalName: z.string().max(100).optional().nullable(),
  type: z.enum(['SCRIM', 'OFFICIAL', 'PRACTICE']).optional(),
  status: z.enum(['PENDIENTE', 'CONFIRMADO', 'CANCELADO']).optional(),
  notes: z.string().max(500).optional().nullable(),
  result: z.enum(['WIN', 'LOSS', 'DRAW']).optional().nullable(),
});

scheduleRouter.get('/', requireAuth, requireRole(staffRoles), async (req, res, next) => {
  try {
    const teamId = String(req.query.teamId ?? '');
    if (!teamId) { res.status(400).json({ error: { message: 'teamId required', code: 'BAD_REQUEST' } }); return; }

    const items = await db.scrimSchedule.findMany({
      where: { teamId },
      orderBy: { scheduledAt: 'asc' },
      include: {
        rivalTeam: { select: { id: true, name: true, abbreviation: true, logoUrl: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    res.json({ items });
  } catch (err) { next(err); }
});

scheduleRouter.post('/', requireAuth, requireRole(['MANAGER', 'COACH']), async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const item = await db.scrimSchedule.create({
      data: {
        teamId: data.teamId,
        rivalTeamId: data.rivalTeamId ?? null,
        rivalName: data.rivalName ?? null,
        scheduledAt: new Date(data.scheduledAt),
        type: data.type,
        notes: data.notes ?? null,
        createdById: req.user!.userId,
      },
      include: {
        rivalTeam: { select: { id: true, name: true, abbreviation: true, logoUrl: true } },
      },
    });
    res.status(201).json({ item });
  } catch (err) { next(err); }
});

scheduleRouter.patch('/:id', requireAuth, requireRole(['MANAGER', 'COACH']), async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const item = await db.scrimSchedule.update({
      where: { id: String(req.params.id) },
      data: {
        ...(data.scheduledAt !== undefined && { scheduledAt: new Date(data.scheduledAt) }),
        ...(data.rivalTeamId !== undefined && { rivalTeamId: data.rivalTeamId }),
        ...(data.rivalName !== undefined && { rivalName: data.rivalName }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.result !== undefined && { result: data.result }),
      },
    });
    res.json({ item });
  } catch (err) { next(err); }
});

scheduleRouter.delete('/:id', requireAuth, requireRole(['MANAGER', 'COACH']), async (req, res, next) => {
  try {
    await db.scrimSchedule.delete({ where: { id: String(req.params.id) } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── POST-MATCH PENDING TASKS ─────────────────────────────────────────────────
// Returns scrims that started >3h ago, are not cancelled, and have pending
// analysis (ANALISTA) or review (COACH) tasks.

scheduleRouter.get('/pending-tasks', requireAuth, requireRole(staffRoles), async (req, res, next) => {
  try {
    const teamId = String(req.query.teamId ?? '');
    if (!teamId) { res.status(400).json({ error: { message: 'teamId required', code: 'BAD_REQUEST' } }); return; }

    const threshold = new Date(Date.now() - 3 * 60 * 60 * 1000); // now - 3h

    const items = await db.scrimSchedule.findMany({
      where: {
        teamId,
        scheduledAt: { lte: threshold },
        status: { not: 'CANCELADO' },
        OR: [
          { analysedAt: null },
          { reviewedAt: null },
        ],
      },
      orderBy: { scheduledAt: 'desc' },
      include: {
        rivalTeam: { select: { id: true, name: true, abbreviation: true, logoUrl: true } },
      },
    });

    // Return which tasks are pending per item
    const tasks = items.map(item => ({
      ...item,
      analysisPending: item.analysedAt === null,
      reviewPending:   item.reviewedAt === null,
    }));

    res.json({ tasks });
  } catch (err) { next(err); }
});

// Mark a specific task as done: PATCH /schedule/:id/dismiss
// Body: { taskType: 'analysis' | 'review' }
scheduleRouter.patch('/:id/dismiss', requireAuth, requireRole(staffRoles), async (req, res, next) => {
  try {
    const { taskType } = req.body as { taskType?: string };
    if (taskType !== 'analysis' && taskType !== 'review') {
      res.status(400).json({ error: { message: 'taskType must be "analysis" or "review"', code: 'BAD_REQUEST' } }); return;
    }
    const now = new Date();
    const item = await db.scrimSchedule.update({
      where: { id: String(req.params.id) },
      data: taskType === 'analysis' ? { analysedAt: now } : { reviewedAt: now },
    });
    res.json({ item });
  } catch (err) { next(err); }
});
