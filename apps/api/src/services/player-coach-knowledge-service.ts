import { db } from '../db.js';

export type CoachKnowledgeKind = 'fundamental' | 'hero' | 'item' | 'loadout';

export interface CoachKnowledgeEvidence {
  id: string;
  kind: CoachKnowledgeKind;
  label: string;
  value: string;
  source: string;
  patch: string | null;
}

interface RecentCoachMatch {
  heroSlug: string;
  role: string | null;
  inventoryItems: unknown;
  perks: unknown;
  match: {
    predggUuid: string;
    versionId?: string | null;
    version?: { name: string } | null;
  };
}

export interface FundamentalKnowledge {
  key: string;
  label: string;
  keywords: string[];
  roles?: string[];
  value: string;
}

export const FUNDAMENTALS: FundamentalKnowledge[] = [
  {
    key: 'economy',
    label: 'Oro, experiencia y compras',
    keywords: ['oro', 'economia', 'farm', 'cs', 'experiencia', 'nivel', 'compra', 'recall', 'volver a base'],
    value: 'El oro se convierte en poder al comprar y la experiencia al subir habilidades. Acumular recursos sin encontrar una ventana segura para comprar retrasa el pico de poder. Una buena vuelta a base compara el valor de la compra, la oleada u objetivo que se puede perder y el riesgo de permanecer en el mapa.',
  },
  {
    key: 'objectives',
    label: 'Preparación de objetivos',
    keywords: ['objetivo', 'fangtooth', 'prime', 'orb', 'shaper', 'torre', 'estructura', 'preparar'],
    value: 'Preparar un objetivo empieza antes de atacarlo: comprar, empujar las oleadas que sea seguro empujar, conservar vida y recursos, obtener información y ocupar accesos. Asegurarlo no depende sólo del daño infligido al monstruo; también cuentan la presión, el control de zona y evitar una muerte previa evitable.',
  },
  {
    key: 'vision',
    label: 'Visión e información',
    keywords: ['vision', 'ward', 'mapa', 'informacion', 'niebla', 'entrada', 'rotacion'],
    value: 'Un ward es valioso por la decisión que permite tomar, no por aumentar un contador. Su momento, la ruta que cubre y la capacidad del equipo para actuar importan más que el volumen aislado. Colocar visión profunda sin prioridad o apoyo puede entregar una muerte en lugar de producir información útil.',
  },
  {
    key: 'build_adaptation',
    label: 'Adaptación de build',
    keywords: ['build', 'objeto', 'item', 'adaptar', 'anticuracion', 'antiheal', 'penetracion', 'armadura', 'resistencia', 'dano', 'escudo'],
    value: 'Una build tiene un núcleo que hace funcionar al héroe y decisiones situacionales que responden a amenazas reales. La adaptación debe considerar composición, fuentes de daño, curación, escudos, control, resistencias, quién va por delante, el siguiente objetivo y el momento de compra. Un objeto no es bueno o malo de forma absoluta: resuelve una función con un coste de oportunidad.',
  },
  {
    key: 'anti_heal',
    label: 'Anti-curación',
    keywords: ['anticuracion', 'antiheal', 'curacion', 'curar', 'sustain', 'recuperacion de vida'],
    value: 'La anti-curación gana valor cuando una parte relevante de la supervivencia rival depende de curación repetida y estará activa durante las peleas importantes. Debe comprarse con tiempo para influir en esas ventanas y asignarse a quien pueda aplicarla de forma fiable. No sustituye automáticamente daño, control o supervivencia cuando la curación rival es pequeña o difícil de afectar.',
  },
  {
    key: 'damage_defence',
    label: 'Daño, penetración y defensas',
    keywords: ['dano fisico', 'dano magico', 'dano verdadero', 'penetracion', 'armadura', 'resistencia magica', 'tanque', 'mitigacion'],
    value: 'La defensa adecuada depende de quién representa la amenaza y qué tipo de daño aplica, no sólo del total recibido al final. La penetración y la reducción de defensas aumentan de valor contra objetivos que invierten en resistencias; contra objetivos frágiles puede ser más importante completar antes el pico principal de daño o utilidad.',
  },
  {
    key: 'tempo',
    label: 'Tempo y picos de poder',
    keywords: ['tempo', 'pico de poder', 'power spike', 'timing', 'momento', 'ventana'],
    value: 'Tempo es la capacidad temporal de actuar antes de que el rival pueda responder en igualdad de condiciones. Lo crean, entre otras cosas, una compra completada, una oleada empujada, un rival muerto o una habilidad clave no disponible. Un pico de poder sólo aporta valor si el jugador reconoce la ventana y adapta la siguiente decisión.',
  },
  {
    key: 'combat',
    label: 'Función en combate',
    keywords: ['pelea', 'teamfight', 'combate', 'engage', 'iniciar', 'peel', 'proteger', 'posicionamiento', 'cc', 'control'],
    value: 'La contribución en una pelea depende de la función del héroe y del estado de la partida. Iniciar, proteger, controlar, causar daño o negar espacio pueden ser tareas correctas distintas. Kills, asistencias y daño ayudan a localizar una situación, pero no demuestran por sí solos que la entrada, el objetivo elegido o el posicionamiento fueran correctos.',
  },
  {
    key: 'support_role',
    label: 'Fundamentos de Support',
    keywords: ['support', 'apoyo'],
    roles: ['SUPPORT'],
    value: 'Support convierte información, control y protección en mejores decisiones para el equipo. Su prioridad cambia entre iniciar, proteger al aliado que puede ganar la pelea, negar una entrada o preparar visión. No debe valorarse únicamente por daño, oro o bajas.',
  },
  {
    key: 'carry_role',
    label: 'Fundamentos de Carry',
    keywords: ['carry', 'adc'],
    roles: ['CARRY'],
    value: 'Carry necesita convertir recursos en daño sostenido sin exponerse antes de que desaparezcan las principales amenazas. Farmear, comprar a tiempo, mantener una distancia útil y elegir un objetivo alcanzable suelen importar más que perseguir una baja aislada.',
  },
  {
    key: 'jungle_role',
    label: 'Fundamentos de Jungla',
    keywords: ['jungla', 'jungle', 'gank', 'pathing', 'ruta'],
    roles: ['JUNGLE'],
    value: 'Jungla distribuye su tiempo entre recursos, presión, información y objetivos. Una ruta no puede evaluarse sólo por el número de ganks: debe considerar campamentos disponibles, prioridad de líneas, estado de las oleadas, información rival y la próxima ventana de objetivo. Sin movimiento continuo o replay, RiftLine no puede reconstruir con certeza el pathing.',
  },
  {
    key: 'midlane_role',
    label: 'Fundamentos de Midlane',
    keywords: ['midlane', 'mid', 'linea central'],
    roles: ['MIDLANE'],
    value: 'Midlane equilibra recursos de línea, prioridad central y capacidad de influir en ambos lados del mapa. Empujar no siempre obliga a rotar: la decisión depende de la información, el coste de abandonar la línea y si la llegada puede producir una ventaja real.',
  },
  {
    key: 'offlane_role',
    label: 'Fundamentos de Offlane',
    keywords: ['offlane', 'solo lane', 'linea lateral'],
    roles: ['OFFLANE'],
    value: 'Offlane debe convertir su presión y durabilidad en una ventaja útil sin aislarse de las ventanas decisivas. Presionar una línea, agruparse o flanquear son opciones contextuales que dependen de oleadas, teleportes o movilidad, objetivos y capacidad del equipo para esperar.',
  },
];

