import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { tryCompleteMission } from '../services/missions-service.js';

export const reviewSessionsRouter = Router();

const staffRoles  = ['MANAGER', 'COACH', 'ANALISTA'];
const editRoles   = ['MANAGER', 'COACH', 'ANALISTA'];
const deleteRoles = ['MANAGER', 'COACH'];

const sessionInclude = {
  createdBy:   { select: { id: true, name: true } },
  scrim:       { select: { id: true, scheduledAt: true, type: true, rivalName: true, result: true } },
  agendaItems: { orderBy: { order: 'asc' as const } },
  actionItems: {
    orderBy: { createdAt: 'asc' as const },
    include: { assignee: { select: { id: true, name: true } } },
  },
};

// ── Schemas ───────────────────────────────────────────────────────────────────

const createSessionSchema = z.object({
  teamId:      z.string().min(1),
  title:       z.string().min(1).max(200),
  notes:       z.string().max(10000).optional(),
  scrimId:     z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
});

const updateSessionSchema = z.object({
  title:       z.string().min(1).max(200).optional(),
  notes:       z.string().max(10000).nullable().optional(),
  status:      z.enum(['PENDIENTE', 'EN_CURSO', 'COMPLETADA']).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
});

const createAgendaSchema = z.object({
  title:        z.string().min(1).max(300),
  description:  z.string().max(2000).optional(),
  vodTimestamp: z.number().int().min(0).optional(),
  playerRef:    z.string().max(100).optional(),
});

const updateAgendaSchema = z.object({
  title:        z.string().min(1).max(300).optional(),
  description:  z.string().max(2000).nullable().optional(),
  vodTimestamp: z.number().int().min(0).nullable().optional(),
  playerRef:    z.string().max(100).nullable().optional(),
  reviewed:     z.boolean().optional(),
  order:        z.number().int().min(0).optional(),
});

const createActionSchema = z.object({
  title:      z.string().min(1).max(300),
  assignedTo: z.string().optional(),
  dueDate:    z.string().datetime().optional(),
});

const updateActionSchema = z.object({
  title:      z.string().min(1).max(300).optional(),
  assignedTo: z.string().nullable().optional(),
  status:     z.enum(['ABIERTO', 'EN_PROGRESO', 'COMPLETADO']).optional(),
  dueDate:    z.string().datetime().nullable().optional(),
});

// ── GET /review-sessions?teamId=X ────────────────────────────────────────────

reviewSessionsRouter.get('/', requireAuth, requireRole([...staffRoles, 'JUGADOR']), async (req, res, next) => {
  try {
    const teamId = String(req.query.teamId ?? '');
    if (!teamId) { res.status(400).json({ error: { message: 'teamId required', code: 'BAD_REQUEST' } }); return; }

    const sessions = await db.reviewSession.findMany({
      where: { teamId },
      orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
      include: sessionInclude,
    });

    res.json({ sessions });
  } catch (err) { next(err); }
});

// ── GET /review-sessions/:id ─────────────────────────────────────────────────

reviewSessionsRouter.get('/:id', requireAuth, requireRole([...staffRoles, 'JUGADOR']), async (req, res, next) => {
  try {
    const session = await db.reviewSession.findUnique({
      where: { id: req.params.id },
      include: sessionInclude,
    });
    if (!session) { res.status(404).json({ error: { message: 'Session not found', code: 'NOT_FOUND' } }); return; }
    res.json({ session });
  } catch (err) { next(err); }
});

// ── POST /review-sessions ────────────────────────────────────────────────────

reviewSessionsRouter.post('/', requireAuth, requireRole(editRoles), async (req, res, next) => {
  try {
    const data = createSessionSchema.parse(req.body);
    const session = await db.reviewSession.create({
      data: {
        teamId:      data.teamId,
        title:       data.title,
        notes:       data.notes ?? null,
        scrimId:     data.scrimId ?? null,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        createdById: req.user!.userId,
      },
      include: sessionInclude,
    });
    res.status(201).json({ session });
  } catch (err) { next(err); }
});

// ── PATCH /review-sessions/:id ───────────────────────────────────────────────

