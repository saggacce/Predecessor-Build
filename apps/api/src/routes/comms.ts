import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';

export const commsRouter = Router();

const staffRoles = ['MANAGER', 'COACH', 'ANALISTA', 'JUGADOR'];

const createSchema = z.object({
  teamId: z.string().min(1),
  toRole: z.enum(['ANALISTA', 'COACH', 'MANAGER', 'JUGADOR']).optional(),
  toUserId: z.string().optional(),
  type: z.enum(['REQUEST', 'ANNOUNCEMENT', 'NOTE']).default('REQUEST'),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  priority: z.enum(['normal', 'urgent']).default('normal'),
});

const updateSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE', 'DISMISSED']).optional(),
  body: z.string().min(1).max(2000).optional(),
});

commsRouter.get('/', requireAuth, requireRole(staffRoles), async (req, res, next) => {
  try {
    const teamId = String(req.query.teamId ?? '');
    if (!teamId) { res.status(400).json({ error: { message: 'teamId required', code: 'BAD_REQUEST' } }); return; }

    const items = await db.teamComm.findMany({
      where: { teamId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: {
        fromUser: { select: { id: true, name: true, avatarUrl: true } },
        toUser: { select: { id: true, name: true } },
      },
    });
    res.json({ items });
  } catch (err) { next(err); }
});

commsRouter.post('/', requireAuth, requireRole(staffRoles), async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const item = await db.teamComm.create({
      data: {
        teamId: data.teamId,
        fromUserId: req.user!.userId,
        toRole: data.toRole ?? null,
        toUserId: data.toUserId ?? null,
        type: data.type,
        subject: data.subject,
        body: data.body,
        priority: data.priority,
      },
      include: {
        fromUser: { select: { id: true, name: true, avatarUrl: true } },
        toUser: { select: { id: true, name: true } },
      },
    });
    res.status(201).json({ item });
  } catch (err) { next(err); }
});

commsRouter.patch('/:id', requireAuth, requireRole(staffRoles), async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const resolvedFields = data.status === 'DONE' || data.status === 'DISMISSED'
      ? { resolvedAt: new Date(), resolvedById: req.user!.userId }
      : {};
    const item = await db.teamComm.update({
      where: { id: String(req.params.id) },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.body !== undefined && { body: data.body }),
        ...resolvedFields,
      },
    });
    res.json({ item });
  } catch (err) { next(err); }
});

commsRouter.delete('/:id', requireAuth, requireRole(['MANAGER', 'COACH']), async (req, res, next) => {
  try {
    await db.teamComm.delete({ where: { id: String(req.params.id) } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
