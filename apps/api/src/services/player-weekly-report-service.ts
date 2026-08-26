import { db } from '../db.js';
import { AppError } from '../middleware/error-handler.js';

const DAY_MS = 24 * 60 * 60 * 1000;

type MatchRow = {
  heroSlug: string;
  role: string | null;
  team: string;
  kills: number;
  deaths: number;
  assists: number;
  heroDamage: number | null;
  gold: number | null;
  laneMinionsKilled: number | null;
  wardsPlaced: number | null;
  totalDamageDealtToObjectives: number | null;
  totalDamageDealtToStructures: number | null;
  totalDamageTaken: number | null;
  totalHealingDone: number | null;
  totalShieldingReceived: number | null;
  totalDamageMitigated: number | null;
  match: {
    startTime: Date;
    winningTeam: string | null;
    duration: number;
    matchPlayers: Array<{ team: string; kills: number }>;
    version: { name: string } | null;
  };
};

type PlayerRole = 'CARRY' | 'SUPPORT' | 'MIDLANE' | 'JUNGLE' | 'OFFLANE';

type RoleMetricKey =
  | 'kda'
  | 'deathsPerMatch'
  | 'csPerMinute'
  | 'goldPerMinute'
  | 'damagePerMinute'
  | 'killParticipation'
  | 'wardsPerMinute'
  | 'objectiveDamagePerMinute'
  | 'structureDamagePerMinute'
  | 'damageTakenPerMinute'
  | 'healingPerMinute'
  | 'shieldingPerMinute'
  | 'mitigationPerMinute';

export type PlayerRoleCoach = {
  role: PlayerRole;
  label: string;
  matches: number;
  shareOfMatches: number;
  confidence: 'low' | 'medium' | 'high';
  metrics: Array<{
    key: RoleMetricKey;
    label: string;
    value: number | null;
    baseline: number | null;
    unit: 'ratio' | 'per_match' | 'per_minute' | 'percent';
  }>;
  focus: {
    title: string;
    rationale: string;
    action: string;
  };
  training: {
    metricKey: 'cs_per_min' | 'dpm' | 'deaths_per_match' | 'wards_per_min' | 'kill_participation' | 'objective_damage_per_min' | 'structure_damage_per_min';
    metricLabel: string;
    direction: 'higher' | 'lower';
    targetValue: number | null;
    targetMatches: 5;
  };
};

export type PlayerChampionPool = {
  currentPatch: string | null;
  totalMatches30d: number;
  heroes: Array<{
    heroSlug: string;
    role: string | null;
    designation: 'main' | 'alternate' | 'experimental';
    matches30d: number;
    wins30d: number;
    winRate30d: number;
    kda30d: number;
    currentPatchMatches: number;
    currentPatchWinRate: number | null;
    currentPatchKda: number | null;
    trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
  }>;
  mainHero: string | null;
  alternativeHero: string | null;
  recommendation: {
    title: string;
    rationale: string;
    action: string;
  };
};

export type PlayerPeriodMetrics = {
  matches: number;
  wins: number;
  winRate: number | null;
  kills: number;
  deaths: number;
  assists: number;
  kda: number | null;
  averageHeroDamage: number | null;
  averageGold: number | null;
  averageLaneMinions: number | null;
};

export type PlayerMetricTrend = {
  metric: 'kda' | 'winRate' | 'averageHeroDamage' | 'averageGold' | 'averageLaneMinions';
  weekly: number | null;
  baseline: number | null;
  delta: number | null;
  direction: 'up' | 'down' | 'stable' | 'insufficient_data';
  deltaUnit: 'percent' | 'percentage_points';
};

export type PlayerWeeklyReport = {
  generatedAt: string;
  period: { weeklyFrom: string; baselineFrom: string; to: string };
  player: { id: string; displayName: string; customName: string | null };
  weekly: PlayerPeriodMetrics;
  baseline30d: PlayerPeriodMetrics;
  trends: PlayerMetricTrend[];
  topHero: {
    heroSlug: string;
    matches: number;
    wins: number;
    winRate: number;
    shareOfWeeklyMatches: number;
  } | null;
  focusOfWeek: {
    category: 'activity' | 'survivability' | 'consistency' | 'hero_pool' | 'momentum';
    title: string;
    rationale: string;
    action: string;
  };
  roleCoach: PlayerRoleCoach | null;
  championPool: PlayerChampionPool;
};

