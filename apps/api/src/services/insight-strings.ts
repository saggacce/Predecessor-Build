/**
 * insight-strings.ts
 *
 * All user-facing text for every analyst insight rule, in English and Spanish.
 * When adding a new rule: add computation to analyst-service.ts and strings here.
 * No other files should change.
 */

export type InsightLang = 'en' | 'es';

type InsightText = {
  title: string;
  body: string;
  evidence: string[];
  recommendation: string;
};

export const insightStrings = {

  // ── RULE 1 — Critical deaths before major objective ─────────────────────────
  'rule-crit-death-obj': (
    lang: InsightLang,
    vars: {
      critPct: number;
      matchesWithCritDeath: number;
      totalMatches: number;
      roles: string[];
      objTypes: string[];
      isRival: boolean;
      teamRef: string;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? `Rival vulnerable before major objectives (${vars.critPct}% of games)`
          : 'Critical deaths before major objectives',
        body: vars.isRival
          ? `${vars.teamRef} loses players in the 60s before major objectives in ${vars.critPct}% of their games. Exploit this pattern by contesting objectives when they are at a life disadvantage.`
          : `In ${vars.critPct}% of analyzed games, a roster player dies in the 60s before a major objective (Fangtooth, Prime, Shaper).`,
        evidence: [
          `${vars.matchesWithCritDeath} of ${vars.totalMatches} games with pre-objective death`,
          `Most affected players: ${vars.roles.join(', ')}`,
          `Objectives: ${vars.objTypes.join(', ')}`,
        ],
        recommendation: vars.isRival
          ? 'Force teamfight engages 60–90s before each major objective spawn. If 1–2 rival players fall, contest immediately without waiting for your own setup.'
          : 'Review positioning and setup timing 90s before each major objective. Prioritize reset if life advantage is insufficient.',
      };
    }
    return {
      title: vars.isRival
        ? `Rival vulnerable antes de objetivos (${vars.critPct}% de partidas)`
        : 'Muertes críticas antes de objetivos mayores',
      body: vars.isRival
        ? `${vars.teamRef} pierde jugadores en los 60s previos a objetivos mayores en el ${vars.critPct}% de sus partidas. Aprovechar este patrón contestando el objetivo cuando detectes que están en desventaja de vida.`
        : `En el ${vars.critPct}% de las partidas analizadas, un jugador del roster muere en los 60s previos a un objetivo mayor (Fangtooth, Prime, Shaper).`,
      evidence: [
        `${vars.matchesWithCritDeath} de ${vars.totalMatches} partidas con death pre-objetivo`,
        `Jugadores más afectados: ${vars.roles.join(', ')}`,
        `Objetivos: ${vars.objTypes.join(', ')}`,
      ],
      recommendation: vars.isRival
        ? 'Forzar peleas de teamfight 60-90s antes de cada spawn de objetivo mayor. Si caen 1-2 jugadores rivales, contestar inmediatamente sin esperar setup propio.'
        : 'Revisar el posicionamiento y el timing de setup 90s antes de cada objetivo mayor. Priorizar reset si hay ventaja de vida insuficiente.',
    };
  },

  // ── RULE 2 — Low vision before objective ────────────────────────────────────
  'rule-low-vision-obj': (
    lang: InsightLang,
    vars: {
      noVisionPct: number;
      objsWithNoVision: number;
      totalObjs: number;
      totalMatches: number;
      isRival: boolean;
      teamRef: string;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? `Rival has no pre-objective vision (${vars.noVisionPct}% of objectives)`
          : 'No vision setup before objectives',
        body: vars.isRival
          ? `${vars.teamRef} places no wards in the 90s before ${vars.noVisionPct}% of their major objectives. Exploit this blindspot: approach the objective zone without establishing vision and surprise them at the contest.`
          : `${vars.teamRef} places no wards in the 90s before ${vars.noVisionPct}% of the contested major objectives.`,
        evidence: [
          `${vars.objsWithNoVision} of ${vars.totalObjs} objectives with no prior wards`,
          `Analyzed ${vars.totalMatches} games with event stream`,
        ],
        recommendation: vars.isRival
          ? 'Prepare the objective contest before the rival establishes vision. Their support arrives late — flank and force the teamfight without their information.'
          : 'Establish a mandatory vision routine 90–120s before each Fangtooth/Prime/Shaper. Support and jungler must initiate the setup.',
      };
    }
    return {
      title: vars.isRival
        ? `Rival sin visión pre-objetivo (${vars.noVisionPct}% de objetivos)`
        : 'Sin setup de visión antes de objetivos',
      body: vars.isRival
        ? `${vars.teamRef} no coloca wards en los 90s previos al ${vars.noVisionPct}% de sus objetivos mayores. Explotar esta ceguera: entrar a la zona del objetivo sin establecer visión y sorprender en el contest.`
        : `${vars.teamRef} no coloca wards en los 90s previos al ${vars.noVisionPct}% de los objetivos mayores disputados.`,
      evidence: [
        `${vars.objsWithNoVision} de ${vars.totalObjs} objetivos sin wards previas`,
        `Se analizaron ${vars.totalMatches} partidas con event stream`,
      ],
      recommendation: vars.isRival
        ? 'Preparar el contest del objetivo antes de que el rival establezca visión. El soporte rival llega tarde — entrar por los flancos y forzar el teamfight sin información del rival.'
        : 'Establecer una rutina de visión obligatoria 90-120s antes de cada Fangtooth/Prime/Shaper. El support y el jungla deben iniciar el setup.',
    };
  },

  // ── RULE 3 — Vision cleaned before objective ────────────────────────────────
  'rule-vision-cleaned': (
    lang: InsightLang,
    vars: {
      cleanedPct: number;
      objsWithCleanedVision: number;
      totalObjs: number;
      isRival: boolean;
      teamRef: string;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? `Rival actively denies vision (${vars.cleanedPct}% of objectives)`
          : 'Rival clears our vision before objectives',
        body: vars.isRival
          ? `${vars.teamRef} systematically destroys 2 or more wards in the 120s before ${vars.cleanedPct}% of objectives. Anticipate this: place additional backup wards or use sweepers before the spawn.`
          : `In ${vars.cleanedPct}% of objectives, the rival destroys 2 or more of our wards in the 120s prior, reaching the spawn with full information against us.`,
        evidence: [
          `${vars.objsWithCleanedVision} of ${vars.totalObjs} objectives with cleared vision`,
          vars.isRival
            ? 'The rival has an established vision denial routine'
            : 'The rival is actively denying our vision before contesting',
        ],
        recommendation: vars.isRival
          ? 'Place backup wards in secondary zones the rival does not clear. Use own oracles to detect the rival sweeper before it clears the main setup.'
          : 'Use Oracle/Sentry wards to protect our own vision zones. Place backup wards later to avoid losing the entire setup.',
      };
    }
    return {
      title: vars.isRival
        ? `El rival hace denial de visión activo (${vars.cleanedPct}% de objetivos)`
        : 'El rival limpia la visión antes de objetivos',
      body: vars.isRival
        ? `${vars.teamRef} destruye sistemáticamente 2 o más wards en los 120s previos al ${vars.cleanedPct}% de los objetivos. Anticipar este patrón: colocar wards adicionales de backup o usar sweepers antes del spawn.`
        : `En el ${vars.cleanedPct}% de los objetivos, el rival destruye 2 o más wards propias en los 120s previos, llegando sin información.`,
      evidence: [
        `${vars.objsWithCleanedVision} de ${vars.totalObjs} objetivos con visión limpiada`,
        vars.isRival
          ? 'El rival tiene una rutina establecida de denial de visión'
          : 'El rival está haciendo denial activo de visión antes de contestar',
      ],
      recommendation: vars.isRival
        ? 'Colocar wards de backup en zonas secundarias que el rival no limpia. Usar oráculos propios para detectar al sweeper rival antes de que limpie el setup principal.'
        : 'Usar wards de tipo Oracle/Sentry para proteger zonas de visión propia. Colocar wards de backup más tarde para no perder todo el setup.',
    };
  },

  // ── RULE 4 — Prime not converted ────────────────────────────────────────────
  'rule-prime-no-conv': (
    lang: InsightLang,
    vars: {
      notConvPct: number;
      notConverted: number;
      teamPrimesLength: number;
      isRival: boolean;
      teamRef: string;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? `Rival does not convert Primes into structures (${vars.notConvPct}%)`
          : 'Orb Prime with no structure conversion',
        body: vars.isRival
          ? `${vars.teamRef} does not pressure any structure in the 3 minutes after ${vars.notConvPct}% of the Primes they secure. Use that time to reset, recover position, and prepare the next objective.`
          : `${vars.teamRef} does not destroy any structure in the 3 minutes following ${vars.notConvPct}% of the Orb Primes secured.`,
        evidence: [
          `${vars.notConverted} of ${vars.teamPrimesLength} primes with no subsequent structure`,
          vars.isRival
            ? 'The rival systematically wastes the map advantage from Prime'
            : 'The map advantage generated by Orb Prime is being wasted',
        ],
        recommendation: vars.isRival
          ? 'When the rival secures Prime, disperse quickly, recover health, and prepare the next contest. The rival will not exploit the Prime — we have time to reposition.'
          : 'Define a post-Prime protocol: execute split push or inhibitor attack immediately. Do not reset without first pressuring a structure.',
      };
    }
    return {
      title: vars.isRival
        ? `Rival no convierte Primes en estructura (${vars.notConvPct}%)`
        : 'Orb Prime sin conversión en estructura',
      body: vars.isRival
        ? `${vars.teamRef} no presiona ninguna estructura en los 3 minutos posteriores al ${vars.notConvPct}% de los Primes que consigue. Aprovechar ese tiempo para resetear, recuperar posición y preparar el siguiente objetivo.`
        : `${vars.teamRef} no destruye ninguna estructura en los 3 minutos siguientes al ${vars.notConvPct}% de los Orb Prime que asegura.`,
      evidence: [
        `${vars.notConverted} de ${vars.teamPrimesLength} primes sin estructura posterior`,
        vars.isRival
          ? 'El rival desperdicia la ventaja de mapa de Prime sistemáticamente'
          : 'Se pierde la ventaja de mapa que genera Orb Prime',
      ],
      recommendation: vars.isRival
        ? 'Cuando el rival consiga Prime, dispersarse rápidamente, recuperar vida y preparar el siguiente contest. El rival no explotará el Prime — tenemos tiempo para reposicionarnos.'
        : 'Definir un protocolo post-Prime: ejecutar split push o ataque de inhibidor inmediatamente. No resetear hasta presionar una estructura.',
    };
  },

  // ── RULE 5 — Draft dependency ───────────────────────────────────────────────
  'rule-draft-dep': (
    lang: InsightLang,
    vars: {
      name: string;
      top2Pct: number;
      top2: number;
      mpsLength: number;
      heroes: string;
      poolSize: number;
      isRival: boolean;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? `Ban ${vars.name}: only 2-hero pool`
          : `Draft dependency: ${vars.name}`,
        body: vars.isRival
          ? `${vars.name} (rival) plays ${vars.top2Pct}% of games on ${vars.heroes}. Banning one of these forces the rival out of their comfort zone.`
          : `${vars.name} concentrates ${vars.top2Pct}% of games on just 2 heroes (${vars.heroes}). High vulnerability if one is banned.`,
        evidence: [
          `${vars.top2} of ${vars.mpsLength} games on ${vars.heroes}`,
          `Total pool: ${vars.poolSize} distinct heroes`,
        ],
        recommendation: vars.isRival
          ? `Prioritize banning ${vars.heroes.split(' + ')[0]}. Forcing ${vars.name} onto a secondary hero significantly reduces their impact.`
          : `Expand ${vars.name}'s pool with at least 1 additional viable hero. Prioritize in scrim sessions.`,
      };
    }
    return {
      title: vars.isRival
        ? `Banear a ${vars.name}: pool de solo 2 héroes`
        : `Dependencia de draft: ${vars.name}`,
      body: vars.isRival
        ? `${vars.name} (rival) juega el ${vars.top2Pct}% de sus partidas con ${vars.heroes}. Si baneamos uno de estos héroes, obligamos al rival a salir de su zona de confort.`
        : `${vars.name} concentra el ${vars.top2Pct}% de sus partidas en solo 2 héroes (${vars.heroes}). Alta vulnerabilidad si uno es baneado.`,
      evidence: [
        `${vars.top2} de ${vars.mpsLength} partidas con ${vars.heroes}`,
        `Pool total: ${vars.poolSize} héroes distintos`,
      ],
      recommendation: vars.isRival
        ? `Priorizar el ban de ${vars.heroes.split(' + ')[0]} en la fase de bans. Forzar a ${vars.name} a un héroe secundario reduce significativamente su impacto.`
        : `Ampliar el pool de ${vars.name} con al menos 1 héroe adicional viable. Priorizar en sesiones de scrim.`,
    };
  },

  // ── RULE 6 — Throw pattern ───────────────────────────────────────────────────
  'rule-throw': (
    lang: InsightLang,
    vars: {
      throwMatches: number;
      isRival: boolean;
      teamRef: string;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? `Rival throws in ${vars.throwMatches} games — vulnerable when ahead`
          : `Throw pattern detected (${vars.throwMatches} games)`,
        body: vars.isRival
          ? `${vars.teamRef} loses games in which they had a +3,000 gold lead (${vars.throwMatches} cases). If we equalize or surpass their gold in games they are winning, they can make closing errors.`
          : `In ${vars.throwMatches} losses, ${vars.teamRef} had a +3,000 gold advantage at some point and did not close the game.`,
        evidence: [
          `${vars.throwMatches} games with gold lead >3k that ended in defeat`,
          vars.isRival
            ? 'The rival does not convert economic advantage — a comeback is viable if we survive'
            : 'The team does not convert economic advantage into objectives or structures',
        ],
        recommendation: vars.isRival
          ? 'If we are behind in gold, stay alive and wait for the rival mistake in the closing phase. Avoid direct teamfights when the rival advantage exceeds 5k.'
          : 'Define a closing rule when the lead exceeds 3k: prioritize Prime, inhibitor, or coordinated push. Do not scatter after major objectives.',
      };
    }
    return {
      title: vars.isRival
        ? `Rival throw en ${vars.throwMatches} partidas — vulnerable en ventaja`
        : `Patrón de throw detectado (${vars.throwMatches} partidas)`,
      body: vars.isRival
        ? `${vars.teamRef} pierde partidas en las que tuvo +3.000 oro de ventaja (${vars.throwMatches} casos). Si conseguimos igualar o superar su gold en partidas que van perdiendo, pueden cometer errores de cierre.`
        : `En ${vars.throwMatches} derrotas, ${vars.teamRef} tuvo una ventaja de +3.000 oro en algún momento y no cerró la partida.`,
      evidence: [
        `${vars.throwMatches} partidas con gold lead >3k que terminaron en derrota`,
        vars.isRival
          ? 'El rival no convierte ventaja económica — una comeback es viable si aguantamos'
          : 'El equipo no convierte ventaja económica en objetivos o estructura',
      ],
      recommendation: vars.isRival
        ? 'Si vamos por detrás en oro, mantenernos vivos y esperar el error del rival en la fase de cierre. Evitar teamfights directas cuando la ventaja rival supera 5k.'
        : 'Definir una regla de cierre cuando la ventaja supera 3k: priorizar Prime, inhibidor o push coordinado. No dispersarse después de objetivos grandes.',
    };
  },

  // ── RULE 7 — Player slump (KDA) ─────────────────────────────────────────────
  'rule-slump': (
    lang: InsightLang,
    vars: {
      name: string;
      recentKda: number;
      historicalKda: number;
      delta: number;
      isRival: boolean;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? `${vars.name} (rival) in a slump — good time to exploit`
          : `Performance slump: ${vars.name}`,
        body: vars.isRival
          ? `${vars.name} is performing below their usual level (recent KDA ${vars.recentKda.toFixed(2)} vs historical ${vars.historicalKda.toFixed(2)}). Good time to apply direct pressure during the game.`
          : `${vars.name}'s KDA over the last 10 games (${vars.recentKda.toFixed(2)}) is significantly below their historical average (${vars.historicalKda.toFixed(2)}).`,
        evidence: [
          `Historical KDA: ${vars.historicalKda.toFixed(2)}`,
          `Last 10 KDA: ${vars.recentKda.toFixed(2)} (${vars.delta.toFixed(2)} difference)`,
        ],
        recommendation: vars.isRival
          ? `Direct pressure toward ${vars.name}'s lane. Camp their jungle or lane to force errors while they are already low on confidence.`
          : `Review ${vars.name}'s recent games to identify whether this is a draft, role, positioning, or individual form issue.`,
      };
    }
    return {
      title: vars.isRival
        ? `${vars.name} (rival) en bajón de forma — momento para explotar`
        : `Bajón de rendimiento: ${vars.name}`,
      body: vars.isRival
        ? `${vars.name} está rindiendo por debajo de su nivel habitual (KDA reciente ${vars.recentKda.toFixed(2)} vs histórico ${vars.historicalKda.toFixed(2)}). Buen momento para presionarle directamente durante la partida.`
        : `KDA de ${vars.name} en las últimas 10 partidas (${vars.recentKda.toFixed(2)}) es significativamente inferior a su histórico (${vars.historicalKda.toFixed(2)}).`,
      evidence: [
        `KDA histórico: ${vars.historicalKda.toFixed(2)}`,
        `KDA últimas 10: ${vars.recentKda.toFixed(2)} (${vars.delta.toFixed(2)} de diferencia)`,
      ],
      recommendation: vars.isRival
        ? `Dirigir la presión hacia el carril de ${vars.name}. Campear su jungla o carril, forzar errores cuando ya está en bajón de confianza.`
        : `Revisar partidas recientes de ${vars.name} para identificar si es un problema de draft, rol, posicionamiento o momento individual.`,
    };
  },

  // ── RULE 8 — Vision gaps (wards/min below baseline) ─────────────────────────
  'rule-vision-gaps': (
    lang: InsightLang,
    vars: {
      lowVisionPlayersCount: number;
      lowVisionPlayers: string[];
      isRival: boolean;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? `Rival with poor vision in ${vars.lowVisionPlayersCount} role(s)`
          : 'Vision activity below threshold',
        body: vars.isRival
          ? `${vars.lowVisionPlayersCount} rival player(s) place significantly fewer wards than expected for their role. The rival's map will have blind spots we can exploit.`
          : `${vars.lowVisionPlayersCount} roster player(s) have a wards/min ratio notably below the expected for their role.`,
        evidence: vars.lowVisionPlayers,
        recommendation: vars.isRival
          ? "Move through the rival's lowest-coverage vision zones to gain information undetected. Especially valuable for the jungler on invasion routes."
          : 'Set individual vision goals. In scrims, count wards placed by support and jungler before each objective.',
      };
    }
    return {
      title: vars.isRival
        ? `Rival con visión deficiente en ${vars.lowVisionPlayersCount} rol(es)`
        : 'Actividad de visión por debajo del umbral',
      body: vars.isRival
        ? `${vars.lowVisionPlayersCount} jugador(es) rival(es) colocan significativamente menos wards de las esperadas para su rol. El mapa del rival tendrá zonas ciegas que podemos explotar.`
        : `${vars.lowVisionPlayersCount} jugador(es) del roster tienen un ratio de wards/min notablemente inferior al esperado para su rol.`,
      evidence: vars.lowVisionPlayers,
      recommendation: vars.isRival
        ? 'Moverse por las zonas de menor cobertura de visión rival para ganar información sin ser detectados. Especialmente valioso para el jungla en las rutas de invasión.'
        : 'Establecer objetivos individuales de visión. En scrims, contar wards colocadas por el support y jungla antes de cada objetivo.',
    };
  },

  // ── RULE 9 — Positive: Fangtooth control ────────────────────────────────────
  'rule-positive-ft': (
    lang: InsightLang,
    vars: {
      ftCtrl: number;
      ftDataTeam: number;
      ftTotal: number;
      isRival: boolean;
      teamRef: string;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? `Alert: rival dominates Fangtooth (${vars.ftCtrl}%)`
          : `Fangtooth control strength: ${vars.ftCtrl}%`,
        body: vars.isRival
          ? `${vars.teamRef} controls ${vars.ftCtrl}% of contested Fangtoots. Prioritize contesting this objective or draft to dispute it on even footing.`
          : `${vars.teamRef} controls ${vars.ftCtrl}% of contested Fangtoots — a clear macro strength.`,
        evidence: [`${vars.ftDataTeam} Fangtoots secured out of ${vars.ftTotal} total`],
        recommendation: vars.isRival
          ? 'Build the draft around early teamfight champions to dispute Fangtooth. Prioritize vision setup in the north map zone from minute 4.'
          : 'Maintain early priority and exploit this advantage in draft design.',
      };
    }
    return {
      title: vars.isRival
        ? `Alerta: rival domina Fangtooth (${vars.ftCtrl}%)`
        : `Control de Fangtooth destacado: ${vars.ftCtrl}%`,
      body: vars.isRival
        ? `${vars.teamRef} controla el ${vars.ftCtrl}% de los Fangtoots disputados. Priorizar contestar este objetivo o diseñar el draft para poder disputarlo en igualdad.`
        : `${vars.teamRef} controla el ${vars.ftCtrl}% de los Fangtoots disputados — fortaleza macro clara.`,
      evidence: [`${vars.ftDataTeam} Fangtoots conseguidos de ${vars.ftTotal} totales`],
      recommendation: vars.isRival
        ? 'Diseñar el draft con campeones de teamfight temprana para poder disputar Fangtooth. Priorizar el setup de visión en la zona norte del mapa desde el minuto 4.'
        : 'Mantener la prioridad temprana y explotar esta ventaja en el diseño del draft.',
    };
  },

  // ── RULE 9b — Positive: Prime control ───────────────────────────────────────
  'rule-positive-prime': (
    lang: InsightLang,
    vars: {
      primeCtrl: number;
      primeDataTeam: number;
      primeTotal: number;
      isRival: boolean;
      teamRef: string;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? `Alert: rival dominates Prime (${vars.primeCtrl}%)`
          : `Prime dominance: ${vars.primeCtrl}%`,
        body: vars.isRival
          ? `${vars.teamRef} controls ${vars.primeCtrl}% of Prime objectives. We need a clear response when the rival secures Prime, or prevent them from reaching it with an advantage.`
          : `${vars.teamRef} controls ${vars.primeCtrl}% of Prime objectives (Mini + Orb).`,
        evidence: [`${vars.primeDataTeam} Primes secured out of ${vars.primeTotal} total`],
        recommendation: vars.isRival
          ? 'Do not contest Prime if the rival has a life advantage. Better to disperse, recover, and prepare for the next respawn. Force a fight pre-Prime to prevent them from reaching the spawn with an advantage.'
          : 'Prime control is a real competitive advantage. Reinforce with vision setup to maintain it under pressure.',
      };
    }
    return {
      title: vars.isRival
        ? `Alerta: rival domina Prime (${vars.primeCtrl}%)`
        : `Dominio de Prime: ${vars.primeCtrl}%`,
      body: vars.isRival
        ? `${vars.teamRef} controla el ${vars.primeCtrl}% de los objetivos de Prime. Hay que tener una respuesta clara cuando el rival consiga Prime o evitar que lleguen a él en ventaja.`
        : `${vars.teamRef} controla el ${vars.primeCtrl}% de los objetivos de Prime (Mini + Orb).`,
      evidence: [`${vars.primeDataTeam} Primes conseguidos de ${vars.primeTotal} totales`],
      recommendation: vars.isRival
        ? 'No contestar Prime si el rival tiene ventaja de vida. Mejor dispersarse, recuperar y preparar el próximo respawn. Forzar pelea pre-Prime para evitar que lleguen al spawn con ventaja.'
        : 'El control de Prime es una ventaja competitiva real. Reforzar con setup de visión para mantenerlo bajo presión.',
    };
  },

  // ── GROUP A — Role death before objective ────────────────────────────────────
  'rule-role-death-obj': (
    lang: InsightLang,
    vars: {
      label: string;
      p: number;
      ev: string[];
      isRival: boolean;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? `Rival loses ${vars.label} before objectives (${vars.p}%)`
          : `${vars.label} dies before major objectives (${vars.p}%)`,
        body: vars.isRival
          ? `The rival loses their ${vars.label} in the 60s before major objectives in ${vars.p}% of games. Contest the objective when that player falls.`
          : `The ${vars.label} dies in the 60s before a major objective in ${vars.p}% of analyzed games.`,
        evidence: vars.ev,
        recommendation: vars.isRival
          ? `Force the teamfight before the objective spawn targeting the rival ${vars.label}. If they fall, contest the objective immediately.`
          : `The ${vars.label} must retreat or reset 90s before each major objective spawn. Prioritize survival over pressure.`,
      };
    }
    return {
      title: vars.isRival
        ? `Rival pierde ${vars.label} antes de objetivos (${vars.p}%)`
        : `${vars.label} muerto/a antes de objetivos mayores (${vars.p}%)`,
      body: vars.isRival
        ? `El rival pierde al ${vars.label} en los 60s previos a objetivos mayores en el ${vars.p}% de las partidas. Contestar el objetivo cuando caiga ese jugador.`
        : `El ${vars.label} muere en los 60s previos a un objetivo mayor en el ${vars.p}% de las partidas analizadas.`,
      evidence: vars.ev,
      recommendation: vars.isRival
        ? `Forzar el teamfight antes del spawn objetivo apuntando al ${vars.label} rival. Si cae, contestar el objetivo inmediatamente.`
        : `El ${vars.label} debe retirarse o resetear 90s antes del spawn de cada objetivo mayor. Priorizar supervivencia sobre presión.`,
    };
  },

  // ── GROUP A — Multiple deaths before objective ───────────────────────────────
  'rule-multi-death-obj': (
    lang: InsightLang,
    vars: {
      multiPct: number;
      multiMatchCount: number;
      ev: string[];
      isRival: boolean;
      teamRef: string;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? `Rival reaches objectives with multiple deaths (${vars.multiPct}%)`
          : `Multiple deaths before major objectives (${vars.multiPct}%)`,
        body: vars.isRival
          ? `${vars.teamRef} reaches major objectives having lost ≥2 players in the 60s prior in ${vars.multiPct}% of games. The most dangerous moment to contest.`
          : `In ${vars.multiPct}% of games, the team loses ≥2 players in the 60s before a major objective.`,
        evidence: vars.ev,
        recommendation: vars.isRival
          ? 'If the rival reaches the objective with 2+ deaths, contest aggressively. This is the best moment to steal or force a winning fight.'
          : "Review the team's collective preparation before objectives: no one should enter danger zones without team confirmation 90s before the spawn.",
      };
    }
    return {
      title: vars.isRival
        ? `Rival llega a objetivos con bajas múltiples (${vars.multiPct}%)`
        : `Múltiples muertes antes de objetivos mayores (${vars.multiPct}%)`,
      body: vars.isRival
        ? `${vars.teamRef} llega a objetivos mayores habiendo perdido ≥2 jugadores en los 60s previos en el ${vars.multiPct}% de las partidas. El momento más peligroso para contestar.`
        : `En el ${vars.multiPct}% de las partidas, el equipo pierde ≥2 jugadores en los 60s antes de un objetivo mayor.`,
      evidence: vars.ev,
      recommendation: vars.isRival
        ? 'Si el rival llega al objetivo con 2+ bajas, contestar agresivamente. Es el mejor momento para robar o forzar una pelea ganada.'
        : 'Revisar la preparación colectiva del equipo antes de objetivos: nadie debe entrar en zonas de peligro sin confirmación de equipo 90s antes del spawn.',
    };
  },

  // ── GROUP B1 — Late vision setup ─────────────────────────────────────────────
  'rule-late-vision-setup': (
    lang: InsightLang,
    vars: {
      p: number;
      lateSetupObjs: number;
      totalMajorObjs: number;
      isRival: boolean;
      teamRef: string;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? `Rival places vision too late pre-objective (${vars.p}%)`
          : `Late vision setup before objectives (${vars.p}%)`,
        body: vars.isRival
          ? `${vars.teamRef} places their wards in the last 30s before the objective in ${vars.p}% of cases. Enter via flanks before they establish vision.`
          : `In ${vars.p}% of objectives, wards are placed in the final 30s — too late to detect rival rotations.`,
        evidence: [`${vars.lateSetupObjs} of ${vars.totalMajorObjs} objectives with setup <30s`],
        recommendation: vars.isRival
          ? 'Begin the move toward the objective while the rival still has no vision. The window is 90–30s before the spawn.'
          : 'Support and jungler must begin vision setup 90–120s before the spawn. One ward placed on time is worth more than three placed too late.',
      };
    }
    return {
      title: vars.isRival
        ? `Rival coloca visión demasiado tarde pre-objetivo (${vars.p}%)`
        : `Setup de visión tardío antes de objetivos (${vars.p}%)`,
      body: vars.isRival
        ? `${vars.teamRef} coloca sus wards en los últimos 30s antes del objetivo en el ${vars.p}% de los casos. Entrar por los flancos antes de que establezcan visión.`
        : `En el ${vars.p}% de los objetivos, las wards se colocan en los últimos 30s — demasiado tarde para detectar rotaciones rivales.`,
      evidence: [`${vars.lateSetupObjs} de ${vars.totalMajorObjs} objetivos con setup <30s`],
      recommendation: vars.isRival
        ? 'Iniciar el movimiento hacia el objetivo cuando el rival todavía no tiene visión. La ventana es los 90-30s antes del spawn.'
        : 'El support y jungla deben iniciar el setup de visión entre 90 y 120s antes del spawn. Un ward a tiempo vale más que tres cuando ya es tarde.',
    };
  },

  // ── GROUP B2 — No vision backup ──────────────────────────────────────────────
  'rule-no-backup-vision': (
    lang: InsightLang,
    vars: {
      p: number;
      noBackupCount: number;
      totalDestructions: number;
      isRival: boolean;
      teamRef: string;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? `Rival does not replace vision after destruction (${vars.p}%)`
          : `No backup vision after destruction (${vars.p}%)`,
        body: vars.isRival
          ? `${vars.teamRef} does not replace ${vars.p}% of wards that are destroyed. Once their vision is cleared, the map is blind for them.`
          : `${vars.p}% of destroyed wards are not replaced within 90s, leaving map zones without coverage.`,
        evidence: [`${vars.noBackupCount} of ${vars.totalDestructions} destroyed wards not replaced within 90s`],
        recommendation: vars.isRival
          ? 'Use sweepers to clear rival vision just before setting up our own. Once cleared, the rival will take time to recover it.'
          : 'Establish an immediate replacement protocol: when the jungler detects a destroyed ward, place a new one in an alternative zone.',
      };
    }
    return {
      title: vars.isRival
        ? `Rival no repone visión tras destrucción (${vars.p}%)`
        : `Sin visión de respaldo tras destrucción (${vars.p}%)`,
      body: vars.isRival
        ? `${vars.teamRef} no reemplaza el ${vars.p}% de las wards que le destruyen. Una vez limpiada su visión, el mapa queda ciego para ellos.`
        : `El ${vars.p}% de las wards destruidas no se reponen en los 90s siguientes, dejando zonas del mapa sin cobertura.`,
      evidence: [`${vars.noBackupCount} de ${vars.totalDestructions} wards destruidas sin reposición en 90s`],
      recommendation: vars.isRival
        ? 'Usar sweepers para limpiar visión rival justo antes del setup propio. Una vez limpiada, el rival tardará en recuperarla.'
        : 'Establecer un protocolo de reposición inmediata: cuando el jungla detecte una ward destruida, colocar una nueva en zona alternativa.',
    };
  },

  // ── GROUP B3 — Vision lost without recovery ──────────────────────────────────
  'rule-vision-lost-no-recovery': (
    lang: InsightLang,
    vars: {
      p: number;
      visionLostObjs: number;
      totalObjsChecked: number;
      isRival: boolean;
      teamRef: string;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? `Rival loses pre-objective vision without recovering (${vars.p}%)`
          : `Vision destroyed without recovery pre-objective (${vars.p}%)`,
        body: vars.isRival
          ? `${vars.teamRef} loses all vision in the 120s before the objective and does not replace it before the spawn in ${vars.p}% of cases. The best moment to initiate the contest is right after clearing their wards.`
          : `In ${vars.p}% of objectives, our wards are destroyed and the team reaches the spawn without information.`,
        evidence: [`${vars.visionLostObjs} of ${vars.totalObjsChecked} objectives with vision lost and unrecovered`],
        recommendation: vars.isRival
          ? 'Clear rival vision and enter the objective pit immediately. Do not give them time to replace wards.'
          : 'Always have backup wards ready to place if primary vision falls. Support should carry 2 wards for each objective setup.',
      };
    }
    return {
      title: vars.isRival
        ? `Rival pierde visión pre-objetivo sin recuperarla (${vars.p}%)`
        : `Visión destruida sin recuperación pre-objetivo (${vars.p}%)`,
      body: vars.isRival
        ? `${vars.teamRef} pierde toda su visión en los 120s previos al objetivo y no la repone antes del spawn en el ${vars.p}% de los casos. El mejor momento para iniciar el contest es justo después de limpiar sus wards.`
        : `En el ${vars.p}% de los objetivos, las wards propias son destruidas y el equipo llega al spawn sin información.`,
      evidence: [`${vars.visionLostObjs} de ${vars.totalObjsChecked} objetivos con visión perdida sin recuperar`],
      recommendation: vars.isRival
        ? 'Limpiar la visión rival y entrar inmediatamente al pit del objetivo. No dar tiempo a que repongan wards.'
        : 'Tener siempre wards de backup listas para colocar si la visión primaria cae. El support debe llevar 2 wards al setup de cada objetivo.',
    };
  },

  // ── GROUP C — Conversion variants (Fangtooth / Shaper) ──────────────────────
  'rule-obj-no-structure': (
    lang: InsightLang,
    vars: {
      label: string;
      p: number;
      notConverted: number;
      teamObjsLength: number;
      convWindow: number;
      isRival: boolean;
      teamRef: string;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? `Rival does not convert ${vars.label} into structures (${vars.p}%)`
          : `${vars.label} with no structure conversion (${vars.p}%)`,
        body: vars.isRival
          ? `${vars.teamRef} does not pressure any structure in the ${vars.convWindow}s after ${vars.p}% of their ${vars.label}. Use that time to reset and prepare the next objective.`
          : `${vars.teamRef} does not destroy any structure in the ${vars.convWindow}s following ${vars.p}% of the ${vars.label} secured.`,
        evidence: [`${vars.notConverted} of ${vars.teamObjsLength} ${vars.label}s with no subsequent structure`],
        recommendation: vars.isRival
          ? `When the rival secures ${vars.label}, execute a fast reset and prepare the next spawn. The rival will not exploit the advantage.`
          : `Define a clear objective when securing ${vars.label}: which structure to pressure and via which lane. Do not reset without attempting a structure.`,
      };
    }
    return {
      title: vars.isRival
        ? `Rival no convierte ${vars.label} en estructura (${vars.p}%)`
        : `${vars.label} sin conversión en estructura (${vars.p}%)`,
      body: vars.isRival
        ? `${vars.teamRef} no presiona ninguna estructura en los ${vars.convWindow}s posteriores al ${vars.p}% de sus ${vars.label}. Aprovechar ese tiempo para resetear y preparar el siguiente objetivo.`
        : `${vars.teamRef} no destruye ninguna estructura en los ${vars.convWindow}s siguientes al ${vars.p}% de los ${vars.label} que asegura.`,
      evidence: [`${vars.notConverted} de ${vars.teamObjsLength} ${vars.label}s sin estructura posterior`],
      recommendation: vars.isRival
        ? `Cuando el rival consiga ${vars.label}, ejecutar un reset rápido y preparar el próximo spawn. El rival no explotará la ventaja.`
        : `Definir un objetivo claro al conseguir ${vars.label}: qué estructura presionar y por qué carril. No resetear sin haber intentado una estructura.`,
    };
  },

  // ── GROUP D1 — Objective lost after ally death ───────────────────────────────
  'rule-obj-lost-after-death': (
    lang: InsightLang,
    vars: {
      objLostAfterDeathCount: number;
      ev: string[];
      isRival: boolean;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? `Rival vulnerable: their deaths precede our objectives (${vars.objLostAfterDeathCount} games)`
          : `Objective lost after allied death (${vars.objLostAfterDeathCount} games)`,
        body: vars.isRival
          ? `In ${vars.objLostAfterDeathCount} games, a rival death directly precedes an objective taken by our team. Identify and pressure the weakest rival player to create these chains.`
          : `In ${vars.objLostAfterDeathCount} games, a team player's death is followed by a rival objective within the next 90s.`,
        evidence: vars.ev,
        recommendation: vars.isRival
          ? 'Study which rival player dies first most frequently. Target that player to create the death → objective chain.'
          : 'Review positions and spacing before objectives. A death in a danger zone can cost the objective.',
      };
    }
    return {
      title: vars.isRival
        ? `Rival vulnerable: sus muertes preceden objetivos nuestros (${vars.objLostAfterDeathCount} partidas)`
        : `Objetivo perdido tras muerte aliada (${vars.objLostAfterDeathCount} partidas)`,
      body: vars.isRival
        ? `En ${vars.objLostAfterDeathCount} partidas, una muerte rival precede directamente a un objetivo tomado por nuestro equipo. Identificar y presionar al jugador más débil para crear estas cadenas.`
        : `En ${vars.objLostAfterDeathCount} partidas, una muerte de un jugador del equipo va seguida de un objetivo rival en los 90s siguientes.`,
      evidence: vars.ev,
      recommendation: vars.isRival
        ? 'Estudiar qué jugador rival muere primero con más frecuencia. Apuntar a ese jugador para crear la cadena muerte → objetivo.'
        : 'Revisar las posiciones y el spacing antes de objetivos. Una muerte en zona de peligro puede costar el objetivo.',
    };
  },

  // ── GROUP D2 — Objective taken after killing rival ───────────────────────────
  'rule-obj-taken-after-kill': (
    lang: InsightLang,
    vars: {
      objTakenAfterKillCount: number;
      ev: string[];
      isRival: boolean;
      teamRef: string;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? `Rival converts kills into objectives (${vars.objTakenAfterKillCount} games)`
          : `Team converts kills into objectives (${vars.objTakenAfterKillCount} games)`,
        body: vars.isRival
          ? `${vars.teamRef} uses their kills to take major objectives in the following 90s in ${vars.objTakenAfterKillCount} games. Be ready to defend objectives immediately when a player falls.`
          : `In ${vars.objTakenAfterKillCount} games, a kill translates into a major objective in under 90s — a sign of good macro reading.`,
        evidence: vars.ev,
        recommendation: vars.isRival
          ? 'When a rival player falls, immediately protect the nearest objective. Do not reset — the rival will look to convert that death into macro.'
          : 'Maintain this pattern: after a pick, execute the nearest objective without delay. Communicate the target objective before the teamfight.',
      };
    }
    return {
      title: vars.isRival
        ? `Rival convierte kills en objetivos (${vars.objTakenAfterKillCount} partidas)`
        : `El equipo convierte kills en objetivos (${vars.objTakenAfterKillCount} partidas)`,
      body: vars.isRival
        ? `${vars.teamRef} aprovecha sus kills para tomar objetivos mayores en los 90s siguientes en ${vars.objTakenAfterKillCount} partidas. Estar preparados para defender objetivos inmediatamente cuando caiga un jugador.`
        : `En ${vars.objTakenAfterKillCount} partidas, un kill se traduce en un objetivo mayor en menos de 90s — señal de buena lectura macro.`,
      evidence: vars.ev,
      recommendation: vars.isRival
        ? 'Cuando un jugador rival cae, proteger inmediatamente el objetivo más cercano. No resetear — el rival buscará convertir esa muerte en macro.'
        : 'Mantener este patrón: tras un pick, ejecutar el objetivo más cercano sin demorarse. Comunicar el objetivo destino antes del teamfight.',
    };
  },

  // ── GROUP E — GPM slump ──────────────────────────────────────────────────────
  'rule-gpm-slump': (
    lang: InsightLang,
    vars: {
      name: string;
      recentGpm: number;
      prevGpm: number;
      isRival: boolean;
    },
  ): InsightText => {
    const fmtNum = (n: number) => Math.round(n).toLocaleString('es-ES');
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? `${vars.name} (rival) with economic slump — low GPM`
          : `Economic slump: ${vars.name}`,
        body: vars.isRival
          ? `${vars.name} is generating gold far below their usual level (${fmtNum(vars.recentGpm)} GPM vs ${fmtNum(vars.prevGpm)} GPM previous). Less item impact in the game.`
          : `${vars.name} has dropped from ${fmtNum(vars.prevGpm)} to ${fmtNum(vars.recentGpm)} GPM over the last 10 games.`,
        evidence: [
          `Recent GPM: ${fmtNum(vars.recentGpm)}/min`,
          `Previous GPM: ${fmtNum(vars.prevGpm)}/min`,
        ],
        recommendation: vars.isRival
          ? `Pressure ${vars.name}'s lane to further reduce their farm. Weaker economy means less item potential.`
          : `Review ${vars.name}'s farm efficiency: CS/min, gold wasted in base, and jungle rotation timings.`,
      };
    }
    return {
      title: vars.isRival
        ? `${vars.name} (rival) con bajón económico — GPM bajo`
        : `Bajón económico: ${vars.name}`,
      body: vars.isRival
        ? `${vars.name} está generando oro muy por debajo de su nivel habitual (${fmtNum(vars.recentGpm)} GPM vs ${fmtNum(vars.prevGpm)} GPM anterior). Menor impacto de items en la partida.`
        : `${vars.name} ha caído de ${fmtNum(vars.prevGpm)} a ${fmtNum(vars.recentGpm)} GPM en las últimas 10 partidas.`,
      evidence: [
        `GPM reciente: ${fmtNum(vars.recentGpm)}/min`,
        `GPM anterior: ${fmtNum(vars.prevGpm)}/min`,
      ],
      recommendation: vars.isRival
        ? `Presionar el carril de ${vars.name} para reducir aún más su farm. Peor economía significa menos potencial de items.`
        : `Revisar la eficiencia de farm de ${vars.name}: CS/min, gold wasted en base y rotaciones de campo.`,
    };
  },

  // ── GROUP E — DPM slump ──────────────────────────────────────────────────────
  'rule-dpm-slump': (
    lang: InsightLang,
    vars: {
      name: string;
      recentDpm: number;
      prevDpm: number;
      isRival: boolean;
    },
  ): InsightText => {
    const fmtNum = (n: number) => Math.round(n).toLocaleString('es-ES');
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? `${vars.name} (rival) with damage slump — less impact`
          : `Damage slump: ${vars.name}`,
        body: vars.isRival
          ? `${vars.name} is dealing significantly less damage than their usual level (${fmtNum(vars.recentDpm)} DPM vs ${fmtNum(vars.prevDpm)} previous).`
          : `${vars.name} has dropped from ${fmtNum(vars.prevDpm)} to ${fmtNum(vars.recentDpm)} DPM — a sign of reduced impact in fights.`,
        evidence: [
          `Recent DPM: ${fmtNum(vars.recentDpm)}/min`,
          `Previous DPM: ${fmtNum(vars.prevDpm)}/min`,
        ],
        recommendation: vars.isRival
          ? `${vars.name}'s damage is down — they are less threatening. Position to ignore them and focus on more dangerous players.`
          : `Review with ${vars.name} whether the slump is positioning, draft, or economy. Compare recent builds vs previous ones.`,
      };
    }
    return {
      title: vars.isRival
        ? `${vars.name} (rival) con bajón de daño — menos impacto`
        : `Bajón de daño: ${vars.name}`,
      body: vars.isRival
        ? `${vars.name} está haciendo significativamente menos daño que en su nivel habitual (${fmtNum(vars.recentDpm)} DPM vs ${fmtNum(vars.prevDpm)} anterior).`
        : `${vars.name} ha bajado de ${fmtNum(vars.prevDpm)} a ${fmtNum(vars.recentDpm)} DPM — señal de menor impacto en peleas.`,
      evidence: [
        `DPM reciente: ${fmtNum(vars.recentDpm)}/min`,
        `DPM anterior: ${fmtNum(vars.prevDpm)}/min`,
      ],
      recommendation: vars.isRival
        ? `El daño de ${vars.name} está caído — es menos amenazante. Posicionarse para ignorarle y focusear a otros jugadores más peligrosos.`
        : `Revisar con ${vars.name} si el bajón es de posicionamiento, draft o economía. Comparar sus builds recientes vs las anteriores.`,
    };
  },

  // ── GROUP E — Kill participation low ────────────────────────────────────────
  'rule-kp-low': (
    lang: InsightLang,
    vars: {
      name: string;
      avgKpPct: number;
      kpMpsLength: number;
      isRival: boolean;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? `${vars.name} (rival) with low kill participation`
          : `Low fight participation: ${vars.name}`,
        body: vars.isRival
          ? `${vars.name} participates in only ${vars.avgKpPct}% of their team's kills. Player disconnected from collective rival play.`
          : `${vars.name} is participating in only ${vars.avgKpPct}% of team kills — a sign of disconnection from fights.`,
        evidence: [`Average KP over last ${vars.kpMpsLength} games: ${vars.avgKpPct}%`],
        recommendation: vars.isRival
          ? `${vars.name} does not pressure alongside the team — teammates do the work. Focus pressure on players with higher KP.`
          : `Talk with ${vars.name} about teamfight positioning and rotation timing. Are they farming when the team is fighting?`,
      };
    }
    return {
      title: vars.isRival
        ? `${vars.name} (rival) con baja participación en kills`
        : `Baja participación en peleas: ${vars.name}`,
      body: vars.isRival
        ? `${vars.name} participa en solo el ${vars.avgKpPct}% de los kills de su equipo. Jugador desconectado del juego colectivo rival.`
        : `${vars.name} está participando en solo el ${vars.avgKpPct}% de los kills del equipo — señal de desconexión en peleas.`,
      evidence: [`KP promedio últimas ${vars.kpMpsLength} partidas: ${vars.avgKpPct}%`],
      recommendation: vars.isRival
        ? `${vars.name} no presiona junto al equipo — sus compañeros hacen el trabajo. Enfocar la presión en los jugadores con mayor KP.`
        : `Hablar con ${vars.name} sobre su posicionamiento en teamfights y su timing de rotación. ¿Está farmeando cuando el equipo pelea?`,
    };
  },

  // ── GROUP E — Death share high ───────────────────────────────────────────────
  'rule-death-share': (
    lang: InsightLang,
    vars: {
      name: string;
      avgDsPct: number;
      deathMpsLength: number;
      isRival: boolean;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? `${vars.name} (rival) concentrates their team's deaths`
          : `Deaths concentrated in ${vars.name}`,
        body: vars.isRival
          ? `${vars.name} accumulates ${vars.avgDsPct}% of their team's deaths. They are the easiest target to eliminate for generating chains.`
          : `${vars.name} accumulates ${vars.avgDsPct}% of the team's deaths over the last ${vars.deathMpsLength} games.`,
        evidence: [`Average death share: ${vars.avgDsPct}%`],
        recommendation: vars.isRival
          ? `Target ${vars.name} in fights — they fall frequently and their death can generate chain picks or objective access.`
          : `Review ${vars.name}'s positioning and engage decisions. Are they entering alone or without vision?`,
      };
    }
    return {
      title: vars.isRival
        ? `${vars.name} (rival) concentra las muertes de su equipo`
        : `Muertes concentradas en ${vars.name}`,
      body: vars.isRival
        ? `${vars.name} acumula el ${vars.avgDsPct}% de las muertes de su equipo. Es el objetivo más fácil a eliminar para generar cadenas.`
        : `${vars.name} acumula el ${vars.avgDsPct}% de las muertes del equipo en las últimas ${vars.deathMpsLength} partidas.`,
      evidence: [`Death share promedio: ${vars.avgDsPct}%`],
      recommendation: vars.isRival
        ? `Apuntar a ${vars.name} en las peleas — cae con frecuencia y su caída puede generar picks en cadena o acceso a objetivos.`
        : `Revisar con ${vars.name} las decisiones de posicionamiento y entradas. ¿Está entrando solo o sin visión?`,
    };
  },

  // ── GROUP E — Gold/damage gap ────────────────────────────────────────────────
  'rule-gold-low-dmg': (
    lang: InsightLang,
    vars: {
      name: string;
      avgGoldSharePct: number;
      avgDmgSharePct: number;
      gapPct: number;
      isRival: boolean;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? `${vars.name} (rival): high gold, low damage — resources not converting`
          : `${vars.name}: high farm, low damage impact`,
        body: vars.isRival
          ? `${vars.name} receives ${vars.avgGoldSharePct}% of their team's gold but only deals ${vars.avgDmgSharePct}% of the damage. Their items are not translating into a real threat.`
          : `${vars.name} generates ${vars.avgGoldSharePct}% of the team's gold but only deals ${vars.avgDmgSharePct}% of total damage.`,
        evidence: [
          `Gold share: ${vars.avgGoldSharePct}%`,
          `Damage share: ${vars.avgDmgSharePct}%`,
          `Gap: +${vars.gapPct}pp gold vs damage`,
        ],
        recommendation: vars.isRival
          ? `${vars.name} has resources but is not converting them into damage. They are less dangerous than their farm suggests. Focus on other players.`
          : `Review with ${vars.name} whether they are arriving late to fights, if their items synergize with their role, or if there is a positioning issue in teamfights.`,
      };
    }
    return {
      title: vars.isRival
        ? `${vars.name} (rival): mucho oro, poco daño — resources mal convertidos`
        : `${vars.name}: alto farm, bajo impacto de daño`,
      body: vars.isRival
        ? `${vars.name} recibe el ${vars.avgGoldSharePct}% del oro de su equipo pero solo hace el ${vars.avgDmgSharePct}% del daño. Sus items no están traduciendo en amenaza real.`
        : `${vars.name} genera el ${vars.avgGoldSharePct}% del oro del equipo pero solo hace el ${vars.avgDmgSharePct}% del daño total.`,
      evidence: [
        `Gold share: ${vars.avgGoldSharePct}%`,
        `Damage share: ${vars.avgDmgSharePct}%`,
        `Gap: +${vars.gapPct}pp de oro vs daño`,
      ],
      recommendation: vars.isRival
        ? `${vars.name} tiene recursos pero no los convierte en daño. Es menos peligroso de lo que parece su farm. Enfocar en otros jugadores.`
        : `Revisar con ${vars.name} si está llegando a las peleas tarde, si sus items tienen sinergía con el rol, o si hay un problema de posicionamiento en los teamfights.`,
    };
  },

  // ── GROUP E — Positive player form ──────────────────────────────────────────
  'rule-positive-player-form': (
    lang: InsightLang,
    vars: {
      name: string;
      recentKda: number;
      historicalKda: number;
      delta: number;
      isRival: boolean;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? `Alert: ${vars.name} (rival) on a streak — elevated performance`
          : `${vars.name} in good form`,
        body: vars.isRival
          ? `${vars.name} has a KDA of ${vars.recentKda.toFixed(2)} in the last 10 games vs their historical ${vars.historicalKda.toFixed(2)}. They are the most dangerous rival player right now.`
          : `${vars.name} has risen from a historical KDA of ${vars.historicalKda.toFixed(2)} to ${vars.recentKda.toFixed(2)} in the last 10 games.`,
        evidence: [
          `Historical KDA: ${vars.historicalKda.toFixed(2)}`,
          `Recent KDA: ${vars.recentKda.toFixed(2)} (+${vars.delta.toFixed(2)})`,
        ],
        recommendation: vars.isRival
          ? `Prioritize a ban or an unfavorable matchup against ${vars.name}. Do not leave them on a comfortable pick during this form peak.`
          : `Keep ${vars.name} in a role and composition that enhances their current momentum. This is the best time to build around their form.`,
      };
    }
    return {
      title: vars.isRival
        ? `Alerta: ${vars.name} (rival) en racha — rendimiento elevado`
        : `${vars.name} en buena racha de forma`,
      body: vars.isRival
        ? `${vars.name} tiene un KDA de ${vars.recentKda.toFixed(2)} en las últimas 10 partidas vs su histórico de ${vars.historicalKda.toFixed(2)}. Es el jugador rival más peligroso en este momento.`
        : `${vars.name} ha subido de un KDA histórico de ${vars.historicalKda.toFixed(2)} a ${vars.recentKda.toFixed(2)} en las últimas 10 partidas.`,
      evidence: [
        `KDA histórico: ${vars.historicalKda.toFixed(2)}`,
        `KDA reciente: ${vars.recentKda.toFixed(2)} (+${vars.delta.toFixed(2)})`,
      ],
      recommendation: vars.isRival
        ? `Priorizar el ban o el matchup desfavorable contra ${vars.name}. No dejarle en un pick cómodo en este momento de forma.`
        : `Mantener a ${vars.name} en un rol y composición que potencie su momento actual. Es el mejor momento para construir alrededor de su forma.`,
    };
  },

  // ── GROUP F — Draft: damage type imbalance (no AP) ───────────────────────────
  'rule-draft-dmg-imbalance-ap': (
    lang: InsightLang,
    vars: {
      physicalCount: number;
      magicalCount: number;
      totalClassified: number;
      isRival: boolean;
      teamRef: string;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? 'Rival has no magical damage — full AD composition'
          : 'Composition with no magical damage (full AD)',
        body: vars.isRival
          ? `${vars.teamRef} has no Mage in their usual pool. A composition with magic and magic-penetration can punish them heavily.`
          : `No player on the team has a Mage as their main hero. The rival can build physical resistance and minimize damage.`,
        evidence: [
          `Physical players: ${vars.physicalCount}`,
          `Magical players: ${vars.magicalCount}`,
          `Classified: ${vars.totalClassified}`,
        ],
        recommendation: vars.isRival
          ? 'Include at least one Mage or a hero with relevant magical damage in the draft. The rival will not have prioritized magic resistance.'
          : 'Consider including a Mage in the composition, especially in Midlane or Support. Diversifies damage and makes building harder for the rival.',
      };
    }
    return {
      title: vars.isRival
        ? 'Rival sin daño mágico — composición todo AD'
        : 'Composición sin daño mágico (todo AD)',
      body: vars.isRival
        ? `${vars.teamRef} no tiene ningún Mage en su pool habitual. Una comp con magia y reducción de armadura mágica puede castigarles duramente.`
        : `Ningún jugador del equipo tiene un Mage como héroe principal. El rival puede buildear resistencia física y minimizar el daño.`,
      evidence: [
        `Jugadores físicos: ${vars.physicalCount}`,
        `Jugadores mágicos: ${vars.magicalCount}`,
        `Clasificados: ${vars.totalClassified}`,
      ],
      recommendation: vars.isRival
        ? 'Incluir al menos un Mage en el draft o un héroe con daño mágico relevante. El rival no tendrá resistencia mágica prioritaria.'
        : 'Considerar incluir un Mage en la composición, especialmente en Midlane o Support. Diversifica el daño y hace más difícil el building del rival.',
    };
  },

  // ── GROUP F — Draft: damage type imbalance (no AD) ───────────────────────────
  'rule-draft-dmg-imbalance-ad': (
    lang: InsightLang,
    vars: {
      physicalCount: number;
      magicalCount: number;
      totalClassified: number;
      isRival: boolean;
      teamRef: string;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? 'Rival has no physical damage — full AP composition'
          : 'Composition with no physical damage (full AP)',
        body: vars.isRival
          ? `${vars.teamRef} plays predominantly with Mages. A physical carry or physical Assassin can be especially effective against them.`
          : `The team composition lacks relevant physical damage. The rival can build magic resistance and neutralize the output.`,
        evidence: [
          `Magical players: ${vars.magicalCount}`,
          `Physical players: ${vars.physicalCount}`,
          `Classified: ${vars.totalClassified}`,
        ],
        recommendation: vars.isRival
          ? "Prioritize physical damage heroes in the draft to exploit the rival's lack of physical armor. A Sharpshooter Carry or Fighter can dominate."
          : 'Include at least one physical Carry or Fighter in the composition to diversify damage.',
      };
    }
    return {
      title: vars.isRival
        ? 'Rival sin daño físico — composición todo AP'
        : 'Composición sin daño físico (todo AP)',
      body: vars.isRival
        ? `${vars.teamRef} juega mayoritariamente con Mages. Un carry físico o un Assassin físico puede ser especialmente efectivo contra ellos.`
        : `La composición del equipo carece de daño físico relevante. El rival puede buildear resistencia mágica y neutralizar el output.`,
      evidence: [
        `Jugadores mágicos: ${vars.magicalCount}`,
        `Jugadores físicos: ${vars.physicalCount}`,
        `Clasificados: ${vars.totalClassified}`,
      ],
      recommendation: vars.isRival
        ? 'Priorizar héroes de daño físico en el draft para explotar la falta de armadura física del rival. Un carry Sharpshooter o Fighter puede dominar.'
        : 'Incluir al menos un Carry o Fighter físico en la composición para diversificar el daño.',
    };
  },

  // ── GROUP G — Rival objective-focused ───────────────────────────────────────
  'rule-rival-obj-focused': (
    lang: InsightLang,
    vars: {
      teamObjPct: number;
      totalObjTeam: number;
      grandTotal: number;
      objDetails: string[];
      teamRef: string;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: `Rival focused on objective control (${vars.teamObjPct}%)`,
        body: `${vars.teamRef} controls ${vars.teamObjPct}% of all contested objectives. Their game identity revolves around macro control. We need a clear response for every objective.`,
        evidence: [
          `${vars.totalObjTeam} objectives controlled out of ${vars.grandTotal} total`,
          ...vars.objDetails,
        ],
        recommendation: 'Design the draft to be able to dispute objectives on equal footing or with an advantage. Prioritize teamfight and crowd-control champions. Never leave an objective uncontested when the rival has the health to fight.',
      };
    }
    return {
      title: `Rival centrado en control de objetivos (${vars.teamObjPct}%)`,
      body: `${vars.teamRef} controla el ${vars.teamObjPct}% de todos los objetivos disputados. Su identidad de juego gira en torno al control macro. Necesitamos una respuesta clara para cada objetivo.`,
      evidence: [
        `${vars.totalObjTeam} objetivos controlados de ${vars.grandTotal} totales`,
        ...vars.objDetails,
      ],
      recommendation: 'Diseñar el draft para poder disputar objetivos en igualdad o superioridad. Priorizar campeones de teamfight y control de multitudes. Nunca dejar un objetivo sin contest cuando el rival tiene vida para pelear.',
    };
  },

  // ── GROUP G — Rival weak objective defense ───────────────────────────────────
  'rule-rival-weak-defense': (
    lang: InsightLang,
    vars: {
      teamObjPct: number;
      totalObjTeam: number;
      grandTotal: number;
      ourImplicitCtrl: number;
      teamRef: string;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: `Rival with poor objective control (${vars.teamObjPct}%)`,
        body: `${vars.teamRef} only controls ${vars.teamObjPct}% of contested objectives. An objective-focused strategy has a high probability of success.`,
        evidence: [
          `${vars.totalObjTeam} rival objectives out of ${vars.grandTotal} total`,
          `Our implicit control: ${vars.ourImplicitCtrl}%`,
        ],
        recommendation: 'Prioritize all objectives from the draft. Include champions that can secure and generate constant map pressure.',
      };
    }
    return {
      title: `Rival con pobre control de objetivos (${vars.teamObjPct}%)`,
      body: `${vars.teamRef} solo controla el ${vars.teamObjPct}% de los objetivos disputados. Una estrategia centrada en objetivos tiene altas probabilidades de éxito.`,
      evidence: [
        `${vars.totalObjTeam} objetivos del rival de ${vars.grandTotal} totales`,
        `Nuestro control implícito: ${vars.ourImplicitCtrl}%`,
      ],
      recommendation: 'Priorizar todos los objetivos desde el draft. Incluir campeones que puedan hacer secure y generar presión de mapa constante.',
    };
  },

  // ── GROUP H1 — Positive: good vision setup ───────────────────────────────────
  'rule-positive-vision-setup': (
    lang: InsightLang,
    vars: {
      p: number;
      goodVisionObjs: number;
      totalObjs: number;
      isRival: boolean;
      teamRef: string;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? `Alert: rival with excellent pre-objective vision (${vars.p}%)`
          : `Good vision setup before objectives (${vars.p}%)`,
        body: vars.isRival
          ? `${vars.teamRef} places ≥2 wards in the 90s before ${vars.p}% of objectives. They will have full information before every spawn.`
          : `${vars.teamRef} places ≥2 wards before ${vars.p}% of major objectives — a genuine vision strength.`,
        evidence: [`${vars.goodVisionObjs} of ${vars.totalObjs} objectives with setup of ≥2 wards`],
        recommendation: vars.isRival
          ? 'Use sweepers to clear that vision before attempting the contest. Without clearing the wards, the rival will have all the information.'
          : 'Maintain this vision routine. It is one of the few areas where the team is above average.',
      };
    }
    return {
      title: vars.isRival
        ? `Alerta: rival con excelente visión pre-objetivo (${vars.p}%)`
        : `Buen setup de visión antes de objetivos (${vars.p}%)`,
      body: vars.isRival
        ? `${vars.teamRef} coloca ≥2 wards en los 90s previos al ${vars.p}% de los objetivos. Tendrán información completa antes de cada spawn.`
        : `${vars.teamRef} coloca ≥2 wards antes del ${vars.p}% de los objetivos mayores — una fortaleza real de visión.`,
      evidence: [`${vars.goodVisionObjs} de ${vars.totalObjs} objetivos con setup de ≥2 wards`],
      recommendation: vars.isRival
        ? 'Usar sweepers para limpiar esa visión antes de intentar el contest. Sin limpiar las wards, el rival tendrá toda la información.'
        : 'Mantener esta rutina de visión. Es una de las pocas áreas donde el equipo está por encima de la media.',
    };
  },

  // ── GROUP H2 — Positive: good Prime conversion ───────────────────────────────
  'rule-positive-prime-conv': (
    lang: InsightLang,
    vars: {
      p: number;
      converted: number;
      teamPrimesLength: number;
      isRival: boolean;
      teamRef: string;
    },
  ): InsightText => {
    if (lang === 'en') {
      return {
        title: vars.isRival
          ? `Alert: rival converts Primes efficiently (${vars.p}%)`
          : `Excellent Prime-to-structure conversion (${vars.p}%)`,
        body: vars.isRival
          ? `${vars.teamRef} converts ${vars.p}% of their Primes into structure destruction within 3 minutes. Every rival Prime is a real closing threat.`
          : `${vars.teamRef} converts ${vars.p}% of Orb Primes into structure pressure — efficient macro closing.`,
        evidence: [`${vars.converted} of ${vars.teamPrimesLength} Primes converted into structure`],
        recommendation: vars.isRival
          ? 'When the rival secures Prime, immediately defend the most threatened structure. Never reset without protecting it first.'
          : 'Excellent closing pattern. Keep defining the structure target before executing the Prime.',
      };
    }
    return {
      title: vars.isRival
        ? `Alerta: rival convierte Primes eficientemente (${vars.p}%)`
        : `Excelente conversión de Prime en estructura (${vars.p}%)`,
      body: vars.isRival
        ? `${vars.teamRef} convierte el ${vars.p}% de sus Primes en destrucción de estructura en los 3 minutos siguientes. Cada Prime rival es una amenaza real de cierre.`
        : `${vars.teamRef} convierte el ${vars.p}% de sus Orb Prime en presión de estructura — cierre macro eficiente.`,
      evidence: [`${vars.converted} de ${vars.teamPrimesLength} Primes convertidos en estructura`],
      recommendation: vars.isRival
        ? 'Cuando el rival consiga Prime, defender inmediatamente la estructura más amenazada. Nunca resetear sin protegerla primero.'
        : 'Excelente patrón de cierre. Seguir definiendo el objetivo de estructura antes de ejecutar el Prime.',
    };
  },

  // ── Data status insight ───────────────────────────────────────────────────────
  'data-status': (
    lang: InsightLang,
    vars: {
      isRival: boolean;
      rosterOk: boolean;
      playerDataOk: boolean;
      eventDataOk: boolean;
      rosterCount: number;
      playersWithEnoughData: number;
      totalMPs: number;
      minPlayerMatches: number;
      minEventMatches: number;
      eventMatchCount: number;
      lacking: number;
      statusEvidence: string[];
    },
  ): InsightText => {
    let body: string;
    let recommendation: string;

    if (lang === 'en') {
      if (vars.rosterOk && vars.playerDataOk && vars.eventDataOk) {
        body = 'All data available. Individual performance and macro analysis rules are active.';
        recommendation = 'Analysis is complete. Insights update automatically with each newly synced game.';
      } else if (vars.rosterOk && vars.playerDataOk && !vars.eventDataOk) {
        body = 'Individual player data is correct. Team games with event stream are missing to activate macro rules (objectives, vision, throws).';
        recommendation = 'Go to Team Analysis → Performance → Objective Control and click "Sync matches" to sync the event stream for team games.';
      } else if (!vars.rosterOk) {
        body = `Insufficient roster (${vars.rosterCount} player(s)). Team rules require ≥3 active players.`;
        recommendation = 'Add at least 3 players to the roster in the Roster tab.';
      } else {
        body = `${vars.lacking} player(s) have too few synced games. Performance and vision rules need ≥${vars.minPlayerMatches} games per player to be statistically reliable.`;
        recommendation = 'Go to the Dashboard and click "Sync Players" to update player game history.';
      }
      return {
        title: vars.isRival ? 'Scouting data status' : 'Analysis data status',
        body: vars.isRival ? body.replace('The team', 'The rival').replace('the team', 'the rival') : body,
        evidence: vars.statusEvidence,
        recommendation,
      };
    }

    // Spanish
    if (vars.rosterOk && vars.playerDataOk && vars.eventDataOk) {
      body = 'Todos los datos disponibles. Las reglas de rendimiento individual y análisis macro están activas.';
      recommendation = 'El análisis está completo. Los insights se actualizan automáticamente con cada nueva partida sincronizada.';
    } else if (vars.rosterOk && vars.playerDataOk && !vars.eventDataOk) {
      body = 'Datos individuales de los jugadores correctos. Faltan partidas de equipo con event stream para activar las reglas macro (objetivos, visión, throws).';
      recommendation = 'Ve a Team Analysis → Performance → Objective Control y pulsa "Sync matches" para sincronizar el event stream de las partidas del equipo.';
    } else if (!vars.rosterOk) {
      body = `Roster insuficiente (${vars.rosterCount} jugadores). Las reglas de equipo requieren ≥3 jugadores activos.`;
      recommendation = 'Añade al menos 3 jugadores al roster en la pestaña Roster.';
    } else {
      body = `${vars.lacking} jugador(es) tienen pocas partidas sincronizadas. Las reglas de rendimiento y visión necesitan ≥${vars.minPlayerMatches} partidas por jugador para ser estadísticamente fiables.`;
      recommendation = 'Ve al Dashboard y pulsa "Sync Players" para actualizar el historial de partidas de los jugadores.';
    }
    return {
      title: vars.isRival ? 'Estado del scouting' : 'Estado de datos del análisis',
      body: vars.isRival ? body.replace('El equipo', 'El rival').replace('el equipo', 'el rival') : body,
      evidence: vars.statusEvidence,
      recommendation,
    };
  },

} as const;
