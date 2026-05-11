import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { AppError } from '../middleware/error-handler.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { logger } from '../logger.js';

export const vodRouter = Router();

const staffRoles = ['COACH', 'ANALISTA', 'MANAGER'];
const vodTypes = [
  'full_match',
  'player_pov',
  'clip',
  'coach_review',
  'scrim_recording',
  'tournament_vod',
  'ingame_replay_ref',
] as const;

const visibilityValues = ['staff', 'team', 'player'] as const;

const listQuerySchema = z.object({
  teamId: z.string().min(1).optional(),
  matchId: z.string().min(1).optional(),
});

const createVodSchema = z.object({
  teamId: z.string().min(1),
  matchId: z.string().min(1).nullable().optional(),
  playerId: z.string().min(1).nullable().optional(),
  type: z.enum(vodTypes),
  url: z.string().url(),
  gameTimeStart: z.number().int().nonnegative().nullable().optional(),
  gameTimeEnd: z.number().int().nonnegative().nullable().optional(),
  videoTimestampStart: z.number().int().nonnegative().nullable().optional(),
  videoTimestampEnd: z.number().int().nonnegative().nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(12).default([]),
  notes: z.string().max(1000).nullable().optional(),
  visibility: z.enum(visibilityValues).default('staff'),
});

const updateVodSchema = createVodSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field is required',
});

type VodLinkRecord = {
  id: string;
  matchId: string | null;
  playerId: string | null;
  teamId: string;
  type: string;
  url: string;
  gameTimeStart: number | null;
  gameTimeEnd: number | null;
  videoTimestampStart: number | null;
  videoTimestampEnd: number | null;
  tags: string[];
  notes: string | null;
  visibility: string;
  createdAt: Date;
};

async function attachVodTeamId(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const vod = await db.vodLink.findUnique({
      where: { id: req.params.id },
      select: { teamId: true },
    });
    if (!vod) {
      throw new AppError(404, 'VOD link not found', 'VOD_NOT_FOUND');
    }

    req.body = { ...req.body, teamId: vod.teamId };
    next();
  } catch (err) {
    next(err);
  }
}

function normalizeNullable<T>(value: T | null | undefined): T | null {
  return value ?? null;
}

function canAccessTeam(req: Request, teamId: string): boolean {
  const user = req.user;
  if (!user) return false;
  if (user.globalRole === 'PLATFORM_ADMIN') return true;
  return user.memberships.some((membership) => (
    membership.teamId === teamId && staffRoles.includes(membership.role)
  ));
}

function vodPayload(vod: VodLinkRecord, match?: { id: string; startTime: Date; gameMode: string; winningTeam: string | null } | null) {
  return {
    ...vod,
    createdAt: vod.createdAt.toISOString(),
    match: match
      ? {
          id: match.id,
          startTime: match.startTime.toISOString(),
          gameMode: match.gameMode,
          winningTeam: match.winningTeam,
        }
      : null,
  };
}

async function enrichVodLinks(vods: VodLinkRecord[]) {
  const matchIds = [...new Set(vods.map((vod) => vod.matchId).filter((id): id is string => Boolean(id)))];
  const matches = matchIds.length > 0
    ? await db.match.findMany({
        where: { id: { in: matchIds } },
        select: { id: true, startTime: true, gameMode: true, winningTeam: true },
      })
    : [];
  const matchesById = new Map(matches.map((match) => [match.id, match]));
  return vods.map((vod) => vodPayload(vod, vod.matchId ? matchesById.get(vod.matchId) : null));
}

vodRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const { teamId, matchId } = listQuerySchema.parse(req.query);
    if (!teamId && !matchId) {
      throw new AppError(400, 'teamId or matchId is required', 'VALIDATION_ERROR');
    }
    if (teamId && !canAccessTeam(req, teamId)) {
      throw new AppError(403, 'Insufficient permissions', 'FORBIDDEN');
    }

    const vods = await db.vodLink.findMany({
      where: {
        ...(teamId && { teamId }),
        ...(matchId && { matchId }),
      },
      orderBy: { createdAt: 'desc' },
    });
    const accessibleVods = vods.filter((vod) => canAccessTeam(req, vod.teamId));
    res.json({ vods: await enrichVodLinks(accessibleVods) });
  } catch (err) {
    next(err);
  }
});

vodRouter.post('/', requireAuth, requireRole(staffRoles), async (req, res, next) => {
  try {
    const data = createVodSchema.parse(req.body);
    const vod = await db.vodLink.create({
      data: {
        ...data,
        matchId: normalizeNullable(data.matchId),
        playerId: normalizeNullable(data.playerId),
        gameTimeStart: normalizeNullable(data.gameTimeStart),
        gameTimeEnd: normalizeNullable(data.gameTimeEnd),
        videoTimestampStart: normalizeNullable(data.videoTimestampStart),
        videoTimestampEnd: normalizeNullable(data.videoTimestampEnd),
        notes: normalizeNullable(data.notes),
      },
    });

    logger.info({ vodId: vod.id, teamId: vod.teamId }, 'vod link created');
    const [payload] = await enrichVodLinks([vod]);
    res.status(201).json({ vod: payload });
  } catch (err) {
    next(err);
  }
});

vodRouter.patch('/:id', requireAuth, attachVodTeamId, requireRole(staffRoles), async (req, res, next) => {
  try {
    const data = updateVodSchema.parse(req.body);
    const vod = await db.vodLink.update({
      where: { id: req.params.id },
      data: {
        ...data,
        matchId: data.matchId === undefined ? undefined : normalizeNullable(data.matchId),
        playerId: data.playerId === undefined ? undefined : normalizeNullable(data.playerId),
        gameTimeStart: data.gameTimeStart === undefined ? undefined : normalizeNullable(data.gameTimeStart),
        gameTimeEnd: data.gameTimeEnd === undefined ? undefined : normalizeNullable(data.gameTimeEnd),
        videoTimestampStart: data.videoTimestampStart === undefined ? undefined : normalizeNullable(data.videoTimestampStart),
        videoTimestampEnd: data.videoTimestampEnd === undefined ? undefined : normalizeNullable(data.videoTimestampEnd),
        notes: data.notes === undefined ? undefined : normalizeNullable(data.notes),
      },
    });

    logger.info({ vodId: vod.id, teamId: vod.teamId }, 'vod link updated');
    const [payload] = await enrichVodLinks([vod]);
    res.json({ vod: payload });
  } catch (err) {
    next(err);
  }
});

vodRouter.delete('/:id', requireAuth, attachVodTeamId, requireRole(staffRoles), async (req, res, next) => {
  try {
    await db.vodLink.delete({ where: { id: req.params.id } });
    logger.info({ vodId: req.params.id, teamId: req.body.teamId }, 'vod link deleted');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
