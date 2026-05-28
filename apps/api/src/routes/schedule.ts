import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { getTeamInsights } from '../services/analyst-service.js';
import { logger } from '../logger.js';
import { tryCompleteMission } from '../services/missions-service.js';

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function scrimLabel(scrim: { rivalName: string | null; rivalTeam?: { name: string } | null; scheduledAt: Date; type: string }): string {
  const rival = scrim.rivalTeam?.name ?? scrim.rivalName ?? 'rival';
  const date = scrim.scheduledAt.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const type = scrim.type === 'OFFICIAL' ? 'Oficial' : scrim.type === 'PRACTICE' ? 'Práctica' : 'Scrim';
  return `${type} vs ${rival} (${date})`;
}

async function createResultComms(
  teamId: string,
  fromUserId: string,
  scrim: { rivalName: string | null; scheduledAt: Date; type: string; result: string },
): Promise<void> {
  const label = scrimLabel(scrim);
  const resultStr = scrim.result === 'WIN' ? '✅ WIN' : scrim.result === 'LOSS' ? '❌ LOSS' : '➖ DRAW';

  await db.teamComm.createMany({
    data: [
      {
        teamId,
        fromUserId,
        toRole: 'ANALISTA',
        type: 'ANNOUNCEMENT',
        subject: `Análisis pendiente — ${label}`,
        body: `Se ha registrado el resultado ${resultStr} para el ${label}. Por favor, accede al análisis de la partida para sincronizar los datos y generar los insights del equipo.`,
        priority: 'urgent',
      },
      {
        teamId,
        fromUserId,
        toRole: 'COACH',
        type: 'ANNOUNCEMENT',
        subject: `Resultado registrado: ${resultStr} — ${label}`,
        body: `El resultado de la partida ha sido registrado. El análisis de datos está pendiente por parte del analista.`,
        priority: 'normal',
      },
    ],
  });
}

// ── GET /schedule ─────────────────────────────────────────────────────────────

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

// ── POST /schedule ────────────────────────────────────────────────────────────

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
    void tryCompleteMission(db, req.user!.userId, 'CREATE_FIRST_SCRIM');
  } catch (err) { next(err); }
});

// ── PATCH /schedule/:id ───────────────────────────────────────────────────────

scheduleRouter.patch('/:id', requireAuth, requireRole(['MANAGER', 'COACH']), async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);

    // Fetch existing to detect result being set for the first time
    const existing = await db.scrimSchedule.findUnique({
      where: { id: String(req.params.id) },
      select: { teamId: true, result: true, rivalName: true, scheduledAt: true, type: true },
    });

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

    // Fire-and-forget comms when result is first set manually
    if (existing && data.result && data.result !== null && existing.result === null) {
      createResultComms(
        existing.teamId,
        req.user!.userId,
        { rivalName: existing.rivalName, scheduledAt: existing.scheduledAt, type: existing.type, result: data.result },
      ).catch((err) => logger.error({ err }, 'schedule: failed to create result comms'));
    }
  } catch (err) { next(err); }
});

// ── DELETE /schedule/:id ──────────────────────────────────────────────────────

scheduleRouter.delete('/:id', requireAuth, requireRole(['MANAGER', 'COACH']), async (req, res, next) => {
  try {
    await db.scrimSchedule.delete({ where: { id: String(req.params.id) } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── GET /schedule/pending-tasks ───────────────────────────────────────────────

scheduleRouter.get('/pending-tasks', requireAuth, requireRole(staffRoles), async (req, res, next) => {
  try {
    const teamId = String(req.query.teamId ?? '');
    if (!teamId) { res.status(400).json({ error: { message: 'teamId required', code: 'BAD_REQUEST' } }); return; }

    const threshold = new Date(Date.now() - 3 * 60 * 60 * 1000);

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

    const tasks = items.map(item => ({
      ...item,
      analysisPending: item.analysedAt === null,
      reviewPending:   item.reviewedAt === null,
    }));

    res.json({ tasks });
  } catch (err) { next(err); }
});

// ── PATCH /schedule/:id/dismiss ───────────────────────────────────────────────
// Body: { taskType: 'analysis' | 'review' }
// For analysis: marks analysedAt, runs insights, creates ReviewSession + agenda, notifies COACH.

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

    if (taskType !== 'analysis') {
      res.json({ item, session: null });
      return;
    }

    // ── Analysis dismissed: build review session from insights ────────────────

    // Fetch full scrim details
    const scrim = await db.scrimSchedule.findUnique({
      where: { id: item.id },
      include: { rivalTeam: { select: { name: true } } },
    });
    if (!scrim) { res.json({ item, session: null }); return; }

    // Skip if a session already exists for this scrim
    const existing = await db.reviewSession.findFirst({ where: { scrimId: scrim.id } });
    if (existing) {
      res.json({ item, session: { id: existing.id, title: existing.title } });
      return;
    }

    let session: { id: string; title: string } | null = null;

    try {
      // Generate insights for the team
      const insights = await getTeamInsights(scrim.teamId, 'es');

      // Build session title
      const rival = scrim.rivalTeam?.name ?? scrim.rivalName ?? 'rival';
      const dateStr = scrim.scheduledAt.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
      const typeStr = scrim.type === 'OFFICIAL' ? 'Oficial' : scrim.type === 'PRACTICE' ? 'Práctica' : 'Scrim';
      const title = `Revisión: ${typeStr} vs ${rival} — ${dateStr}`;

      // Create the session
      const created = await db.reviewSession.create({
        data: {
          teamId:      scrim.teamId,
          scrimId:     scrim.id,
          title,
          notes:       'Sesión generada automáticamente tras el análisis. El coach puede editar cualquier punto.',
          createdById: req.user!.userId,
        },
      });

      // Populate agenda items from insights (critical + high + medium, max 8)
      const PRIORITY = { critical: 0, high: 1, medium: 2, low: 3, positive: 4 };
      const topInsights = insights
        .filter((i) => ['critical', 'high', 'medium'].includes(i.severity))
        .sort((a, b) => (PRIORITY[a.severity] ?? 9) - (PRIORITY[b.severity] ?? 9))
        .slice(0, 8);

      if (topInsights.length > 0) {
        await db.agendaItem.createMany({
          data: topInsights.map((insight, idx) => ({
            sessionId:   created.id,
            order:       idx,
            title:       `[${insight.severity.toUpperCase()}] ${insight.title}`,
            description: `${insight.body}\n\n💡 ${insight.recommendation}`,
          })),
        });
      }

      session = { id: created.id, title };

      // Notify COACH
      await db.teamComm.create({
        data: {
          teamId:     scrim.teamId,
          fromUserId: req.user!.userId,
          toRole:     'COACH',
          type:       'ANNOUNCEMENT',
          subject:    `Análisis completado — sesión de revisión lista`,
          body:       `El análisis de la partida "${scrimLabel(scrim)}" ha sido completado. Se ha generado automáticamente una sesión de revisión con ${topInsights.length} punto${topInsights.length !== 1 ? 's' : ''} de agenda basados en los insights del equipo.`,
          priority:   'normal',
        },
      });

      logger.info({ scrimId: scrim.id, sessionId: created.id, agendaItems: topInsights.length }, 'schedule: review session auto-created');
    } catch (err) {
      // Analysis dismiss succeeded — session creation failure is non-fatal
      logger.error({ err, scrimId: scrim.id }, 'schedule: failed to auto-create review session');
    }

    res.json({ item, session });
    if (taskType === 'analysis') {
      void tryCompleteMission(db, req.user!.userId, 'COMPLETE_ANALYSIS');
    }
  } catch (err) { next(err); }
});
