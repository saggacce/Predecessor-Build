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
    GROUP BY mp."matchId", mp."team", m."winningTeam"
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
          where: { matchId: { in: eventMatchIds }, killedPlayerId: { in: rosterPlayerIds } },
          select: { matchId: true, gameTime: true, killedPlayerId: true, killerTeam: true, killedTeam: true },
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

  // ── Player snapshots for draft rules ──────────────────────────────────────
  const snapshots = new Map(
    team.roster.map((r) => [r.player.id, r.player.snapshots[0] ?? null]),
  );

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
  if (eventMatchIds.length >= 3) {
    const majorObjs = objKills.filter((o) => MAJOR_OBJECTIVES.includes(o.entityType));

    let matchesWithCritDeath = 0;
    const affectedByMatch: { matchId: string; objType: string; playerName: string }[] = [];

    for (const matchId of eventMatchIds) {
      const matchObjs = majorObjs.filter((o) => o.matchId === matchId);
      const matchKills = heroKills.filter((k) => k.matchId === matchId);

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
        title: 'Muertes críticas antes de objetivos mayores',
        body: `En el ${critPct}% de las partidas analizadas, un jugador del roster muere en los 60s previos a un objetivo mayor (Fangtooth, Prime, Shaper).`,
        evidence: [
          `${matchesWithCritDeath} de ${eventMatchIds.length} partidas con death pre-objetivo`,
          `Jugadores más afectados: ${roles.join(', ')}`,
          `Objetivos: ${[...new Set(affectedByMatch.map((a) => a.objType))].join(', ')}`,
        ],
        recommendation: 'Revisar el posicionamiento y el timing de setup 90s antes de cada objetivo mayor. Priorizar reset si hay ventaja de vida insuficiente.',
        reviewRequired: true,
        affectedPlayers: roles,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RULE 2 — Low vision before objective
  // ─────────────────────────────────────────────────────────────────────────
  if (eventMatchIds.length >= 3) {
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
    if (totalObjs >= 5 && noVisionPct >= 50) {
      insights.push({
        id: 'rule-low-vision-obj',
        severity: 'high',
        category: 'vision',
        title: 'Sin setup de visión antes de objetivos',
        body: `El equipo no coloca wards en los 90s previos al ${noVisionPct}% de los objetivos mayores disputados.`,
        evidence: [
          `${objsWithNoVision} de ${totalObjs} objetivos sin wards previas`,
          `Se analizaron ${eventMatchIds.length} partidas con event stream`,
        ],
        recommendation: 'Establecer una rutina de visión obligatoria 90-120s antes de cada Fangtooth/Prime/Shaper. El support y el jungla deben iniciar el setup.',
        reviewRequired: true,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RULE 3 — Vision cleaned before objective
  // ─────────────────────────────────────────────────────────────────────────
  if (eventMatchIds.length >= 3) {
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
    if (totalObjs >= 5 && cleanedPct >= 40) {
      insights.push({
        id: 'rule-vision-cleaned',
        severity: 'high',
        category: 'vision',
        title: 'El rival limpia la visión antes de objetivos',
        body: `En el ${cleanedPct}% de los objetivos, el rival destruye 2 o más wards propias en los 120s previos, llegando sin información.`,
        evidence: [
          `${objsWithCleanedVision} de ${totalObjs} objetivos con visión limpiada`,
          'El rival está haciendo denial activo de visión antes de contestar',
        ],
        recommendation: 'Usar wards de tipo Oracle/Sentry para proteger zonas de visión propia. Colocar wards de backup más tarde para no perder todo el setup.',
        reviewRequired: false,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RULE 4 — Prime not converted
  // ─────────────────────────────────────────────────────────────────────────
  if (eventMatchIds.length >= 3) {
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
    if (teamPrimes.length >= 3 && notConvPct >= 50) {
      insights.push({
        id: 'rule-prime-no-conv',
        severity: 'high',
        category: 'macro',
        title: 'Orb Prime sin conversión en estructura',
        body: `El equipo no destruye ninguna estructura en los 3 minutos siguientes al ${notConvPct}% de los Orb Prime que asegura.`,
        evidence: [
          `${notConverted} de ${teamPrimes.length} primes sin estructura posterior`,
          'Se pierde la ventaja de mapa que genera Orb Prime',
        ],
        recommendation: 'Definir un protocolo post-Prime: ejecutar split push o ataque de inhibidor inmediatamente. No resetear hasta presionar una estructura.',
        reviewRequired: true,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RULE 5 — Draft dependency (pool < 2 héroes fiables)
  // ─────────────────────────────────────────────────────────────────────────
  for (const [playerId, mps] of mpByPlayer) {
    if (mps.length < 8) continue;

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
        title: `Dependencia de draft: ${name}`,
        body: `${name} concentra el ${top2Pct}% de sus partidas en solo 2 héroes (${heroes}). Alta vulnerabilidad si uno es baneado.`,
        evidence: [
          `${top2} de ${mps.length} partidas con ${heroes}`,
          `Pool total: ${sorted.length} héroes distintos`,
        ],
        recommendation: `Ampliar el pool de ${name} con al menos 1 héroe adicional viable. Priorizar en sesiones de scrim.`,
        reviewRequired: false,
        affectedPlayers: [name],
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RULE 6 — Throw pattern (gold lead lost)
  // ─────────────────────────────────────────────────────────────────────────
  if (eventMatchIds.length >= 3) {
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

    if (throwMatches >= 2) {
      insights.push({
        id: 'rule-throw',
        severity: 'high',
        category: 'economy',
        title: `Patrón de throw detectado (${throwMatches} partidas)`,
        body: `En ${throwMatches} derrotas, el equipo tuvo una ventaja de +3.000 oro en algún momento y no cerró la partida.`,
        evidence: [
          `${throwMatches} partidas con gold lead >3k que terminaron en derrota`,
          'El equipo no convierte ventaja económica en objetivos o estructura',
        ],
        recommendation: 'Definir una regla de cierre cuando la ventaja supera 3k: priorizar Prime, inhibidor o push coordinado. No dispersarse después de objetivos grandes.',
        reviewRequired: true,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RULE 7 — Player slump
  // ─────────────────────────────────────────────────────────────────────────
  for (const [playerId, mps] of mpByPlayer) {
    if (mps.length < 10) continue;

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
        title: `Bajón de rendimiento: ${name}`,
        body: `KDA de ${name} en las últimas 10 partidas (${recentKda.toFixed(2)}) es significativamente inferior a su histórico (${historicalKda.toFixed(2)}).`,
        evidence: [
          `KDA histórico: ${historicalKda.toFixed(2)}`,
          `KDA últimas 10: ${recentKda.toFixed(2)} (${delta.toFixed(2)} de diferencia)`,
        ],
        recommendation: `Revisar partidas recientes de ${name} para identificar si es un problema de draft, rol, posicionamiento o momento individual.`,
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
    if (withWards.length < 5) continue;

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
      title: 'Actividad de visión por debajo del umbral',
      body: `${lowVisionPlayers.length} jugador(es) del roster tienen un ratio de wards/min notablemente inferior al esperado para su rol.`,
      evidence: lowVisionPlayers,
      recommendation: 'Establecer objetivos individuales de visión. En scrims, contar wards colocadas por el support y jungla antes de cada objetivo.',
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

  if (ftTotal >= 5 && ftCtrl >= 70) {
    insights.push({
      id: 'rule-positive-ft',
      severity: 'positive',
      category: 'macro',
      title: `Control de Fangtooth destacado: ${ftCtrl}%`,
      body: `El equipo controla el ${ftCtrl}% de los Fangtoots disputados — fortaleza macro clara.`,
      evidence: [`${ftData.team} Fangtoots conseguidos de ${ftTotal} totales`],
      recommendation: 'Mantener la prioridad temprana y explotar esta ventaja en el diseño del draft.',
      reviewRequired: false,
    });
  }

  if (primeTotal >= 5 && primeCtrl >= 70) {
    insights.push({
      id: 'rule-positive-prime',
      severity: 'positive',
      category: 'macro',
      title: `Dominio de Prime: ${primeCtrl}%`,
      body: `El equipo controla el ${primeCtrl}% de los objetivos de Prime (Mini + Orb).`,
      evidence: [`${primeData.team} Primes conseguidos de ${primeTotal} totales`],
      recommendation: 'El control de Prime es una ventaja competitiva real. Reforzar con setup de visión para mantenerlo bajo presión.',
      reviewRequired: false,
    });
  }

  // ── Data status insight — always shown ───────────────────────────────────
  const totalMPs = [...mpByPlayer.values()].reduce((s, arr) => s + arr.length, 0);
  const playersWithEnoughData = [...mpByPlayer.values()].filter((arr) => arr.length >= 8).length;

  const statusEvidence: string[] = [
    `Jugadores en el roster: ${rosterPlayerIds.length}`,
    `Partidas individuales sincronizadas: ${totalMPs} registros entre ${mpByPlayer.size} jugadores`,
    `Jugadores con datos suficientes (≥8 partidas): ${playersWithEnoughData}/${rosterPlayerIds.length}`,
    `Partidas de equipo con event stream (≥3 jugadores juntos): ${eventMatchIds.length}`,
  ];

  const missingData: string[] = [];
  if (rosterPlayerIds.length < 3) missingData.push('Añade al menos 3 jugadores al roster para análisis de equipo');
  if (eventMatchIds.length === 0) missingData.push('Sincroniza el event stream con "Sync matches" en Objective Control para activar reglas macro');
  if (playersWithEnoughData < rosterPlayerIds.length) missingData.push(`${rosterPlayerIds.length - playersWithEnoughData} jugador(es) necesita(n) más partidas sincronizadas (mín. 8)`);

  insights.push({
    id: 'data-status',
    severity: 'low',
    category: 'performance',
    title: `Estado de datos del análisis`,
    body: missingData.length === 0
      ? 'Datos suficientes para todas las reglas disponibles.'
      : missingData.join(' · '),
    evidence: statusEvidence,
    recommendation: missingData.length === 0
      ? 'El análisis está completo. Las reglas se recalculan con cada nueva partida sincronizada.'
      : 'Sincroniza más partidas y asegúrate de tener al menos 3 jugadores en el roster para desbloquear todas las reglas.',
    reviewRequired: false,
  });

  return insights.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