function rounded(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return null;
  return rounded(present.reduce((sum, value) => sum + value, 0) / present.length, 1);
}

function averageRaw(values: number[]): number | null {
  if (values.length === 0) return null;
  return rounded(values.reduce((sum, value) => sum + value, 0) / values.length, 2);
}

function perMinute(row: MatchRow, value: number | null): number | null {
  if (value === null || row.match.duration <= 0) return null;
  return value / (row.match.duration / 60);
}

type RoleMetricValues = Record<RoleMetricKey, number | null>;

function aggregateRole(rows: MatchRow[]): RoleMetricValues {
  const kills = rows.reduce((sum, row) => sum + row.kills, 0);
  const deaths = rows.reduce((sum, row) => sum + row.deaths, 0);
  const assists = rows.reduce((sum, row) => sum + row.assists, 0);
  const killParticipation = rows.flatMap((row) => {
    const teamKills = row.match.matchPlayers
      .filter((player) => player.team === row.team)
      .reduce((sum, player) => sum + player.kills, 0);
    return teamKills > 0 ? [Math.min(100, ((row.kills + row.assists) / teamKills) * 100)] : [];
  });
  const metricPerMinute = (read: (row: MatchRow) => number | null) =>
    averageRaw(rows.flatMap((row) => {
      const value = perMinute(row, read(row));
      return value === null ? [] : [value];
    }));

  return {
    kda: rows.length > 0 ? rounded((kills + assists) / Math.max(deaths, 1)) : null,
    deathsPerMatch: rows.length > 0 ? rounded(deaths / rows.length, 1) : null,
    csPerMinute: metricPerMinute((row) => row.laneMinionsKilled),
    goldPerMinute: metricPerMinute((row) => row.gold),
    damagePerMinute: metricPerMinute((row) => row.heroDamage),
    killParticipation: averageRaw(killParticipation),
    wardsPerMinute: metricPerMinute((row) => row.wardsPlaced),
    objectiveDamagePerMinute: metricPerMinute((row) => row.totalDamageDealtToObjectives),
    structureDamagePerMinute: metricPerMinute((row) => row.totalDamageDealtToStructures),
    damageTakenPerMinute: metricPerMinute((row) => row.totalDamageTaken),
    healingPerMinute: metricPerMinute((row) => row.totalHealingDone),
    shieldingPerMinute: metricPerMinute((row) => row.totalShieldingReceived),
    mitigationPerMinute: metricPerMinute((row) => row.totalDamageMitigated),
  };
}

const ROLE_LABELS: Record<PlayerRole, string> = {
  CARRY: 'Carry',
  SUPPORT: 'Support',
  MIDLANE: 'Midlane',
  JUNGLE: 'Jungle',
  OFFLANE: 'Offlane',
};

const METRIC_LABELS: Record<RoleMetricKey, string> = {
  kda: 'KDA',
  deathsPerMatch: 'Muertes / partida',
  csPerMinute: 'CS / min',
  goldPerMinute: 'Oro / min',
  damagePerMinute: 'Daño / min',
  killParticipation: 'Participación',
  wardsPerMinute: 'Wards / min',
  objectiveDamagePerMinute: 'Daño a objetivos / min',
  structureDamagePerMinute: 'Daño a estructuras / min',
  damageTakenPerMinute: 'Daño recibido / min',
  healingPerMinute: 'Curación / min',
  shieldingPerMinute: 'Escudos recibidos / min',
  mitigationPerMinute: 'Daño mitigado / min',
};

const ROLE_METRICS: Record<PlayerRole, RoleMetricKey[]> = {
  CARRY: ['csPerMinute', 'goldPerMinute', 'damagePerMinute', 'deathsPerMatch'],
  SUPPORT: ['killParticipation', 'wardsPerMinute', 'healingPerMinute', 'shieldingPerMinute'],
  MIDLANE: ['damagePerMinute', 'csPerMinute', 'killParticipation', 'deathsPerMatch'],
  JUNGLE: ['objectiveDamagePerMinute', 'killParticipation', 'damagePerMinute', 'deathsPerMatch'],
  OFFLANE: ['damageTakenPerMinute', 'mitigationPerMinute', 'structureDamagePerMinute', 'deathsPerMatch'],
};

