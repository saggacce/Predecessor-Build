import { db } from '../db.js';
import { AppError } from '../middleware/error-handler.js';
import { getMatchBuildAnalysis } from './build-coach-service.js';

export async function getPlayerBuildReview(playerId: string, options: { days?: number; limit?: number } = {}) {
  const days = options.days ?? 30;
  const limit = options.limit ?? 5;
  const player = await db.player.findUnique({
    where: { id: playerId },
    select: { id: true },
  });
  if (!player) throw new AppError(404, 'Player not found', 'PLAYER_NOT_FOUND');

  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db.matchPlayer.findMany({
    where: { playerId, match: { startTime: { gte: from } } },
    orderBy: { match: { startTime: 'desc' } },
    take: limit,
    select: {
      id: true,
      matchId: true,
      match: {
        select: {
          predggUuid: true,
          startTime: true,
          duration: true,
          gameMode: true,
          version: { select: { name: true } },
        },
      },
    },
  });

  const reviewed = await Promise.allSettled(rows.map(async (row) => ({
    match: {
      id: row.matchId,
      predggUuid: row.match.predggUuid,
      startTime: row.match.startTime,
      duration: row.match.duration,
      gameMode: row.match.gameMode,
      version: row.match.version?.name ?? null,
    },
    analysis: await getMatchBuildAnalysis(row.matchId, row.id),
  })));

  return {
    playerId,
    period: { days, from, to: new Date() },
    matches: reviewed.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []),
  };
}
