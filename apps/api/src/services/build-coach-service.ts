import { db } from '../db.js';
import { AppError } from '../middleware/error-handler.js';

export type BuildSignalSeverity = 'info' | 'warning' | 'critical';

interface BuildSignal {
  key: string;
  severity: BuildSignalSeverity;
  title: string;
  evidence: string;
  recommendation: string;
  desiredTags: string[];
  suggestedItems?: Array<{ slug: string; displayName: string; aggressionType: string | null; reason: string }>;
}

type LoadoutPerk = {
  id: string;
  name?: string;
  displayName: string;
  slot: string;
  simpleDescription?: string | null;
  description?: string | null;
};

function jsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function share(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
}

function semanticTags(item: {
  displayName: string;
  aggressionType: string | null;
  stats: Array<{ stat: string }>;
  effects: Array<{ name: string; text: string; condition: string | null }>;
}): Set<string> {
  const tags = new Set<string>();
  if (item.aggressionType) tags.add(item.aggressionType);
  const stats = new Set(item.stats.map((stat) => stat.stat));
  if (stats.has('PHYSICAL_ARMOR')) tags.add('ARMOR');
  if (stats.has('MAGICAL_ARMOR')) tags.add('ANTI_MAGIC');
  const text = [item.displayName, ...item.effects.flatMap((effect) => [effect.name, effect.text, effect.condition ?? ''])]
    .join(' ')
    .replace(/<[^>]+>/g, ' ')
    .toLowerCase();
  if (/healing.*reduc|reduce.*healing|anti.?heal|tainted/.test(text)) tags.add('ANTI_HEAL');
  if (/shield.*reduc|reduce.*shield|anti.?shield/.test(text)) tags.add('ANTI_SHIELD');
  if (/spell shield|block.*ability/.test(text)) tags.add('SPELL_SHIELD');
  if (/critical.*reduc|reduce.*critical|anti.?crit/.test(text)) tags.add('ANTI_CRIT');
  if (/armor.*shred|reduce.*armor|physical penetration/.test(text)) tags.add('PHYSICAL_SHRED');
  if (/magical armor.*reduc|magical penetration/.test(text)) tags.add('MAGICAL_SHRED');
  if (/maximum health|bonus health|current health/.test(text)) tags.add('ANTI_TANK');
  if (/heal|healing|health regeneration|omnivamp|lifesteal/.test(text)) tags.add('SUSTAIN');
  if (/shield/.test(text)) tags.add('SHIELD');
  if (/movement speed|dash|blink|leap/.test(text)) tags.add('MOBILITY');
  if (/crowd control|stun|slow|root|knock/.test(text)) tags.add('CONTROL');
  if (/basic attack|critical strike/.test(text)) tags.add('BASIC_ATTACK');
  if (/ability damage|magical power|ability haste/.test(text)) tags.add('ABILITY_DAMAGE');
  return tags;
}

