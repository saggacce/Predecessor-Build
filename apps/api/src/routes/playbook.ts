import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { tryCompleteMission } from '../services/missions-service.js';

export const playbookRouter = Router();

const staffRoles = ['MANAGER', 'COACH', 'ANALISTA'];
const editRoles  = ['MANAGER', 'COACH', 'ANALISTA'];
const deleteRoles = ['MANAGER', 'COACH'];

const VALID_PHASES = ['ALL', 'EARLY', 'MID', 'LATE'] as const;
const VALID_ROLES  = ['CARRY', 'JUNGLE', 'MIDLANE', 'OFFLANE', 'SUPPORT'] as const;

const createSchema = z.object({
  teamId:      z.string().min(1),
  title:       z.string().min(1).max(200),
  body:        z.string().max(5000),
  category:    z.string().min(1).max(80).default('General'),
  phase:       z.enum(VALID_PHASES).default('ALL'),
  roles:       z.array(z.enum(VALID_ROLES)).default([]),
  pinned:      z.boolean().default(false),
  mapSnapshot: z.string().max(200000).nullable().optional(),
});

const updateSchema = z.object({
  title:       z.string().min(1).max(200).optional(),
  body:        z.string().max(5000).optional(),
  category:    z.string().min(1).max(80).optional(),
  phase:       z.enum(VALID_PHASES).optional(),
  roles:       z.array(z.enum(VALID_ROLES)).optional(),
  pinned:      z.boolean().optional(),
  mapSnapshot: z.string().max(200000).nullable().optional(),
});

// ── GET /playbook?teamId=X ────────────────────────────────────────────────────
playbookRouter.get('/', requireAuth, requireRole([...staffRoles, 'JUGADOR']), async (req, res, next) => {
  try {
    const teamId = String(req.query.teamId ?? '');
    if (!teamId) {
      res.status(400).json({ error: { message: 'teamId required', code: 'BAD_REQUEST' } }); return;
    }

    const entries = await db.playbookEntry.findMany({
      where: { teamId },
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
      include: { createdBy: { select: { id: true, name: true } } },
    });

    res.json({ entries });
  } catch (err) { next(err); }
});

// ── POST /playbook ────────────────────────────────────────────────────────────
playbookRouter.post('/', requireAuth, requireRole(editRoles), async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const entry = await db.playbookEntry.create({
      data: {
        teamId:      data.teamId,
        title:       data.title,
        body:        data.body,
        category:    data.category,
        phase:       data.phase,
        roles:       data.roles,
        pinned:      data.pinned,
        mapSnapshot: data.mapSnapshot ?? null,
        createdById: req.user!.userId,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });
    res.status(201).json({ entry });
    void tryCompleteMission(db, req.user!.userId, 'CREATE_PLAYBOOK_ENTRY');
  } catch (err) { next(err); }
});

// ── PATCH /playbook/:id ───────────────────────────────────────────────────────
playbookRouter.patch('/:id', requireAuth, requireRole(editRoles), async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const entry = await db.playbookEntry.update({
      where: { id: String(req.params.id) },
      data: {
        ...(data.title    !== undefined && { title:    data.title }),
        ...(data.body     !== undefined && { body:     data.body }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.phase    !== undefined && { phase:    data.phase }),
        ...(data.roles       !== undefined && { roles:       data.roles }),
        ...(data.pinned      !== undefined && { pinned:      data.pinned }),
        ...(data.mapSnapshot !== undefined && { mapSnapshot: data.mapSnapshot }),
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });
    res.json({ entry });
  } catch (err) { next(err); }
});

// ── DELETE /playbook/:id ──────────────────────────────────────────────────────
playbookRouter.delete('/:id', requireAuth, requireRole(deleteRoles), async (req, res, next) => {
  try {
    await db.playbookEntry.delete({ where: { id: String(req.params.id) } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
