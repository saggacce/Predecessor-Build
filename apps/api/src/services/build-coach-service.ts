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
  suggestedItems?: Array<{ slug: string; displayName: string; aggressionType: string | null }>;
}

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
  return tags;
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
              totalShieldingReceived: true, totalDamageMitigated: true,
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
      evidence: `La composición rival acumuló ${enemyHealing.toLocaleString()} de curación.`,
      recommendation: 'Introduce anti-curación antes del siguiente pico de pelea del rival.', desiredTags: ['ANTI_HEAL'],
    });
  }
  if (enemyShielding >= 15_000 && !tags.has('ANTI_SHIELD')) {
    signals.push({
      key: 'anti-shield', severity: 'warning', title: 'La composición rival generó muchos escudos',
      evidence: `Los rivales recibieron ${enemyShielding.toLocaleString()} de escudos.`,
      recommendation: 'Valora una respuesta anti-escudo si el valor procede de peleas repetidas y no de daño incidental.', desiredTags: ['ANTI_SHIELD'],
    });
  }
  if (enemyMitigation >= 80_000 && !tags.has('ANTI_TANK') && !tags.has('SHRED')) {
    signals.push({
      key: 'anti-tank', severity: 'warning', title: 'Faltó penetración contra una primera línea resistente',
      evidence: `El equipo rival mitigó ${enemyMitigation.toLocaleString()} de daño.`,
      recommendation: 'Adapta una pieza a anti-tanque, penetración o shred en lugar de repetir daño plano.',
      desiredTags: ['ANTI_TANK', 'PHYSICAL_SHRED', 'MAGICAL_SHRED', 'SHRED'],
    });
  }

  const selectedIds = new Set(inventory.map((item) => item.predggDataId).filter((id): id is string => Boolean(id)));
  const conflict = inventory.find((item) => [...item.blocksIds, ...item.blockedByIds].some((id) => selectedIds.has(id)));
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
  if (catalogVersionId && desiredTags.length > 0) {
    const candidates = await db.gameItemVersion.findMany({
      where: {
        versionId: catalogVersionId, isHidden: false, rarity: 'LEGENDARY',
      },
      include: { item: { select: { slug: true } } },
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
        .map((candidate) => ({ slug: candidate.item.slug, displayName: candidate.displayName, aggressionType: candidate.aggressionType }));
    }
  }

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
    },
    inventory,
    eternalLoadout: jsonArray<{ id: string; displayName: string; slot: string }>(row.perks),
    abilityOrder: jsonArray<{ ability: string; gameTime: number }>(row.abilityOrder),
    signals,
  };
}