function formatHeroList(players: Array<{ heroSlug: string; value: number }>): string {
  return players
    .filter((player) => player.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((player) => `${player.heroSlug} (${player.value.toLocaleString()})`)
    .join(', ');
}

function tagPurpose(tag: string): string {
  const labels: Record<string, string> = {
    ANTI_HEAL: 'reduce la curación rival', ANTI_SHIELD: 'castiga los escudos',
    ARMOR: 'reduce el daño físico', ANTI_CRIT: 'responde al daño crítico',
    ANTI_MAGIC: 'reduce el daño mágico', SPELL_SHIELD: 'protege frente a una habilidad decisiva',
    ANTI_TANK: 'escala contra mucha vida', PHYSICAL_SHRED: 'reduce la armadura física',
    MAGICAL_SHRED: 'reduce la resistencia mágica', SHRED: 'reduce las defensas rivales',
    SUSTAIN: 'aporta aguante sostenido', SHIELD: 'aporta protección', MOBILITY: 'mejora la movilidad',
    CONTROL: 'mejora el control', BASIC_ATTACK: 'potencia los ataques básicos', ABILITY_DAMAGE: 'potencia las habilidades',
  };
  return labels[tag] ?? tag.toLowerCase().replaceAll('_', ' ');
}

function minuteLabel(gameTime: number): string {
  const minutes = Math.floor(gameTime / 60);
  const seconds = Math.max(0, gameTime % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function normalizeCatalogKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function perkAssessment(perk: LoadoutPerk, player: {
  deaths: number;
  heroDamage: number | null;
  totalHealingDone: number | null;
  totalShieldingReceived: number | null;
}, needTags: Set<string>) {
  const text = `${perk.displayName} ${perk.simpleDescription ?? ''} ${perk.description ?? ''}`;
  const tags = semanticTags({ displayName: text, aggressionType: null, stats: [], effects: [] });
  const matchedNeed = [...tags].find((tag) => needTags.has(tag));
  const slot = perk.slot.toUpperCase();
  let verdict: 'correct' | 'conditional' | 'questionable' = 'conditional';
  let why = `Su efecto se orienta a ${[...tags].slice(0, 2).map(tagPurpose).join(' y ') || 'una ventaja situacional'}.`;

  if (matchedNeed) {
    verdict = 'correct';
    why = `Encaja con esta partida porque ${tagPurpose(matchedNeed)}, una necesidad visible frente a la composición rival.`;
  } else if (tags.has('SUSTAIN') && (player.totalHealingDone ?? 0) > 2_000) {
    verdict = 'correct';
    why = `Fue coherente: el efecto de sustain sí tuvo uso y registraste ${(player.totalHealingDone ?? 0).toLocaleString()} de curación.`;
  } else if (tags.has('SHIELD') && (player.totalShieldingReceived ?? 0) > 4_000) {
    verdict = 'correct';
    why = `Fue coherente con peleas prolongadas: recibiste ${(player.totalShieldingReceived ?? 0).toLocaleString()} de escudos.`;
  } else if ((tags.has('ABILITY_DAMAGE') || tags.has('BASIC_ATTACK')) && (player.heroDamage ?? 0) > 15_000) {
    verdict = 'correct';
    why = `La orientación ofensiva produjo valor: terminaste con ${(player.heroDamage ?? 0).toLocaleString()} de daño a héroes.`;
  } else if ((tags.has('SUSTAIN') || tags.has('SHIELD')) && player.deaths >= 7) {
    verdict = 'questionable';
    why = `La idea defensiva era razonable, pero ${player.deaths} muertes indican que no resolvió el principal patrón de riesgo; convenía priorizar una respuesta más específica.`;
  }

  if (slot.includes('HERO_SPECIFIC') || slot.includes('AUGMENT')) {
    why = `Es un Augmento diseñado para ${perk.name ?? 'tu héroe'}. ${why}`;
  }
  return { ...perk, verdict, why, effect: perk.simpleDescription ?? perk.description ?? null };
}

export async function getMatchBuildAnalysis(matchId: string, matchPlayerId: string) {
  const row = await db.matchPlayer.findFirst({
    where: { id: matchPlayerId, matchId },
    include: {
      match: {
        select: {
          versionId: true,
          winningTeam: true,
          matchPlayers: {
            select: {
              id: true, team: true, role: true, heroSlug: true, totalHealingDone: true,
              totalShieldingReceived: true, totalDamageMitigated: true, playerId: true, playerName: true,
            },
          },
        },
      },
    },
  });
  if (!row) throw new AppError(404, 'Match player not found', 'MATCH_PLAYER_NOT_FOUND');

  const inventorySlugs = jsonArray<string>(row.inventoryItems).filter(Boolean);
  let catalogVersionId = row.match.versionId;
  let catalogItems = catalogVersionId && inventorySlugs.length > 0
    ? await db.gameItem.findMany({
      where: { slug: { in: inventorySlugs } },
      include: { versions: { where: { versionId: catalogVersionId }, take: 1 } },
    })
    : [];
  if (catalogVersionId && inventorySlugs.length > 0 && catalogItems.every((item) => item.versions.length === 0)) {
    const matchVersion = await db.version.findUnique({ where: { id: catalogVersionId }, select: { releaseDate: true } });
    const fallback = matchVersion ? await db.version.findFirst({
      where: { releaseDate: { lte: matchVersion.releaseDate }, itemVersions: { some: {} } },
      orderBy: { releaseDate: 'desc' },
      select: { id: true },
    }) : null;
    if (fallback) {
      catalogVersionId = fallback.id;
      catalogItems = await db.gameItem.findMany({
        where: { slug: { in: inventorySlugs } },
        include: { versions: { where: { versionId: catalogVersionId }, take: 1 } },
      });
    }
  }

  const inventory = catalogItems.map((item) => {
    const data = item.versions[0];
    return {
      predggId: item.predggId,
      predggDataId: data?.predggDataId ?? null,
      slug: item.slug,
      displayName: data?.displayName ?? item.name,
      aggressionType: data?.aggressionType ?? null,
      rarity: data?.rarity ?? null,
      slotType: data?.slotType ?? null,
      isEvolved: data?.isEvolved ?? false,
      isHidden: data?.isHidden ?? false,
      stats: jsonArray<{ stat: string; value: number; showPercent: boolean }>(data?.stats),
      effects: jsonArray<{ name: string; text: string; active: boolean; condition: string | null; cooldown: string | null }>(data?.effects),
      blocksIds: jsonArray<string>(data?.blocksIds),
      blockedByIds: jsonArray<string>(data?.blockedByIds),
    };
  });
  const tags = new Set(inventory.flatMap((item) => [...semanticTags(item)]));
  const statNames = new Set(inventory.flatMap((item) => item.stats.map((stat) => stat.stat)));
  const enemies = row.match.matchPlayers.filter((player) => player.team !== row.team);

  const physical = row.physicalDamageTakenFromHeroes ?? row.physicalDamageTaken ?? 0;
  const magical = row.magicalDamageTakenFromHeroes ?? row.magicalDamageTaken ?? 0;
  const trueDamage = row.trueDamageTakenFromHeroes ?? row.trueDamageTaken ?? 0;
  const damageTotal = physical + magical + trueDamage;
  const enemyHealing = enemies.reduce((sum, player) => sum + (player.totalHealingDone ?? 0), 0);
  const enemyShielding = enemies.reduce((sum, player) => sum + (player.totalShieldingReceived ?? 0), 0);
  const enemyMitigation = enemies.reduce((sum, player) => sum + (player.totalDamageMitigated ?? 0), 0);
  const healingHeroes = formatHeroList(enemies.map((player) => ({ heroSlug: player.heroSlug, value: player.totalHealingDone ?? 0 })));
  const shieldedHeroes = formatHeroList(enemies.map((player) => ({ heroSlug: player.heroSlug, value: player.totalShieldingReceived ?? 0 })));
  const resistantHeroes = formatHeroList(enemies.map((player) => ({ heroSlug: player.heroSlug, value: player.totalDamageMitigated ?? 0 })));
  const signals: BuildSignal[] = [];

  if (damageTotal > 0 && share(physical, damageTotal) >= 60 && !tags.has('ARMOR') && !tags.has('ANTI_CRIT') && !statNames.has('PHYSICAL_ARMOR')) {
    signals.push({
      key: 'physical-defense', severity: row.deaths >= 6 ? 'critical' : 'warning', title: 'Faltó respuesta al daño físico',
      evidence: `${share(physical, damageTotal)}% del daño de héroes recibido fue físico.`,
      recommendation: 'Considera adelantar armadura o una respuesta anti-crítico si el carry rival está acelerado.',
      desiredTags: ['ARMOR', 'ANTI_CRIT', 'SUSTAINED_DURABILITY'],
    });
  }
  if (damageTotal > 0 && share(magical, damageTotal) >= 60 && !tags.has('ANTI_MAGIC') && !tags.has('SPELL_SHIELD') && !statNames.has('MAGICAL_ARMOR')) {
    signals.push({
      key: 'magical-defense', severity: row.deaths >= 6 ? 'critical' : 'warning', title: 'Faltó respuesta al daño mágico',
      evidence: `${share(magical, damageTotal)}% del daño de héroes recibido fue mágico.`,
      recommendation: 'Añade resistencia mágica, anti-magia o escudo de hechizo antes de completar otra pieza ofensiva.',
      desiredTags: ['ANTI_MAGIC', 'SPELL_SHIELD', 'ANTI_BURST'],
    });
  }
  if (enemyHealing >= 12_000 && !tags.has('ANTI_HEAL')) {
    signals.push({
      key: 'anti-heal', severity: enemyHealing >= 25_000 ? 'critical' : 'warning', title: 'El rival tuvo demasiada curación sin anti-heal',
      evidence: `La composición rival acumuló ${enemyHealing.toLocaleString()} de curación${healingHeroes ? `; destacaron ${healingHeroes}` : ''}.`,
      recommendation: 'Introduce anti-curación antes del siguiente pico de pelea del rival.', desiredTags: ['ANTI_HEAL'],
    });
  }
  if (enemyShielding >= 15_000 && !tags.has('ANTI_SHIELD')) {
    signals.push({
      key: 'anti-shield', severity: 'warning', title: 'La composición rival generó muchos escudos',
      evidence: `Los rivales recibieron ${enemyShielding.toLocaleString()} de escudos${shieldedHeroes ? `; el valor se concentró en ${shieldedHeroes}` : ''}.`,
      recommendation: 'Valora una respuesta anti-escudo si el valor procede de peleas repetidas y no de daño incidental.', desiredTags: ['ANTI_SHIELD'],
    });
  }
  if (enemyMitigation >= 80_000 && !tags.has('ANTI_TANK') && !tags.has('SHRED')) {
    signals.push({
      key: 'anti-tank', severity: 'warning', title: 'Faltó penetración contra una primera línea resistente',
      evidence: `El equipo rival mitigó ${enemyMitigation.toLocaleString()} de daño${resistantHeroes ? `; la primera línea más resistente fue ${resistantHeroes}` : ''}.`,
      recommendation: 'Adapta una pieza a anti-tanque, penetración o shred en lugar de repetir daño plano.',
      desiredTags: ['ANTI_TANK', 'PHYSICAL_SHRED', 'MAGICAL_SHRED', 'SHRED'],
    });
  }

  const selectedIds = new Set(inventory.map((item) => item.predggDataId).filter((id): id is string => Boolean(id)));
  const conflict = inventory.find((item) => [...item.blocksIds, ...item.blockedByIds]
    .some((id) => id !== item.predggDataId && selectedIds.has(id)));
  if (conflict) {
    signals.push({
      key: 'item-conflict', severity: 'critical', title: 'La build contiene objetos incompatibles',
      evidence: `${conflict.displayName} bloquea o es bloqueado por otra pieza del inventario.`,
      recommendation: 'Revisa el orden de compra y sustituye una de las piezas para no perder valor.', desiredTags: [],
    });
  }

  if (signals.length === 0) {
    signals.push({
      key: 'adaptation-ok', severity: 'info', title: 'La build no muestra una carencia contextual evidente',
      evidence: damageTotal > 0 ? `Reparto recibido: ${share(physical, damageTotal)}% físico, ${share(magical, damageTotal)}% mágico y ${share(trueDamage, damageTotal)}% verdadero.` : 'La telemetría de daño recibido todavía es insuficiente.',
      recommendation: 'Valida ahora el momento de compra y si cada pico llegó antes de las peleas decisivas.', desiredTags: [],
    });
  }

  const desiredTags = [...new Set(signals.flatMap((signal) => signal.desiredTags))];
  let candidates: Array<{
    displayName: string; aggressionType: string | null; totalPrice: number;
    stats: unknown; effects: unknown; item: { slug: string; name?: string };
  }> = [];
  if (catalogVersionId && desiredTags.length > 0) {
    candidates = await db.gameItemVersion.findMany({
      where: {
        versionId: catalogVersionId, isHidden: false, rarity: 'EPIC', slotType: 'PASSIVE',
      },
      include: { item: { select: { slug: true, name: true } } },
      orderBy: { totalPrice: 'asc' },
    });
    for (const signal of signals) {
      signal.suggestedItems = candidates
        .filter((candidate) => {
          const candidateTags = semanticTags({
            displayName: candidate.displayName,
            aggressionType: candidate.aggressionType,
            stats: jsonArray<{ stat: string }>(candidate.stats),
            effects: jsonArray<{ name: string; text: string; condition: string | null }>(candidate.effects),
          });
          return signal.desiredTags.some((tag) => candidateTags.has(tag));
        })
        .slice(0, 3)
        .map((candidate) => {
          const candidateTags = semanticTags({
            displayName: candidate.displayName,
            aggressionType: candidate.aggressionType,
            stats: jsonArray<{ stat: string }>(candidate.stats),
            effects: jsonArray<{ name: string; text: string; condition: string | null }>(candidate.effects),
          });
          const matched = signal.desiredTags.find((tag) => candidateTags.has(tag));
          return {
            slug: candidate.item.slug,
            displayName: candidate.displayName,
            aggressionType: candidate.aggressionType,
            reason: matched ? `${candidate.displayName} ${tagPurpose(matched)}; responde directamente a esta amenaza.` : 'Aporta una respuesta situacional a esta amenaza.',
          };
        });
    }
  }

  const activeSignals = signals.filter((signal) => signal.key !== 'adaptation-ok');
  const needTagSet = new Set(desiredTags);
  const inventoryAssessments = inventory.map((item) => {
    const itemTags = semanticTags(item);
    const matched = [...itemTags].filter((tag) => needTagSet.has(tag));
    return {
      slug: item.slug,
      displayName: item.displayName,
      verdict: matched.length > 0 ? 'correct' as const : activeSignals.length > 0 ? 'neutral' as const : 'correct' as const,
      purpose: [...itemTags].slice(0, 3).map(tagPurpose),
      explanation: matched.length > 0
        ? `Fue una buena adaptación porque ${matched.map(tagPurpose).join(' y ')}.`
        : activeSignals.length > 0
          ? 'Puede formar parte del núcleo del héroe, pero no respondía a las amenazas que decidieron esta partida.'
          : 'Encajó sin dejar una carencia contextual evidente en la build final.',
    };
  });

  const alreadyOwned = new Set(inventory.map((item) => item.slug));
  const replaceable = inventory
    .filter((item) => ![...semanticTags(item)].some((tag) => needTagSet.has(tag)))
    .filter((item) => item.rarity === 'EPIC' && item.slotType === 'PASSIVE');
  const usedReplacements = new Set<string>();
  const changes = activeSignals.flatMap((signal) => {
    const suggestion = signal.suggestedItems?.find((item) => !alreadyOwned.has(item.slug));
    if (!suggestion) return [];
    const insteadOf = [...replaceable].reverse().find((item) => !usedReplacements.has(item.slug));
    if (insteadOf) usedReplacements.add(insteadOf.slug);
    const timing = signal.key === 'anti-heal'
      ? 'Como segunda pieza completa, antes de que la curación domine las peleas grupales.'
      : signal.key === 'anti-tank'
        ? 'Como tercera pieza, antes de las peleas repetidas por Fangtooth u Orb Prime.'
        : signal.key.includes('defense')
          ? 'Adelántalo a segunda o tercera pieza si vuelves a morir dos veces por el mismo tipo de daño.'
          : 'Compra el componente de respuesta en cuanto identifiques la amenaza y completa la pieza antes del siguiente objetivo mayor.';
    return [{
      signalKey: signal.key,
      action: insteadOf ? 'replace' as const : 'add' as const,
      item: suggestion,
      insteadOf: insteadOf ? { slug: insteadOf.slug, displayName: insteadOf.displayName } : null,
      timing,
      why: `${signal.evidence} ${suggestion.reason}`,
    }];
  });

  const transactions = await db.transaction.findMany({
    where: { matchId, transactionType: { in: ['BUY', 'SELL'] } },
    orderBy: { gameTime: 'asc' },
  });
  const catalogByKey = new Map<string, { slug: string; displayName: string; tags: Set<string> }>();
  for (const item of inventory) {
    const value = { slug: item.slug, displayName: item.displayName, tags: semanticTags(item) };
    catalogByKey.set(normalizeCatalogKey(item.slug), value);
    catalogByKey.set(normalizeCatalogKey(item.displayName), value);
  }
  for (const candidate of candidates) {
    const value = {
      slug: candidate.item.slug,
      displayName: candidate.displayName,
      tags: semanticTags({
        displayName: candidate.displayName, aggressionType: candidate.aggressionType,
        stats: jsonArray<{ stat: string }>(candidate.stats),
        effects: jsonArray<{ name: string; text: string; condition: string | null }>(candidate.effects),
      }),
    };
    catalogByKey.set(normalizeCatalogKey(candidate.item.slug), value);
    catalogByKey.set(normalizeCatalogKey(candidate.item.name ?? ''), value);
    catalogByKey.set(normalizeCatalogKey(candidate.displayName), value);
  }
  const enemyByPlayerId = new Map(enemies.filter((enemy) => enemy.playerId).map((enemy) => [enemy.playerId!, enemy]));
  const ownPurchases = transactions
    .filter((transaction) => transaction.playerId === row.playerId && transaction.transactionType === 'BUY' && transaction.itemName)
    .map((transaction) => {
      const item = catalogByKey.get(normalizeCatalogKey(transaction.itemName!));
      return { gameTime: transaction.gameTime, minute: minuteLabel(transaction.gameTime), itemName: item?.displayName ?? transaction.itemName!, itemSlug: item?.slug ?? normalizeCatalogKey(transaction.itemName!) };
    });
  const opponentResponses = transactions.flatMap((transaction) => {
    if (!transaction.itemName || transaction.transactionType !== 'BUY' || !transaction.playerId) return [];
    const enemy = enemyByPlayerId.get(transaction.playerId);
    const item = catalogByKey.get(normalizeCatalogKey(transaction.itemName));
    if (!enemy || !item) return [];
    const relevant = [...item.tags].filter((tag) => ['ARMOR', 'ANTI_MAGIC', 'ANTI_HEAL', 'ANTI_SHIELD', 'ANTI_TANK', 'PHYSICAL_SHRED', 'MAGICAL_SHRED'].includes(tag));
    if (relevant.length === 0) return [];
    return [{
      gameTime: transaction.gameTime,
      minute: minuteLabel(transaction.gameTime),
      heroSlug: enemy.heroSlug,
      playerName: enemy.playerName,
      itemName: item.displayName,
      itemSlug: item.slug,
      explanation: `${enemy.heroSlug} compró ${item.displayName} para ${relevant.slice(0, 2).map(tagPurpose).join(' y ')}. A partir de ese minuto, repetir daño plano pierde valor y conviene adaptar la siguiente pieza.`,
    }];
  }).slice(0, 8);

  const loadout = jsonArray<LoadoutPerk>(row.perks).map((perk) => perkAssessment(perk, row, needTagSet));
  const criticalCount = activeSignals.filter((signal) => signal.severity === 'critical').length;
  const warningCount = activeSignals.filter((signal) => signal.severity === 'warning').length;
  const grade = criticalCount > 0 ? 'poor' : warningCount > 1 ? 'mixed' : warningCount === 1 ? 'mostly_correct' : 'correct';
  const verdictSummary = grade === 'correct'
    ? 'La build final fue coherente con las amenazas observadas y no dejó una respuesta contextual importante sin cubrir.'
    : grade === 'mostly_correct'
      ? 'La base de la build era razonable, pero faltó una adaptación concreta que habría aumentado su valor frente a este rival.'
      : grade === 'mixed'
        ? 'La build tenía un núcleo utilizable, pero dedicó demasiadas ranuras a valor genérico y pocas a responder a la composición rival.'
        : 'La build no respondió a una o más amenazas decisivas; el principal aprendizaje es adaptar antes, no cambiar todo el núcleo del héroe.';

  return {
    matchId,
    matchPlayerId,
    heroSlug: row.heroSlug,
    role: row.role,
    result: row.match.winningTeam === row.team ? 'win' : 'loss',
    context: {
      catalogVersionId,
      deaths: row.deaths,
      damageReceived: { physical, magical, true: trueDamage, total: damageTotal },
      enemyHealing,
      enemyShielding,
      enemyMitigation,
      enemyHeroes: enemies.map((enemy) => ({
        heroSlug: enemy.heroSlug, role: enemy.role, playerName: enemy.playerName,
        healing: enemy.totalHealingDone ?? 0, shieldingReceived: enemy.totalShieldingReceived ?? 0,
        damageMitigated: enemy.totalDamageMitigated ?? 0,
      })),
    },
    inventory,
    inventoryAssessments,
    verdict: { grade, summary: verdictSummary, score: Math.max(20, 100 - criticalCount * 25 - warningCount * 12) },
    recommendedBuild: {
      principle: 'Mantén el núcleo que hace funcionar al héroe y reserva al menos una ranura para responder a lo que realmente está comprando y produciendo el rival.',
      changes,
    },
    purchaseTimeline: {
      available: transactions.length > 0,
      ownPurchases,
      opponentResponses,
      lesson: transactions.length > 0
        ? 'La adaptación se decide en base: revisa composición al inicio y vuelve a comprobar las compras rivales antes de completar tu segunda y tercera pieza.'
        : 'No hay transacciones sincronizadas para evaluar el minuto exacto. La recomendación se basa en la composición y el resultado final.',
    },
    eternalLoadout: loadout,
    abilityOrder: jsonArray<{ ability: string; gameTime: number }>(row.abilityOrder),
    signals,
  };
}
