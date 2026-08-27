import { Prisma } from '@prisma/client';
import { db } from '../db.js';
import { AppError } from '../middleware/error-handler.js';

export type CoachCategory = 'abilities' | 'economy' | 'combat' | 'objectives';
export type CoachConfidence = 'low' | 'medium' | 'high';

export interface EducationalObservation {
  id: string;
  category: CoachCategory;
  priority: 'primary' | 'secondary' | 'reference';
  tone: 'strength' | 'development' | 'context';
  title: string;
  evidence: string;
  interpretation: string;
  action: string;
  exception: string;
  transferExamples: string[];
  confidence: { level: CoachConfidence; basis: string };
  limitation: string | null;
}

type AbilityUpgrade = { ability: string; gameTime: number };

function arrayValue<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function rounded(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function perMinute(value: number | null, duration: number): number | null {
  return value === null || duration <= 0 ? null : rounded(value / (duration / 60), 2);
}

function confidence(level: CoachConfidence, basis: string) {
  return { level, basis };
}

function roleLabel(role: string | null): string {
  const labels: Record<string, string> = {
    CARRY: 'Carry', JUNGLE: 'Jungla', MIDLANE: 'Midlane', OFFLANE: 'Offlane', SUPPORT: 'Support',
  };
  return role ? labels[role] ?? role : 'tu rol';
}

function abilityKey(order: AbilityUpgrade[]): string {
  return order.slice(0, 10).map((upgrade) => upgrade.ability).join(' → ');
}

function choosePositive(input: {
  won: boolean;
  killParticipation: number;
  teamKillParticipationAverage: number;
  deaths: number;
  wardsPlaced: number;
  objectiveDamage: number;
}): EducationalObservation {
  if (input.killParticipation >= Math.max(55, input.teamKillParticipationAverage)) {
    return {
      id: 'combat-participation-strength', category: 'combat', priority: 'secondary', tone: 'strength',
      title: 'Estuviste conectado con las acciones de tu equipo',
      evidence: `Participaste en el ${input.killParticipation}% de las bajas del equipo.`,
      interpretation: 'La participación alta suele indicar que llegaste a las peleas que tu equipo decidió jugar; no demuestra por sí sola que cada entrada fuese correcta.',
      action: 'Conserva el hábito de mirar el estado de tus aliados antes de rotar y anota qué señal te hizo llegar a tiempo.',
      exception: 'Una participación menor puede ser correcta si estabas generando una ventaja clara en otra zona o evitando una pelea perdida.',
      transferExamples: ['Support que rota tras empujar la oleada', 'Jungla que llega al objetivo con sus enfriamientos disponibles'],
      confidence: confidence('high', 'Calculado con bajas y asistencias completas del marcador.'), limitation: null,
    };
  }
  if (input.deaths <= 3) {
    return {
      id: 'combat-survival-strength', category: 'combat', priority: 'secondary', tone: 'strength',
      title: 'Limitaste las ventanas de castigo rival',
      evidence: `Terminaste con ${input.deaths} muertes.`,
      interpretation: 'Morir poco conserva tempo, oro y presencia, aunque jugar demasiado atrás también puede reducir tu impacto.',
      action: 'Revisa una pelea que evitaste y confirma si fue paciencia útil o una oportunidad perdida.',
      exception: 'Un iniciador puede aceptar una muerte si intercambia recursos por una pelea u objetivo claramente favorable.',
      transferExamples: ['Carry que mantiene distancia hasta que se gasta el engage rival', 'Support que guarda su movilidad para salir después de usar el control'],
      confidence: confidence('high', 'Dato directo del marcador.'), limitation: null,
    };
  }
  if (input.wardsPlaced >= 8) {
    return {
      id: 'vision-volume-strength', category: 'objectives', priority: 'secondary', tone: 'strength',
      title: 'Generaste información de forma constante',
      evidence: `Colocaste ${input.wardsPlaced} wards.`,
      interpretation: 'El volumen crea oportunidades de información; el siguiente paso es comprobar si las colocaciones anticiparon decisiones importantes.',
      action: 'Elige dos wards y relaciona cada uno con la decisión que permitió tomar.',
      exception: 'Más wards no implica mejor visión si se colocan tarde, juntos o en zonas que el equipo no puede utilizar.',
      transferExamples: ['Visión profunda antes de Fangtooth', 'Ward defensivo cuando el rival tiene presión de línea'],
      confidence: confidence('high', 'Recuento directo del marcador; la utilidad se contrasta con eventos y tiempo.'), limitation: null,
    };
  }
  return {
    id: 'objective-presence-strength', category: 'objectives', priority: 'secondary', tone: 'strength',
    title: input.won ? 'Convertiste suficiente ventaja para cerrar la partida' : 'Hay una base útil sobre la que construir',
    evidence: input.won ? `Victoria con ${input.objectiveDamage.toLocaleString()} de daño a objetivos.` : `${input.objectiveDamage.toLocaleString()} de daño a objetivos pese a la derrota.`,
    interpretation: 'El resultado y el daño ayudan a localizar valor, pero el aprendizaje debe centrarse en decisiones repetibles y no sólo en ganar o perder.',
    action: 'Identifica la decisión previa al objetivo que más valor generó y conviértela en una señal reutilizable.',
    exception: 'Supports y héroes de control pueden aportar al objetivo protegiendo la zona aunque su daño directo sea bajo.',
    transferExamples: ['Controlar entradas mientras el Carry golpea Fangtooth', 'Empujar una oleada antes de iniciar Prime'],
    confidence: confidence('medium', 'Combina resultado y daño directo; no mide toda la contribución indirecta.'),
    limitation: 'No atribuye peel, zoning ni control de entradas sin VOD.',
  };
}

export async function getPlayerMatchCoachAnalysis(matchId: string, matchPlayerId: string) {
  const player = await db.matchPlayer.findFirst({
    where: { id: matchPlayerId, matchId },
    include: {
      match: {
        include: {
          matchPlayers: true,
          heroKills: true,
          objectiveKills: true,
          structureDestructions: true,
          wardEvents: true,
        },
      },
    },
  });
  if (!player) throw new AppError(404, 'Match player not found', 'MATCH_PLAYER_NOT_FOUND');

  const teammates = player.match.matchPlayers.filter((entry) => entry.team === player.team);
  const laneOpponent = player.match.matchPlayers.find((entry) => entry.team !== player.team && entry.role === player.role) ?? null;
  const teamKills = teammates.reduce((sum, entry) => sum + entry.kills, 0);
  const killParticipation = teamKills > 0 ? rounded(Math.min(100, ((player.kills + player.assists) / teamKills) * 100)) : 0;
  const teammateParticipation = teammates.map((entry) => teamKills > 0 ? Math.min(100, ((entry.kills + entry.assists) / teamKills) * 100) : 0);
  const teamKillParticipationAverage = teammateParticipation.length > 0
    ? rounded(teammateParticipation.reduce((sum, value) => sum + value, 0) / teammateParticipation.length)
    : 0;
  const duration = player.match.duration;
  const gpm = perMinute(player.gold, duration);
  const dpm = perMinute(player.heroDamage, duration);
  const csPerMinute = perMinute(player.laneMinionsKilled, duration);
  const won = player.match.winningTeam === player.team;

  const gold = arrayValue<number>(player.goldEarnedAtInterval);
  const opponentGold = arrayValue<number>(laneOpponent?.goldEarnedAtInterval);
  const goldMinute = Math.min(14, gold.length - 1, opponentGold.length - 1);
  const laneGoldDelta = goldMinute >= 5 ? (gold[goldMinute] ?? 0) - (opponentGold[goldMinute] ?? 0) : null;

  const deaths = player.playerId
    ? player.match.heroKills.filter((event) => event.killedPlayerId === player.playerId)
    : [];
  const majorObjectives = player.match.objectiveKills.filter((event) =>
    ['FANGTOOTH', 'PRIMAL_FANGTOOTH', 'ORB_PRIME', 'MINI_PRIME', 'SHAPER'].includes(event.entityType));
  const deathsBeforeObjectives = deaths.filter((death) => majorObjectives.some((objective) =>
    objective.gameTime > death.gameTime && objective.gameTime - death.gameTime <= 90));
  const positionedDeaths = deaths.filter((death) => death.locationX !== null && death.locationY !== null);
  const wards = player.playerId
    ? player.match.wardEvents.filter((event) => event.playerId === player.playerId)
    : [];
  const placedWards = wards.filter((event) => event.eventType === 'PLACEMENT');
  const objectiveSecures = player.playerId
    ? player.match.objectiveKills.filter((event) => event.killerPlayerId === player.playerId)
    : [];

  const currentAbilityOrder = arrayValue<AbilityUpgrade>(player.abilityOrder);
  const historicalAbilityRows = player.playerId && currentAbilityOrder.length > 0
    ? await db.matchPlayer.findMany({
      where: {
        id: { not: player.id }, playerId: player.playerId, heroSlug: player.heroSlug, role: player.role,
        abilityOrder: { not: Prisma.DbNull },
      },
      select: { abilityOrder: true, team: true, match: { select: { winningTeam: true } } },
      orderBy: { match: { startTime: 'desc' } },
      take: 20,
    })
    : [];
  const abilityPatterns = new Map<string, number>();
  for (const row of historicalAbilityRows.filter((entry) => entry.match.winningTeam === entry.team)) {
    const key = abilityKey(arrayValue<AbilityUpgrade>(row.abilityOrder));
    if (key) abilityPatterns.set(key, (abilityPatterns.get(key) ?? 0) + 1);
  }
  const commonAbilityPattern = [...abilityPatterns.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

  const observations: EducationalObservation[] = [];
  observations.push(choosePositive({
    won, killParticipation, teamKillParticipationAverage, deaths: player.deaths,
    wardsPlaced: player.wardsPlaced ?? placedWards.length,
    objectiveDamage: player.totalDamageDealtToObjectives ?? 0,
  }));

  if (deathsBeforeObjectives.length >= 2) {
    observations.push({
      id: 'tempo-deaths-before-objectives', category: 'objectives', priority: 'primary', tone: 'development',
      title: 'Tu principal fuga de tempo ocurrió antes de objetivos',
      evidence: `${deathsBeforeObjectives.length} de tus ${Math.max(deaths.length, player.deaths)} muertes registradas ocurrieron en los 90 segundos anteriores a un objetivo mayor.`,
      interpretation: 'La muerte no sólo entrega oro: elimina tu capacidad de preparar visión, ocupar una entrada o responder cuando aparece el objetivo.',
      action: 'Durante las próximas tres partidas, cuando falten 90 segundos para Fangtooth o Prime, detén la jugada de alto riesgo y comprueba oleada, visión, vida y enfriamientos antes de avanzar.',
      exception: 'La presión agresiva puede ser correcta si fuerza recursos rivales y tu equipo obtiene el objetivo aun sin ti; comprueba la conversión antes de juzgarla.',
      transferExamples: ['Support que acompaña la entrada de visión en vez de entrar solo', 'Offlaner que empuja y retrocede antes del objetivo', 'Jungla que evita disputar un campamento sin prioridad'],
      confidence: confidence('high', 'Cruce directo entre tus muertes y los eventos de objetivos.'),
      limitation: positionedDeaths.length === deaths.length ? null : 'Algunas muertes no incluyen coordenadas, pero su relación temporal sí está disponible.',
    });
  } else if (player.deaths >= Math.max(6, Math.ceil(teammates.reduce((sum, entry) => sum + entry.deaths, 0) / Math.max(teammates.length, 1)))) {
    observations.push({
      id: 'combat-repeat-deaths', category: 'combat', priority: 'primary', tone: 'development',
      title: 'Reduce la repetición del mismo riesgo, no toda la agresividad',
      evidence: `Terminaste con ${player.deaths} muertes; ${positionedDeaths.length} tienen posición verificable en el mapa.`,
      interpretation: 'El objetivo no es jugar pasivo, sino reconocer qué recurso rival o falta de información convirtió tus entradas en intercambios desfavorables.',
      action: 'Elige las dos primeras muertes y anota: información disponible, enfriamiento rival clave y ruta de salida. Busca una causa repetida antes de cambiar tu estilo.',
      exception: 'Una muerte de iniciación puede ser rentable si crea una ventaja numérica, un objetivo o protege al aliado que porta el daño.',
      transferExamples: ['Entrar después de que el rival gaste su control principal', 'Guardar una habilidad de movilidad como salida', 'No perseguir sin visión de la siguiente rotación'],
      confidence: confidence(positionedDeaths.length >= 2 ? 'medium' : 'low', 'Las muertes son exactas; la intención y el posicionamiento completo requieren VOD.'),
      limitation: 'Las coordenadas son puntos de evento, no una reconstrucción continua de movimiento.',
    });
  }

  if (laneGoldDelta !== null && laneGoldDelta <= -700) {
    observations.push({
      id: 'economy-lane-deficit', category: 'economy', priority: observations.some((item) => item.priority === 'primary') ? 'secondary' : 'primary', tone: 'development',
      title: 'El primer déficit económico redujo tus opciones posteriores',
      evidence: `En torno al minuto ${goldMinute + 1} estabas ${Math.abs(laneGoldDelta).toLocaleString()} de oro por detrás del rival de ${roleLabel(player.role)}.`,
      interpretation: 'Un déficit temprano cambia qué intercambios son razonables y cuándo puedes completar una pieza; intentar jugar como si ambos tuvierais el mismo pico amplifica el problema.',
      action: 'Cuando pierdas el primer tempo de compra, identifica si debes recuperar una oleada segura, aceptar un componente intermedio o ceder presión hasta tu siguiente pico.',
      exception: 'Un Support puede ir por detrás en oro y estar cumpliendo su función si el Carry y el control de mapa reciben ese valor.',
      transferExamples: ['Carry que prioriza la oleada antes de rotar', 'Midlane que compra un componente barato para estabilizar', 'Support que no compite por el farmeo del Carry'],
      confidence: confidence('high', 'Comparación directa de curvas de oro por minuto y rol enfrentado.'), limitation: null,
    });
  }

  if (killParticipation + 10 < teamKillParticipationAverage && teamKills >= 5) {
    observations.push({
      id: 'combat-low-participation', category: 'combat', priority: observations.some((item) => item.priority === 'primary') ? 'secondary' : 'primary', tone: 'development',
      title: 'Faltó convertir tu tiempo en las acciones del equipo',
      evidence: `Tu participación fue ${killParticipation}% frente a una media de equipo de ${teamKillParticipationAverage}%.`,
      interpretation: 'La diferencia puede venir de rotaciones tardías, una oleada mal preparada o de elegir una jugada lateral mientras el equipo peleaba.',
      action: 'Antes de cada oleada, mira objetivo, posición del Jungla y temporizadores de compra; decide explícitamente si tu siguiente minuto será presión lateral o agrupación.',
      exception: 'No debes abandonar una ventaja garantizada para unirte a una pelea que ya está perdida o que empezó sin condiciones.',
      transferExamples: ['Offlaner que comunica que no puede rotar', 'Carry que empuja antes de agruparse', 'Support que se mueve con quien puede crear la jugada'],
      confidence: confidence('high', 'Calculado con kills y asistencias completas de todo el equipo.'), limitation: null,
    });
  }

  if (currentAbilityOrder.length > 0) {
    const currentPattern = abilityKey(currentAbilityOrder);
    const followsPattern = commonAbilityPattern ? currentPattern === commonAbilityPattern[0] : null;
    observations.push({
      id: 'abilities-progression', category: 'abilities', priority: 'reference', tone: followsPattern === false ? 'context' : 'strength',
      title: followsPattern === false ? 'Tu orden de habilidades fue una adaptación poco habitual' : 'El desarrollo de habilidades tiene una referencia verificable',
      evidence: commonAbilityPattern
        ? `Secuencia inicial: ${currentPattern}. Tu patrón más repetido en victorias comparables apareció ${commonAbilityPattern[1]} veces: ${commonAbilityPattern[0]}.`
        : `Secuencia inicial: ${currentPattern}. Aún no hay suficientes victorias comparables para declarar un patrón personal.`,
      interpretation: followsPattern === false
        ? 'Diferente no significa incorrecto: la pregunta es qué necesidad de línea o pelea resolvió el punto adelantado.'
        : 'Repetir una secuencia ayuda a ejecutar con consistencia, pero cada punto debe conservar una razón contextual.',
      action: 'Al subir nivel, formula la decisión como función: daño, control, supervivencia o limpieza. Después comprueba si esa función apareció antes del siguiente nivel.',
      exception: 'Un matchup con presión, poke o all-in distinto puede justificar apartarse del orden más frecuente.',
      transferExamples: ['Subir control antes para preparar una emboscada', 'Priorizar limpieza cuando necesitas recuperar prioridad', 'Adelantar supervivencia frente a un all-in'],
      confidence: confidence(historicalAbilityRows.length >= 5 ? 'medium' : 'low', `${historicalAbilityRows.length} partidas personales comparables con orden registrado.`),
      limitation: 'La comparación es contra tu propio historial, no contra una receta global ni una prueba causal.',
    });
  }

  if (placedWards.length > 0 || (player.wardsPlaced ?? 0) > 0) {
    observations.push({
      id: 'vision-timing', category: 'objectives', priority: 'reference', tone: 'context',
      title: 'Evalúa la visión por la decisión que habilita',
      evidence: `${placedWards.length || player.wardsPlaced || 0} colocaciones están asociadas a tu jugador; el equipo aseguró ${player.match.objectiveKills.filter((event) => event.killerTeam === player.team).length} objetivos.`,
      interpretation: 'Un ward es útil si llega antes de la decisión, cubre una ruta relevante y el equipo puede actuar con esa información.',
      action: 'Para cada objetivo mayor, elige una entrada que quieres ver y coloca visión antes de que el rival pueda ocuparla.',
      exception: 'La visión profunda no es buena si entrar a colocarla exige cruzar una zona sin prioridad ni acompañamiento.',
      transferExamples: ['Ward defensivo al perder prioridad', 'Control de entrada antes de Prime', 'Visión lateral para proteger al Carry durante el asedio'],
      confidence: confidence(placedWards.length > 0 ? 'medium' : 'low', 'Hay eventos de colocación, pero no visión continua ni comunicación del equipo.'),
      limitation: 'No se conoce con precisión todo lo que cada ward reveló durante su duración.',
    });
  }

  const mainFocus = observations.find((item) => item.priority === 'primary')
    ?? observations.find((item) => item.tone === 'development')
    ?? observations[0];
  const secondaryInsights = observations
    .filter((item) => item.id !== mainFocus.id && item.priority !== 'reference' && item.tone !== 'strength')
    .slice(0, 2);
  const positive = observations.find((item) => item.tone === 'strength') ?? observations[0];

  return {
    matchId,
    matchPlayerId,
    heroSlug: player.heroSlug,
    role: player.role,
    result: won ? 'win' as const : 'loss' as const,
    summary: {
      headline: mainFocus.title,
      explanation: mainFocus.interpretation,
      nextMatchCue: mainFocus.action,
      positive: { title: positive.title, evidence: positive.evidence },
      secondaryInsights: secondaryInsights.map((item) => ({ id: item.id, title: item.title, evidence: item.evidence })),
      confidence: mainFocus.confidence,
    },
    metrics: {
      killParticipation, teamKillParticipationAverage, gpm, dpm, csPerMinute,
      laneGoldDelta, laneGoldMinute: laneGoldDelta === null ? null : goldMinute + 1,
      deathsBeforeObjectives: deathsBeforeObjectives.length,
      positionedDeaths: positionedDeaths.length,
      wardsPlaced: player.wardsPlaced ?? placedWards.length,
      wardEvents: placedWards.length,
      objectiveSecures: objectiveSecures.length,
    },
    coverage: {
      scoreboard: true,
      goldTimeline: gold.length > 0,
      abilityOrder: currentAbilityOrder.length > 0,
      eventPositions: positionedDeaths.length > 0,
      wardEvents: placedWards.length > 0,
      objectiveEvents: majorObjectives.length > 0,
      disclaimer: 'El coach distingue hechos del marcador, inferencias de eventos y aspectos que requieren VOD. No reconstruye movimiento continuo ni comunicación.',
    },
    sections: {
      abilities: observations.filter((item) => item.category === 'abilities'),
      economy: observations.filter((item) => item.category === 'economy'),
      combat: observations.filter((item) => item.category === 'combat'),
      objectives: observations.filter((item) => item.category === 'objectives'),
    },
  };
}
