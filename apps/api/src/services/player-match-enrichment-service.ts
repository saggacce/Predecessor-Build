import { Prisma, type PrismaClient } from '@prisma/client';
import { logger } from '../logger.js';
import { resyncMatch, syncMatchEventStream } from './sync-service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_DAYS = 30;
const DEFAULT_BATCH_LIMIT = 50;
const DEFAULT_CONCURRENCY = 2;

export interface PlayerMatchEnrichmentCoverage {
  playerId: string;
  windowDays: number;
  totalMatches: number;
  rosterSynced: number;
  eventStreamSynced: number;
  fullyEnriched: number;
  failed: number;
  pending: number;
  coveragePercent: number;
  lastMatchSyncedAt: string | null;
}

export interface PlayerMatchEnrichmentJob {
  running: boolean;
  total: number;
  processed: number;
  succeeded: number;
  errors: number;
  startedAt: string;
  finishedAt: string | null;
}

export interface PlayerMatchEnrichmentStatus extends PlayerMatchEnrichmentCoverage {
  job: PlayerMatchEnrichmentJob | null;
}

interface EnrichmentCandidate {
  id: string;
  predggUuid: string;
  rosterSynced: boolean;
  eventStreamSynced: boolean;
  eventStreamFailed: boolean;
  needsRosterRefresh?: boolean;
  needsGoldRefresh?: boolean;
}

interface EnrichmentOptions {
  windowDays?: number;
  limit?: number;
  concurrency?: number;
  retryFailed?: boolean;
  userName?: string;
  onStart?: (total: number) => void;
  onProgress?: (result: { succeeded: boolean }) => void;
}

const jobs = new Map<string, PlayerMatchEnrichmentJob>();

function cutoffFor(windowDays: number): Date {
  return new Date(Date.now() - windowDays * DAY_MS);
}

export async function getPlayerMatchEnrichmentCoverage(
  db: PrismaClient,
  playerId: string,
  windowDays = DEFAULT_WINDOW_DAYS,
): Promise<PlayerMatchEnrichmentCoverage> {
  const matches = await db.match.findMany({
    where: {
      startTime: { gte: cutoffFor(windowDays) },
      matchPlayers: { some: { playerId } },
    },
    select: {
      rosterSynced: true,
      eventStreamSynced: true,
      eventStreamFailed: true,
      syncedAt: true,
      matchPlayers: {
        where: { playerId },
        take: 1,
        select: { goldEarnedAtInterval: true },
      },
    },
  });

  let rosterSynced = 0;
  let eventStreamSynced = 0;
  let fullyEnriched = 0;
  let failed = 0;
  let lastMatchSyncedAt: Date | null = null;

  for (const match of matches) {
    if (match.rosterSynced) rosterSynced++;
    if (match.eventStreamSynced) eventStreamSynced++;
    const goldTimeline = match.matchPlayers[0]?.goldEarnedAtInterval;
    const hasGoldTimeline = Array.isArray(goldTimeline) && goldTimeline.length > 0;
    if (match.rosterSynced && match.eventStreamSynced && hasGoldTimeline) fullyEnriched++;
    if (match.eventStreamFailed && !match.eventStreamSynced) failed++;
    if (!lastMatchSyncedAt || match.syncedAt > lastMatchSyncedAt) lastMatchSyncedAt = match.syncedAt;
  }

  const totalMatches = matches.length;
  return {
    playerId,
    windowDays,
    totalMatches,
    rosterSynced,
    eventStreamSynced,
    fullyEnriched,
    failed,
    pending: totalMatches - fullyEnriched,
    coveragePercent: totalMatches === 0 ? 0 : Math.round((fullyEnriched / totalMatches) * 100),
    lastMatchSyncedAt: lastMatchSyncedAt?.toISOString() ?? null,
  };
}

async function loadCandidates(
  db: PrismaClient,
  playerId: string,
  options: EnrichmentOptions,
): Promise<EnrichmentCandidate[]> {
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;
  const retryFailed = options.retryFailed ?? false;

  const matches = await db.match.findMany({
    where: {
      startTime: { gte: cutoffFor(windowDays) },
      matchPlayers: { some: { playerId } },
      OR: [
        { rosterSynced: false },
        { matchPlayers: { some: { playerId, physicalDamageTaken: null } } },
        { matchPlayers: { some: { playerId, goldEarnedAtInterval: { equals: Prisma.DbNull } } } },
        {
          eventStreamSynced: false,
          ...(retryFailed ? {} : { eventStreamFailed: false }),
        },
      ],
    },
    orderBy: { startTime: 'desc' },
    take: options.limit ?? DEFAULT_BATCH_LIMIT,
    select: {
      id: true,
      predggUuid: true,
      rosterSynced: true,
      eventStreamSynced: true,
      eventStreamFailed: true,
      matchPlayers: {
        where: { playerId },
        take: 1,
        select: { physicalDamageTaken: true, goldEarnedAtInterval: true },
      },
    },
  });

  return matches.map((match) => {
    const playerMatch = match.matchPlayers?.[0];
    const goldTimeline = playerMatch?.goldEarnedAtInterval;
    return {
      id: match.id,
      predggUuid: match.predggUuid,
      rosterSynced: match.rosterSynced,
      eventStreamSynced: match.eventStreamSynced,
      eventStreamFailed: match.eventStreamFailed,
      needsRosterRefresh: playerMatch?.physicalDamageTaken === null,
      needsGoldRefresh: Boolean(playerMatch) && (!Array.isArray(goldTimeline) || goldTimeline.length === 0),
    };
  });
}

