import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/require-auth.js';
import { AppError } from '../middleware/error-handler.js';
import { getMissionsForUser, tryCompleteMission } from '../services/missions-service.js';
import { MISSIONS_CATALOG, type MissionRole } from '../services/missions-catalog.js';

const VALID_ROLES: MissionRole[] = ['COACH', 'MANAGER', 'ANALISTA', 'JUGADOR', 'PLAYER'];

export const missionsRouter = Router();

/**
 * GET /missions/me — missions for the current user's role with completion status.
 * PLATFORM_ADMIN can pass ?role=COACH|MANAGER|... to preview a role's mission list.
 */
missionsRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = req.user!;
    const roleParam = req.query.role as string | undefined;
    const roleOverride = (user.globalRole === 'PLATFORM_ADMIN' && roleParam && VALID_ROLES.includes(roleParam as MissionRole))
      ? roleParam as MissionRole
      : undefined;
    const { missions, role, allComplete } = await getMissionsForUser(db, user.userId, roleOverride);
    res.json({ missions, role, allComplete });
  } catch (err) { next(err); }
});

/** POST /missions/complete/:missionId — frontend-triggered completion */
missionsRouter.post('/complete/:missionId', requireAuth, async (req, res, next) => {
  try {
    const { missionId } = req.params;
    const userId = req.user!.userId;

    const mission = MISSIONS_CATALOG.find((m) => m.id === missionId);
    if (!mission) throw new AppError(404, 'Mission not found', 'NOT_FOUND');

    await tryCompleteMission(db, userId, missionId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/** GET /missions/achievements — achievements for the current user */
missionsRouter.get('/achievements', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const achievements = await db.userAchievement.findMany({
      where: { userId },
      orderBy: { awardedAt: 'desc' },
    });
    res.json({ achievements });
  } catch (err) { next(err); }
});

/** PATCH /missions/onboarding-seen — marks the welcome modal as seen */
missionsRouter.patch('/onboarding-seen', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    await db.user.update({ where: { id: userId }, data: { onboardingModalSeen: true } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