export function fundamentalCompetency(key: string): string {
  if (['economy'].includes(key)) return 'moba_fundamentals';
  if (['objectives', 'vision', 'tempo'].includes(key)) return 'macro';
  if (['build_adaptation', 'anti_heal', 'damage_defence'].includes(key)) return 'builds';
  if (['combat'].includes(key)) return 'micro_concepts';
  if (key.endsWith('_role')) return 'role_knowledge';
  return 'moba_fundamentals';
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function plainText(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function compactJsonText(value: unknown, maxLength = 900): string {
  const text = plainText(JSON.stringify(value ?? ''));
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}…`;
}

function selectedFundamentals(question: string, role: string | null): FundamentalKnowledge[] {
  const normalizedQuestion = normalize(question);
  const matches = FUNDAMENTALS.filter((entry) =>
    entry.keywords.some((keyword) => normalizedQuestion.includes(normalize(keyword))),
  );
  const roleEntry = FUNDAMENTALS.find((entry) => entry.roles?.includes(role ?? ''));
  const selected = [...matches];
  if (roleEntry && !selected.some((entry) => entry.key === roleEntry.key)) selected.push(roleEntry);
  if (selected.length === 0) selected.push(FUNDAMENTALS.find((entry) => entry.key === 'build_adaptation')!);
  return selected.slice(0, 3);
}

/**
 * Builds a small, traceable knowledge pack for the personal coach.
 * Evergreen principles come from RiftLine's reviewed curriculum while
 * patch-sensitive facts come from the synchronized game catalog.
 */
export async function getPlayerCoachKnowledge(
  question: string,
  recentMatches: RecentCoachMatch[],
): Promise<CoachKnowledgeEvidence[]> {
  const knowledge: CoachKnowledgeEvidence[] = selectedFundamentals(question, recentMatches[0]?.role ?? null)
    .map((entry, index) => ({
      id: `K${index + 1}`,
      kind: 'fundamental' as const,
      label: entry.label,
      value: entry.value,
      source: 'Currículo RiftLine revisado · fundamentos MOBA v1',
      patch: null,
    }));

  const heroSlugs = [...new Set(recentMatches.slice(0, 3).map((match) => match.heroSlug).filter(Boolean))];
  const itemSlugs = [...new Set(recentMatches.slice(0, 3)
    .flatMap((match) => asArray<string>(match.inventoryItems))
    .filter(Boolean))].slice(0, 12);
  const selectedPerks = recentMatches.slice(0, 3)
    .flatMap((match) => asArray<{ id?: string; displayName?: string; name?: string; slot?: string }>(match.perks))
    .filter((perk) => perk.id || perk.displayName || perk.name)
    .slice(0, 12);

  const preferredVersionId = recentMatches.find((match) => match.match.versionId)?.match.versionId ?? null;
  const exactCatalogVersion = preferredVersionId
    ? await db.version.findFirst({
      where: {
        id: preferredVersionId,
        OR: [{ itemVersions: { some: {} } }, { perkVersions: { some: {} } }],
      },
      select: { id: true, name: true },
    })
    : null;
  const catalogVersion = exactCatalogVersion ?? await db.version.findFirst({
    where: { OR: [{ itemVersions: { some: {} } }, { perkVersions: { some: {} } }] },
    orderBy: { releaseDate: 'desc' },
    select: { id: true, name: true },
  });
  const requestedPatch = recentMatches.find((match) => match.match.version?.name)?.match.version?.name ?? null;
  const catalogIsFallback = Boolean(preferredVersionId && !exactCatalogVersion && catalogVersion);
  const catalogSourceSuffix = catalogIsFallback
    ? ` · catálogo más próximo disponible; la partida era ${requestedPatch ?? 'de otro parche'}`
    : '';

  const [heroes, items, perks] = await Promise.all([
    heroSlugs.length > 0
      ? db.heroMeta.findMany({
        where: { slug: { in: heroSlugs } },
        select: { slug: true, displayName: true, roles: true, classes: true, abilities: true },
      })
      : Promise.resolve([]),
    catalogVersion && itemSlugs.length > 0
      ? db.gameItem.findMany({
        where: { slug: { in: itemSlugs } },
        select: {
          slug: true,
          name: true,
          versions: {
            where: { versionId: catalogVersion.id },
            take: 1,
            select: { displayName: true, stats: true, effects: true, totalPrice: true },
          },
        },
      })
      : Promise.resolve([]),
    catalogVersion && selectedPerks.length > 0
      ? db.gamePerkVersion.findMany({
        where: {
          versionId: catalogVersion.id,
          OR: [
            { predggDataId: { in: selectedPerks.flatMap((perk) => perk.id ? [String(perk.id)] : []) } },
            { displayName: { in: selectedPerks.flatMap((perk) => perk.displayName ? [perk.displayName] : []) } },
          ],
        },
        select: { displayName: true, slot: true, simpleDescription: true, description: true, heroSlug: true },
        take: 12,
      })
      : Promise.resolve([]),
  ]);

  let nextId = knowledge.length + 1;
  for (const hero of heroes.slice(0, 3)) {
    knowledge.push({
      id: `K${nextId++}`,
      kind: 'hero',
      label: `${hero.displayName}: habilidades y función`,
      value: `Roles ${compactJsonText(hero.roles, 180)}; clases ${compactJsonText(hero.classes, 180)}; habilidades ${compactJsonText(hero.abilities, 1_200)}.`,
      source: 'Catálogo de héroes sincronizado por RiftLine',
      patch: null,
    });
  }
  for (const item of items.slice(0, 8)) {
    const version = item.versions[0];
    if (!version) continue;
    knowledge.push({
      id: `K${nextId++}`,
      kind: 'item',
      label: version.displayName || item.name,
      value: `Coste total ${version.totalPrice}; estadísticas ${compactJsonText(version.stats, 500)}; efectos ${compactJsonText(version.effects, 900)}.`,
      source: `Catálogo de objetos sincronizado por RiftLine${catalogSourceSuffix}`,
      patch: catalogVersion?.name ?? null,
    });
  }
  for (const perk of perks.slice(0, 8)) {
    knowledge.push({
      id: `K${nextId++}`,
      kind: 'loadout',
      label: perk.displayName,
      value: `Ranura ${perk.slot}; héroe ${perk.heroSlug ?? 'global'}; ${plainText(perk.simpleDescription ?? perk.description)}`,
      source: `Catálogo de Augmentos, Eternos y bendiciones sincronizado por RiftLine${catalogSourceSuffix}`,
      patch: catalogVersion?.name ?? null,
    });
  }

  return knowledge.slice(0, 14);
}
