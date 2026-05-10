import { db } from '../db.js';
import { AppError } from '../middleware/error-handler.js';

const VALID_STATUSES = [
  'PENDING', 'IN_REVIEW', 'REVIEWED', 'FALSE_POSITIVE',
  'TEAM_ISSUE', 'PLAYER_ISSUE', 'DRAFT_ISSUE', 'ADDED_TO_TRAINING',
] as const;

const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;

const VALID_TAGS = [
  'bad_objective_setup', 'facecheck', 'bad_reset', 'late_rotation',
  'bad_engage', 'ignored_call', 'bad_secure', 'poor_conversion',
] as const;

export type ReviewStatus = (typeof VALID_STATUSES)[number];
export type ReviewPriority = (typeof VALID_PRIORITIES)[number];

export interface ReviewItemInput {
  teamId: string;
  matchId?: string;
  playerId?: string;
  insightId?: string;
  gameTime?: number;
  eventType: string;
  priority: string;
  reason: string;
}

export interface ReviewItemUpdate {
  status?: string;
  tag?: string;
  coachComment?: string;
  assignedTo?: string;
  actionItem?: string;
  vodUrl?: string;
  vodTimestamp?: number;
}

// ── Review Items ──────────────────────────────────────────────────────────────

export async function createReviewItem(input: ReviewItemInput) {
  if (!input.teamId || !input.eventType || !input.reason) {
    throw new AppError(400, 'teamId, eventType and reason are required', 'VALIDATION_ERROR');
  }
  return db.reviewItem.create({ data: { ...input } });
}

export async function listReviewItems(params: {
  teamId: string;
  status?: string;
  priority?: string;
  limit?: number;
  offset?: number;
}) {
  const where = {
    teamId: params.teamId,
    ...(params.status ? { status: params.status } : {}),
    ...(params.priority ? { priority: params.priority } : {}),
  };

  const [items, total] = await Promise.all([
    db.reviewItem.findMany({
      where,
      orderBy: [
        { priority: 'asc' }, // critical < high < medium < low alphabetically... we'll sort in JS
        { createdAt: 'desc' },
      ],
      take: params.limit ?? 50,
      skip: params.offset ?? 0,
    }),
    db.reviewItem.count({ where }),
  ]);

  // Sort by severity manually since alphabetical order doesn't match severity
  const ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  items.sort((a, b) => (ORDER[a.priority] ?? 9) - (ORDER[b.priority] ?? 9) || b.createdAt.getTime() - a.createdAt.getTime());

  return { items, total };
}

export async function updateReviewItem(id: string, update: ReviewItemUpdate) {
  const item = await db.reviewItem.findUnique({ where: { id } });
  if (!item) throw new AppError(404, `Review item not found: ${id}`, 'NOT_FOUND');

  return db.reviewItem.update({ where: { id }, data: { ...update, updatedAt: new Date() } });
}

export async function deleteReviewItem(id: string) {
  const item = await db.reviewItem.findUnique({ where: { id } });
  if (!item) throw new AppError(404, `Review item not found: ${id}`, 'NOT_FOUND');
  await db.reviewItem.delete({ where: { id } });
}

// ── Team Goals ────────────────────────────────────────────────────────────────

export interface TeamGoalInput {
  teamId: string;
  title: string;
  description?: string;
  metricId?: string;
  baselineValue?: number;
  targetValue?: number;
  timeframe?: string;
  priority?: string;
}

export interface TeamGoalUpdate {
  title?: string;
  description?: string;
  targetValue?: number;
  currentValue?: number;
  timeframe?: string;
  priority?: string;
  status?: string;
}

export async function createTeamGoal(input: TeamGoalInput) {
  if (!input.teamId || !input.title) {
    throw new AppError(400, 'teamId and title are required', 'VALIDATION_ERROR');
  }
  return db.teamGoal.create({ data: { ...input } });
}

export async function listTeamGoals(teamId: string) {
  return db.teamGoal.findMany({
    where: { teamId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateTeamGoal(id: string, update: TeamGoalUpdate) {
  const goal = await db.teamGoal.findUnique({ where: { id } });
  if (!goal) throw new AppError(404, `Team goal not found: ${id}`, 'NOT_FOUND');
  return db.teamGoal.update({ where: { id }, data: { ...update, updatedAt: new Date() } });
}

export async function deleteTeamGoal(id: string) {
  const goal = await db.teamGoal.findUnique({ where: { id } });
  if (!goal) throw new AppError(404, `Team goal not found: ${id}`, 'NOT_FOUND');
  await db.teamGoal.delete({ where: { id } });
}

// ── Player Goals ──────────────────────────────────────────────────────────────

export interface PlayerGoalInput {
  playerId: string;
  teamId: string;
  title: string;
  description?: string;
  metricId?: string;
  baselineValue?: number;
  targetValue?: number;
  coachNote?: string;
  visibility?: string;
}

export async function createPlayerGoal(input: PlayerGoalInput) {
  if (!input.playerId || !input.teamId || !input.title) {
    throw new AppError(400, 'playerId, teamId and title are required', 'VALIDATION_ERROR');
  }
  return db.playerGoal.create({ data: { ...input } });
}

export async function listPlayerGoals(teamId: string, playerId?: string) {
  return db.playerGoal.findMany({
    where: { teamId, ...(playerId ? { playerId } : {}) },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updatePlayerGoal(id: string, update: Partial<PlayerGoalInput> & { status?: string; currentValue?: number }) {
  const goal = await db.playerGoal.findUnique({ where: { id } });
  if (!goal) throw new AppError(404, `Player goal not found: ${id}`, 'NOT_FOUND');
  return db.playerGoal.update({ where: { id }, data: { ...update, updatedAt: new Date() } });
}