function lowerThanBaseline(current: number | null, baseline: number | null, ratio = 0.9): boolean {
  return current !== null && baseline !== null && current < baseline * ratio;
}

function roleFocus(role: PlayerRole, weekly: RoleMetricValues, baseline: RoleMetricValues, matches: number) {
  if (matches < 2) {
    return {
      title: `Construye una muestra como ${ROLE_LABELS[role]}`,
      rationale: `Solo hay ${matches} ${matches === 1 ? 'partida' : 'partidas'} reciente como ${ROLE_LABELS[role]}; aún no conviene sacar conclusiones específicas del rol.`,
      action: `Juega al menos tres partidas más como ${ROLE_LABELS[role]} manteniendo un mismo objetivo de proceso.`,
    };
  }

  const highDeaths = weekly.deathsPerMatch !== null
    && weekly.deathsPerMatch >= 5
    && (baseline.deathsPerMatch === null || weekly.deathsPerMatch > baseline.deathsPerMatch * 1.1);

  if (role === 'CARRY') {
    if (lowerThanBaseline(weekly.csPerMinute, baseline.csPerMinute)) return {
      title: 'Protege tu curva de recursos',
      rationale: `Tu ritmo de farmeo como Carry (${weekly.csPerMinute} CS/min) está por debajo de tu referencia (${baseline.csPerMinute} CS/min).`,
      action: 'En las próximas cinco partidas, registra tu CS al minuto 10 y evita abandonar dos oleadas seguidas por una rotación sin objetivo claro.',
    };
    if (highDeaths) return {
      title: 'Llega vivo al daño decisivo',
      rationale: `Promedias ${weekly.deathsPerMatch} muertes como Carry; cada muerte reduce tu tiempo de farmeo y tu presencia en peleas.`,
      action: 'Revisa tus dos primeras muertes y clasifícalas: posición, falta de visión o uso tardío de recursos defensivos.',
    };
    return {
      title: 'Convierte recursos en daño seguro',
      rationale: `Tu economía reciente es de ${weekly.goldPerMinute ?? '—'} oro/min y produces ${weekly.damagePerMinute ?? '—'} daño/min.`,
      action: 'En cinco partidas, prioriza mantener rango seguro y anota si cada muerte ocurrió antes o después de usar tu recurso defensivo.',
    };
  }

  if (role === 'SUPPORT') {
    if (lowerThanBaseline(weekly.wardsPerMinute, baseline.wardsPerMinute)) return {
      title: 'Recupera control de visión',
      rationale: `Tu colocación de visión (${weekly.wardsPerMinute} wards/min) está por debajo de tu referencia (${baseline.wardsPerMinute}).`,
      action: 'Marca dos ventanas por partida para renovar visión: antes del primer Fangtooth y antes de cada rotación al lado fuerte.',
    };
    if (highDeaths) return {
      title: 'Da información sin regalarte',
      rationale: `Promedias ${weekly.deathsPerMatch} muertes como Support, por encima de tu patrón reciente.`,
      action: 'Revisa cada muerte fuera de una pelea 5v5 y comprueba si entraste a colocar visión sin información de dos rivales.',
    };
    return {
      title: 'Aumenta tu impacto colectivo',
      rationale: `Participas en el ${weekly.killParticipation ?? '—'}% de las bajas aliadas mientras sostienes la visión del equipo.`,
      action: 'Durante cinco partidas, decide antes de cada objetivo si tu prioridad es iniciar, proteger al Carry o negar visión; no mezcles las tres a la vez.',
    };
  }

  if (role === 'MIDLANE') {
    if (lowerThanBaseline(weekly.damagePerMinute, baseline.damagePerMinute)) return {
      title: 'Recupera presión desde Midlane',
      rationale: `Tu daño reciente (${weekly.damagePerMinute}/min) está por debajo de tu referencia (${baseline.damagePerMinute}/min).`,
      action: 'Revisa minuto 8–15: cuenta cuántas oleadas limpias antes de rotar y si llegas a la pelea con recursos disponibles.',
    };
    if (lowerThanBaseline(weekly.csPerMinute, baseline.csPerMinute)) return {
      title: 'Equilibra oleada y rotación',
      rationale: `Tu farmeo como Midlane ha bajado a ${weekly.csPerMinute} CS/min frente a ${baseline.csPerMinute}.`,
      action: 'No rotes con una oleada entrando en tu torre salvo que la jugada asegure un objetivo o una ventaja numérica clara.',
    };
    return {
      title: 'Transforma prioridad en ventaja',
      rationale: `Tu participación es ${weekly.killParticipation ?? '—'}% y tu daño ${weekly.damagePerMinute ?? '—'}/min.`,
      action: 'En las próximas cinco partidas, anota la primera rotación realizada con prioridad y qué ventaja concreta generó.',
    };
  }

  if (role === 'JUNGLE') {
    if (lowerThanBaseline(weekly.objectiveDamagePerMinute, baseline.objectiveDamagePerMinute)) return {
      title: 'Convierte presión en objetivos',
      rationale: `Tu daño a objetivos (${weekly.objectiveDamagePerMinute}/min) está por debajo de tu referencia (${baseline.objectiveDamagePerMinute}/min).`,
      action: 'Antes de cada gank, define qué objetivo o campamento rival podrás convertir si la jugada sale bien.',
    };
    if (highDeaths) return {
      title: 'Reduce invasiones sin información',
      rationale: `Promedias ${weekly.deathsPerMatch} muertes como Jungla, lo que cede tempo y control del mapa.`,
      action: 'Revisa las muertes en jungla rival e identifica qué líneas tenían prioridad y qué visión confirmaba la invasión.',
    };
    return {
      title: 'Haz que cada aparición tenga propósito',
      rationale: `Participas en el ${weekly.killParticipation ?? '—'}% de las bajas y generas ${weekly.objectiveDamagePerMinute ?? '—'} de daño a objetivos/min.`,
      action: 'Durante cinco partidas, etiqueta cada gank como objetivo, protección de oleada o castigo; elimina los que no encajen en ninguna categoría.',
    };
  }

  if (lowerThanBaseline(weekly.structureDamagePerMinute, baseline.structureDamagePerMinute)) return {
    title: 'Convierte la presión lateral',
    rationale: `Tu daño a estructuras (${weekly.structureDamagePerMinute}/min) está por debajo de tu referencia (${baseline.structureDamagePerMinute}/min).`,
    action: 'Después de ganar un intercambio, decide explícitamente entre placa/torre, oleada profunda o rotación; evita volver a base sin convertir presión.',
  };
  if (highDeaths) return {
    title: 'Absorbe presión con mejores salidas',
    rationale: `Promedias ${weekly.deathsPerMatch} muertes como Offlane mientras recibes ${weekly.damageTakenPerMinute ?? '—'} de daño/min.`,
    action: 'Revisa si tus muertes laterales ocurrieron con visión del rival y una ruta de salida; coloca la visión antes de cruzar el río.',
  };
  return {
    title: 'Convierte ventaja de línea en mapa',
    rationale: `Recibes ${weekly.damageTakenPerMinute ?? '—'} daño/min y aportas ${weekly.structureDamagePerMinute ?? '—'} a estructuras/min.`,
    action: 'En cinco partidas, mide cuántas veces tu presión lateral obliga a responder a dos rivales sin morir por ello.',
  };
}

