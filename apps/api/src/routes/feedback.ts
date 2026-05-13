import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requirePlatformAdmin } from '../middleware/require-platform-admin.js';

export const feedbackRouter = Router();

const APP_SECTIONS = [
  'Dashboard', 'Player Scouting', 'Team Analysis', 'Match Detail',
  'Rival Scouting', 'Scrim Report', 'Review Queue', 'Team Goals',
  'VOD Index', 'Staff Management', 'Platform Admin', 'Profile', 'Otro',
] as const;

// POST /feedback — submit a new feedback report (any authenticated user)
feedbackRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = z.object({
      type: z.enum(['bug', 'suggestion', 'improvement']),
      section: z.string().min(1).max(60),
      description: z.string().min(10).max(2000),
      screenshotBase64: z.string().max(2_800_000).optional().nullable(), // ~2MB base64
    }).parse(req.body);

    const user = (req as { user?: { id: string; name?: string; email?: string } }).user;

    const report = await db.feedbackReport.create({
      data: {
        type: body.type,
        section: body.section,
        description: body.description,
        screenshotBase64: body.screenshotBase64 ?? null,
        userId: user?.id ?? null,
        userName: user?.name ?? null,
        userEmail: user?.email ?? null,
      },
    });

    res.status(201).json({ ok: true, id: report.id });
  } catch (err) { next(err); }
});

// GET /feedback/sections — list valid app sections
feedbackRouter.get('/sections', (_req, res) => {
  res.json({ sections: APP_SECTIONS });
});

// GET /feedback/unread-count — count of NEW reports (platform admin only)
feedbackRouter.get('/unread-count', requireAuth, requirePlatformAdmin, async (_req, res, next) => {
  try {
    const count = await db.feedbackReport.count({ where: { status: 'NEW' } });
    res.json({ count });
  } catch (err) { next(err); }
});

// GET /feedback — list all reports (platform admin only)
feedbackRouter.get('/', requireAuth, requirePlatformAdmin, async (req, res, next) => {
  try {
    const { status, type } = z.object({
      status: z.string().optional(),
      type: z.string().optional(),
    }).parse(req.query);

    const reports = await db.feedbackReport.findMany({
      where: {
        ...(status && { status }),
        ...(type && { type }),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, type: true, section: true, description: true,
        status: true, userId: true, userName: true, userEmail: true,
        createdAt: true, reviewedAt: true, reviewNote: true,
        screenshotBase64: false, // don't send image in list — only in detail
      },
    });
    res.json({ reports });
  } catch (err) { next(err); }
});

// GET /feedback/:id — get single report with screenshot (platform admin only)
feedbackRouter.get('/:id', requireAuth, requirePlatformAdmin, async (req, res, next) => {
  try {
    const report = await db.feedbackReport.findUnique({ where: { id: req.params.id } });
    if (!report) { res.status(404).json({ error: { message: 'Not found' } }); return; }
    res.json({ report });
  } catch (err) { next(err); }
});

// PATCH /feedback/:id — update status / add review note (platform admin only)
feedbackRouter.patch('/:id', requireAuth, requirePlatformAdmin, async (req, res, next) => {
  try {
    const body = z.object({
      status: z.enum(['NEW', 'REVIEWED', 'DISMISSED']).optional(),
      reviewNote: z.string().max(500).optional().nullable(),
    }).parse(req.body);

    const report = await db.feedbackReport.update({
      where: { id: req.params.id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.status && body.status !== 'NEW' && { reviewedAt: new Date() }),
        ...(body.reviewNote !== undefined && { reviewNote: body.reviewNote }),
      },
      select: {
        id: true, type: true, section: true, status: true,
        reviewedAt: true, reviewNote: true, screenshotBase64: false,
      },
    });
    res.json({ report });
  } catch (err) { next(err); }
});
