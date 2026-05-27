/**
 * @fileoverview Automatic scrim result detection via pred.gg.
 *
 * For every ScrimSchedule that:
 *   - started 3h+ ago
 *   - is not cancelled
 *   - has no result yet
 *   - has no predggMatchId yet
 *
 * We try to find the corresponding pred.gg match by:
 *  1. Fetching the last 15 match UUIDs for each player in the team roster
 *  2. Finding a UUID shared by ≥3 roster players (= they played together)
 *  3. Loading that match's detail; confirming startTime falls in
 *     [scheduledAt - 30min, scheduledAt + 3h]
 *  4. Determining WIN or LOSS by comparing our players' team (DAWN/DUSK)
 *     against match.winningTeam
 *
 * Uses only confirmed-working pred.gg query forms (same X-Api-Key auth as the rest of
 * the data-sync worker). If a player's match history returns Forbidden (private account),
 * that player is silently skipped.
 */

import { PrismaClient } from '@prisma/client';
import { gql } from '../client.js';

// ─── pred.gg query types ─────────────────────────────────────────────────────

interface MatchNode {
  uuid: string;
}

interface PredggMatchDetail {
  uuid: string;
  startTime: string;
  winningTeam: string | null;
  matchPlayers: Array<{
    team: string;
    player: { id: string } | null;
  }>;
}

// ─── GraphQL queries ──────────────────────────────────────────────────────────

/**
 * Fetches the last N match UUIDs for a player.
 * `filter: {}` = all game modes (RANKED, STANDARD, CUSTOM, etc.)
 * Uses `nodes { uuid }` — the format confirmed working in production.
 */
const PLAYER_RECENT_MATCHES_QUERY = `
  query ScrimDetectPlayerMatches($playerId: ID!) {
    player(by: { id: $playerId }) {
      matchesPaginated(limit: 15, offset: 0, filter: {}) {
        nodes { uuid }
      }
    }
  }
`;

/**
 * Full match detail for a given match UUID.
 * Same structure as the existing MATCH_QUERY in matches.ts — confirmed working.
 */
const MATCH_DETAIL_QUERY = `
  query ScrimDetectMatchDetail($uuid: String!) {
    match(by: { uuid: $uuid }) {
      uuid
      startTime
      winningTeam
      matchPlayers {
        team
        player { id }
      }
    }
  }
`;

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Detect and persist results for all pending scrims.
 * Returns the number of scrims where a result was successfully determined.
 */
export async function detectScrimResults(db: PrismaClient): Promise<number> {
  const threshold = new Date(Date.now() - 3 * 60 * 60 * 1000); // now - 3h

  const scrims = await db.scrimSchedule.findMany({
    where: {
      scheduledAt: { lte: threshold },
      status: { not: 'CANCELADO' },
      result: null,
      predggMatchId: null,
    },
    select: { id: true, teamId: true, scheduledAt: true },
  });

  if (scrims.length === 0) {
    console.log('[detect-results] no pending scrims');
    return 0;
  }

  console.log(`[detect-results] checking ${scrims.length} scrim(s)`);
  let detected = 0;

  for (const scrim of scrims) {
    try {
      const result = await detectOneScrim(db, scrim);
      if (result) detected++;
    } catch (err) {
      console.error(`[detect-results] scrim ${scrim.id} unhandled error:`, err);
    }
  }

  return detected;
}

// ─── Per-scrim detection ──────────────────────────────────────────────────────

