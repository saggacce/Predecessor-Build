import type { PrismaClient } from '@prisma/client';
import { logger } from '../logger.js';
import { getMissionsForRole, MISSIONS_CATALOG, ONBOARDING_ACHIEVEMENT_ID, type MissionRole } from './missions-catalog.js';

/** Resolve the effective mission role from the user's DB data. */
export async function resolveMissionRole(
  db: PrismaClient,
  userId: string,
): Promise<MissionRole | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      globalRole: true,
      memberships: { select: { role: true } },
    },
  });
  if (!user) return null;

  if (user.globalRole === 'PLAYER') return 'PLAYER';

  const teamRole = user.memberships[0]?.role ?? null;
  if (teamRole === 'COACH') return 'COACH';
  if (teamRole === 'MANAGER') return 'MANAGER';
  if (teamRole === 'ANALISTA') return 'ANALISTA';
  if (teamRole === 'JUGADOR') return 'JUGADOR';

  return null;
}

/**
 * Returns missions for the user's role, enriched with completion state.
 * Auto-detects COMPLETE_PROFILE and LINK_PREDGG from DB state.
 * Pass roleOverride (PLATFORM_ADMIN only) to preview a different role's missions.
 */
export async function getMissionsForUser(db: PrismaClient, userId: string, roleOverride?: MissionRole) {
  const role = roleOverride ?? await resolveMissionRole(db, userId);
  if (!role) return { missions: [], role: null, allComplete: false };

  const missions = getMissionsForRole(role);

  const [dbUser, completions] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { bio: true, name: true, linkedPlayerId: true },
    }),
    db.userMissionCompletion.findMany({
      where: { userId, missionId: { in: missions.map((m) => m.id) } },
      select: { missionId: true, completedAt: true },
    }),
  ]);

  const completedSet = new Set(completions.map((c) => c.missionId));
  const completedAtMap = new Map(completions.map((c) => [c.missionId, c.completedAt]));

  // Auto-detect COMPLETE_PROFILE and LINK_PREDGG
  if (!completedSet.has('COMPLETE_PROFILE') && dbUser?.bio && dbUser.bio.trim().length > 0) {
    await tryCompleteMission(db, userId, 'COMPLETE_PROFILE', false);
    completedSet.add('COMPLETE_PROFILE');
  }
  if (!completedSet.has('LINK_PREDGG') && dbUser?.linkedPlayerId) {
    await tryCompleteMission(db, userId, 'LINK_PREDGG', false);
    completedSet.add('LINK_PREDGG');
  }

  const enriched = missions.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    ctaPath: m.ctaPath,
    order: m.order,
    completed: completedSet.has(m.id),
    completedAt: completedAtMap.get(m.id) ?? null,
  }));

  const allComplete = enriched.every((m) => m.completed);
  return { missions: enriched, role, allComplete };
}

/**
 * Marks a mission as completed for a user (idempotent).
 * If all missions are now complete, awards the FIRST_STEPS achievement.
 * Pass checkAchievement=false from auto-detect calls to avoid recursion.
 */
export async function tryCompleteMission(
  db: PrismaClient,
  userId: string,
  missionId: string,
  checkAchievement = true,
): Promise<void> {
  try {
    const mission = MISSIONS_CATALOG.find((m) => m.id === missionId);
    if (!mission) return;

    await db.userMissionCompletion.upsert({
      where: { userId_missionId: { userId, missionId } },
      create: { userId, missionId },
      update: {},
    });

    if (checkAchievement) {
      await checkAndAwardAchievement(db, userId);
    }
  } catch (err) {
    logger.warn({ err, userId, missionId }, 'tryCompleteMission failed silently');
  }
}

/** Awards the FIRST_STEPS achievement if all role missions are now done. */
async function checkAndAwardAchievement(db: PrismaClient, userId: string): Promise<void> {
  try {
    const role = await resolveMissionRole(db, userId);
    if (!role) return;

    const missions = getMissionsForRole(role);
    const completions = await db.userMissionCompletion.findMany({
      where: { userId, missionId: { in: missions.map((m) => m.id) } },
      select: { missionId: true },
    });
    const completedSet = new Set(completions.map((c) => c.missionId));

    // Auto-detect COMPLETE_PROFILE and LINK_PREDGG
    const dbUser = await db.user.findUnique({
      where: { id: userId },
      select: { bio: true, linkedPlayerId: true },
    });
    if (dbUser?.bio?.trim()) completedSet.add('COMPLETE_PROFILE');
    if (dbUser?.linkedPlayerId) completedSet.add('LINK_PREDGG');

    const allDone = missions.every((m) => completedSet.has(m.id));
    if (!allDone) return;

    const achievementId = `${ONBOARDING_ACHIEVEMENT_ID}_${role}`;
    await db.userAchievement.upsert({
      where: { userId_achievementId: { userId, achievementId } },
      create: { userId, achievementId },
      update: {},
    });
    logger.info({ userId, achievementId }, 'achievement awarded');
  } catch (err) {
    logger.warn({ err, userId }, 'checkAndAwardAchievement failed silently');
  }
}
