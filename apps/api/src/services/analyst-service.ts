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

  if (ftTotal >= 5 && ftCtrl >= 70) {
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

  if (primeTotal >= 5 && primeCtrl >= 70) {
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

  // ── Data status insight — always shown ───────────────────────────────────
  const totalMPs = [...mpByPlayer.values()].reduce((s, arr) => s + arr.length, 0);
  const playersWithEnoughData = [...mpByPlayer.values()].filter((arr) => arr.length >= 8).length;
  const playerDataOk = playersWithEnoughData === rosterPlayerIds.length && rosterPlayerIds.length >= 1;
  const eventDataOk = eventMatchIds.length >= 3;
  const rosterOk = rosterPlayerIds.length >= 3;

  const statusEvidence: string[] = [
    `${rosterOk ? '✓' : '✗'} Roster: ${rosterPlayerIds.length} jugador(es) activos${rosterOk ? '' : ' — necesita ≥3'}`,
    `${playerDataOk ? '✓' : '✗'} Datos individuales: ${playersWithEnoughData}/${rosterPlayerIds.length} jugadores con ≥8 partidas (${totalMPs} registros totales)`,
    `${eventDataOk ? '✓' : '✗'} Event stream de equipo: ${eventMatchIds.length} partidas con ≥3 jugadores juntos sincronizadas${eventDataOk ? '' : ' — necesita ≥3'}`,
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
    statusBody = `${lacking} jugador(es) tienen pocas partidas sincronizadas. Las reglas de draft, rendimiento y visión necesitan ≥8 partidas por jugador.`;
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