async function detectOneScrim(
  db: PrismaClient,
  scrim: { id: string; teamId: string; scheduledAt: Date },
): Promise<boolean> {
  // 1. Get the current active roster with pred.gg IDs
  const roster = await db.teamRoster.findMany({
    where: {
      teamId: scrim.teamId,
      activeTo: null,
    },
    include: { player: { select: { predggId: true } } },
  });

  const predggIds = roster
    .map((r) => r.player.predggId)
    .filter((id): id is string => id !== null && id !== '');

  if (predggIds.length < 3) {
    console.log(`[detect-results] scrim ${scrim.id}: only ${predggIds.length} players with pred.gg IDs — skipping`);
    return false;
  }

  // 2. Fetch recent match UUIDs for each roster player
  const matchUuidCounts = new Map<string, number>();

  for (const predggId of predggIds) {
    let nodes: MatchNode[] = [];

    try {
      const data = await gql<{
        player: { matchesPaginated: { nodes: MatchNode[] } } | null;
      }>(PLAYER_RECENT_MATCHES_QUERY, { playerId: predggId });

      nodes = data?.player?.matchesPaginated?.nodes ?? [];
    } catch (err) {
      // Private account or API error — skip this player, not fatal
      console.warn(`[detect-results] player ${predggId}: ${String(err).slice(0, 120)}`);
      continue;
    }

    // Count unique UUIDs per player (avoid double-counting if API returns dupes)
    const seen = new Set<string>();
    for (const node of nodes) {
      if (!seen.has(node.uuid)) {
        seen.add(node.uuid);
        matchUuidCounts.set(node.uuid, (matchUuidCounts.get(node.uuid) ?? 0) + 1);
      }
    }
  }

  // 3. Find candidate UUIDs where ≥3 roster players share the same match
  const candidates = [...matchUuidCounts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1]) // prefer UUIDs with more players first
    .map(([uuid]) => uuid);

  if (candidates.length === 0) {
    console.log(`[detect-results] scrim ${scrim.id}: no common match UUID across ≥3 players`);
    return false;
  }

  // Time window: scheduledAt ± some tolerance
  const windowStart = new Date(scrim.scheduledAt.getTime() - 30 * 60 * 1000);   // -30 min
  const windowEnd   = new Date(scrim.scheduledAt.getTime() + 3  * 60 * 60 * 1000); // +3 h

  // 4. Check each candidate match against the time window
  for (const uuid of candidates) {
    let matchDetail: PredggMatchDetail | null = null;

    try {
      const data = await gql<{ match: PredggMatchDetail | null }>(MATCH_DETAIL_QUERY, { uuid });
      matchDetail = data.match;
    } catch (err) {
      console.warn(`[detect-results] match ${uuid}: ${String(err).slice(0, 120)}`);
      continue;
    }

    if (!matchDetail) continue;

    const matchStart = new Date(matchDetail.startTime);
    if (matchStart < windowStart || matchStart > windowEnd) {
      // Match exists but is outside our time window — not our game
      continue;
    }

    if (!matchDetail.winningTeam) {
      // Match has no result (maybe in-progress or draw in some game modes)
      continue;
    }

    // 5. Determine which side (DAWN/DUSK) our players played on
    //    Take a majority vote among roster players found in this match
    const teamTally: Record<string, number> = {};
    for (const mp of matchDetail.matchPlayers) {
      if (mp.player && predggIds.includes(mp.player.id)) {
        teamTally[mp.team] = (teamTally[mp.team] ?? 0) + 1;
      }
    }

    const [[ourTeam] = []] = Object.entries(teamTally).sort((a, b) => b[1] - a[1]);
    if (!ourTeam) continue;

    const result: 'WIN' | 'LOSS' = ourTeam === matchDetail.winningTeam ? 'WIN' : 'LOSS';

    await db.scrimSchedule.update({
      where: { id: scrim.id },
      data: { result, predggMatchId: uuid },
    });

    console.log(
      `[detect-results] scrim ${scrim.id}: ${result}` +
      ` (match ${uuid}, started ${matchStart.toISOString()}, ourTeam=${ourTeam}, winner=${matchDetail.winningTeam})`,
    );
    return true;
  }

  console.log(`[detect-results] scrim ${scrim.id}: ${candidates.length} candidate(s) found but none in time window`);
  return false;
}