export async function enrichPlayerMatches(
  db: PrismaClient,
  playerId: string,
  accessToken: string,
  options: EnrichmentOptions = {},
): Promise<{ total: number; processed: number; succeeded: number; errors: number }> {
  const candidates = await loadCandidates(db, playerId, options);
  options.onStart?.(candidates.length);
  let cursor = 0;
  let processed = 0;
  let succeeded = 0;
  let errors = 0;

  const processCandidate = async (match: EnrichmentCandidate) => {
    let success = false;
    try {
      if (!match.rosterSynced || match.needsRosterRefresh) {
        await resyncMatch(db, match.predggUuid, accessToken, true);
      } else if (!match.eventStreamSynced || match.needsGoldRefresh) {
        await syncMatchEventStream(
          db,
          match.id,
          match.predggUuid,
          accessToken,
          Boolean(options.retryFailed || match.needsGoldRefresh),
        );
      }

      const refreshed = await db.match.findUnique({
        where: { id: match.id },
        select: {
          rosterSynced: true,
          eventStreamSynced: true,
          matchPlayers: {
            where: { playerId },
            take: 1,
            select: { goldEarnedAtInterval: true },
          },
        },
      });
      const refreshedGold = refreshed?.matchPlayers[0]?.goldEarnedAtInterval;
      const hasRefreshedGold = Array.isArray(refreshedGold) && refreshedGold.length > 0;
      success = Boolean(refreshed?.rosterSynced && refreshed.eventStreamSynced
        && (!match.needsGoldRefresh || hasRefreshedGold));
      if (!success) throw new Error('La partida no quedó completamente enriquecida.');
      succeeded++;
    } catch (error) {
      errors++;
      const message = error instanceof Error ? error.message : String(error);
      logger.warn({ playerId, matchId: match.id, predggUuid: match.predggUuid, error: message }, 'player match enrichment failed');
      await db.syncLog.create({
        data: {
          entity: 'player-enrichment',
          entityId: match.predggUuid,
          operation: 'enrich-match',
          status: 'error',
          error: message.slice(0, 1000),
          source: 'user',
          userName: options.userName,
        },
      }).catch(() => null);
    } finally {
      processed++;
      options.onProgress?.({ succeeded: success });
    }
  };

  const worker = async () => {
    while (cursor < candidates.length) {
      const match = candidates[cursor++];
      if (match) await processCandidate(match);
    }
  };

  const workerCount = Math.min(
    Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY),
    Math.max(candidates.length, 1),
  );
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return { total: candidates.length, processed, succeeded, errors };
}

export async function getPlayerMatchEnrichmentStatus(
  db: PrismaClient,
  playerId: string,
  windowDays = DEFAULT_WINDOW_DAYS,
): Promise<PlayerMatchEnrichmentStatus> {
  const coverage = await getPlayerMatchEnrichmentCoverage(db, playerId, windowDays);
  return { ...coverage, job: jobs.get(playerId) ?? null };
}

export async function startPlayerMatchEnrichment(
  db: PrismaClient,
  playerId: string,
  accessToken: string,
  options: EnrichmentOptions = {},
): Promise<PlayerMatchEnrichmentStatus> {
  const current = jobs.get(playerId);
  if (current?.running) return getPlayerMatchEnrichmentStatus(db, playerId, options.windowDays);

  const job: PlayerMatchEnrichmentJob = {
    running: true,
    total: 0,
    processed: 0,
    succeeded: 0,
    errors: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  jobs.set(playerId, job);

  void enrichPlayerMatches(db, playerId, accessToken, {
    ...options,
    onStart: (total) => {
      job.total = total;
    },
    onProgress: ({ succeeded }) => {
      job.processed++;
      if (succeeded) job.succeeded++;
      else job.errors++;
    },
  }).then((result) => {
    job.total = result.total;
    job.processed = result.processed;
    job.succeeded = result.succeeded;
    job.errors = result.errors;
  }).catch((error) => {
    job.errors++;
    logger.error({ playerId, error }, 'player match enrichment job failed');
  }).finally(() => {
    job.running = false;
    job.finishedAt = new Date().toISOString();
  });

  return getPlayerMatchEnrichmentStatus(db, playerId, options.windowDays);
}
