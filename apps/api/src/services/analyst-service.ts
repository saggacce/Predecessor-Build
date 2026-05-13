import { type PrismaClient } from '@prisma/client';
import { db } from '../db.js';
import { AppError } from '../middleware/error-handler.js';

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

export async function getTeamInsights(teamId: string): Promise<Insight[]> {
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
          (k) => k.gameTime >= obj.gameTime - 60 && k.gameTime < obj.gameTime,
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
      insights.push({
        id: 'rule-crit-death-obj',
        severity: 'critical',
        category: 'macro',
        title: isRival
          ? `Rival vulnerable antes de objetivos (${critPct}% de partidas)`
          : 'Muertes críticas antes de objetivos mayores',
        body: isRival
          ? `${teamRef} pierde jugadores en los 60s previos a objetivos mayores en el ${critPct}% de sus partidas. Aprovechar este patrón contestando el objetivo cuando detectes que están en desventaja de vida.`
          : `En el ${critPct}% de las partidas analizadas, un jugador del roster muere en los 60s previos a un objetivo mayor (Fangtooth, Prime, Shaper).`,
        evidence: [
          `${matchesWithCritDeath} de ${eventMatchIds.length} partidas con death pre-objetivo`,
          `Jugadores más afectados: ${roles.join(', ')}`,
          `Objetivos: ${[...new Set(affectedByMatch.map((a) => a.objType))].join(', ')}`,
        ],
        recommendation: isRival
          ? 'Forzar peleas de teamfight 60-90s antes de cada spawn de objetivo mayor. Si caen 1-2 jugadores rivales, contestar inmediatamente sin esperar setup propio.'
          : 'Revisar el posicionamiento y el timing de setup 90s antes de cada objetivo mayor. Priorizar reset si hay ventaja de vida insuficiente.',
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
          w.gameTime >= obj.gameTime - 90 &&
          w.gameTime < obj.gameTime,
      );
      if (wardsPlacedBefore.length === 0) objsWithNoVision++;
    }

    const noVisionPct = pct(objsWithNoVision, totalObjs);
    if (totalObjs >= MIN_OBJ_OPPORTUNITIES && noVisionPct >= 50) {
      insights.push({
        id: 'rule-low-vision-obj',
        severity: 'high',
        category: 'vision',
        title: isRival
          ? `Rival sin visión pre-objetivo (${noVisionPct}% de objetivos)`
          : 'Sin setup de visión antes de objetivos',
        body: isRival
          ? `${teamRef} no coloca wards en los 90s previos al ${noVisionPct}% de sus objetivos mayores. Explotar esta ceguera: entrar a la zona del objetivo sin establecer visión y sorprender en el contest.`
          : `${teamRef} no coloca wards en los 90s previos al ${noVisionPct}% de los objetivos mayores disputados.`,
        evidence: [
          `${objsWithNoVision} de ${totalObjs} objetivos sin wards previas`,
          `Se analizaron ${eventMatchIds.length} partidas con event stream`,
        ],
        recommendation: isRival
          ? 'Preparar el contest del objetivo antes de que el rival establezca visión. El soporte rival llega tarde — entrar por los flancos y forzar el teamfight sin información del rival.'
          : 'Establecer una rutina de visión obligatoria 90-120s antes de cada Fangtooth/Prime/Shaper. El support y el jungla deben iniciar el setup.',
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
      insights.push({
        id: 'rule-vision-cleaned',
        severity: 'high',
        category: 'vision',
        title: isRival
          ? `El rival hace denial de visión activo (${cleanedPct}% de objetivos)`
          : 'El rival limpia la visión antes de objetivos',
        body: isRival
          ? `${teamRef} destruye sistemáticamente 2 o más wards en los 120s previos al ${cleanedPct}% de los objetivos. Anticipar este patrón: colocar wards adicionales de backup o usar sweepers antes del spawn.`
          : `En el ${cleanedPct}% de los objetivos, el rival destruye 2 o más wards propias en los 120s previos, llegando sin información.`,
        evidence: [
          `${objsWithCleanedVision} de ${totalObjs} objetivos con visión limpiada`,
          isRival ? 'El rival tiene una rutina establecida de denial de visión' : 'El rival está haciendo denial activo de visión antes de contestar',
        ],
        recommendation: isRival
          ? 'Colocar wards de backup en zonas secundarias que el rival no limpia. Usar oráculos propios para detectar al sweeper rival antes de que limpie el setup principal.'
          : 'Usar wards de tipo Oracle/Sentry para proteger zonas de visión propia. Colocar wards de backup más tarde para no perder todo el setup.',
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
      insights.push({
        id: 'rule-prime-no-conv',
        severity: 'high',
        category: 'macro',
        title: isRival
          ? `Rival no convierte Primes en estructura (${notConvPct}%)`
          : 'Orb Prime sin conversión en estructura',
        body: isRival
          ? `${teamRef} no presiona ninguna estructura en los 3 minutos posteriores al ${notConvPct}% de los Primes que consigue. Aprovechar ese tiempo para resetear, recuperar posición y preparar el siguiente objetivo.`
          : `${teamRef} no destruye ninguna estructura en los 3 minutos siguientes al ${notConvPct}% de los Orb Prime que asegura.`,
        evidence: [
          `${notConverted} de ${teamPrimes.length} primes sin estructura posterior`,
          isRival ? 'El rival desperdicia la ventaja de mapa de Prime sistemáticamente' : 'Se pierde la ventaja de mapa que genera Orb Prime',
        ],
        recommendation: isRival
          ? 'Cuando el rival consiga Prime, dispersarse rápidamente, recuperar vida y preparar el siguiente contest. El rival no explotará el Prime — tenemos tiempo para reposicionarnos.'
          : 'Definir un protocolo post-Prime: ejecutar split push o ataque de inhibidor inmediatamente. No resetear hasta presionar una estructura.',
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
      insights.push({
        id: `rule-draft-dep-${playerId}`,
        severity: 'medium',
        category: 'draft',
        title: isRival
          ? `Banear a ${name}: pool de solo 2 héroes`
          : `Dependencia de draft: ${name}`,
        body: isRival
          ? `${name} (rival) juega el ${top2Pct}% de sus partidas con ${heroes}. Si baneamos uno de estos héroes, obligamos al rival a salir de su zona de confort.`
          : `${name} concentra el ${top2Pct}% de sus partidas en solo 2 héroes (${heroes}). Alta vulnerabilidad si uno es baneado.`,
        evidence: [
          `${top2} de ${mps.length} partidas con ${heroes}`,
          `Pool total: ${sorted.length} héroes distintos`,
        ],
        recommendation: isRival
          ? `Priorizar el ban de ${heroes.split(' + ')[0]} en la fase de bans. Forzar a ${name} a un héroe secundario reduce significativamente su impacto.`
          : `Ampliar el pool de ${name} con al menos 1 héroe adicional viable. Priorizar en sesiones de scrim.`,
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
      if (maxLead >= 3000) throwMatches++;
    }

    if (throwMatches >= 4) {
      insights.push({
        id: 'rule-throw',
        severity: 'high',
        category: 'economy',
        title: isRival
          ? `Rival throw en ${throwMatches} partidas — vulnerable en ventaja`
          : `Patrón de throw detectado (${throwMatches} partidas)`,
        body: isRival
          ? `${teamRef} pierde partidas en las que tuvo +3.000 oro de ventaja (${throwMatches} casos). Si conseguimos igualar o superar su gold en partidas que van perdiendo, pueden cometer errores de cierre.`
          : `En ${throwMatches} derrotas, ${teamRef} tuvo una ventaja de +3.000 oro en algún momento y no cerró la partida.`,
        evidence: [
          `${throwMatches} partidas con gold lead >3k que terminaron en derrota`,
          isRival ? 'El rival no convierte ventaja económica — una comeback es viable si aguantamos' : 'El equipo no convierte ventaja económica en objetivos o estructura',
        ],
        recommendation: isRival
          ? 'Si vamos por detrás en oro, mantenernos vivos y esperar el error del rival en la fase de cierre. Evitar teamfights directas cuando la ventaja rival supera 5k.'
          : 'Definir una regla de cierre cuando la ventaja supera 3k: priorizar Prime, inhibidor o push coordinado. No dispersarse después de objetivos grandes.',
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
      insights.push({
        id: `rule-slump-${playerId}`,
        severity: 'medium',
        category: 'performance',
        title: isRival
          ? `${name} (rival) en bajón de forma — momento para explotar`
          : `Bajón de rendimiento: ${name}`,
        body: isRival
          ? `${name} está rindiendo por debajo de su nivel habitual (KDA reciente ${recentKda.toFixed(2)} vs histórico ${historicalKda.toFixed(2)}). Buen momento para presionarle directamente durante la partida.`
          : `KDA de ${name} en las últimas 10 partidas (${recentKda.toFixed(2)}) es significativamente inferior a su histórico (${historicalKda.toFixed(2)}).`,
        evidence: [
          `KDA histórico: ${historicalKda.toFixed(2)}`,
          `KDA últimas 10: ${recentKda.toFixed(2)} (${delta.toFixed(2)} de diferencia)`,
        ],
        recommendation: isRival
          ? `Dirigir la presión hacia el carril de ${name}. Campear su jungla o carril, forzar errores cuando ya está en bajón de confianza.`
          : `Revisar partidas recientes de ${name} para identificar si es un problema de draft, rol, posicionamiento o momento individual.`,
        reviewRequired: false,
        affectedPlayers: [name],
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RULE 8 — Vision gaps (wards/min below role baseline)
  // ─────────────────────────────────────────────────────────────────────────
  const WARD_BASELINE: Record<string, number> = {
    support: 1.0, jungle: 0.5, midlane: 0.35, carry: 0.25, offlane: 0.3,
  };

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
    insights.push({
      id: 'rule-vision-gaps',
      severity: 'medium',
      category: 'vision',
      title: isRival
        ? `Rival con visión deficiente en ${lowVisionPlayers.length} rol(es)`
        : 'Actividad de visión por debajo del umbral',
      body: isRival
        ? `${lowVisionPlayers.length} jugador(es) rival(es) colocan significativamente menos wards de las esperadas para su rol. El mapa del rival tendrá zonas ciegas que podemos explotar.`
        : `${lowVisionPlayers.length} jugador(es) del roster tienen un ratio de wards/min notablemente inferior al esperado para su rol.`,
      evidence: lowVisionPlayers,
      recommendation: isRival
        ? 'Moverse por las zonas de menor cobertura de visión rival para ganar información sin ser detectados. Especialmente valioso para el jungla en las rutas de invasión.'
        : 'Establecer objetivos individuales de visión. En scrims, contar wards colocadas por el support y jungla antes de cada objetivo.',
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
    insights.push({
      id: 'rule-positive-ft',
      severity: isRival ? 'high' : 'positive',
      category: 'macro',
      title: isRival
        ? `Alerta: rival domina Fangtooth (${ftCtrl}%)`
        : `Control de Fangtooth destacado: ${ftCtrl}%`,
      body: isRival
        ? `${teamRef} controla el ${ftCtrl}% de los Fangtoots disputados. Priorizar contestar este objetivo o diseñar el draft para poder disputarlo en igualdad.`
        : `${teamRef} controla el ${ftCtrl}% de los Fangtoots disputados — fortaleza macro clara.`,
      evidence: [`${ftData.team} Fangtoots conseguidos de ${ftTotal} totales`],
      recommendation: isRival
        ? 'Diseñar el draft con campeones de teamfight temprana para poder disputar Fangtooth. Priorizar el setup de visión en la zona norte del mapa desde el minuto 4.'
        : 'Mantener la prioridad temprana y explotar esta ventaja en el diseño del draft.',
      reviewRequired: false,
    });
  }

  if (primeTotal >= MIN_OBJ_OPPORTUNITIES && primeCtrl >= 70) {
    insights.push({
      id: 'rule-positive-prime',
      severity: isRival ? 'high' : 'positive',
      category: 'macro',
      title: isRival
        ? `Alerta: rival domina Prime (${primeCtrl}%)`
        : `Dominio de Prime: ${primeCtrl}%`,
      body: isRival
        ? `${teamRef} controla el ${primeCtrl}% de los objetivos de Prime. Hay que tener una respuesta clara cuando el rival consiga Prime o evitar que lleguen a él en ventaja.`
        : `${teamRef} controla el ${primeCtrl}% de los objetivos de Prime (Mini + Orb).`,
      evidence: [`${primeData.team} Primes conseguidos de ${primeTotal} totales`],
      recommendation: isRival
        ? 'No contestar Prime si el rival tiene ventaja de vida. Mejor dispersarse, recuperar y preparar el próximo respawn. Forzar pelea pre-Prime para evitar que lleguen al spawn con ventaja.'
        : 'El control de Prime es una ventaja competitiva real. Reforzar con setup de visión para mantenerlo bajo presión.',
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
            (k) => k.gameTime >= obj.gameTime - 60 && k.gameTime < obj.gameTime,
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
        insights.push({
          id,
          severity: 'high',
          category: 'macro',
          title: isRival
            ? `Rival pierde ${label} antes de objetivos (${p}%)`
            : `${label} muerto/a antes de objetivos mayores (${p}%)`,
          body: isRival
            ? `El rival pierde al ${label} en los 60s previos a objetivos mayores en el ${p}% de las partidas. Contestar el objetivo cuando caiga ese jugador.`
            : `El ${label} muere en los 60s previos a un objetivo mayor en el ${p}% de las partidas analizadas.`,
          evidence: [...new Set(ev)].slice(0, 4),
          recommendation: isRival
            ? `Forzar el teamfight antes del spawn objetivo apuntando al ${label} rival. Si cae, contestar el objetivo inmediatamente.`
            : `El ${label} debe retirarse o resetear 90s antes del spawn de cada objetivo mayor. Priorizar supervivencia sobre presión.`,
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
          (k) => k.gameTime >= obj.gameTime - 60 && k.gameTime < obj.gameTime,
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
      insights.push({
        id: 'rule-multi-death-obj',
        severity: 'critical',
        category: 'macro',
        title: isRival
          ? `Rival llega a objetivos con bajas múltiples (${multiPct}%)`
          : `Múltiples muertes antes de objetivos mayores (${multiPct}%)`,
        body: isRival
          ? `${teamRef} llega a objetivos mayores habiendo perdido ≥2 jugadores en los 60s previos en el ${multiPct}% de las partidas. El momento más peligroso para contestar.`
          : `En el ${multiPct}% de las partidas, el equipo pierde ≥2 jugadores en los 60s antes de un objetivo mayor.`,
        evidence: [...new Set(multiEv)].slice(0, 4),
        recommendation: isRival
          ? 'Si el rival llega al objetivo con 2+ bajas, contestar agresivamente. Es el mejor momento para robar o forzar una pelea ganada.'
          : 'Revisar la preparación colectiva del equipo antes de objetivos: nadie debe entrar en zonas de peligro sin confirmación de equipo 90s antes del spawn.',
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
            w.gameTime >= obj.gameTime - 90 && w.gameTime < obj.gameTime,
        );
        const wardsIn30 = wardsIn90.filter((w) => w.gameTime >= obj.gameTime - 30);
        if (wardsIn90.length > 0 && wardsIn90.length === wardsIn30.length) lateSetupObjs++;
      }
      const p = pct(lateSetupObjs, totalMajorObjs);
      if (totalMajorObjs >= MIN_OBJ_OPPORTUNITIES && p >= 40) {
        insights.push({
          id: 'rule-late-vision-setup',
          severity: 'medium',
          category: 'vision',
          title: isRival
            ? `Rival coloca visión demasiado tarde pre-objetivo (${p}%)`
            : `Setup de visión tardío antes de objetivos (${p}%)`,
          body: isRival
            ? `${teamRef} coloca sus wards en los últimos 30s antes del objetivo en el ${p}% de los casos. Entrar por los flancos antes de que establezcan visión.`
            : `En el ${p}% de los objetivos, las wards se colocan en los últimos 30s — demasiado tarde para detectar rotaciones rivales.`,
          evidence: [`${lateSetupObjs} de ${totalMajorObjs} objetivos con setup <30s`],
          recommendation: isRival
            ? 'Iniciar el movimiento hacia el objetivo cuando el rival todavía no tiene visión. La ventana es los 90-30s antes del spawn.'
            : 'El support y jungla deben iniciar el setup de visión entre 90 y 120s antes del spawn. Un ward a tiempo vale más que tres cuando ya es tarde.',
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
        insights.push({
          id: 'rule-no-backup-vision',
          severity: 'medium',
          category: 'vision',
          title: isRival
            ? `Rival no repone visión tras destrucción (${p}%)`
            : `Sin visión de respaldo tras destrucción (${p}%)`,
          body: isRival
            ? `${teamRef} no reemplaza el ${p}% de las wards que le destruyen. Una vez limpiada su visión, el mapa queda ciego para ellos.`
            : `El ${p}% de las wards destruidas no se reponen en los 90s siguientes, dejando zonas del mapa sin cobertura.`,
          evidence: [`${noBackupCount} de ${totalDestructions} wards destruidas sin reposición en 90s`],
          recommendation: isRival
            ? 'Usar sweepers para limpiar visión rival justo antes del setup propio. Una vez limpiada, el rival tardará en recuperarla.'
            : 'Establecer un protocolo de reposición inmediata: cuando el jungla detecte una ward destruida, colocar una nueva en zona alternativa.',
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
        insights.push({
          id: 'rule-vision-lost-no-recovery',
          severity: 'high',
          category: 'vision',
          title: isRival
            ? `Rival pierde visión pre-objetivo sin recuperarla (${p}%)`
            : `Visión destruida sin recuperación pre-objetivo (${p}%)`,
          body: isRival
            ? `${teamRef} pierde toda su visión en los 120s previos al objetivo y no la repone antes del spawn en el ${p}% de los casos. El mejor momento para iniciar el contest es justo después de limpiar sus wards.`
            : `En el ${p}% de los objetivos, las wards propias son destruidas y el equipo llega al spawn sin información.`,
          evidence: [`${visionLostObjs} de ${totalObjsChecked} objetivos con visión perdida sin recuperar`],
          recommendation: isRival
            ? 'Limpiar la visión rival y entrar inmediatamente al pit del objetivo. No dar tiempo a que repongan wards.'
            : 'Tener siempre wards de backup listas para colocar si la visión primaria cae. El support debe llevar 2 wards al setup de cada objetivo.',
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
        insights.push({
          id,
          severity: 'medium',
          category: 'macro',
          title: isRival
            ? `Rival no convierte ${label} en estructura (${p}%)`
            : `${label} sin conversión en estructura (${p}%)`,
          body: isRival
            ? `${teamRef} no presiona ninguna estructura en los ${convWindow}s posteriores al ${p}% de sus ${label}. Aprovechar ese tiempo para resetear y preparar el siguiente objetivo.`
            : `${teamRef} no destruye ninguna estructura en los ${convWindow}s siguientes al ${p}% de los ${label} que asegura.`,
          evidence: [`${notConverted} de ${teamObjs.length} ${label}s sin estructura posterior`],
          recommendation: isRival
            ? `Cuando el rival consiga ${label}, ejecutar un reset rápido y preparar el próximo spawn. El rival no explotará la ventaja.`
            : `Definir un objetivo claro al conseguir ${label}: qué estructura presionar y por qué carril. No resetear sin haber intentado una estructura.`,
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
      insights.push({
        id: 'rule-obj-lost-after-death',
        severity: 'high',
        category: 'macro',
        title: isRival
          ? `Rival vulnerable: sus muertes preceden objetivos nuestros (${objLostAfterDeathCount} partidas)`
          : `Objetivo perdido tras muerte aliada (${objLostAfterDeathCount} partidas)`,
        body: isRival
          ? `En ${objLostAfterDeathCount} partidas, una muerte rival precede directamente a un objetivo tomado por nuestro equipo. Identificar y presionar al jugador más débil para crear estas cadenas.`
          : `En ${objLostAfterDeathCount} partidas, una muerte de un jugador del equipo va seguida de un objetivo rival en los 90s siguientes.`,
        evidence: objLostEv.slice(0, 4),
        recommendation: isRival
          ? 'Estudiar qué jugador rival muere primero con más frecuencia. Apuntar a ese jugador para crear la cadena muerte → objetivo.'
          : 'Revisar las posiciones y el spacing antes de objetivos. Una muerte en zona de peligro puede costar el objetivo.',
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
      insights.push({
        id: 'rule-obj-taken-after-kill',
        severity: isRival ? 'high' : 'positive',
        category: 'macro',
        title: isRival
          ? `Rival convierte kills en objetivos (${objTakenAfterKillCount} partidas)`
          : `El equipo convierte kills en objetivos (${objTakenAfterKillCount} partidas)`,
        body: isRival
          ? `${teamRef} aprovecha sus kills para tomar objetivos mayores en los 90s siguientes en ${objTakenAfterKillCount} partidas. Estar preparados para defender objetivos inmediatamente cuando caiga un jugador.`
          : `En ${objTakenAfterKillCount} partidas, un kill se traduce en un objetivo mayor en menos de 90s — señal de buena lectura macro.`,
        evidence: objTakenEv.slice(0, 4),
        recommendation: isRival
          ? 'Cuando un jugador rival cae, proteger inmediatamente el objetivo más cercano. No resetear — el rival buscará convertir esa muerte en macro.'
          : 'Mantener este patrón: tras un pick, ejecutar el objetivo más cercano sin demorarse. Comunicar el objetivo destino antes del teamfight.',
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
        insights.push({
          id: `rule-gpm-slump-${playerId}`,
          severity: 'medium',
          category: 'performance',
          title: isRival
            ? `${name} (rival) con bajón económico — GPM bajo`
            : `Bajón económico: ${name}`,
          body: isRival
            ? `${name} está generando oro muy por debajo de su nivel habitual (${fmt(recentGpm)} GPM vs ${fmt(prevGpm)} GPM anterior). Menor impacto de items en la partida.`
            : `${name} ha caído de ${fmt(prevGpm)} a ${fmt(recentGpm)} GPM en las últimas 10 partidas.`,
          evidence: [`GPM reciente: ${fmt(recentGpm)}/min`, `GPM anterior: ${fmt(prevGpm)}/min`],
          recommendation: isRival
            ? `Presionar el carril de ${name} para reducir aún más su farm. Peor economía significa menos potencial de items.`
            : `Revisar la eficiencia de farm de ${name}: CS/min, gold wasted en base y rotaciones de campo.`,
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
        insights.push({
          id: `rule-dpm-slump-${playerId}`,
          severity: 'medium',
          category: 'performance',
          title: isRival
            ? `${name} (rival) con bajón de daño — menos impacto`
            : `Bajón de daño: ${name}`,
          body: isRival
            ? `${name} está haciendo significativamente menos daño que en su nivel habitual (${fmt(recentDpm)} DPM vs ${fmt(prevDpm)} anterior).`
            : `${name} ha bajado de ${fmt(prevDpm)} a ${fmt(recentDpm)} DPM — señal de menor impacto en peleas.`,
          evidence: [`DPM reciente: ${fmt(recentDpm)}/min`, `DPM anterior: ${fmt(prevDpm)}/min`],
          recommendation: isRival
            ? `El daño de ${name} está caído — es menos amenazante. Posicionarse para ignorarle y focusear a otros jugadores más peligrosos.`
            : `Revisar con ${name} si el bajón es de posicionamiento, draft o economía. Comparar sus builds recientes vs las anteriores.`,
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
        insights.push({
          id: `rule-kp-low-${playerId}`,
          severity: 'medium',
          category: 'performance',
          title: isRival
            ? `${name} (rival) con baja participación en kills`
            : `Baja participación en peleas: ${name}`,
          body: isRival
            ? `${name} participa en solo el ${Math.round(avgKp * 100)}% de los kills de su equipo. Jugador desconectado del juego colectivo rival.`
            : `${name} está participando en solo el ${Math.round(avgKp * 100)}% de los kills del equipo — señal de desconexión en peleas.`,
          evidence: [`KP promedio últimas ${kpMps.length} partidas: ${Math.round(avgKp * 100)}%`],
          recommendation: isRival
            ? `${name} no presiona junto al equipo — sus compañeros hacen el trabajo. Enfocar la presión en los jugadores con mayor KP.`
            : `Hablar con ${name} sobre su posicionamiento en teamfights y su timing de rotación. ¿Está farmeando cuando el equipo pelea?`,
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
        insights.push({
          id: `rule-death-share-${playerId}`,
          severity: 'medium',
          category: 'performance',
          title: isRival
            ? `${name} (rival) concentra las muertes de su equipo`
            : `Muertes concentradas en ${name}`,
          body: isRival
            ? `${name} acumula el ${Math.round(avgDs * 100)}% de las muertes de su equipo. Es el objetivo más fácil a eliminar para generar cadenas.`
            : `${name} acumula el ${Math.round(avgDs * 100)}% de las muertes del equipo en las últimas ${deathMps.length} partidas.`,
          evidence: [`Death share promedio: ${Math.round(avgDs * 100)}%`],
          recommendation: isRival
            ? `Apuntar a ${name} en las peleas — cae con frecuencia y su caída puede generar picks en cadena o acceso a objetivos.`
            : `Revisar con ${name} las decisiones de posicionamiento y entradas. ¿Está entrando solo o sin visión?`,
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
          insights.push({
            id: `rule-gold-low-dmg-${playerId}`,
            severity: 'medium',
            category: 'performance',
            title: isRival
              ? `${name} (rival): mucho oro, poco daño — resources mal convertidos`
              : `${name}: alto farm, bajo impacto de daño`,
            body: isRival
              ? `${name} recibe el ${Math.round(avgGoldShare * 100)}% del oro de su equipo pero solo hace el ${Math.round(avgDmgShare * 100)}% del daño. Sus items no están traduciendo en amenaza real.`
              : `${name} genera el ${Math.round(avgGoldShare * 100)}% del oro del equipo pero solo hace el ${Math.round(avgDmgShare * 100)}% del daño total.`,
            evidence: [
              `Gold share: ${Math.round(avgGoldShare * 100)}%`,
              `Damage share: ${Math.round(avgDmgShare * 100)}%`,
              `Gap: +${Math.round((avgGoldShare - avgDmgShare) * 100)}pp de oro vs daño`,
            ],
            recommendation: isRival
              ? `${name} tiene recursos pero no los convierte en daño. Es menos peligroso de lo que parece su farm. Enfocar en otros jugadores.`
              : `Revisar con ${name} si está llegando a las peleas tarde, si sus items tienen sinergía con el rol, o si hay un problema de posicionamiento en los teamfights.`,
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
    insights.push({
      id: `rule-positive-player-form-${best.playerId}`,
      severity: isRival ? 'high' : 'positive',
      category: 'performance',
      title: isRival
        ? `Alerta: ${best.name} (rival) en racha — rendimiento elevado`
        : `${best.name} en buena racha de forma`,
      body: isRival
        ? `${best.name} tiene un KDA de ${recent.toFixed(2)} en las últimas 10 partidas vs su histórico de ${hist.toFixed(2)}. Es el jugador rival más peligroso en este momento.`
        : `${best.name} ha subido de un KDA histórico de ${hist.toFixed(2)} a ${recent.toFixed(2)} en las últimas 10 partidas.`,
      evidence: [`KDA histórico: ${hist.toFixed(2)}`, `KDA reciente: ${recent.toFixed(2)} (+${best.delta.toFixed(2)})`],
      recommendation: isRival
        ? `Priorizar el ban o el matchup desfavorable contra ${best.name}. No dejarle en un pick cómodo en este momento de forma.`
        : `Mantener a ${best.name} en un rol y composición que potencie su momento actual. Es el mejor momento para construir alrededor de su forma.`,
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
        insights.push({
          id: 'rule-draft-dmg-imbalance-ap',
          severity: 'medium',
          category: 'draft',
          title: isRival
            ? 'Rival sin daño mágico — composición todo AD'
            : 'Composición sin daño mágico (todo AD)',
          body: isRival
            ? `${teamRef} no tiene ningún Mage en su pool habitual. Una comp con magia y reducción de armadura mágica puede castigarles duramente.`
            : `Ningún jugador del equipo tiene un Mage como héroe principal. El rival puede buildear resistencia física y minimizar el daño.`,
          evidence: [
            `Jugadores físicos: ${physicalCount}`,
            `Jugadores mágicos: ${magicalCount}`,
            `Clasificados: ${totalClassified}`,
          ],
          recommendation: isRival
            ? 'Incluir al menos un Mage en el draft o un héroe con daño mágico relevante. El rival no tendrá resistencia mágica prioritaria.'
            : 'Considerar incluir un Mage en la composición, especialmente en Midlane o Support. Diversifica el daño y hace más difícil el building del rival.',
          reviewRequired: false,
        });
      } else if (physicalCount === 0 && magicalCount >= 3) {
        insights.push({
          id: 'rule-draft-dmg-imbalance-ad',
          severity: 'medium',
          category: 'draft',
          title: isRival
            ? 'Rival sin daño físico — composición todo AP'
            : 'Composición sin daño físico (todo AP)',
          body: isRival
            ? `${teamRef} juega mayoritariamente con Mages. Un carry físico o un Assassin físico puede ser especialmente efectivo contra ellos.`
            : `La composición del equipo carece de daño físico relevante. El rival puede buildear resistencia mágica y neutralizar el output.`,
          evidence: [
            `Jugadores mágicos: ${magicalCount}`,
            `Jugadores físicos: ${physicalCount}`,
            `Clasificados: ${totalClassified}`,
          ],
          recommendation: isRival
            ? 'Priorizar héroes de daño físico en el draft para explotar la falta de armadura física del rival. Un carry Sharpshooter o Fighter puede dominar.'
            : 'Incluir al menos un Carry o Fighter físico en la composición para diversificar el daño.',
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
        insights.push({
          id: 'rule-rival-obj-focused',
          severity: 'high',
          category: 'macro',
          title: `Rival centrado en control de objetivos (${teamObjPct}%)`,
          body: `${teamRef} controla el ${teamObjPct}% de todos los objetivos disputados. Su identidad de juego gira en torno al control macro. Necesitamos una respuesta clara para cada objetivo.`,
          evidence: [
            `${totalObjTeam} objetivos controlados de ${grandTotal} totales`,
            ...([...objControlMap.entries()]
              .filter(([, d]) => d.team > 0)
              .map(([type, d]) => `${type}: ${d.team} de ${d.team + d.rival}`)
              .slice(0, 3)),
          ],
          recommendation: 'Diseñar el draft para poder disputar objetivos en igualdad o superioridad. Priorizar campeones de teamfight y control de multitudes. Nunca dejar un objetivo sin contest cuando el rival tiene vida para pelear.',
          reviewRequired: false,
        });
      }

      // Rival weak objective defense (low control = opportunity for own team)
      if (isRival && teamObjPct <= 40) {
        insights.push({
          id: 'rule-rival-weak-defense',
          severity: 'positive',
          category: 'macro',
          title: `Rival con pobre control de objetivos (${teamObjPct}%)`,
          body: `${teamRef} solo controla el ${teamObjPct}% de los objetivos disputados. Una estrategia centrada en objetivos tiene altas probabilidades de éxito.`,
          evidence: [
            `${totalObjTeam} objetivos del rival de ${grandTotal} totales`,
            `Nuestro control implícito: ${pct(totalObjRival, grandTotal)}%`,
          ],
          recommendation: 'Priorizar todos los objetivos desde el draft. Incluir campeones que puedan hacer secure y generar presión de mapa constante.',
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
              w.gameTime >= obj.gameTime - 90 && w.gameTime < obj.gameTime,
          );
          if (wards.length >= 2) goodVisionObjs++;
        }
        const p = pct(goodVisionObjs, totalObjs);
        if (totalObjs >= MIN_OBJ_OPPORTUNITIES && p >= 70) {
          insights.push({
            id: 'rule-positive-vision-setup',
            severity: isRival ? 'high' : 'positive',
            category: 'vision',
            title: isRival
              ? `Alerta: rival con excelente visión pre-objetivo (${p}%)`
              : `Buen setup de visión antes de objetivos (${p}%)`,
            body: isRival
              ? `${teamRef} coloca ≥2 wards en los 90s previos al ${p}% de los objetivos. Tendrán información completa antes de cada spawn.`
              : `${teamRef} coloca ≥2 wards antes del ${p}% de los objetivos mayores — una fortaleza real de visión.`,
            evidence: [`${goodVisionObjs} de ${totalObjs} objetivos con setup de ≥2 wards`],
            recommendation: isRival
              ? 'Usar sweepers para limpiar esa visión antes de intentar el contest. Sin limpiar las wards, el rival tendrá toda la información.'
              : 'Mantener esta rutina de visión. Es una de las pocas áreas donde el equipo está por encima de la media.',
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
          insights.push({
            id: 'rule-positive-prime-conv',
            severity: isRival ? 'high' : 'positive',
            category: 'macro',
            title: isRival
              ? `Alerta: rival convierte Primes eficientemente (${p}%)`
              : `Excelente conversión de Prime en estructura (${p}%)`,
            body: isRival
              ? `${teamRef} convierte el ${p}% de sus Primes en destrucción de estructura en los 3 minutos siguientes. Cada Prime rival es una amenaza real de cierre.`
              : `${teamRef} convierte el ${p}% de sus Orb Prime en presión de estructura — cierre macro eficiente.`,
            evidence: [`${converted} de ${teamPrimes.length} Primes convertidos en estructura`],
            recommendation: isRival
              ? 'Cuando el rival consiga Prime, defender inmediatamente la estructura más amenazada. Nunca resetear sin protegerla primero.'
              : 'Excelente patrón de cierre. Seguir definiendo el objetivo de estructura antes de ejecutar el Prime.',
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

  let statusBody: string;
  let statusRec: string;

  if (rosterOk && playerDataOk && eventDataOk) {
    statusBody = 'Todos los datos disponibles. Las reglas de rendimiento individual y análisis macro están activas.';
    statusRec = 'El análisis está completo. Los insights se actualizan automáticamente con cada nueva partida sincronizada.';
  } else if (rosterOk && playerDataOk && !eventDataOk) {
    statusBody = 'Datos individuales de los jugadores correctos. Faltan partidas de equipo con event stream para activar las reglas macro (objetivos, visión, throws).';
    statusRec = 'Ve a Team Analysis → Performance → Objective Control y pulsa "Sync matches" para sincronizar el event stream de las partidas del equipo.';
  } else if (!rosterOk) {
    statusBody = `Roster insuficiente (${rosterPlayerIds.length} jugadores). Las reglas de equipo requieren ≥3 jugadores activos.`;
    statusRec = 'Añade al menos 3 jugadores al roster en la pestaña Roster.';
  } else {
    const lacking = rosterPlayerIds.length - playersWithEnoughData;
    statusBody = `${lacking} jugador(es) tienen pocas partidas sincronizadas. Las reglas de rendimiento y visión necesitan ≥${MIN_PLAYER_MATCHES} partidas por jugador para ser estadísticamente fiables.`;
    statusRec = 'Ve al Dashboard y pulsa "Sync Players" para actualizar el historial de partidas de los jugadores.';
  }

  insights.push({
    id: 'data-status',
    severity: 'low',
    category: 'performance',
    title: isRival ? 'Estado del scouting' : 'Estado de datos del análisis',
    body: isRival
      ? statusBody.replace('El equipo', 'El rival').replace('el equipo', 'el rival')
      : statusBody,
    evidence: statusEvidence,
    recommendation: statusRec,
    reviewRequired: false,
  });

  return insights.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
