import { db } from '../db.js';
import { AppError } from '../middleware/error-handler.js';
import { Prisma } from '@prisma/client';

export type BuildSignalSeverity = 'info' | 'warning' | 'critical';

interface BuildSignal {
  key: string;
  severity: BuildSignalSeverity;
  title: string;
  evidence: string;
  recommendation: string;
  whyItMatters?: string;
  learningPrompt?: string;
  whenNotToApply?: string;
  confidence?: { level: 'low' | 'medium' | 'high'; basis: string };
  sources?: Array<{ heroSlug: string; sourceType: 'ability' | 'item'; name: string; description: string }>;
  appliesAgainst?: string[];
  desiredTags: string[];
  suggestedItems?: Array<{
    slug: string; displayName: string; aggressionType: string | null; reason: string; totalPrice: number;
    stats: Array<{ stat: string; value: number; showPercent?: boolean }>;
    effects: Array<{ name: string; text: string; condition?: string | null; cooldown?: string | null }>;
  }>;
}

type LoadoutPerk = {
  id: string;
  name?: string;
  displayName: string;
  slot: string;
  simpleDescription?: string | null;
  description?: string | null;
  icon?: string | null;
};

type HeroAbility = {
  key?: string;
  display_name?: string;
  game_description?: string;
  menu_description?: string;
};

type CatalogPerk = {
  predggDataId: string;
  displayName: string;
  slot: string;
  icon: string | null;
  simpleDescription: string | null;
  description: string;
  heroSlug: string | null;
  minorBlessingPredggIds: unknown;
  perk: { predggId: string; slug: string };
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
  if (/armor.*shred|shred.*physical.*armor|reduce.*armor|physical penetration/.test(text)) tags.add('PHYSICAL_SHRED');
  if (/magical armor.*reduc|shred.*magical.*armor|magical penetration/.test(text)) tags.add('MAGICAL_SHRED');
  if (/maximum health|bonus health|current health/.test(text)) tags.add('ANTI_TANK');
  if (/\bheal(?:s|ed|ing)?\b|health regeneration|\bomnivamp\b|\blifesteal\b/.test(text) && !tags.has('ANTI_HEAL')) tags.add('SUSTAIN');
  if (/shield/.test(text) && !tags.has('ANTI_SHIELD')) tags.add('SHIELD');
  if (/movement speed|dash|blink|leap/.test(text)) tags.add('MOBILITY');
  if (/crowd control|stun|slow|root|knock/.test(text)) tags.add('CONTROL');
  if (/basic attack|critical strike/.test(text)) tags.add('BASIC_ATTACK');
  if (/ability damage|magical power|ability haste|cooldown/.test(text)) tags.add('ABILITY_DAMAGE');
  if (/deal.*damage|damage.*target/.test(text)) tags.add('DAMAGE');
  if (/attack speed|on.?hit|damage over time|every basic attack|basic attacks.*stack/.test(text)) tags.add('DPS');
  if (/burst|execute|missing health|below.*health|next ability.*damage/.test(text)) tags.add('BURST');
  if (/projectile|range|from a distance|above.*health/.test(text)) tags.add('POKE');
  if (/\bdash(?:es|ed)?\b|\bblink\b|\bleap(?:s|ed)?\b|\bcharge(?:s|d)?\s+(?:forward|toward|to)\b|\bpull.*toward|\bteleport/.test(text)) tags.add('ENGAGE');
  if (/knockback|knock up|slow|stun|root|shield.*all|nearby allies/.test(text)) tags.add('PEEL');
  if (/area|nearby enemies|all enemies|multiple enemies|radius/.test(text)) tags.add('AOE');
  if (/tenacity|crowd control duration/.test(text)) tags.add('TENACITY');
  if (/ability haste|cooldown/.test(text)) tags.add('HASTE');
  if (/nearby allies|allied heroes|your team|teammates/.test(text)) tags.add('TEAM_UTILITY');
  if (stats.has('ATTACK_SPEED')) tags.add('DPS');
  if (stats.has('CRITICAL_STRIKE_CHANCE')) tags.add('BURST');
  if (stats.has('MAX_HEALTH') || stats.has('PHYSICAL_ARMOR') || stats.has('MAGICAL_ARMOR')) tags.add('DURABILITY');
  return tags;
}

const CONCEPT_DETAILS: Record<string, { label: string; description: string }> = {
  CONTROL: { label: 'Control de masas', description: 'Interrumpe, inmoviliza o limita el movimiento para crear ventanas de daño.' },
  ENGAGE: { label: 'Iniciación', description: 'Permite empezar la pelea o alcanzar un objetivo prioritario.' },
  PEEL: { label: 'Protección y peel', description: 'Aleja amenazas o protege al aliado que debe seguir haciendo daño.' },
  DPS: { label: 'Daño sostenido', description: 'Aumenta el daño repetido en peleas largas, normalmente mediante ataques, acumulaciones o efectos por segundo.' },
  BURST: { label: 'Daño explosivo', description: 'Concentra mucho daño en una ventana corta para eliminar un objetivo antes de que responda.' },
  POKE: { label: 'Poke', description: 'Desgasta desde una distancia segura antes de comprometer la pelea.' },
  SUSTAIN: { label: 'Sustain', description: 'Recupera vida o mantiene al héroe activo durante intercambios prolongados.' },
  SHIELD: { label: 'Escudos', description: 'Añade vida temporal durante la ventana crítica de daño rival.' },
  MOBILITY: { label: 'Movilidad', description: 'Facilita entrar, reposicionarse o escapar.' },
  DURABILITY: { label: 'Resistencia', description: 'Aumenta el tiempo que el héroe puede permanecer en combate.' },
  HASTE: { label: 'Frecuencia de habilidades', description: 'Reduce el tiempo entre rotaciones y permite repetir antes el control, daño o utilidad.' },
  TEAM_UTILITY: { label: 'Utilidad de equipo', description: 'Convierte una compra individual en valor compartido con los aliados.' },
  ANTI_HEAL: { label: 'Anti-curación', description: 'Reduce la recuperación de vida rival durante la pelea.' },
  ANTI_SHIELD: { label: 'Anti-escudo', description: 'Reduce el valor de los escudos rivales.' },
  ARMOR: { label: 'Defensa física', description: 'Reduce el daño físico recibido.' },
  ANTI_MAGIC: { label: 'Defensa mágica', description: 'Reduce el daño mágico recibido.' },
  PHYSICAL_SHRED: { label: 'Shred físico', description: 'Reduce la armadura física del objetivo para aumentar el daño posterior.' },
  MAGICAL_SHRED: { label: 'Shred mágico', description: 'Reduce la resistencia mágica del objetivo para aumentar el daño posterior.' },
};

