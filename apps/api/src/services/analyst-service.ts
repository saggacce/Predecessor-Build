import { type PrismaClient } from '@prisma/client';
import { db } from '../db.js';
import { AppError } from '../middleware/error-handler.js';
import { getConfigMap } from './config-service.js';
import { insightStrings, type InsightLang } from './insight-strings.js';

export interface Insight {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'positive';
  category: 'macro' | 'vision' | 'draft' | 'performance' | 'economy';
  title: string;
  body: string;
  evidence: string[];
  recommendation: string;
  reviewRequired: boolean;
  affectedPlayers?: string[];
}

const SEVERITY_ORDER: Record<Insight['severity'], number> = {
  critical: 0, high: 1, medium: 2, low: 3, positive: 4,
};

const MAJOR_OBJECTIVES = ['FANGTOOTH', 'PRIMAL_FANGTOOTH', 'ORB_PRIME', 'MINI_PRIME', 'SHAPER'];

// ── Minimum sample sizes for statistical confidence ───────────────────────────
const MIN_EVENT_MATCHES = 10;       // team matches with full event stream
const MIN_OBJ_OPPORTUNITIES = 15;   // objectives analyzed for vision/conversion rules
const MIN_WARD_EVENTS = 25;         // ward events for vision backup rules
const MIN_PLAYER_MATCHES = 30;      // individual player match history
const MIN_CALC_PTS = 7;             // usable data points within a 10-match window
const MIN_CHAIN_OCC = 5;            // chain rule occurrences (obj-after-death, etc.)
const MIN_OBJ_TYPE = 8;             // minimum of a specific objective type secured

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(n: number, d: number) {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

function fmt(n: number) {
  return Math.round(n).toLocaleString('es-ES');
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function getTeamInsights(teamId: string, lang: InsightLang = 'es'): Promise<Insight[]> {
  const team = await db.team.findUnique({
    where: { id: teamId },
    include: {
      roster: {
        where: { activeTo: null },
        include: { player: { include: { snapshots: { orderBy: { syncedAt: 'desc' }, take: 1 } } } },
      },
    },
  });
  if (!team) throw new AppError(404, `Team not found: ${teamId}`, 'TEAM_NOT_FOUND');

  const isRival = team.type === 'RIVAL';
  const teamRef = isRival ? 'El rival' : 'El equipo';

  const rosterPlayerIds = team.roster.map((r) => r.player.id);
  if (rosterPlayerIds.length === 0) return [];

  // Load platform config (5-min cache) — overrides module-level constants
  const cfg = await getConfigMap(db);
  const MIN_EVENT_MATCHES = cfg.get('analyst_min_event_matches') ?? 10;
  const MIN_OBJ_OPPORTUNITIES = cfg.get('analyst_min_obj_opportunities') ?? 15;
  const MIN_WARD_EVENTS = cfg.get('analyst_min_ward_events') ?? 25;
  const MIN_PLAYER_MATCHES = cfg.get('analyst_min_player_matches') ?? 30;
  const MIN_CHAIN_OCC = cfg.get('analyst_min_chain_occ') ?? 5;
  const MIN_OBJ_TYPE = cfg.get('analyst_min_obj_type') ?? 8;
  const DEATH_WINDOW = cfg.get('analyst_death_window_secs') ?? 60;
  const VISION_WINDOW = cfg.get('analyst_vision_window_secs') ?? 90;
  const THROW_GOLD_LEAD = cfg.get('analyst_throw_gold_lead') ?? 3000;
  const WARD_BASELINE: Record<string, number> = {
    support: cfg.get('analyst_ward_baseline_support') ?? 1.0,
    jungle: cfg.get('analyst_ward_baseline_jungle') ?? 0.5,
    midlane: cfg.get('analyst_ward_baseline_midlane') ?? 0.35,
    offlane: cfg.get('analyst_ward_baseline_offlane') ?? 0.30,
    carry: cfg.get('analyst_ward_baseline_carry') ?? 0.25,
  };

  // Player name map for evidence messages
  const playerName = new Map(
    team.roster.map((r) => [r.player.id, r.player.customName ?? r.player.displayName]),
  );

  // ── Recent MatchPlayer data (all player matches, for performance rules) ────
  const recentMPs = await db.matchPlayer.findMany({
    where: { playerId: { in: rosterPlayerIds } },
    include: { match: { select: { winningTeam: true, duration: true, startTime: true } } },
    orderBy: { match: { startTime: 'desc' } },
    take: 50 * rosterPlayerIds.length,
  });
  const mpByPlayer = new Map<string, typeof recentMPs>();
  for (const mp of recentMPs) {
    if (!mp.playerId) continue;
    const arr = mpByPlayer.get(mp.playerId) ?? [];
    arr.push(mp);
    mpByPlayer.set(mp.playerId, arr);
  }

  // ── Team matches with event stream ────────────────────────────────────────
  const teamMatchRows = await db.$queryRaw<Array<{
    matchId: string; team: string; winningTeam: string | null;
  }>>`
    SELECT mp."matchId", mp."team", m."winningTeam"
    FROM "MatchPlayer" mp
    JOIN "Match" m ON m.id = mp."matchId"
    WHERE mp."playerId" = ANY(${rosterPlayerIds}::text[])
      AND m."eventStreamSynced" = true
    GROUP BY mp."matchId", m."startTime", mp."team", m."winningTeam"
    HAVING COUNT(DISTINCT mp."playerId") >= 3
    ORDER BY m."startTime" DESC
    LIMIT 30
  `;

  const eventMatchIds = teamMatchRows.map((r) => r.matchId);
  const teamSideMap = new Map(teamMatchRows.map((r) => [r.matchId, r.team]));

  // Batch-fetch event data for these matches (only if there are any)
  const [objKills, heroKills, wardEvents, structDestructions] = eventMatchIds.length > 0
    ? await Promise.all([
        db.objectiveKill.findMany({
          where: { matchId: { in: eventMatchIds } },
          select: { matchId: true, entityType: true, killerTeam: true, gameTime: true, killerPlayerId: true },
        }),
        db.heroKill.findMany({
          where: { matchId: { in: eventMatchIds } },
          select: { matchId: true, gameTime: true, killedPlayerId: true, killerPlayerId: true, killerTeam: true, killedTeam: true },
        }),
        db.wardEvent.findMany({
          where: { matchId: { in: eventMatchIds } },
          select: { matchId: true, gameTime: true, eventType: true, wardType: true, team: true },
        }),
        db.structureDestruction.findMany({
          where: { matchId: { in: eventMatchIds } },
          select: { matchId: true, gameTime: true, destructionTeam: true, structureType: true },
        }),
      ])
    : [[], [], [], []];

  // Deaths where our roster players were killed (backwards-compatible alias)
  const rosterDeaths = heroKills.filter(
    (k) => k.killedPlayerId && rosterPlayerIds.includes(k.killedPlayerId),
  );
  // Kills made by our roster players (needed for objective-after-kill chain)
  const rosterKills = heroKills.filter(
    (k) => k.killerPlayerId && rosterPlayerIds.includes(k.killerPlayerId),
  );

  // ── Player snapshots for draft rules ──────────────────────────────────────
  const snapshots = new Map(
    team.roster.map((r) => [r.player.id, r.player.snapshots[0] ?? null]),
  );

  // ── HeroMeta for draft imbalance rule ────────────────────────────────────
  const heroMetaList = await db.heroMeta.findMany({ select: { slug: true, classes: true } });
  const heroMetaClasses = new Map(heroMetaList.map((h) => [h.slug, h.classes as string[]]));

  // ── Per-match team aggregates (for KP, death share, gold-damage gap) ──────
  const teamKillsPerMatch = new Map<string, number>();
  const teamDeathsPerMatch = new Map<string, number>();
  const teamGoldPerMatch = new Map<string, number>();
  const teamDmgPerMatch = new Map<string, number>();
  for (const mp of recentMPs) {
    const key = `${mp.matchId}:${mp.team}`;
    teamKillsPerMatch.set(key, (teamKillsPerMatch.get(key) ?? 0) + mp.kills);
    teamDeathsPerMatch.set(key, (teamDeathsPerMatch.get(key) ?? 0) + mp.deaths);
    teamGoldPerMatch.set(key, (teamGoldPerMatch.get(key) ?? 0) + (mp.gold ?? 0));
    teamDmgPerMatch.set(key, (teamDmgPerMatch.get(key) ?? 0) + (mp.heroDamage ?? 0));
  }

  // ── Role lookup from roster ───────────────────────────────────────────────
  const playerRole = new Map(team.roster.map((r) => [r.player.id, r.role?.toLowerCase() ?? '']));

  // ── Objective control totals (for positive rule) ──────────────────────────
  const objControlMap = new Map<string, { team: number; rival: number }>();
  for (const o of objKills) {
    const side = teamSideMap.get(o.matchId);
    if (!side) continue;
    const entry = objControlMap.get(o.entityType) ?? { team: 0, rival: 0 };
    if (o.killerTeam === side) entry.team++;
    else entry.rival++;
    objControlMap.set(o.entityType, entry);
  }

  const insights: Insight[] = [];

  // ─────────────────────────────────────────────────────────────────────────
  // RULE 1 — Critical deaths before major objective
  // ─────────────────────────────────────────────────────────────────────────
  if (eventMatchIds.length >= MIN_EVENT_MATCHES) {
    const majorObjs = objKills.filter((o) => MAJOR_OBJECTIVES.includes(o.entityType));

    let matchesWithCritDeath = 0;
    const affectedByMatch: { matchId: string; objType: string; playerName: string }[] = [];

    for (const matchId of eventMatchIds) {
      const matchObjs = majorObjs.filter((o) => o.matchId === matchId);
      const matchKills = rosterDeaths.filter((k) => k.matchId === matchId);

      let hasCritDeath = false;
      for (const obj of matchObjs) {
        const windowKills = matchKills.filter(
          (k) => k.gameTime >= obj.gameTime - DEATH_WINDOW && k.gameTime < obj.gameTime,
        );
        for (const k of windowKills) {
          if (k.killedPlayerId && rosterPlayerIds.includes(k.killedPlayerId)) {
            hasCritDeath = true;
            affectedByMatch.push({
              matchId,
              objType: obj.entityType,
              playerName: playerName.get(k.killedPlayerId) ?? 'Unknown',
            });
          }
        }
      }
      if (hasCritDeath) matchesWithCritDeath++;
    }

    const critPct = pct(matchesWithCritDeath, eventMatchIds.length);
    if (critPct >= 60) {
      const roles = [...new Set(affectedByMatch.map((a) => a.playerName))].slice(0, 3);
      const objTypes = [...new Set(affectedByMatch.map((a) => a.objType))];
      // See insight-strings.ts for text
      const txt = insightStrings['rule-crit-death-obj'](lang, {
        critPct, matchesWithCritDeath, totalMatches: eventMatchIds.length,
        roles, objTypes, isRival, teamRef,
      });
      insights.push({
        id: 'rule-crit-death-obj',
        severity: 'critical',
        category: 'macro',
        ...txt,
        reviewRequired: !isRival,
        affectedPlayers: roles,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RULE 2 — Low vision before objective
  // ─────────────────────────────────────────────────────────────────────────
  if (eventMatchIds.length >= MIN_EVENT_MATCHES) {
    const majorObjs = objKills.filter((o) => MAJOR_OBJECTIVES.includes(o.entityType));
    let objsWithNoVision = 0;
    let totalObjs = 0;

    for (const obj of majorObjs) {
      const side = teamSideMap.get(obj.matchId);
      if (!side) continue;
      totalObjs++;
      const wardsPlacedBefore = wardEvents.filter(
        (w) =>
          w.matchId === obj.matchId &&
          w.eventType === 'PLACEMENT' &&
          w.team === side &&
          w.gameTime >= obj.gameTime - VISION_WINDOW &&
          w.gameTime < obj.gameTime,
      );
      if (wardsPlacedBefore.length === 0) objsWithNoVision++;
    }

    const noVisionPct = pct(objsWithNoVision, totalObjs);
    if (totalObjs >= MIN_OBJ_OPPORTUNITIES && noVisionPct >= 50) {
      // See insight-strings.ts for text
      const txt = insightStrings['rule-low-vision-obj'](lang, {
        noVisionPct, objsWithNoVision, totalObjs, totalMatches: eventMatchIds.length,
        isRival, teamRef,
      });
      insights.push({
        id: 'rule-low-vision-obj',
        severity: 'high',
        category: 'vision',
        ...txt,
        reviewRequired: !isRival,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RULE 3 — Vision cleaned before objective
  // ─────────────────────────────────────────────────────────────────────────
  if (eventMatchIds.length >= MIN_EVENT_MATCHES) {
    const majorObjs = objKills.filter((o) => MAJOR_OBJECTIVES.includes(o.entityType));
    let objsWithCleanedVision = 0;
    let totalObjs = 0;

    for (const obj of majorObjs) {
      const side = teamSideMap.get(obj.matchId);
      if (!side) continue;
      totalObjs++;
      const ownWardsDestroyed = wardEvents.filter(
        (w) =>
          w.matchId === obj.matchId &&
          w.eventType === 'DESTRUCTION' &&
          w.team === side &&
          w.gameTime >= obj.gameTime - 120 &&
          w.gameTime < obj.gameTime,
      );
      if (ownWardsDestroyed.length >= 2) objsWithCleanedVision++;
    }

    const cleanedPct = pct(objsWithCleanedVision, totalObjs);
    if (totalObjs >= MIN_OBJ_OPPORTUNITIES && cleanedPct >= 40) {
      // See insight-strings.ts for text
      const txt = insightStrings['rule-vision-cleaned'](lang, {
        cleanedPct, objsWithCleanedVision, totalObjs, isRival, teamRef,
      });
      insights.push({
        id: 'rule-vision-cleaned',
        severity: 'high',
        category: 'vision',
        ...txt,
        reviewRequired: false,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RULE 4 — Prime not converted
  // ─────────────────────────────────────────────────────────────────────────
  if (eventMatchIds.length >= MIN_EVENT_MATCHES) {
    const primes = objKills.filter((o) => o.entityType === 'ORB_PRIME');
    const teamPrimes = primes.filter((o) => o.killerTeam === teamSideMap.get(o.matchId));

    let notConverted = 0;
    for (const prime of teamPrimes) {
      const side = teamSideMap.get(prime.matchId);
      const structures = structDestructions.filter(
        (s) =>
          s.matchId === prime.matchId &&
          s.destructionTeam === side &&
          s.gameTime >= prime.gameTime &&
          s.gameTime <= prime.gameTime + 180 &&
          ['INNER_TOWER', 'INHIBITOR', 'CORE'].includes(s.structureType),
      );
      if (structures.length === 0) notConverted++;
    }

    const notConvPct = pct(notConverted, teamPrimes.length);
    if (teamPrimes.length >= MIN_OBJ_TYPE && notConvPct >= 50) {
      // See insight-strings.ts for text
      const txt = insightStrings['rule-prime-no-conv'](lang, {
        notConvPct, notConverted, teamPrimesLength: teamPrimes.length, isRival, teamRef,
      });
      insights.push({
        id: 'rule-prime-no-conv',
        severity: 'high',
        category: 'macro',
        ...txt,
        reviewRequired: !isRival,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RULE 5 — Draft dependency (pool < 2 héroes fiables)
  // ─────────────────────────────────────────────────────────────────────────
  for (const [playerId, mps] of mpByPlayer) {
    if (mps.length < MIN_PLAYER_MATCHES) continue;

    const heroCount = new Map<string, number>();
    for (const mp of mps) heroCount.set(mp.heroSlug, (heroCount.get(mp.heroSlug) ?? 0) + 1);

    const sorted = [...heroCount.entries()].sort((a, b) => b[1] - a[1]);
    const top2 = sorted.slice(0, 2).reduce((s, [, c]) => s + c, 0);
    const top2Pct = pct(top2, mps.length);

    if (top2Pct >= 65) {
      const name = playerName.get(playerId) ?? 'Unknown';
      const heroes = sorted.slice(0, 2).map(([h]) => h).join(' + ');
      // See insight-strings.ts for text
      const txt = insightStrings['rule-draft-dep'](lang, {
        name, top2Pct, top2, mpsLength: mps.length, heroes, poolSize: sorted.length, isRival,
      });
      insights.push({
        id: `rule-draft-dep-${playerId}`,
        severity: 'medium',
        category: 'draft',
        ...txt,
        reviewRequired: false,
        affectedPlayers: [name],
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RULE 6 — Throw pattern (gold lead lost)
  // ─────────────────────────────────────────────────────────────────────────
  if (eventMatchIds.length >= MIN_EVENT_MATCHES) {
    let throwMatches = 0;
    for (const matchId of eventMatchIds) {
      const side = teamSideMap.get(matchId);
      const row = teamMatchRows.find((r) => r.matchId === matchId);
      if (!row || row.winningTeam === side || !row.winningTeam) continue; // only losses

      // Get goldEarnedAtInterval for our team players in this match
      const ownMPs = await db.matchPlayer.findMany({
        where: { matchId, playerId: { in: rosterPlayerIds } },
        select: { goldEarnedAtInterval: true, team: true },
      });
      const rivalMPs = await db.matchPlayer.findMany({
        where: { matchId, playerId: { notIn: [...rosterPlayerIds, ''] }, team: { not: side } },
        select: { goldEarnedAtInterval: true },
      });

      const ownIntervals = ownMPs
        .map((m) => m.goldEarnedAtInterval as number[] | null)
        .filter((v): v is number[] => Array.isArray(v));
      const rivalIntervals = rivalMPs
        .map((m) => m.goldEarnedAtInterval as number[] | null)
        .filter((v): v is number[] => Array.isArray(v));

      if (ownIntervals.length < 3 || rivalIntervals.length < 3) continue;

      const minLen = Math.min(
        Math.min(...ownIntervals.map((a) => a.length)),
        Math.min(...rivalIntervals.map((a) => a.length)),
      );

      let maxLead = 0;
      for (let i = 0; i < minLen; i++) {
        const ownGold = ownIntervals.reduce((s, a) => s + (a[i] ?? 0), 0);
        const rivalGold = rivalIntervals.reduce((s, a) => s + (a[i] ?? 0), 0);
        maxLead = Math.max(maxLead, ownGold - rivalGold);
      }
      if (maxLead >= THROW_GOLD_LEAD) throwMatches++;
    }

    if (throwMatches >= 4) {
      // See insight-strings.ts for text
      const txt = insightStrings['rule-throw'](lang, { throwMatches, isRival, teamRef });
      insights.push({
        id: 'rule-throw',
        severity: 'high',
        category: 'economy',
        ...txt,
        reviewRequired: !isRival,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RULE 7 — Player slump
  // ─────────────────────────────────────────────────────────────────────────
  for (const [playerId, mps] of mpByPlayer) {
    if (mps.length < MIN_PLAYER_MATCHES) continue;

    const snap = snapshots.get(playerId);
    const historicalKda = snap
      ? (((snap.generalStats as Record<string, unknown>)?.kda as number) ?? null)
      : null;
    if (!historicalKda || historicalKda === 0) continue;

    const last10 = mps.slice(0, 10);
    const recentKda =
      last10.reduce((s, m) => {
        const d = Math.max(m.deaths, 1);
        return s + (m.kills + m.assists) / d;
      }, 0) / last10.length;

    const delta = recentKda - historicalKda;
    if (delta < -1.0 && recentKda < 2.0) {
      const name = playerName.get(playerId) ?? 'Unknown';
      // See insight-strings.ts for text
      const txt = insightStrings['rule-slump'](lang, {
        name, recentKda, historicalKda, delta, isRival,
      });
      insights.push({
        id: `rule-slump-${playerId}`,
        severity: 'medium',
        category: 'performance',
        ...txt,
        reviewRequired: false,
        affectedPlayers: [name],
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RULE 8 — Vision gaps (wards/min below role baseline)
  // ─────────────────────────────────────────────────────────────────────────
  // WARD_BASELINE is now loaded from config above

  const lowVisionPlayers: string[] = [];
  for (const [playerId, mps] of mpByPlayer) {
    const role = team.roster.find((r) => r.player.id === playerId)?.role?.toLowerCase() ?? null;
    if (!role || !WARD_BASELINE[role]) continue;

    const withWards = mps.filter((m) => m.wardsPlaced !== null && m.match.duration > 0);
    if (withWards.length < MIN_PLAYER_MATCHES) continue;

    const avgWardsPerMin =
      withWards.reduce((s, m) => s + (m.wardsPlaced! / (m.match.duration / 60)), 0) / withWards.length;

    const baseline = WARD_BASELINE[role];
    if (avgWardsPerMin < baseline * 0.65) {
      lowVisionPlayers.push(`${playerName.get(playerId) ?? 'Unknown'} (${avgWardsPerMin.toFixed(2)}/min, ref: ${baseline})`);
    }
  }

  if (lowVisionPlayers.length > 0) {
    // See insight-strings.ts for text
    const txt = insightStrings['rule-vision-gaps'](lang, {
      lowVisionPlayersCount: lowVisionPlayers.length,
      lowVisionPlayers,
      isRival,
    });
    insights.push({
      id: 'rule-vision-gaps',
      severity: 'medium',
      category: 'vision',
      ...txt,
      reviewRequired: false,
      affectedPlayers: lowVisionPlayers.map((s) => s.split(' (')[0]),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RULE 9 — Positive reinforcement
  // ─────────────────────────────────────────────────────────────────────────
  const ftData = ['FANGTOOTH', 'PRIMAL_FANGTOOTH'].reduce(
    (acc, key) => {
      const d = objControlMap.get(key);
      if (d) { acc.team += d.team; acc.rival += d.rival; }
      return acc;
    },
    { team: 0, rival: 0 },
  );
  const primeData = ['MINI_PRIME', 'ORB_PRIME'].reduce(
    (acc, key) => {
      const d = objControlMap.get(key);
      if (d) { acc.team += d.team; acc.rival += d.rival; }
      return acc;
    },
    { team: 0, rival: 0 },
  );

  const ftTotal = ftData.team + ftData.rival;
  const primeTotal = primeData.team + primeData.rival;
  const ftCtrl = pct(ftData.team, ftTotal);
  const primeCtrl = pct(primeData.team, primeTotal);

  if (ftTotal >= MIN_OBJ_OPPORTUNITIES && ftCtrl >= 70) {
    // See insight-strings.ts for text
    const txt = insightStrings['rule-positive-ft'](lang, {
      ftCtrl, ftDataTeam: ftData.team, ftTotal, isRival, teamRef,
    });
    insights.push({
      id: 'rule-positive-ft',
      severity: isRival ? 'high' : 'positive',
      category: 'macro',
      ...txt,
      reviewRequired: false,
    });
  }

  if (primeTotal >= MIN_OBJ_OPPORTUNITIES && primeCtrl >= 70) {
    // See insight-strings.ts for text
    const txt = insightStrings['rule-positive-prime'](lang, {
      primeCtrl, primeDataTeam: primeData.team, primeTotal, isRival, teamRef,
    });
    insights.push({
      id: 'rule-positive-prime',
      severity: isRival ? 'high' : 'positive',
      category: 'macro',
      ...txt,
      reviewRequired: false,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GROUP A — Deaths by role before major objectives
  // ─────────────────────────────────────────────────────────────────────────
  if (eventMatchIds.length >= MIN_EVENT_MATCHES) {
    const majorObjs = objKills.filter((o) => MAJOR_OBJECTIVES.includes(o.entityType));

    const roleRules: Array<{ role: string; id: string; label: string }> = [
      { role: 'jungle', id: 'rule-jungler-death-obj', label: 'Jungla' },
      { role: 'support', id: 'rule-support-death-obj', label: 'Support' },
      { role: 'carry', id: 'rule-carry-death-obj', label: 'Carry' },
    ];

    for (const { role, id, label } of roleRules) {
      let matchCount = 0;
      const ev: string[] = [];
      for (const matchId of eventMatchIds) {
        const matchObjs = majorObjs.filter((o) => o.matchId === matchId);
        const matchDeaths = rosterDeaths.filter((k) => k.matchId === matchId);
        let hit = false;
        for (const obj of matchObjs) {
          const windowDeaths = matchDeaths.filter(
            (k) => k.gameTime >= obj.gameTime - DEATH_WINDOW && k.gameTime < obj.gameTime,
          );
          for (const d of windowDeaths) {
            if (playerRole.get(d.killedPlayerId ?? '') === role) {
              hit = true;
              ev.push(`${playerName.get(d.killedPlayerId ?? '') ?? label} murió antes de ${d.killedPlayerId ? obj.entityType : '?'}`);
            }
          }
        }
        if (hit) matchCount++;
      }
      const p = pct(matchCount, eventMatchIds.length);
      if (p >= 40) {
        // See insight-strings.ts for text
        const txt = insightStrings['rule-role-death-obj'](lang, {
          label, p, ev: [...new Set(ev)].slice(0, 4), isRival,
        });
        insights.push({
          id,
          severity: 'high',
          category: 'macro',
          ...txt,
          reviewRequired: !isRival,
        });
      }
    }

    // Multiple deaths before objective (≥2 in same window)
    let multiMatchCount = 0;
    const multiEv: string[] = [];
    for (const matchId of eventMatchIds) {
      const matchObjs = majorObjs.filter((o) => o.matchId === matchId);
      const matchDeaths = rosterDeaths.filter((k) => k.matchId === matchId);
      let hit = false;
      for (const obj of matchObjs) {
        const windowDeaths = matchDeaths.filter(
          (k) => k.gameTime >= obj.gameTime - DEATH_WINDOW && k.gameTime < obj.gameTime,
        );
        if (windowDeaths.length >= 2) {
          hit = true;
          multiEv.push(`${windowDeaths.length} muertes antes de ${obj.entityType}`);
        }
      }
      if (hit) multiMatchCount++;
    }
    const multiPct = pct(multiMatchCount, eventMatchIds.length);
    if (multiPct >= 40) {
      // See insight-strings.ts for text
      const txt = insightStrings['rule-multi-death-obj'](lang, {
        multiPct, multiMatchCount, ev: [...new Set(multiEv)].slice(0, 4), isRival, teamRef,
      });
      insights.push({
        id: 'rule-multi-death-obj',
        severity: 'critical',
        category: 'macro',
        ...txt,
        reviewRequired: !isRival,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GROUP B — Vision sub-rules
  // ─────────────────────────────────────────────────────────────────────────
  if (eventMatchIds.length >= MIN_EVENT_MATCHES) {
    const majorObjs = objKills.filter((o) => MAJOR_OBJECTIVES.includes(o.entityType));

    // B1 — Late vision setup (<30s before objective)
    {
      let lateSetupObjs = 0;
      let totalMajorObjs = 0;
      for (const obj of majorObjs) {
        const side = teamSideMap.get(obj.matchId);
        if (!side) continue;
        totalMajorObjs++;
        const wardsIn90 = wardEvents.filter(
          (w) => w.matchId === obj.matchId && w.eventType === 'PLACEMENT' && w.team === side &&
            w.gameTime >= obj.gameTime - VISION_WINDOW && w.gameTime < obj.gameTime,
        );
        const wardsIn30 = wardsIn90.filter((w) => w.gameTime >= obj.gameTime - 30);
        if (wardsIn90.length > 0 && wardsIn90.length === wardsIn30.length) lateSetupObjs++;
      }
      const p = pct(lateSetupObjs, totalMajorObjs);
      if (totalMajorObjs >= MIN_OBJ_OPPORTUNITIES && p >= 40) {
        // See insight-strings.ts for text
        const txt = insightStrings['rule-late-vision-setup'](lang, {
          p, lateSetupObjs, totalMajorObjs, isRival, teamRef,
        });
        insights.push({
          id: 'rule-late-vision-setup',
          severity: 'medium',
          category: 'vision',
          ...txt,
          reviewRequired: false,
        });
      }
    }

    // B2 — No vision backup (ward destroyed, no replacement in 90s)
    {
      let noBackupCount = 0;
      let totalDestructions = 0;
      for (const matchId of eventMatchIds) {
        const side = teamSideMap.get(matchId);
        if (!side) continue;
        const destructions = wardEvents.filter(
          (w) => w.matchId === matchId && w.eventType === 'DESTRUCTION' && w.team === side,
        );
        for (const d of destructions) {
          totalDestructions++;
          const replacement = wardEvents.find(
            (w) => w.matchId === matchId && w.eventType === 'PLACEMENT' && w.team === side &&
              w.gameTime > d.gameTime && w.gameTime <= d.gameTime + 90,
          );
          if (!replacement) noBackupCount++;
        }
      }
      const p = pct(noBackupCount, totalDestructions);
      if (totalDestructions >= MIN_WARD_EVENTS && p >= 50) {
        // See insight-strings.ts for text
        const txt = insightStrings['rule-no-backup-vision'](lang, {
          p, noBackupCount, totalDestructions, isRival, teamRef,
        });
        insights.push({
          id: 'rule-no-backup-vision',
          severity: 'medium',
          category: 'vision',
          ...txt,
          reviewRequired: false,
        });
      }
    }

    // B3 — Vision lost without recovery near objectives
    {
      let visionLostObjs = 0;
      let totalObjsChecked = 0;
      for (const obj of majorObjs) {
        const side = teamSideMap.get(obj.matchId);
        if (!side) continue;
        totalObjsChecked++;
        const ownWardsDestroyed = wardEvents.filter(
          (w) => w.matchId === obj.matchId && w.eventType === 'DESTRUCTION' && w.team === side &&
            w.gameTime >= obj.gameTime - 120 && w.gameTime < obj.gameTime,
        );
        if (ownWardsDestroyed.length === 0) continue;
        const lastDestruction = ownWardsDestroyed[ownWardsDestroyed.length - 1];
        const recoveryWard = wardEvents.find(
          (w) => w.matchId === obj.matchId && w.eventType === 'PLACEMENT' && w.team === side &&
            w.gameTime > lastDestruction.gameTime && w.gameTime < obj.gameTime,
        );
        if (!recoveryWard) visionLostObjs++;
      }
      const p = pct(visionLostObjs, totalObjsChecked);
      if (totalObjsChecked >= MIN_OBJ_OPPORTUNITIES && p >= 40) {
        // See insight-strings.ts for text
        const txt = insightStrings['rule-vision-lost-no-recovery'](lang, {
          p, visionLostObjs, totalObjsChecked, isRival, teamRef,
        });
        insights.push({
          id: 'rule-vision-lost-no-recovery',
          severity: 'high',
          category: 'vision',
          ...txt,
          reviewRequired: !isRival,
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GROUP C — Conversion variants (Fangtooth, Shaper)
  // ─────────────────────────────────────────────────────────────────────────
  if (eventMatchIds.length >= MIN_EVENT_MATCHES) {
    const conversionRules: Array<{ types: string[]; id: string; label: string; window: number }> = [
      { types: ['FANGTOOTH', 'PRIMAL_FANGTOOTH'], id: 'rule-fangtooth-no-structure', label: 'Fangtooth', window: 120 },
      { types: ['SHAPER'], id: 'rule-shaper-no-structure', label: 'Shaper', window: 150 },
    ];

    for (const { types, id, label, window: convWindow } of conversionRules) {
      const objs = objKills.filter((o) => types.includes(o.entityType));
      const teamObjs = objs.filter((o) => o.killerTeam === teamSideMap.get(o.matchId));
      if (teamObjs.length < MIN_OBJ_TYPE) continue;

      let notConverted = 0;
      for (const obj of teamObjs) {
        const side = teamSideMap.get(obj.matchId);
        const structures = structDestructions.filter(
          (s) => s.matchId === obj.matchId && s.destructionTeam === side &&
            s.gameTime >= obj.gameTime && s.gameTime <= obj.gameTime + convWindow &&
            ['INNER_TOWER', 'INHIBITOR', 'CORE'].includes(s.structureType),
        );
        if (structures.length === 0) notConverted++;
      }

      const p = pct(notConverted, teamObjs.length);
      if (p >= 50) {
        // See insight-strings.ts for text
        const txt = insightStrings['rule-obj-no-structure'](lang, {
          label, p, notConverted, teamObjsLength: teamObjs.length, convWindow, isRival, teamRef,
        });
        insights.push({
          id,
          severity: 'medium',
          category: 'macro',
          ...txt,
          reviewRequired: false,
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GROUP D — Objective chain rules
  // ─────────────────────────────────────────────────────────────────────────
  if (eventMatchIds.length >= MIN_EVENT_MATCHES) {
    const majorObjs = objKills.filter((o) => MAJOR_OBJECTIVES.includes(o.entityType));

    // D1 — Objective lost after ally death
    let objLostAfterDeathCount = 0;
    const objLostEv: string[] = [];
    const matchesWithChain = new Set<string>();
    for (const death of rosterDeaths) {
      const side = teamSideMap.get(death.matchId);
      if (!side) continue;
      const rivalSide = side === 'DUSK' ? 'DAWN' : 'DUSK';
      const objAfter = majorObjs.find(
        (o) => o.matchId === death.matchId && o.killerTeam === rivalSide &&
          o.gameTime > death.gameTime && o.gameTime <= death.gameTime + 90,
      );
      if (objAfter && !matchesWithChain.has(death.matchId)) {
        matchesWithChain.add(death.matchId);
        objLostAfterDeathCount++;
        const dName = playerName.get(death.killedPlayerId ?? '') ?? 'jugador';
        objLostEv.push(`${dName} murió → ${objAfter.entityType} en ${Math.round((objAfter.gameTime - death.gameTime) / 60)}min`);
      }
    }
    if (objLostAfterDeathCount >= MIN_CHAIN_OCC) {
      // See insight-strings.ts for text
      const txt = insightStrings['rule-obj-lost-after-death'](lang, {
        objLostAfterDeathCount, ev: objLostEv.slice(0, 4), isRival,
      });
      insights.push({
        id: 'rule-obj-lost-after-death',
        severity: 'high',
        category: 'macro',
        ...txt,
        reviewRequired: !isRival,
      });
    }

    // D2 — Objective taken after killing a rival
    let objTakenAfterKillCount = 0;
    const objTakenEv: string[] = [];
    const matchesKillChain = new Set<string>();
    for (const kill of rosterKills) {
      const side = teamSideMap.get(kill.matchId);
      if (!side) continue;
      const objAfter = majorObjs.find(
        (o) => o.matchId === kill.matchId && o.killerTeam === side &&
          o.gameTime > kill.gameTime && o.gameTime <= kill.gameTime + 90,
      );
      if (objAfter && !matchesKillChain.has(kill.matchId)) {
        matchesKillChain.add(kill.matchId);
        objTakenAfterKillCount++;
        const kName = playerName.get(kill.killerPlayerId ?? '') ?? 'jugador';
        objTakenEv.push(`${kName} mató → ${objAfter.entityType} en ${Math.round((objAfter.gameTime - kill.gameTime) / 60)}min`);
      }
    }
    if (objTakenAfterKillCount >= MIN_CHAIN_OCC) {
      // See insight-strings.ts for text
      const txt = insightStrings['rule-obj-taken-after-kill'](lang, {
        objTakenAfterKillCount, ev: objTakenEv.slice(0, 4), isRival, teamRef,
      });
      insights.push({
        id: 'rule-obj-taken-after-kill',
        severity: isRival ? 'high' : 'positive',
        category: 'macro',
        ...txt,
        reviewRequired: false,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GROUP E — Individual performance slumps
  // ─────────────────────────────────────────────────────────────────────────
  const positiveFormCandidates: Array<{ name: string; playerId: string; delta: number }> = [];

  for (const [playerId, mps] of mpByPlayer) {
    if (mps.length < MIN_PLAYER_MATCHES) continue;
    const name = playerName.get(playerId) ?? 'Unknown';
    const last10 = mps.slice(0, 10);
    const prev10 = mps.slice(10, 20);
    const snap = snapshots.get(playerId);
    const historicalKda = snap
      ? (((snap.generalStats as Record<string, unknown>)?.kda as number) ?? null)
      : null;

    // GPM slump
    const last10Gpm = last10.filter((m) => m.match.duration > 0 && m.gold !== null);
    const prev10Gpm = prev10.filter((m) => m.match.duration > 0 && m.gold !== null);
    if (last10Gpm.length >= MIN_CALC_PTS && prev10Gpm.length >= MIN_CALC_PTS) {
      const recentGpm = last10Gpm.reduce((s, m) => s + m.gold! / (m.match.duration / 60), 0) / last10Gpm.length;
      const prevGpm = prev10Gpm.reduce((s, m) => s + m.gold! / (m.match.duration / 60), 0) / prev10Gpm.length;
      if (recentGpm < prevGpm * 0.80 && recentGpm < 300) {
        // See insight-strings.ts for text
        const txt = insightStrings['rule-gpm-slump'](lang, { name, recentGpm, prevGpm, isRival });
        insights.push({
          id: `rule-gpm-slump-${playerId}`,
          severity: 'medium',
          category: 'performance',
          ...txt,
          reviewRequired: false,
          affectedPlayers: [name],
        });
      }
    }

    // DPM slump
    const last10Dpm = last10.filter((m) => m.match.duration > 0 && m.heroDamage !== null);
    const prev10Dpm = prev10.filter((m) => m.match.duration > 0 && m.heroDamage !== null);
    if (last10Dpm.length >= MIN_CALC_PTS && prev10Dpm.length >= MIN_CALC_PTS) {
      const recentDpm = last10Dpm.reduce((s, m) => s + m.heroDamage! / (m.match.duration / 60), 0) / last10Dpm.length;
      const prevDpm = prev10Dpm.reduce((s, m) => s + m.heroDamage! / (m.match.duration / 60), 0) / prev10Dpm.length;
      if (recentDpm < prevDpm * 0.75 && recentDpm < 400) {
        // See insight-strings.ts for text
        const txt = insightStrings['rule-dpm-slump'](lang, { name, recentDpm, prevDpm, isRival });
        insights.push({
          id: `rule-dpm-slump-${playerId}`,
          severity: 'medium',
          category: 'performance',
          ...txt,
          reviewRequired: false,
          affectedPlayers: [name],
        });
      }
    }

    // KP low
    const kpMps = last10.filter((m) => {
      const tKey = `${m.matchId}:${m.team}`;
      return (teamKillsPerMatch.get(tKey) ?? 0) > 0;
    });
    if (kpMps.length >= MIN_CALC_PTS) {
      const avgKp =
        kpMps.reduce((s, m) => {
          const tk = teamKillsPerMatch.get(`${m.matchId}:${m.team}`) ?? 1;
          return s + (m.kills + m.assists) / tk;
        }, 0) / kpMps.length;
      if (avgKp < 0.35) {
        // See insight-strings.ts for text
        const txt = insightStrings['rule-kp-low'](lang, {
          name, avgKpPct: Math.round(avgKp * 100), kpMpsLength: kpMps.length, isRival,
        });
        insights.push({
          id: `rule-kp-low-${playerId}`,
          severity: 'medium',
          category: 'performance',
          ...txt,
          reviewRequired: false,
          affectedPlayers: [name],
        });
      }
    }

    // Death share high
    const deathMps = last10.filter((m) => {
      const tKey = `${m.matchId}:${m.team}`;
      return (teamDeathsPerMatch.get(tKey) ?? 0) > 0;
    });
    if (deathMps.length >= MIN_CALC_PTS) {
      const avgDs =
        deathMps.reduce((s, m) => {
          const td = teamDeathsPerMatch.get(`${m.matchId}:${m.team}`) ?? 1;
          return s + m.deaths / td;
        }, 0) / deathMps.length;
      if (avgDs > 0.35) {
        // See insight-strings.ts for text
        const txt = insightStrings['rule-death-share'](lang, {
          name, avgDsPct: Math.round(avgDs * 100), deathMpsLength: deathMps.length, isRival,
        });
        insights.push({
          id: `rule-death-share-${playerId}`,
          severity: 'medium',
          category: 'performance',
          ...txt,
          reviewRequired: false,
          affectedPlayers: [name],
        });
      }
    }

    // Gold-damage gap (high gold, low damage) — only carry/jungle/midlane
    const role = playerRole.get(playerId) ?? '';
    if (['carry', 'jungle', 'midlane'].includes(role)) {
      const gdMps = last10.filter((m) => {
        const tKey = `${m.matchId}:${m.team}`;
        return m.gold !== null && m.heroDamage !== null &&
          (teamGoldPerMatch.get(tKey) ?? 0) > 0 && (teamDmgPerMatch.get(tKey) ?? 0) > 0;
      });
      if (gdMps.length >= MIN_CALC_PTS) {
        const avgGoldShare =
          gdMps.reduce((s, m) => s + m.gold! / (teamGoldPerMatch.get(`${m.matchId}:${m.team}`) ?? 1), 0) / gdMps.length;
        const avgDmgShare =
          gdMps.reduce((s, m) => s + m.heroDamage! / (teamDmgPerMatch.get(`${m.matchId}:${m.team}`) ?? 1), 0) / gdMps.length;
        if (avgGoldShare - avgDmgShare > 0.10) {
          // See insight-strings.ts for text
          const txt = insightStrings['rule-gold-low-dmg'](lang, {
            name,
            avgGoldSharePct: Math.round(avgGoldShare * 100),
            avgDmgSharePct: Math.round(avgDmgShare * 100),
            gapPct: Math.round((avgGoldShare - avgDmgShare) * 100),
            isRival,
          });
          insights.push({
            id: `rule-gold-low-dmg-${playerId}`,
            severity: 'medium',
            category: 'performance',
            ...txt,
            reviewRequired: false,
            affectedPlayers: [name],
          });
        }
      }
    }

    // Positive player form
    if (historicalKda && historicalKda > 0 && mps.length >= MIN_PLAYER_MATCHES) {
      const recentKda =
        last10.reduce((s, m) => s + (m.kills + m.assists) / Math.max(m.deaths, 1), 0) / last10.length;
      const delta = recentKda - historicalKda;
      if (delta >= 0.8 && recentKda >= 3.0) {
        positiveFormCandidates.push({ name, playerId, delta });
      }
    }
  }

  // Only push the player with the biggest improvement
  if (positiveFormCandidates.length > 0) {
    const best = positiveFormCandidates.sort((a, b) => b.delta - a.delta)[0];
    const mps = mpByPlayer.get(best.playerId) ?? [];
    const snap = snapshots.get(best.playerId);
    const hist = snap ? (((snap.generalStats as Record<string, unknown>)?.kda as number) ?? 0) : 0;
    const recent = mps.slice(0, 10).reduce((s, m) => s + (m.kills + m.assists) / Math.max(m.deaths, 1), 0) / Math.min(mps.length, 10);
    // See insight-strings.ts for text
    const txt = insightStrings['rule-positive-player-form'](lang, {
      name: best.name, recentKda: recent, historicalKda: hist, delta: best.delta, isRival,
    });
    insights.push({
      id: `rule-positive-player-form-${best.playerId}`,
      severity: isRival ? 'high' : 'positive',
      category: 'performance',
      ...txt,
      reviewRequired: false,
      affectedPlayers: [best.name],
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GROUP F — Draft: damage type imbalance
  // ─────────────────────────────────────────────────────────────────────────
  {
    const PHYSICAL_CLASSES = ['Sharpshooter', 'Executioner', 'Assassin', 'Fighter'];
    const MAGICAL_CLASSES = ['Mage'];

    const playerDmgType = new Map<string, 'physical' | 'magical' | 'utility'>();
    for (const [playerId, mps] of mpByPlayer) {
      if (mps.length < 5) continue;
      const heroCount = new Map<string, number>();
      for (const mp of mps.slice(0, 20)) {
        heroCount.set(mp.heroSlug, (heroCount.get(mp.heroSlug) ?? 0) + 1);
      }
      const topHero = [...heroCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const classes = heroMetaClasses.get(topHero ?? '') ?? [];
      if (classes.some((c) => MAGICAL_CLASSES.includes(c))) playerDmgType.set(playerId, 'magical');
      else if (classes.some((c) => PHYSICAL_CLASSES.includes(c))) playerDmgType.set(playerId, 'physical');
      else playerDmgType.set(playerId, 'utility');
    }

    const magicalCount = [...playerDmgType.values()].filter((t) => t === 'magical').length;
    const physicalCount = [...playerDmgType.values()].filter((t) => t === 'physical').length;
    const totalClassified = playerDmgType.size;

    if (totalClassified >= 4) {
      if (magicalCount === 0 && physicalCount >= 3) {
        // See insight-strings.ts for text
        const txt = insightStrings['rule-draft-dmg-imbalance-ap'](lang, {
          physicalCount, magicalCount, totalClassified, isRival, teamRef,
        });
        insights.push({
          id: 'rule-draft-dmg-imbalance-ap',
          severity: 'medium',
          category: 'draft',
          ...txt,
          reviewRequired: false,
        });
      } else if (physicalCount === 0 && magicalCount >= 3) {
        // See insight-strings.ts for text
        const txt = insightStrings['rule-draft-dmg-imbalance-ad'](lang, {
          physicalCount, magicalCount, totalClassified, isRival, teamRef,
        });
        insights.push({
          id: 'rule-draft-dmg-imbalance-ad',
          severity: 'medium',
          category: 'draft',
          ...txt,
          reviewRequired: false,
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GROUP G — Rival scouting: objective control patterns
  // ─────────────────────────────────────────────────────────────────────────
  if (eventMatchIds.length >= MIN_EVENT_MATCHES) {
    const totalObjTeam = [...objControlMap.values()].reduce((s, d) => s + d.team, 0);
    const totalObjRival = [...objControlMap.values()].reduce((s, d) => s + d.rival, 0);
    const grandTotal = totalObjTeam + totalObjRival;

    if (grandTotal >= MIN_OBJ_OPPORTUNITIES) {
      const teamObjPct = pct(totalObjTeam, grandTotal);

      // Rival objective focused (high control by the team being analyzed = threat if rival)
      if (isRival && teamObjPct >= 55) {
        const objDetails = [...objControlMap.entries()]
          .filter(([, d]) => d.team > 0)
          .map(([type, d]) => `${type}: ${d.team} de ${d.team + d.rival}`)
          .slice(0, 3);
        // See insight-strings.ts for text
        const txt = insightStrings['rule-rival-obj-focused'](lang, {
          teamObjPct, totalObjTeam, grandTotal, objDetails, teamRef,
        });
        insights.push({
          id: 'rule-rival-obj-focused',
          severity: 'high',
          category: 'macro',
          ...txt,
          reviewRequired: false,
        });
      }

      // Rival weak objective defense (low control = opportunity for own team)
      if (isRival && teamObjPct <= 40) {
        // See insight-strings.ts for text
        const txt = insightStrings['rule-rival-weak-defense'](lang, {
          teamObjPct, totalObjTeam, grandTotal,
          ourImplicitCtrl: pct(totalObjRival, grandTotal), teamRef,
        });
        insights.push({
          id: 'rule-rival-weak-defense',
          severity: 'positive',
          category: 'macro',
          ...txt,
          reviewRequired: false,
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GROUP H — Positive variants
  // ─────────────────────────────────────────────────────────────────────────
  if (eventMatchIds.length >= MIN_EVENT_MATCHES) {
    const majorObjs = objKills.filter((o) => MAJOR_OBJECTIVES.includes(o.entityType));

    // H1 — Good vision setup before objectives
    {
      let goodVisionObjs = 0;
      let totalObjs = 0;
      const alreadyFlagged = insights.some((i) => i.id === 'rule-low-vision-obj');
      if (!alreadyFlagged) {
        for (const obj of majorObjs) {
          const side = teamSideMap.get(obj.matchId);
          if (!side) continue;
          totalObjs++;
          const wards = wardEvents.filter(
            (w) => w.matchId === obj.matchId && w.eventType === 'PLACEMENT' && w.team === side &&
              w.gameTime >= obj.gameTime - VISION_WINDOW && w.gameTime < obj.gameTime,
          );
          if (wards.length >= 2) goodVisionObjs++;
        }
        const p = pct(goodVisionObjs, totalObjs);
        if (totalObjs >= MIN_OBJ_OPPORTUNITIES && p >= 70) {
          // See insight-strings.ts for text
          const txt = insightStrings['rule-positive-vision-setup'](lang, {
            p, goodVisionObjs, totalObjs, isRival, teamRef,
          });
          insights.push({
            id: 'rule-positive-vision-setup',
            severity: isRival ? 'high' : 'positive',
            category: 'vision',
            ...txt,
            reviewRequired: false,
          });
        }
      }
    }

    // H2 — Good Prime conversion
    {
      const primes = objKills.filter((o) => o.entityType === 'ORB_PRIME');
      const teamPrimes = primes.filter((o) => o.killerTeam === teamSideMap.get(o.matchId));
      const alreadyFlagged = insights.some((i) => i.id === 'rule-prime-no-conv');
      if (!alreadyFlagged && teamPrimes.length >= MIN_OBJ_TYPE) {
        let converted = 0;
        for (const prime of teamPrimes) {
          const side = teamSideMap.get(prime.matchId);
          const structures = structDestructions.filter(
            (s) => s.matchId === prime.matchId && s.destructionTeam === side &&
              s.gameTime >= prime.gameTime && s.gameTime <= prime.gameTime + 180 &&
              ['INNER_TOWER', 'INHIBITOR', 'CORE'].includes(s.structureType),
          );
          if (structures.length > 0) converted++;
        }
        const p = pct(converted, teamPrimes.length);
        if (p >= 70) {
          // See insight-strings.ts for text
          const txt = insightStrings['rule-positive-prime-conv'](lang, {
            p, converted, teamPrimesLength: teamPrimes.length, isRival, teamRef,
          });
          insights.push({
            id: 'rule-positive-prime-conv',
            severity: isRival ? 'high' : 'positive',
            category: 'macro',
            ...txt,
            reviewRequired: false,
          });
        }
      }
    }
  }

  // ── Data status insight — always shown ───────────────────────────────────
  const totalMPs = [...mpByPlayer.values()].reduce((s, arr) => s + arr.length, 0);
  const playersWithEnoughData = [...mpByPlayer.values()].filter((arr) => arr.length >= MIN_PLAYER_MATCHES).length;
  const playerDataOk = playersWithEnoughData === rosterPlayerIds.length && rosterPlayerIds.length >= 1;
  const eventDataOk = eventMatchIds.length >= MIN_EVENT_MATCHES;
  const rosterOk = rosterPlayerIds.length >= 3;

  const statusEvidence: string[] = [
    `${rosterOk ? '✓' : '✗'} Roster: ${rosterPlayerIds.length} jugador(es) activos${rosterOk ? '' : ' — necesita ≥3'}`,
    `${playerDataOk ? '✓' : '✗'} Datos individuales: ${playersWithEnoughData}/${rosterPlayerIds.length} jugadores con ≥${MIN_PLAYER_MATCHES} partidas (${totalMPs} registros totales)`,
    `${eventDataOk ? '✓' : '✗'} Event stream de equipo: ${eventMatchIds.length} partidas sincronizadas${eventDataOk ? '' : ` — necesita ≥${MIN_EVENT_MATCHES}`}`,
  ];

  const lacking = rosterPlayerIds.length - playersWithEnoughData;
  // See insight-strings.ts for text
  const statusTxt = insightStrings['data-status'](lang, {
    isRival, rosterOk, playerDataOk, eventDataOk,
    rosterCount: rosterPlayerIds.length,
    playersWithEnoughData,
    totalMPs,
    minPlayerMatches: MIN_PLAYER_MATCHES as number,
    minEventMatches: MIN_EVENT_MATCHES as number,
    eventMatchCount: eventMatchIds.length,
    lacking,
    statusEvidence,
  });
  insights.push({
    id: 'data-status',
    severity: 'low',
    category: 'performance',
    ...statusTxt,
    reviewRequired: false,
  });

  return insights.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