reviewSessionsRouter.patch('/:id', requireAuth, requireRole(editRoles), async (req, res, next) => {
  try {
    const data = updateSessionSchema.parse(req.body);
    const update: Record<string, unknown> = {};
    if (data.title       !== undefined) update.title       = data.title;
    if (data.notes       !== undefined) update.notes       = data.notes;
    if (data.status      !== undefined) {
      update.status = data.status;
      if (data.status === 'COMPLETADA') update.completedAt = new Date();
    }
    if (data.scheduledAt !== undefined) update.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
    if (data.completedAt !== undefined) update.completedAt = data.completedAt ? new Date(data.completedAt) : null;

    const session = await db.reviewSession.update({
      where: { id: req.params.id },
      data: update,
      include: sessionInclude,
    });
    res.json({ session });
    if (data.status === 'COMPLETADA') {
      void tryCompleteMission(db, req.user!.userId, 'COMPLETE_REVIEW_SESSION');
    }
  } catch (err) { next(err); }
});

// ── DELETE /review-sessions/:id ──────────────────────────────────────────────

reviewSessionsRouter.delete('/:id', requireAuth, requireRole(deleteRoles), async (req, res, next) => {
  try {
    await db.reviewSession.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── POST /review-sessions/:id/agenda ─────────────────────────────────────────

reviewSessionsRouter.post('/:id/agenda', requireAuth, requireRole(editRoles), async (req, res, next) => {
  try {
    const data = createAgendaSchema.parse(req.body);
    // Get next order value
    const count = await db.agendaItem.count({ where: { sessionId: req.params.id } });
    const item = await db.agendaItem.create({
      data: {
        sessionId:    req.params.id,
        order:        count,
        title:        data.title,
        description:  data.description ?? null,
        vodTimestamp: data.vodTimestamp ?? null,
        playerRef:    data.playerRef ?? null,
      },
    });
    res.status(201).json({ item });
  } catch (err) { next(err); }
});

// ── PATCH /review-sessions/:id/agenda/:itemId ────────────────────────────────

reviewSessionsRouter.patch('/:id/agenda/:itemId', requireAuth, requireRole(editRoles), async (req, res, next) => {
  try {
    const data = updateAgendaSchema.parse(req.body);
    const update: Record<string, unknown> = {};
    if (data.title        !== undefined) update.title        = data.title;
    if (data.description  !== undefined) update.description  = data.description;
    if (data.vodTimestamp !== undefined) update.vodTimestamp = data.vodTimestamp;
    if (data.playerRef    !== undefined) update.playerRef    = data.playerRef;
    if (data.reviewed     !== undefined) update.reviewed     = data.reviewed;
    if (data.order        !== undefined) update.order        = data.order;

    const item = await db.agendaItem.update({ where: { id: req.params.itemId }, data: update });
    res.json({ item });
  } catch (err) { next(err); }
});

// ── DELETE /review-sessions/:id/agenda/:itemId ───────────────────────────────

reviewSessionsRouter.delete('/:id/agenda/:itemId', requireAuth, requireRole(editRoles), async (req, res, next) => {
  try {
    await db.agendaItem.delete({ where: { id: req.params.itemId } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── POST /review-sessions/:id/actions ────────────────────────────────────────

reviewSessionsRouter.post('/:id/actions', requireAuth, requireRole(editRoles), async (req, res, next) => {
  try {
    const data = createActionSchema.parse(req.body);
    const item = await db.actionItem.create({
      data: {
        sessionId:  req.params.id,
        title:      data.title,
        assignedTo: data.assignedTo ?? null,
        dueDate:    data.dueDate ? new Date(data.dueDate) : null,
      },
      include: { assignee: { select: { id: true, name: true } } },
    });
    res.status(201).json({ item });
  } catch (err) { next(err); }
});

// ── PATCH /review-sessions/:id/actions/:itemId ───────────────────────────────

reviewSessionsRouter.patch('/:id/actions/:itemId', requireAuth, requireRole(editRoles), async (req, res, next) => {
  try {
    const data = updateActionSchema.parse(req.body);
    const update: Record<string, unknown> = {};
    if (data.title      !== undefined) update.title      = data.title;
    if (data.assignedTo !== undefined) update.assignedTo = data.assignedTo;
    if (data.status     !== undefined) update.status     = data.status;
    if (data.dueDate    !== undefined) update.dueDate    = data.dueDate ? new Date(data.dueDate) : null;

    const item = await db.actionItem.update({
      where: { id: req.params.itemId },
      data: update,
      include: { assignee: { select: { id: true, name: true } } },
    });
    res.json({ item });
  } catch (err) { next(err); }
});

// ── DELETE /review-sessions/:id/actions/:itemId ──────────────────────────────

reviewSessionsRouter.delete('/:id/actions/:itemId', requireAuth, requireRole(deleteRoles), async (req, res, next) => {
  try {
    await db.actionItem.delete({ where: { id: req.params.itemId } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