const GLOBAL_CONCEPT_KEYS = new Set(Object.keys(CONCEPT_DETAILS));

function conceptsFor(item: Parameters<typeof semanticTags>[0]): string[] {
  return [...semanticTags(item)].filter((tag) => GLOBAL_CONCEPT_KEYS.has(tag));
}

function formatHeroList(players: Array<{ heroSlug: string; value: number }>): string {
  return players
    .filter((player) => player.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((player) => `${player.heroSlug.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')} (${player.value.toLocaleString()})`)
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
    DAMAGE: 'aumenta el daño', DPS: 'mejora el daño sostenido', BURST: 'refuerza el daño explosivo',
    POKE: 'mejora el desgaste a distancia', ENGAGE: 'facilita la iniciación', PEEL: 'protege a los aliados',
    AOE: 'aumenta el impacto en área', TENACITY: 'reduce el control recibido', HASTE: 'permite repetir antes las habilidades',
    TEAM_UTILITY: 'aporta utilidad al equipo', DURABILITY: 'aumenta la resistencia',
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

function plainText(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{[^}]+\}/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function educationalExplanation(key: string): { whyItMatters: string; appliesAgainst: string[] } | null {
  const explanations: Record<string, { whyItMatters: string; appliesAgainst: string[] }> = {
    'anti-heal': {
      whyItMatters: 'La curación borra parte del daño que tu equipo ya ha invertido y permite al rival alargar o reiniciar la pelea. Aplicar Heridas Graves antes de su curación reduce la vida que recupera; comprar anti-heal después de que ya se haya curado llega tarde.',
      appliesAgainst: ['Akeron', 'Countess', 'Narbash', 'Khaimera', 'Phase', 'Rampage'],
    },
    'anti-shield': {
      whyItMatters: 'Un escudo añade vida temporal justo durante la ventana en la que intentas asegurar una eliminación. Una respuesta anti-escudo evita que ese valor defensivo invalide tu control y el burst coordinado del equipo.',
      appliesAgainst: ['Kwang', 'Muriel', 'Phase'],
    },
    'anti-tank': {
      whyItMatters: 'Contra mucha mitigación, añadir más daño plano ofrece un rendimiento decreciente. La penetración o el shred reducen primero la defensa rival y hacen que el daño posterior de todo el equipo sea más efectivo.',
      appliesAgainst: ['Steel', 'Riktor', 'Sevarog', 'Rampage', 'Kwang'],
    },
    'physical-defense': {
      whyItMatters: 'La armadura reduce cada instancia de daño físico. Adelantarla cuando ese tipo domina el daño recibido te da más tiempo vivo para lanzar otra rotación de habilidades.',
      appliesAgainst: ['Murdock', 'Sparrow', 'Drongo', 'Kallari', 'Grux'],
    },
    'magical-defense': {
      whyItMatters: 'La resistencia mágica y los escudos de hechizo amortiguan el burst de habilidades. Son especialmente valiosos si una sola rotación rival te obliga a abandonar la pelea.',
      appliesAgainst: ['Countess', 'Gideon', 'Morigesh', 'Argus', 'Howitzer'],
    },
  };
  return explanations[key] ?? null;
}

function educationalGuardrail(key: string): Pick<BuildSignal, 'learningPrompt' | 'whenNotToApply' | 'confidence'> {
  const values: Record<string, { learningPrompt: string; whenNotToApply: string }> = {
    'anti-heal': {
      learningPrompt: 'Antes de comprar, identifica quién cura, cuándo activa la curación y si tú puedes aplicar anti-heal antes de esa ventana.',
      whenNotToApply: 'No reserves una ranura por costumbre si la curación rival es pequeña, ocurre fuera de combate o un aliado ya mantiene Heridas Graves de forma fiable.',
    },
    'anti-shield': {
      learningPrompt: 'Distingue si el escudo protege el burst decisivo o sólo aumenta una cifra al final de la partida.',
      whenNotToApply: 'No priorices anti-escudo si puedes esperar la duración, cambiar el foco o si el escudo no coincide con la ventana de eliminación.',
    },
    'anti-tank': {
      learningPrompt: 'Comprueba qué objetivo necesitas golpear y qué resistencia está acumulando antes de elegir penetración, shred o daño porcentual.',
      whenNotToApply: 'La penetración pierde prioridad si tu función real es alcanzar a un objetivo frágil y puedes evitar por completo a la primera línea.',
    },
    'physical-defense': {
      learningPrompt: 'Relaciona tus muertes con la fuente de daño: ataques sostenidos, crítico o burst físico requieren respuestas distintas.',
      whenNotToApply: 'No compres armadura sólo porque haya varios héroes físicos si no te están alcanzando o el daño mágico sigue decidiendo tus muertes.',
    },
    'magical-defense': {
      learningPrompt: 'Identifica si te elimina una sola habilidad, una rotación completa o daño mágico sostenido; cada patrón cambia la respuesta.',
      whenNotToApply: 'No sacrifiques tu pico principal si el burst mágico puede evitarse con posición, visión o guardando movilidad.',
    },
  };
  const selected = values[key] ?? {
    learningPrompt: 'Relaciona la compra con una amenaza, el momento en que aparece y la función que tú debes cumplir.',
    whenNotToApply: 'No conviertas esta recomendación en una regla fija: cambia si la amenaza, tu función o el estado de la partida cambian.',
  };
  return {
    ...selected,
    confidence: { level: 'medium', basis: 'Inferencia basada en estadísticas de la partida, composición, catálogo del parche y orden de compra disponible.' },
  };
}

function conceptResponse(key: string): string {
  const responses: Record<string, string> = {
    CONTROL: 'Valora tenacidad, escudo de hechizo, posicionamiento y una pieza de peel; no todo el problema se resuelve comprando daño.',
    ENGAGE: 'Reserva movilidad o una herramienta defensiva para la entrada rival y evita gastar el peel antes de que inicien.',
    PEEL: 'No fuerces un engage largo si el rival conserva sus herramientas de protección; provoca primero esos enfriamientos.',
    DPS: 'Acorta la pelea con control y burst coordinado o construye resistencia sostenida; una defensa de un solo uso puede no ser suficiente.',
    BURST: 'Prioriza vida efectiva, resistencia apropiada o escudo de hechizo y evita entrar sin visión en su ventana de daño.',
    POKE: 'Añade sustain o movilidad y llega a los objetivos con tiempo para no empezar la pelea ya desgastado.',
    SUSTAIN: 'Aplica anti-curación antes de su ventana de recuperación y coordina el foco para que no pueda reiniciar la pelea.',
    SHIELD: 'Sincroniza el burst después del escudo o incorpora anti-escudo cuando ese valor se repite en cada pelea.',
    MOBILITY: 'Guarda control fiable para después de su desplazamiento y evita depender solo de habilidades lineales.',
    DURABILITY: 'La penetración, el shred y el daño porcentual ganan valor; repetir daño plano ofrece cada vez menos rendimiento.',
    HASTE: 'Espera rotaciones más frecuentes y evita reentrar pensando que sus habilidades clave siguen en enfriamiento.',
    TEAM_UTILITY: 'Identifica qué aliado recibe el aura o la protección y decide si debes separar la pelea o eliminar primero al facilitador.',
  };
  return responses[key] ?? 'Adapta la siguiente compra y la forma de ejecutar la pelea a este patrón, no solo a las estadísticas finales.';
}

function perkScore(perk: CatalogPerk, role: string | null, enemyMitigation: number, enablesHealingOrShielding: boolean): number {
  const text = plainText(`${perk.displayName} ${perk.simpleDescription ?? ''} ${perk.description}`).toLowerCase();
  let score = 0;
  if (enemyMitigation >= 80_000 && /(shred|reduce)[^.]{0,50}(armor|defen)|rust/.test(text)) score += 10;
  if (/stun|immobil|crowd control|movement speed/.test(text)) score += role === 'SUPPORT' ? 4 : 2;
  if (/ability haste|cooldown|ultimate haste/.test(text)) score += 3;
  if (/shield allies|allied hero/.test(text)) score += role === 'SUPPORT' ? 4 : 1;
  if (/\bheal(?:s|ed|ing)?\b|\bshield(?:s|ed|ing)?\b/.test(text) && enablesHealingOrShielding) score += 3;
  if (role === 'SUPPORT' && /units? killed|minions? killed/.test(text)) score -= 10;
  if (role === 'SUPPORT' && /basic attacks?/.test(text) && !/abilities/.test(text)) score -= 2;
  return score;
}

function perkRecommendation(perk: CatalogPerk, current: LoadoutPerk | undefined, reason: string) {
  return {
    id: perk.perk.predggId,
    slug: perk.perk.slug,
    displayName: perk.displayName,
    slot: perk.slot,
    icon: perk.icon,
    effect: perk.simpleDescription ?? perk.description,
    reason,
    replaces: current && current.displayName !== perk.displayName
      ? { id: current.id, displayName: current.displayName }
      : null,
  };
}

function perkAssessment(perk: LoadoutPerk, player: {
  deaths: number;
  role: string | null;
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

  if (slot.includes('HERO_SPECIFIC') || slot.includes('AUGMENT')) {
    verdict = 'correct';
    why = `Es un Augmento propio del héroe y su efecto (${[...tags].slice(0, 2).map(tagPurpose).join(' y ') || 'mejora de habilidad'}) se activa jugando su patrón normal. Es una elección coherente; para llamarla óptima habría que compararla con los otros Augmentos disponibles.`;
  } else if (player.role === 'SUPPORT' && /units?[^.]{0,30}killed|minions?[^.]{0,30}killed/.test(text.toLowerCase())) {
    verdict = 'questionable';
    why = 'Escala consiguiendo súbditos o unidades, pero como Support no deberías apropiarte del farmeo del Carry. Alcanzará su pico tarde y otra opción de utilidad o impacto inmediato suele aprovecharse mejor.';
  } else if (player.role === 'SUPPORT' && tags.has('BASIC_ATTACK') && tags.has('SUSTAIN')) {
    verdict = 'conditional';
    why = 'Da sustain mediante ataques básicos. Puede ayudar en línea, pero un Support con poco daño básico obtiene menos valor que un héroe de Carry; es correcta solo si realmente necesitas aguante temprano.';
  } else if (player.role === 'SUPPORT' && tags.has('DAMAGE') && /above.*health|health.*above/.test(text.toLowerCase())) {
    verdict = 'correct';
    why = 'Encaja con un Support de poke: premia golpear al rival antes de que empiece la pelea y no exige quitar farmeo a tus aliados.';
  } else if (matchedNeed) {
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

  return { ...perk, verdict, why, effect: perk.simpleDescription ?? perk.description ?? null };
}

function opponentPurchaseExplanation(heroSlug: string, itemName: string, tags: Set<string>): string {
  if (tags.has('ARMOR')) return `${heroSlug} compró ${itemName} para reducir el daño físico. Desde ese minuto, el daño físico plano pierde valor y la penetración o el shred ganan prioridad.`;
  if (tags.has('ANTI_MAGIC') || tags.has('SPELL_SHIELD')) return `${heroSlug} compró ${itemName} para resistir daño mágico. Si es uno de tus objetivos principales, tu siguiente pico ofensivo debe incluir penetración mágica o shred.`;
  if (tags.has('ANTI_HEAL')) return `${heroSlug} compró ${itemName} para reducir la curación. El rival estaba intentando cortar el sustain de tu equipo; no conviene depender únicamente de curas para sobrevivir.`;
  if (tags.has('ANTI_TANK')) return `${heroSlug} compró ${itemName} para castigar objetivos con mucha vida. Si tu primera línea estaba acumulando salud, necesitaba combinarla con resistencias en lugar de seguir apilando solo vida.`;
  if (tags.has('PHYSICAL_SHRED') || tags.has('MAGICAL_SHRED') || tags.has('SHRED')) return `${heroSlug} compró ${itemName} para reducir defensas. A partir de ese minuto, las peleas largas favorecían su daño y era más importante proteger al objetivo que estaba debilitando.`;
  return `${heroSlug} completó ${itemName} en ese momento; era una señal para revisar la siguiente compra antes de volver a base.`;
}

export async function getMatchBuildAnalysis(matchId: string, matchPlayerId: string) {
  const row = await db.matchPlayer.findFirst({
    where: { id: matchPlayerId, matchId },
    include: {
      match: {
        select: {
          versionId: true,
          version: { select: { name: true, releaseDate: true } },
          startTime: true,
          winningTeam: true,
          matchPlayers: {
            select: {
              id: true, team: true, role: true, heroSlug: true, totalHealingDone: true,
              totalShieldingReceived: true, totalDamageMitigated: true, playerId: true, playerName: true,
              inventoryItems: true,
            },
          },
        },
      },
    },
  });
  if (!row) throw new AppError(404, 'Match player not found', 'MATCH_PLAYER_NOT_FOUND');

  const enemies = row.match.matchPlayers.filter((player) => player.team !== row.team);
  const inventorySlugs = jsonArray<string>(row.inventoryItems).filter(Boolean);
  const enemyInventorySlugs = enemies.flatMap((enemy) => jsonArray<string>(enemy.inventoryItems)).filter(Boolean);
  const catalogSlugs = [...new Set([...inventorySlugs, ...enemyInventorySlugs])];
  let catalogVersionId = row.match.versionId;
  let catalogPatch = row.match.version?.name ?? null;
  let catalogFallback = false;
  let catalogItems = catalogVersionId && catalogSlugs.length > 0
    ? await db.gameItem.findMany({
      where: { slug: { in: catalogSlugs } },
      include: { versions: { where: { versionId: catalogVersionId }, take: 1 } },
    })
    : [];
  if (catalogVersionId && catalogSlugs.length > 0 && catalogItems.every((item) => item.versions.length === 0)) {
    const fallback = await db.version.findFirst({
      where: {
        releaseDate: { lte: row.match.startTime },
        name: { not: 'Unknown' },
        itemVersions: { some: {} },
      },
      orderBy: { releaseDate: 'desc' },
      select: { id: true, name: true },
    });
    if (fallback) {
      catalogVersionId = fallback.id;
      catalogPatch = fallback.name;
      catalogFallback = fallback.id !== row.match.versionId;
      catalogItems = await db.gameItem.findMany({
        where: { slug: { in: catalogSlugs } },
        include: { versions: { where: { versionId: catalogVersionId }, take: 1 } },
      });
    }
  }

  const allCatalogItems = catalogItems.map((item) => {
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
  const catalogItemBySlug = new Map(allCatalogItems.map((item) => [item.slug, item]));
  const inventory = inventorySlugs.flatMap((slug) => {
    const item = catalogItemBySlug.get(slug);
    return item ? [item] : [];
  });
  const tags = new Set(inventory.flatMap((item) => [...semanticTags(item)]));
  const statNames = new Set(inventory.flatMap((item) => item.stats.map((stat) => stat.stat)));

  const heroMetadata = await db.heroMeta.findMany({
    where: { slug: { in: [...new Set([row.heroSlug, ...enemies.map((enemy) => enemy.heroSlug)])] } },
    select: { slug: true, displayName: true, abilities: true },
  });
  const heroMetaBySlug = new Map(heroMetadata.map((hero) => [hero.slug, hero]));

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
  const playerAbilityConcepts = new Map<string, string[]>();
  for (const ability of jsonArray<HeroAbility>(heroMetaBySlug.get(row.heroSlug)?.abilities)) {
    const description = plainText(ability.game_description ?? ability.menu_description ?? '');
    if (!description) continue;
    for (const concept of conceptsFor({ displayName: description, aggressionType: null, stats: [], effects: [] })) {
      const evidence = playerAbilityConcepts.get(concept) ?? [];
      evidence.push(ability.display_name ?? ability.key ?? 'Habilidad');
      playerAbilityConcepts.set(concept, evidence);
    }
  }
  const roleConcepts: Record<string, string[]> = {
    SUPPORT: ['TEAM_UTILITY', 'PEEL', 'CONTROL'], CARRY: ['DPS', 'BURST'],
    JUNGLE: ['ENGAGE', 'DPS'], MIDLANE: ['POKE', 'BURST', 'CONTROL'],
    OFFLANE: ['DURABILITY', 'ENGAGE'],
  };
  for (const concept of roleConcepts[row.role ?? ''] ?? []) {
    if (!playerAbilityConcepts.has(concept)) playerAbilityConcepts.set(concept, [`Responsabilidad de ${row.role?.toLowerCase()}`]);
  }

  type GlobalSource = { heroSlug: string; sourceType: 'ability' | 'item'; name: string; description: string };
  const enemyConceptSources = new Map<string, GlobalSource[]>();
  const addEnemyConcept = (concept: string, source: GlobalSource) => {
    const values = enemyConceptSources.get(concept) ?? [];
    if (!values.some((value) => value.heroSlug === source.heroSlug && value.name === source.name)) values.push(source);
    enemyConceptSources.set(concept, values);
  };
  for (const enemy of enemies) {
    const meta = heroMetaBySlug.get(enemy.heroSlug);
    for (const ability of jsonArray<HeroAbility>(meta?.abilities)) {
      const description = plainText(ability.game_description ?? ability.menu_description ?? '');
      if (!description) continue;
      for (const concept of conceptsFor({ displayName: description, aggressionType: null, stats: [], effects: [] })) {
        addEnemyConcept(concept, { heroSlug: enemy.heroSlug, sourceType: 'ability', name: ability.display_name ?? ability.key ?? 'Habilidad', description });
      }
    }
    for (const slug of jsonArray<string>(enemy.inventoryItems)) {
      const item = catalogItemBySlug.get(slug);
      if (!item) continue;
      const description = plainText(item.effects.map((effect) => `${effect.name}: ${effect.text}`).join(' '));
      for (const concept of conceptsFor(item)) {
        addEnemyConcept(concept, { heroSlug: enemy.heroSlug, sourceType: 'item', name: item.displayName, description });
      }
    }
  }
  const threatPriority = ['SUSTAIN', 'SHIELD', 'CONTROL', 'ENGAGE', 'BURST', 'DPS', 'POKE', 'MOBILITY', 'DURABILITY', 'HASTE', 'TEAM_UTILITY'];
  const enemyBySlug = new Map(enemies.map((enemy) => [enemy.heroSlug, enemy]));
  const enemyThreats = threatPriority.flatMap((key) => {
    const sources = [...(enemyConceptSources.get(key) ?? [])].sort((a, b) => {
      const aEnemy = enemyBySlug.get(a.heroSlug);
      const bEnemy = enemyBySlug.get(b.heroSlug);
      const aImpact = key === 'SUSTAIN' ? aEnemy?.totalHealingDone ?? 0 : key === 'SHIELD' ? aEnemy?.totalShieldingReceived ?? 0 : 0;
      const bImpact = key === 'SUSTAIN' ? bEnemy?.totalHealingDone ?? 0 : key === 'SHIELD' ? bEnemy?.totalShieldingReceived ?? 0 : 0;
      return bImpact - aImpact || (a.sourceType === 'ability' ? -1 : 1);
    });
    const telemetryValue = key === 'SUSTAIN' ? enemyHealing : key === 'SHIELD' ? enemyShielding : key === 'DURABILITY' ? enemyMitigation : 0;
    const visible = sources.length > 0 || telemetryValue > 0;
    if (!visible) return [];
    const detail = CONCEPT_DETAILS[key];
    const critical = (key === 'SUSTAIN' && enemyHealing >= 25_000) || (key === 'SHIELD' && enemyShielding >= 25_000) || (key === 'DURABILITY' && enemyMitigation >= 150_000);
    const evidence = key === 'SUSTAIN'
      ? `${enemyHealing.toLocaleString()} de curación rival registrada.`
      : key === 'SHIELD'
        ? `${enemyShielding.toLocaleString()} de escudos recibidos por el rival.`
        : key === 'DURABILITY'
          ? `${enemyMitigation.toLocaleString()} de daño mitigado por el equipo rival.`
          : `${sources.length} habilidades u objetos rivales muestran este patrón.`;
    return [{ key, label: detail.label, description: detail.description, severity: critical ? 'critical' as const : 'warning' as const, evidence, response: conceptResponse(key), sources: sources.slice(0, 5) }];
  }).slice(0, 8);
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
  if (enemyMitigation >= 80_000 && !['ANTI_TANK', 'SHRED', 'PHYSICAL_SHRED', 'MAGICAL_SHRED'].some((tag) => tags.has(tag))) {
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

  for (const signal of signals) {
    const lesson = educationalExplanation(signal.key);
    if (lesson) Object.assign(signal, lesson);
    Object.assign(signal, educationalGuardrail(signal.key));
    if (!['anti-heal', 'anti-shield'].includes(signal.key)) continue;
    const pattern = signal.key === 'anti-heal'
      ? /\bheal(?:s|ed|ing)?\b|\brestore[^.]{0,30}\bhealth\b|\blifesteal\b|\bomnivamp\b/i
      : /shield/i;
    const sources: NonNullable<BuildSignal['sources']> = [];
    const relevantEnemies = [...enemies].sort((a, b) => {
      const aValue = signal.key === 'anti-heal' ? a.totalHealingDone : a.totalShieldingReceived;
      const bValue = signal.key === 'anti-heal' ? b.totalHealingDone : b.totalShieldingReceived;
      return (bValue ?? 0) - (aValue ?? 0);
    });
    for (const enemy of relevantEnemies) {
      const relevantValue = signal.key === 'anti-heal' ? enemy.totalHealingDone : enemy.totalShieldingReceived;
      if ((relevantValue ?? 0) <= 0) continue;
      const meta = heroMetaBySlug.get(enemy.heroSlug);
      for (const ability of jsonArray<HeroAbility>(meta?.abilities)) {
        const description = plainText(ability.game_description ?? ability.menu_description ?? '');
        if (!description || !pattern.test(description) || /reduc[^.]{0,30}heal|heal[^.]{0,30}reduc/i.test(description)) continue;
        sources.push({
          heroSlug: enemy.heroSlug,
          sourceType: 'ability',
          name: ability.display_name ?? ability.key ?? 'Habilidad',
          description,
        });
      }
    }
    for (const enemy of relevantEnemies) {
      const relevantValue = signal.key === 'anti-heal' ? enemy.totalHealingDone : enemy.totalShieldingReceived;
      if ((relevantValue ?? 0) <= 0) continue;
      for (const slug of jsonArray<string>(enemy.inventoryItems)) {
        const item = catalogItemBySlug.get(slug);
        if (!item) continue;
        const matchingEffects = item.effects.filter((effect) => {
          const description = plainText(`${effect.name} ${effect.text}`);
          return pattern.test(description) && !/reduc[^.]{0,30}heal|heal[^.]{0,30}reduc/i.test(description);
        });
        for (const effect of matchingEffects) {
          sources.push({
            heroSlug: enemy.heroSlug,
            sourceType: 'item',
            name: item.displayName,
            description: plainText(`${effect.name ? `${effect.name}: ` : ''}${effect.text}`),
          });
        }
      }
    }
    signal.sources = sources.slice(0, 8);
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
            totalPrice: candidate.totalPrice,
            stats: jsonArray<{ stat: string; value: number; showPercent?: boolean }>(candidate.stats),
            effects: jsonArray<{ name: string; text: string; condition?: string | null; cooldown?: string | null }>(candidate.effects),
            reason: matched ? `${candidate.displayName} ${tagPurpose(matched)}; responde directamente a esta amenaza.` : 'Aporta una respuesta situacional a esta amenaza.',
          };
        });
    }
  }

  const activeSignals = signals.filter((signal) => signal.key !== 'adaptation-ok');
  const needTagSet = new Set(desiredTags);
  const contextualNeedTags = new Set(desiredTags);
  if (enemyHealing >= 12_000) contextualNeedTags.add('ANTI_HEAL');
  if (enemyShielding >= 15_000) contextualNeedTags.add('ANTI_SHIELD');
  if (enemyMitigation >= 80_000) ['ANTI_TANK', 'SHRED', 'PHYSICAL_SHRED', 'MAGICAL_SHRED'].forEach((tag) => contextualNeedTags.add(tag));
  if (damageTotal > 0 && share(physical, damageTotal) >= 40) ['ARMOR', 'ANTI_CRIT'].forEach((tag) => contextualNeedTags.add(tag));
  if (damageTotal > 0 && share(magical, damageTotal) >= 40) ['ANTI_MAGIC', 'SPELL_SHIELD'].forEach((tag) => contextualNeedTags.add(tag));
  const finalInventory = inventory.filter((item) => item.rarity === 'EPIC' && item.slotType === 'PASSIVE');
  const identityConcepts = new Set(playerAbilityConcepts.keys());
  const buildConceptItems = new Map<string, string[]>();
  for (const item of finalInventory) {
    for (const concept of conceptsFor(item)) {
      const itemNames = buildConceptItems.get(concept) ?? [];
      itemNames.push(item.displayName);
      buildConceptItems.set(concept, itemNames);
    }
  }
  const aggressionCounts = new Map<string, number>();
  for (const item of finalInventory) {
    if (item.aggressionType) aggressionCounts.set(item.aggressionType, (aggressionCounts.get(item.aggressionType) ?? 0) + 1);
  }
  const inventoryAssessments = finalInventory.map((item) => {
    const itemTags = semanticTags(item);
    const matched = [...itemTags].filter((tag) => contextualNeedTags.has(tag));
    const functions = conceptsFor(item).map((concept) => ({ key: concept, ...CONCEPT_DETAILS[concept] }));
    const identityMatches = functions.filter((concept) => identityConcepts.has(concept.key));
    const repeatsPurpose = item.aggressionType ? (aggressionCounts.get(item.aggressionType) ?? 0) > 1 : false;
    return {
      slug: item.slug,
      displayName: item.displayName,
      verdict: matched.length > 0 ? 'correct' as const : activeSignals.length > 0 ? 'neutral' as const : 'correct' as const,
      purpose: [...itemTags].slice(0, 3).map(tagPurpose),
      functions,
      roleFit: identityMatches.length > 0
        ? `Encaja con ${identityMatches.map((concept) => concept.label.toLowerCase()).join(' y ')}, partes del plan de ${row.heroSlug} ${row.role?.toLowerCase() ?? ''}.`
        : `Aporta valor genérico, pero no refuerza de forma directa los conceptos principales detectados para ${row.heroSlug} ${row.role?.toLowerCase() ?? ''}.`,
      matchupFit: matched.length > 0
        ? `Responde a esta partida porque ${matched.map(tagPurpose).join(' y ')}.`
        : activeSignals.length > 0
          ? 'No cubre por sí solo las principales respuestas que exigía la composición rival.'
          : 'No necesitaba cubrir una carencia contextual grave con los datos disponibles.',
      tradeoff: repeatsPurpose
        ? 'Repite una función ya presente en la build; esa redundancia reduce el espacio disponible para adaptación.'
        : functions.length > 0
          ? `Al ocupar esta ranura priorizas ${functions.slice(0, 2).map((concept) => concept.label.toLowerCase()).join(' y ')} frente a otra posible respuesta situacional.`
          : 'El catálogo no describe suficientes efectos para medir con precisión el coste de oportunidad de esta ranura.',
      explanation: matched.length > 0
        ? `Fue una buena adaptación porque ${matched.map(tagPurpose).join(' y ')}.`
        : repeatsPurpose
          ? `Repite el mismo enfoque (${item.aggressionType!.toLowerCase().replaceAll('_', ' ')}) que otra pieza. Esa redundancia era la ranura más fácil de convertir en una respuesta al rival.`
        : activeSignals.length > 0
          ? 'Puede formar parte del núcleo del héroe, pero no respondía a las amenazas que decidieron esta partida.'
          : 'Encajó sin dejar una carencia contextual evidente en la build final.',
    };
  });

  const buildProfile = [...buildConceptItems.entries()]
    .map(([key, items]) => ({ key, label: CONCEPT_DETAILS[key].label, description: CONCEPT_DETAILS[key].description, items }))
    .sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));
  const responseConcepts: Record<string, string[]> = {
    SUSTAIN: ['ANTI_HEAL'], SHIELD: ['ANTI_SHIELD'], CONTROL: ['TENACITY', 'DURABILITY', 'MOBILITY', 'PEEL'],
    ENGAGE: ['PEEL', 'MOBILITY', 'DURABILITY'], BURST: ['DURABILITY', 'ANTI_MAGIC', 'ARMOR', 'SPELL_SHIELD'],
    DPS: ['DURABILITY', 'CONTROL', 'SUSTAIN'], POKE: ['SUSTAIN', 'MOBILITY'], MOBILITY: ['CONTROL'],
    DURABILITY: ['PHYSICAL_SHRED', 'MAGICAL_SHRED', 'ANTI_TANK'], HASTE: ['DURABILITY'], TEAM_UTILITY: ['BURST', 'ENGAGE'],
  };
  const buildTagSet = new Set(finalInventory.flatMap((item) => [...semanticTags(item)]));
  const availableResponseSet = new Set([...buildTagSet, ...identityConcepts]);
  const unresolvedConcepts = enemyThreats.filter((threat) => {
    const responses = responseConcepts[threat.key] ?? [];
    return responses.length > 0 && !responses.some((response) => availableResponseSet.has(response));
  });
  const alignedItems = inventoryAssessments.filter((item) => item.functions.some((concept) => identityConcepts.has(concept.key))).length;
  const buildCoherence = finalInventory.length > 0 ? Math.round((alignedItems / finalInventory.length) * 100) : 0;
  const playerIdentity = [...playerAbilityConcepts.entries()].map(([key, evidence]) => ({
    key,
    label: CONCEPT_DETAILS[key]?.label ?? tagPurpose(key),
    description: CONCEPT_DETAILS[key]?.description ?? tagPurpose(key),
    evidence: [...new Set(evidence)].slice(0, 4),
  })).slice(0, 7);

  const alreadyOwned = new Set(inventory.map((item) => item.slug));
  const replaceable = finalInventory
    .filter((item) => ![...semanticTags(item)].some((tag) => needTagSet.has(tag)))
    .sort((a, b) => {
      const aDuplicate = a.aggressionType && (aggressionCounts.get(a.aggressionType) ?? 0) > 1 ? 1 : 0;
      const bDuplicate = b.aggressionType && (aggressionCounts.get(b.aggressionType) ?? 0) > 1 ? 1 : 0;
      return bDuplicate - aDuplicate;
    });
  const usedReplacements = new Set<string>();
  const usedSuggestions = new Set<string>();
  const changes = activeSignals.flatMap((signal) => {
    const suggestion = signal.suggestedItems?.find((item) => !alreadyOwned.has(item.slug));
    if (!suggestion || usedSuggestions.has(suggestion.slug)) return [];
    usedSuggestions.add(suggestion.slug);
    const insteadOf = replaceable.find((item) => !usedReplacements.has(item.slug));
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
      why: `${signal.evidence} ${suggestion.reason}${activeSignals.some((other) => other.key !== signal.key && other.suggestedItems?.some((item) => item.slug === suggestion.slug)) ? ' Además, la misma pieza cubre más de una de las carencias detectadas, por lo que no necesitas sacrificar otra ranura.' : ''}`,
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
      explanation: opponentPurchaseExplanation(enemy.heroSlug, item.displayName, item.tags),
    }];
  }).slice(0, 8);

  const loadout = jsonArray<LoadoutPerk>(row.perks).map((perk) => perkAssessment(perk, row, needTagSet));
  const currentLoadout = jsonArray<LoadoutPerk>(row.perks);
  let recommendedLoadout: {
    augment: ReturnType<typeof perkRecommendation> | null;
    eternal: ReturnType<typeof perkRecommendation> | null;
    blessings: Array<ReturnType<typeof perkRecommendation>>;
    explanation: string;
    confidence: { level: 'low' | 'medium' | 'high'; basis: string };
    limitation: string;
  } = {
    augment: null,
    eternal: null,
    blessings: [],
    explanation: 'No hay catálogo de loadout disponible para comparar alternativas en este parche.',
    confidence: { level: 'low', basis: 'No hay catálogo versionado suficiente para comparar alternativas.' },
    limitation: 'No se recomienda una alternativa sin conocer sus condiciones de activación en este parche.',
  };
  const perkCatalogVersionId = row.match.versionId ?? catalogVersionId;
  if (perkCatalogVersionId) {
    let perkCatalog = await db.gamePerkVersion.findMany({
      where: {
        versionId: perkCatalogVersionId,
        OR: [
          { slot: 'ETERNAL_1' },
          { heroSlug: row.heroSlug },
          { slot: { startsWith: 'BLESSING_MINOR_' } },
        ],
      },
      include: { perk: { select: { predggId: true, slug: true } } },
    }) as CatalogPerk[];
    if (perkCatalog.length === 0 && catalogVersionId && catalogVersionId !== perkCatalogVersionId) {
      perkCatalog = await db.gamePerkVersion.findMany({
        where: {
          versionId: catalogVersionId,
          OR: [
            { slot: 'ETERNAL_1' },
            { heroSlug: row.heroSlug },
            { slot: { startsWith: 'BLESSING_MINOR_' } },
          ],
        },
        include: { perk: { select: { predggId: true, slug: true } } },
      }) as CatalogPerk[];
    }
    const playerMeta = heroMetaBySlug.get(row.heroSlug);
    const playerAbilityText = jsonArray<HeroAbility>(playerMeta?.abilities)
      .map((ability) => `${ability.game_description ?? ''} ${ability.menu_description ?? ''}`)
      .join(' ');
    const enablesHealingOrShielding = /heal|shield/i.test(playerAbilityText);
    const scored = (values: CatalogPerk[]) => values
      .map((perk) => ({ perk, score: perkScore(perk, row.role, enemyMitigation, enablesHealingOrShielding) }))
      .sort((a, b) => b.score - a.score || a.perk.displayName.localeCompare(b.perk.displayName));
    const augment = scored(perkCatalog.filter((perk) => perk.heroSlug === row.heroSlug && perk.slot.includes('HERO_SPECIFIC')))[0]?.perk ?? null;
    const eternal = scored(perkCatalog.filter((perk) => perk.slot === 'ETERNAL_1'))[0]?.perk ?? null;
    const blessingIds = new Set(jsonArray<unknown>(eternal?.minorBlessingPredggIds).map(String));
    const blessingCandidates = perkCatalog.filter((perk) => blessingIds.has(String(perk.perk.predggId)));
    const blessingOne = scored(blessingCandidates.filter((perk) => perk.slot.endsWith('_1')))[0]?.perk ?? null;
    const blessingTwo = scored(blessingCandidates.filter((perk) => perk.slot.endsWith('_2')))[0]?.perk ?? null;
    const currentAugment = currentLoadout.find((perk) => perk.slot.includes('HERO_SPECIFIC'));
    const currentEternal = currentLoadout.find((perk) => perk.slot === 'ETERNAL_1');
    const currentBlessings = currentLoadout.filter((perk) => perk.slot.includes('BLESSING'));
    recommendedLoadout = {
      augment: augment ? perkRecommendation(
        augment,
        currentAugment,
        enemyMitigation >= 80_000 && /shred|armor/i.test(`${augment.simpleDescription ?? ''} ${augment.description}`)
          ? 'Prioriza utilidad para todo el equipo: su control aplica reducción de defensas y abre una ventana de daño para tus aliados.'
          : 'Es el Augmento que mejor refuerza tu función y las necesidades observadas en esta partida.',
      ) : null,
      eternal: eternal ? perkRecommendation(
        eternal,
        currentEternal,
        enemyMitigation >= 80_000 && /shred|rust|armor/i.test(`${eternal.simpleDescription ?? ''} ${eternal.description}`)
          ? 'Supera a una opción de daño genérico porque reduce las defensas del objetivo y convierte tu poke y control en valor compartido por el equipo.'
          : 'Su condición de activación encaja mejor con tu rol y no depende de apropiarte del farmeo de otra posición.',
      ) : null,
      blessings: [blessingOne, blessingTwo].flatMap((perk) => perk ? [perkRecommendation(
        perk,
        currentBlessings.find((current) => current.slot === perk.slot),
        /rust|shred/i.test(`${perk.simpleDescription ?? ''} ${perk.description}`)
          ? 'Acelera o maximiza la reducción de defensas del Eternal recomendado durante tu ventana de control.'
          : /haste|cooldown/i.test(`${perk.simpleDescription ?? ''} ${perk.description}`)
            ? 'Te permite repetir antes tus habilidades de control y mantener activa la utilidad del Eternal.'
            : 'Es la bendición de su ranura que mejor complementa el patrón de utilidad recomendado.',
      )] : []),
      explanation: 'La comparación usa tu rol, las habilidades del héroe, la mitigación rival y las condiciones reales de activación. Una opción que exige matar unidades pierde valor en Support aunque su bonificación final parezca atractiva.',
      confidence: {
        level: perkCatalog.length >= 4 ? 'medium' : 'low',
        basis: `Comparación contextual entre ${perkCatalog.length} opciones del catálogo del parche; no demuestra causalidad por sí sola.`,
      },
      limitation: 'La elección se apoya en condiciones descritas y telemetría final; el VOD puede revelar un plan de línea o coordinación que justifique otra opción.',
    };
  }

  let localBenchmark: {
    source: 'riftline_local';
    disclosure: string;
    exactBuild: { matches: number; wins: number; winRate: number; confidence: 'low' | 'medium' | 'high' } | null;
    laneMatchup: { opponentHeroSlug: string; matches: number; wins: number; winRate: number; confidence: 'low' | 'medium' | 'high' } | null;
  } = {
    source: 'riftline_local',
    disclosure: 'Referencia calculada con partidas almacenadas por RiftLine; no es una estadística global de pred.gg.',
    exactBuild: null,
    laneMatchup: null,
  };
  try {
    const laneOpponent = enemies.find((enemy) => enemy.role === row.role) ?? null;
    const [buildRows, matchupRows] = await Promise.all([
      db.$queryRaw<Array<{ matches: number; wins: number }>>(Prisma.sql`
        SELECT matches, wins FROM "CoachBuildAggregate"
        WHERE "heroSlug" = ${row.heroSlug}
          AND role IS NOT DISTINCT FROM ${row.role}
          AND "gameMode" = 'RANKED'
          AND "buildItems" = ${JSON.stringify(inventorySlugs)}::jsonb
        ORDER BY matches DESC LIMIT 1
      `),
      laneOpponent ? db.$queryRaw<Array<{ matches: number; wins: number }>>(Prisma.sql`
        SELECT matches, wins FROM "CoachMatchupAggregate"
        WHERE "heroSlug" = ${row.heroSlug}
          AND role IS NOT DISTINCT FROM ${row.role}
          AND "opponentHeroSlug" = ${laneOpponent.heroSlug}
          AND "gameMode" = 'RANKED'
        ORDER BY matches DESC LIMIT 1
      `) : Promise.resolve([]),
    ]);
    const sampleConfidence = (matches: number): 'low' | 'medium' | 'high' => matches >= 30 ? 'high' : matches >= 10 ? 'medium' : 'low';
    const buildSample = buildRows[0];
    const matchupSample = matchupRows[0];
    localBenchmark = {
      ...localBenchmark,
      exactBuild: buildSample ? {
        ...buildSample,
        winRate: buildSample.matches > 0 ? Math.round((buildSample.wins / buildSample.matches) * 1_000) / 10 : 0,
        confidence: sampleConfidence(buildSample.matches),
      } : null,
      laneMatchup: matchupSample && laneOpponent ? {
        opponentHeroSlug: laneOpponent.heroSlug,
        ...matchupSample,
        winRate: matchupSample.matches > 0 ? Math.round((matchupSample.wins / matchupSample.matches) * 1_000) / 10 : 0,
        confidence: sampleConfidence(matchupSample.matches),
      } : null,
    };
  } catch {
    // Aggregates are an enhancement. Match coaching remains available before
    // the first materialized-view refresh or on plain PostgreSQL test doubles.
  }

  const replacementsBySlug = new Map(changes.flatMap((change) => change.insteadOf ? [[change.insteadOf.slug, change.item] as const] : []));
  const addedSuggestions = changes.filter((change) => !change.insteadOf).map((change) => change.item);
  const retainedCore = finalInventory.flatMap((item) => replacementsBySlug.has(item.slug) ? [] : [item]);
  const recommendedItems = (retainedCore.length > 0
    ? [retainedCore[0], ...changes.map((change) => change.item), ...retainedCore.slice(1), ...addedSuggestions]
    : [...changes.map((change) => change.item), ...addedSuggestions]
  ).filter((item, index, values) => values.findIndex((other) => other.slug === item.slug) === index).slice(0, 5);
  const recommendedSequence = recommendedItems.map((item, index) => {
    const change = changes.find((entry) => entry.item.slug === item.slug);
    const inventoryItem = item;
    return {
      position: index + 1,
      slug: item.slug,
      displayName: item.displayName,
      phase: index === 0 ? 'Núcleo temprano' : index === 1 ? 'Adaptación temprana' : index < 4 ? 'Medio juego' : 'Cierre',
      reason: change?.timing ?? (index === 0
        ? 'Conserva esta pieza como base funcional del héroe salvo que la amenaza rival exija una respuesta inmediata.'
        : 'Completa esta pieza después de cubrir la amenaza prioritaria; aporta valor al núcleo sin retrasar la adaptación.'),
      replaces: change?.insteadOf ?? null,
      stats: inventoryItem ? jsonArray<{ stat: string; value: number; showPercent?: boolean }>(inventoryItem.stats) : [],
      effects: inventoryItem ? jsonArray<{ name: string; text: string; condition?: string | null; cooldown?: string | null }>(inventoryItem.effects) : [],
    };
  });
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
    dataContext: {
      matchPatch: row.match.version?.name ?? null,
      catalogPatch,
      catalogFallback,
      disclosure: catalogFallback
        ? `La partida pertenece al parche ${row.match.version?.name ?? 'desconocido'}, pero el catálogo comparable más próximo disponible es ${catalogPatch ?? 'desconocido'}. Las recomendaciones se muestran con confianza limitada.`
        : `Objetos, Augmentos y Eternals se comparan con el catálogo del parche ${catalogPatch ?? 'registrado para la partida'}.`,
    },
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
    globalAnalysis: {
      playerIdentity,
      enemyThreats,
      buildProfile,
      coherence: {
        score: buildCoherence,
        summary: buildCoherence >= 70
          ? `La mayoría de las piezas refuerzan el plan natural de ${row.heroSlug}, aunque todavía deben juzgarse por el rival y el momento de compra.`
          : buildCoherence >= 40
            ? `La build mezcla piezas coherentes con ${row.heroSlug} y valor genérico; conviene definir mejor si la partida exigía control, protección, daño o supervivencia.`
            : `Pocas piezas refuerzan de forma directa el patrón detectado para ${row.heroSlug}; la build parece construida más por valor aislado que por un plan conjunto.`,
      },
      strengths: buildProfile.slice(0, 3).map((concept) => `${concept.label}: ${concept.items.join(', ')}.`),
      tradeoffs: unresolvedConcepts.slice(0, 4).map((threat) => `${threat.label}: la build final no muestra una respuesta directa. ${threat.response}`),
    },
    inventory,
    inventoryAssessments,
    verdict: { grade, summary: verdictSummary, score: Math.max(20, 100 - criticalCount * 25 - warningCount * 12) },
    recommendedBuild: {
      principle: 'Mantén el núcleo que hace funcionar al héroe y reserva al menos una ranura para responder a lo que realmente está comprando y produciendo el rival.',
      changes,
      sequence: recommendedSequence,
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
    recommendedLoadout,
    localBenchmark,
    abilityOrder: jsonArray<{ ability: string; gameTime: number }>(row.abilityOrder),
    signals,
  };
}