function buildRoleCoach(weeklyRows: MatchRow[], baselineRows: MatchRow[]): PlayerRoleCoach | null {
  const roleCounts = new Map<PlayerRole, number>();
  for (const row of baselineRows) {
    if (row.role && row.role in ROLE_LABELS) {
      const role = row.role as PlayerRole;
      roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
    }
  }
  const primaryRole = [...roleCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!primaryRole) return null;

  const weeklyRoleRows = weeklyRows.filter((row) => row.role === primaryRole);
  const baselineRoleRows = baselineRows.filter((row) => row.role === primaryRole);
  const weekly = aggregateRole(weeklyRoleRows);
  const baseline = aggregateRole(baselineRoleRows);
  const matches = weeklyRoleRows.length;
  const baselineMatches = baselineRoleRows.length;
  const focus = roleFocus(primaryRole, weekly, baseline, matches);

  const trainingForFocus = () => {
    const title = focus.title.toLowerCase();
    let metricKey: PlayerRoleCoach['training']['metricKey'];
    let metricLabel: string;
    let direction: PlayerRoleCoach['training']['direction'] = 'higher';
    let current: number | null;
    let reference: number | null;

    if (title.includes('muerte') || title.includes('regalarte') || title.includes('salidas')) {
      metricKey = 'deaths_per_match'; metricLabel = 'Muertes por partida'; direction = 'lower';
      current = weekly.deathsPerMatch; reference = baseline.deathsPerMatch;
    } else if (title.includes('visión')) {
      metricKey = 'wards_per_min'; metricLabel = 'Wards por minuto';
      current = weekly.wardsPerMinute; reference = baseline.wardsPerMinute;
    } else if (title.includes('objetivo')) {
      metricKey = 'objective_damage_per_min'; metricLabel = 'Daño a objetivos por minuto';
      current = weekly.objectiveDamagePerMinute; reference = baseline.objectiveDamagePerMinute;
    } else if (title.includes('lateral') || title.includes('estructura')) {
      metricKey = 'structure_damage_per_min'; metricLabel = 'Daño a estructuras por minuto';
      current = weekly.structureDamagePerMinute; reference = baseline.structureDamagePerMinute;
    } else if (title.includes('recursos') || title.includes('farmeo') || title.includes('oleada')) {
      metricKey = 'cs_per_min'; metricLabel = 'CS por minuto';
      current = weekly.csPerMinute; reference = baseline.csPerMinute;
    } else if (primaryRole === 'SUPPORT' || primaryRole === 'JUNGLE') {
      metricKey = 'kill_participation'; metricLabel = 'Participación en bajas';
      current = weekly.killParticipation; reference = baseline.killParticipation;
    } else if (primaryRole === 'OFFLANE') {
      metricKey = 'structure_damage_per_min'; metricLabel = 'Daño a estructuras por minuto';
      current = weekly.structureDamagePerMinute; reference = baseline.structureDamagePerMinute;
    } else {
      metricKey = 'dpm'; metricLabel = 'Daño por minuto';
      current = weekly.damagePerMinute; reference = baseline.damagePerMinute;
    }

    const targetValue = current === null
      ? reference
      : direction === 'lower'
        ? Math.min(current * 0.9, reference ?? current * 0.9)
        : Math.max(current * 1.05, reference ?? current * 1.05);
    return {
      metricKey,
      metricLabel,
      direction,
      targetValue: targetValue === null ? null : rounded(targetValue, 2),
      targetMatches: 5 as const,
    };
  };

  return {
    role: primaryRole,
    label: ROLE_LABELS[primaryRole],
    matches,
    shareOfMatches: baselineRows.length > 0 ? rounded((baselineMatches / baselineRows.length) * 100, 1) : 0,
    confidence: baselineMatches >= 10 ? 'high' : baselineMatches >= 5 ? 'medium' : 'low',
    metrics: ROLE_METRICS[primaryRole].map((key) => ({
      key,
      label: METRIC_LABELS[key],
      value: weekly[key],
      baseline: baseline[key],
      unit: key === 'kda' ? 'ratio' : key === 'deathsPerMatch' ? 'per_match' : key === 'killParticipation' ? 'percent' : 'per_minute',
    })),
    focus,
    training: trainingForFocus(),
  };
}

