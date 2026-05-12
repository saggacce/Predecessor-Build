import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { AppError } from '../middleware/error-handler.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { logger } from '../logger.js';

export const invitationsRouter = Router();

const invitationRoleSchema = z.enum(['MANAGER', 'COACH', 'ANALISTA', 'JUGADOR']);

const createInvitationSchema = z.object({
  email: z.string().email().transform((email) => email.toLowerCase()),
  teamId: z.string().min(1),
  role: invitationRoleSchema,
  playerId: z.string().min(1).optional(),
});

const listInvitationSchema = z.object({
  teamId: z.string().min(1),
});

function publicInvitation(invitation: { email: string; teamId: string; role: string; playerId?: string | null; expiresAt: Date }) {
  return {
    email: invitation.email,
    teamId: invitation.teamId,
    role: invitation.role,
    playerId: invitation.playerId ?? null,
    expiresAt: invitation.expiresAt,
  };
}

async function attachInvitationTeamId(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const invitationId = String(req.params.id);
    const invitation = await db.invitation.findUnique({
      where: { id: invitationId },
      select: { teamId: true },
    });
    if (!invitation) {
      throw new AppError(404, 'Invitation not found', 'INVITATION_NOT_FOUND');
    }
    req.body = { ...req.body, teamId: invitation.teamId };
    next();
  } catch (err) {
    next(err);
  }
}

invitationsRouter.post('/', requireAuth, requireRole(['MANAGER']), async (req, res, next) => {
  try {
    const data = createInvitationSchema.parse(req.body);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invitation = await db.invitation.create({
      data: {
        email: data.email,
        teamId: data.teamId,
        role: data.role,
        playerId: data.playerId ?? null,
        invitedById: req.user!.userId,
        expiresAt,
      },
      select: {
        id: true,
        token: true,
        email: true,
        teamId: true,
        role: true,
        expiresAt: true,
      },
    });

    logger.info({ invitationId: invitation.id, teamId: invitation.teamId }, 'invitation created');
    await db.syncLog.create({
      data: { entity: 'Invitation', entityId: invitation.id, operation: 'create', status: 'success' },
    });
    res.status(201).json({ invitation });
  } catch (err) {
    next(err);
  }
});

invitationsRouter.get('/', requireAuth, requireRole(['MANAGER']), async (req, res, next) => {
  try {
    const { teamId } = listInvitationSchema.parse(req.query);
    const invitations = await db.invitation.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        token: true,
        email: true,
        teamId: true,
        role: true,
        playerId: true,
        expiresAt: true,
        usedAt: true,
        createdAt: true,
      },
    });
    res.json({ invitations });
  } catch (err) {
    next(err);
  }
});

invitationsRouter.get('/:token', async (req, res, next) => {
  try {
    const token = String(req.params.token);
    const invitation = await db.invitation.findUnique({ where: { token } });
    if (!invitation || invitation.usedAt || invitation.expiresAt <= new Date()) {
      throw new AppError(404, 'Invitation not found', 'INVITATION_NOT_FOUND');
    }

    res.json({ invitation: publicInvitation(invitation) });
  } catch (err) {
    next(err);
  }
});

invitationsRouter.delete(
  '/:id',
  requireAuth,
  attachInvitationTeamId,
  requireRole(['MANAGER']),
  async (req, res, next) => {
    try {
      const invitationId = String(req.params.id);
      const invitation = await db.invitation.findUnique({ where: { id: invitationId } });
      if (!invitation) {
        throw new AppError(404, 'Invitation not found', 'INVITATION_NOT_FOUND');
      }
      if (invitation.usedAt) {
        throw new AppError(400, 'Invitation already used', 'INVITATION_USED');
      }

      await db.invitation.delete({ where: { id: invitationId } });
      await db.syncLog.create({
        data: { entity: 'Invitation', entityId: invitationId, operation: 'delete', status: 'success' },
      });
      logger.info({ invitationId }, 'invitation deleted');
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);