function heroKda(rows: MatchRow[]): number {
  const kills = rows.reduce((sum, row) => sum + row.kills, 0);
  const deaths = rows.reduce((sum, row) => sum + row.deaths, 0);
  const assists = rows.reduce((sum, row) => sum + row.assists, 0);
  return rounded((kills + assists) / Math.max(deaths, 1));
}

function heroWinRate(rows: MatchRow[]): number {
  if (rows.length === 0) return 0;
  const wins = rows.filter((row) => row.match.winningTeam !== null && row.team === row.match.winningTeam).length;
  return rounded((wins / rows.length) * 100, 1);
}

function heroPrimaryRole(rows: MatchRow[]): string | null {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.role) counts.set(row.role, (counts.get(row.role) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function championTrend(currentRows: MatchRow[], previousRows: MatchRow[]) {
  if (currentRows.length < 3 || previousRows.length < 3) return 'insufficient_data' as const;
  const winRateDelta = heroWinRate(currentRows) - heroWinRate(previousRows);
  const kdaDelta = heroKda(currentRows) - heroKda(previousRows);
  if (winRateDelta >= 8 || kdaDelta >= 0.4) return 'improving' as const;
  if (winRateDelta <= -8 || kdaDelta <= -0.4) return 'declining' as const;
  return 'stable' as const;
}

function buildChampionPool(rows: MatchRow[], currentPatch: string | null): PlayerChampionPool {
  const grouped = new Map<string, MatchRow[]>();
  for (const row of rows) {
    const heroRows = grouped.get(row.heroSlug) ?? [];
    heroRows.push(row);
    grouped.set(row.heroSlug, heroRows);
  }

  const sorted = [...grouped.entries()].sort((a, b) => {
    const aPatch = currentPatch ? a[1].filter((row) => row.match.version?.name === currentPatch).length : 0;
    const bPatch = currentPatch ? b[1].filter((row) => row.match.version?.name === currentPatch).length : 0;
    return b[1].length - a[1].length || bPatch - aPatch || heroWinRate(b[1]) - heroWinRate(a[1]);
  });
  const mainHero = sorted[0]?.[0] ?? null;
  const alternativeHero = sorted.slice(1).find(([, heroRows]) => heroRows.length >= 2)?.[0] ?? null;

  const heroes = sorted.slice(0, 5).map(([heroSlug, heroRows]) => {
    const currentRows = currentPatch
      ? heroRows.filter((row) => row.match.version?.name === currentPatch)
      : [];
    const previousRows = currentPatch
      ? heroRows.filter((row) => row.match.version?.name !== currentPatch)
      : [];
    const wins30d = heroRows.filter((row) => row.match.winningTeam !== null && row.team === row.match.winningTeam).length;
    return {
      heroSlug,
      role: heroPrimaryRole(heroRows),
      designation: (heroSlug === mainHero ? 'main' : heroSlug === alternativeHero ? 'alternate' : 'experimental') as 'main' | 'alternate' | 'experimental',
      matches30d: heroRows.length,
      wins30d,
      winRate30d: heroWinRate(heroRows),
      kda30d: heroKda(heroRows),
      currentPatchMatches: currentRows.length,
      currentPatchWinRate: currentRows.length > 0 ? heroWinRate(currentRows) : null,
      currentPatchKda: currentRows.length > 0 ? heroKda(currentRows) : null,
      trend: championTrend(currentRows, previousRows),
    };
  });

  const main = heroes.find((hero) => hero.designation === 'main') ?? null;
  const alternative = heroes.find((hero) => hero.designation === 'alternate') ?? null;
  let recommendation: PlayerChampionPool['recommendation'];
  if (rows.length < 5) {
    recommendation = {
      title: 'No cambies el pool todavía',
      rationale: `Solo hay ${rows.length} partidas recientes; la muestra no permite distinguir rendimiento real de varianza.`,
      action: 'Completa cinco partidas en tu rol principal antes de añadir o retirar un héroe.',
    };
  } else if (!alternative) {
    recommendation = {
      title: 'Define una alternativa fiable',
      rationale: main ? `${main.heroSlug} concentra tu muestra y ningún segundo héroe alcanza todavía dos partidas recientes.` : 'Todavía no hay un héroe principal identificable.',
      action: 'Reserva dos de tus próximas cinco partidas para un segundo héroe del mismo rol que cubra enfrentamientos incómodos de tu principal.',
    };
  } else if (main && main.matches30d / rows.length >= 0.7) {
    recommendation = {
      title: 'Reduce dependencia del héroe principal',
      rationale: `${main.heroSlug} representa el ${rounded((main.matches30d / rows.length) * 100, 1)}% de tus partidas; ${alternative.heroSlug} es la alternativa con mejor muestra disponible.`,
      action: `Usa ${alternative.heroSlug} en dos de las próximas cinco partidas, manteniendo ${main.heroSlug} como elección principal.`,
    };
  } else if (main?.trend === 'declining') {
    recommendation = {
      title: 'Revalida tu héroe principal en este parche',
      rationale: `${main.heroSlug} ha empeorado frente a tus partidas anteriores y ya hay muestra suficiente para vigilar la tendencia.`,
      action: `Compara tus tres próximas partidas con ${main.heroSlug} contra ${alternative.heroSlug}; conserva el que cumpla mejor tu objetivo de rol.`,
    };
  } else {
    recommendation = {
      title: 'Mantén un pool pequeño y estable',
      rationale: `${main?.heroSlug ?? 'Tu principal'} y ${alternative?.heroSlug ?? 'tu alternativa'} ya forman una base utilizable sin dispersar la práctica.`,
      action: 'Aplica una distribución aproximada 60/30/10: principal, alternativa y una partida experimental solo cuando el objetivo semanal esté estable.',
    };
  }

  return {
    currentPatch,
    totalMatches30d: rows.length,
    heroes,
    mainHero,
    alternativeHero,
    recommendation,
  };
}

function aggregate(rows: MatchRow[]): PlayerPeriodMetrics {
  const wins = rows.filter((row) => row.match.winningTeam !== null && row.team === row.match.winningTeam).length;
  const kills = rows.reduce((sum, row) => sum + row.kills, 0);
  const deaths = rows.reduce((sum, row) => sum + row.deaths, 0);
  const assists = rows.reduce((sum, row) => sum + row.assists, 0);

  return {
    matches: rows.length,
    wins,
    winRate: rows.length > 0 ? rounded((wins / rows.length) * 100, 1) : null,
    kills,
    deaths,
    assists,
    kda: rows.length > 0 ? rounded((kills + assists) / Math.max(deaths, 1)) : null,
    averageHeroDamage: average(rows.map((row) => row.heroDamage)),
    averageGold: average(rows.map((row) => row.gold)),
    averageLaneMinions: average(rows.map((row) => row.laneMinionsKilled)),
  };
}

function trend(
  metric: PlayerMetricTrend['metric'],
  weekly: number | null,
  baseline: number | null,
  enoughData: boolean,
): PlayerMetricTrend {
  const points = metric === 'winRate';
  if (!enoughData || weekly === null || baseline === null) {
    return { metric, weekly, baseline, delta: null, direction: 'insufficient_data', deltaUnit: points ? 'percentage_points' : 'percent' };
  }

  const delta = points
    ? rounded(weekly - baseline, 1)
    : baseline === 0 ? null : rounded(((weekly - baseline) / Math.abs(baseline)) * 100, 1);
  if (delta === null) {
    return { metric, weekly, baseline, delta, direction: 'insufficient_data', deltaUnit: points ? 'percentage_points' : 'percent' };
  }

  const threshold = points ? 3 : 5;
  const direction = delta > threshold ? 'up' : delta < -threshold ? 'down' : 'stable';
  return { metric, weekly, baseline, delta, direction, deltaUnit: points ? 'percentage_points' : 'percent' };
}

function topHero(rows: MatchRow[]): PlayerWeeklyReport['topHero'] {
  if (rows.length === 0) return null;
  const heroes = new Map<string, { matches: number; wins: number }>();
  for (const row of rows) {
    const current = heroes.get(row.heroSlug) ?? { matches: 0, wins: 0 };
    current.matches += 1;
    if (row.match.winningTeam !== null && row.team === row.match.winningTeam) current.wins += 1;
    heroes.set(row.heroSlug, current);
  }

  const [heroSlug, stats] = [...heroes.entries()].sort((a, b) => b[1].matches - a[1].matches || b[1].wins - a[1].wins)[0];
  return {
    heroSlug,
    matches: stats.matches,
    wins: stats.wins,
    winRate: rounded((stats.wins / stats.matches) * 100, 1),
    shareOfWeeklyMatches: rounded((stats.matches / rows.length) * 100, 1),
  };
}

function chooseFocus(
  weekly: PlayerPeriodMetrics,
  baseline: PlayerPeriodMetrics,
  hero: PlayerWeeklyReport['topHero'],
): PlayerWeeklyReport['focusOfWeek'] {
  if (weekly.matches < 3) {
    return {
      category: 'activity',
      title: 'Construye una muestra útil',
      rationale: `Solo hay ${weekly.matches} partidas sincronizadas en los últimos 7 días; todavía no es suficiente para separar tendencia de varianza.`,
      action: 'Juega y sincroniza al menos 3–5 partidas antes de cambiar tu plan de entrenamiento.',
    };
  }

  const weeklyDeaths = weekly.deaths / weekly.matches;
  const baselineDeaths = baseline.matches > 0 ? baseline.deaths / baseline.matches : weeklyDeaths;
  if (weeklyDeaths >= baselineDeaths * 1.12 && weeklyDeaths >= 4) {
    return {
      category: 'survivability',
      title: 'Reduce muertes evitables',
      rationale: `Promedias ${rounded(weeklyDeaths, 1)} muertes por partida, por encima de tu referencia de 30 días (${rounded(baselineDeaths, 1)}).`,
      action: 'Revisa la primera muerte de cada partida y anota si faltó visión, información del jungla o respeto por una rotación.',
    };
  }

  if (hero && hero.shareOfWeeklyMatches >= 70 && hero.matches >= 4) {
    return {
      category: 'hero_pool',
      title: 'Añade una segunda opción fiable',
      rationale: `${hero.heroSlug} representa el ${hero.shareOfWeeklyMatches}% de tus partidas semanales. Esa dependencia limita tu adaptación al draft.`,
      action: 'Dedica dos partidas de práctica a un héroe alternativo del mismo rol con un patrón de juego complementario.',
    };
  }

  if (weekly.winRate !== null && baseline.winRate !== null && weekly.winRate >= baseline.winRate + 5) {
    return {
      category: 'momentum',
      title: 'Consolida lo que está funcionando',
      rationale: `Tu win rate semanal es ${weekly.winRate}%, frente al ${baseline.winRate}% de los últimos 30 días.`,
      action: 'Mantén rol y núcleo de héroes una semana más; identifica una decisión repetible de tus victorias y conviértela en hábito.',
    };
  }

  return {
    category: 'consistency',
    title: 'Mejora la consistencia',
    rationale: 'No hay una desviación crítica; el mayor retorno está en repetir buenas decisiones y reducir partidas de bajo impacto.',
    action: 'Elige una métrica de proceso para las próximas cinco partidas: primeras muertes, CS al minuto 10 o participación en objetivos.',
  };
}

export async function generatePlayerWeeklyReport(playerId: string, now = new Date()): Promise<PlayerWeeklyReport> {
  const baselineFrom = new Date(now.getTime() - 30 * DAY_MS);
  const weeklyFrom = new Date(now.getTime() - 7 * DAY_MS);

  const [player, rows, latestVersion] = await Promise.all([
    db.player.findUnique({
      where: { id: playerId },
      select: { id: true, displayName: true, customName: true },
    }),
    db.matchPlayer.findMany({
      where: { playerId, match: { startTime: { gte: baselineFrom, lte: now } } },
      select: {
        heroSlug: true,
        role: true,
        team: true,
        kills: true,
        deaths: true,
        assists: true,
        heroDamage: true,
        gold: true,
        laneMinionsKilled: true,
        wardsPlaced: true,
        totalDamageDealtToObjectives: true,
        totalDamageDealtToStructures: true,
        totalDamageTaken: true,
        totalHealingDone: true,
        totalShieldingReceived: true,
        totalDamageMitigated: true,
        match: {
          select: {
            startTime: true,
            winningTeam: true,
            duration: true,
            matchPlayers: { select: { team: true, kills: true } },
            version: { select: { name: true } },
          },
        },
      },
      orderBy: { match: { startTime: 'desc' } },
    }),
    db.version.findFirst({
      orderBy: { releaseDate: 'desc' },
      select: { name: true },
    }),
  ]);

  if (!player) throw new AppError(404, 'Player not found', 'PLAYER_NOT_FOUND');

  const typedRows = rows as MatchRow[];
  const weeklyRows = typedRows.filter((row) => row.match.startTime >= weeklyFrom);
  const weekly = aggregate(weeklyRows);
  const baseline30d = aggregate(typedRows);
  const enoughData = weekly.matches >= 3 && baseline30d.matches >= 5;
  const hero = topHero(weeklyRows);

  return {
    generatedAt: now.toISOString(),
    period: { weeklyFrom: weeklyFrom.toISOString(), baselineFrom: baselineFrom.toISOString(), to: now.toISOString() },
    player,
    weekly,
    baseline30d,
    trends: [
      trend('kda', weekly.kda, baseline30d.kda, enoughData),
      trend('winRate', weekly.winRate, baseline30d.winRate, enoughData),
      trend('averageHeroDamage', weekly.averageHeroDamage, baseline30d.averageHeroDamage, enoughData),
      trend('averageGold', weekly.averageGold, baseline30d.averageGold, enoughData),
      trend('averageLaneMinions', weekly.averageLaneMinions, baseline30d.averageLaneMinions, enoughData),
    ],
    topHero: hero,
    focusOfWeek: chooseFocus(weekly, baseline30d, hero),
    roleCoach: buildRoleCoach(weeklyRows, typedRows),
    championPool: buildChampionPool(typedRows, latestVersion?.name ?? null),
  };
}
