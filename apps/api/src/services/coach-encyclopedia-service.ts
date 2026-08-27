import { db } from '../db.js';
import { COMPETENCIES, LEARNING_QUESTIONS, MISSION_TEMPLATES } from './player-learning-catalog.js';
import { FUNDAMENTALS, fundamentalCompetency } from './player-coach-knowledge-service.js';

export type EncyclopediaKind = 'concept' | 'hero' | 'item' | 'loadout' | 'eternal_category';

export interface EncyclopediaEntry {
  key: string;
  kind: EncyclopediaKind;
  title: string;
  summary: string;
  details: unknown;
  competencyKey: string | null;
  roles: string[];
  patch: string | null;
  source: string;
  confidence: 'high' | 'medium' | 'low';
}

function arrayValue<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function plainText(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function percentage(complete: number, total: number): number {
  return total > 0 ? Math.round((complete / total) * 1_000) / 10 : 0;
}

async function currentCatalogVersion() {
  return db.version.findFirst({
    where: { OR: [{ itemVersions: { some: {} } }, { perkVersions: { some: {} } }] },
    orderBy: { releaseDate: 'desc' },
    select: { id: true, name: true, releaseDate: true },
  });
}

export async function getCoachKnowledgeCoverage() {
  const version = await currentCatalogVersion();
  const [heroes, items, perks, eternalCategories, latestObservedMatch] = await Promise.all([
    db.heroMeta.findMany({ select: { abilities: true, baseStats: true, roles: true, classes: true, syncedAt: true } }),
    version ? db.gameItemVersion.findMany({
      where: { versionId: version.id, isHidden: false },
      select: { effects: true, stats: true, syncedAt: true },
    }) : Promise.resolve([]),
    version ? db.gamePerkVersion.findMany({
      where: { versionId: version.id },
      select: { description: true, slot: true, syncedAt: true },
    }) : Promise.resolve([]),
    version ? db.eternalCategoryVersion.findMany({
      where: { versionId: version.id },
      select: { description: true, syncedAt: true },
    }) : Promise.resolve([]),
    db.match.findFirst({ where: { versionId: { not: null } }, orderBy: { startTime: 'desc' }, select: { version: { select: { name: true } }, startTime: true } }),
  ]);

  const heroesWithAbilities = heroes.filter((hero) => arrayValue(hero.abilities).length > 0).length;
  const heroesWithStats = heroes.filter((hero) => hero.baseStats && typeof hero.baseStats === 'object').length;
  const itemsWithEffects = items.filter((item) => arrayValue(item.effects).length > 0).length;
  const itemsWithStats = items.filter((item) => arrayValue(item.stats).length > 0).length;
  const perksWithDescription = perks.filter((perk) => plainText(perk.description).length > 0).length;
  const gaps: string[] = [];
  if (!version) gaps.push('No existe un catálogo versionado de objetos y loadout.');
  if (version && latestObservedMatch?.version?.name && latestObservedMatch.version.name !== version.name) {
    gaps.push(`El catálogo está en ${version.name}, pero ya existen partidas de ${latestObservedMatch.version.name}. No deben emitirse recomendaciones específicas del parche sin actualizarlo.`);
  }
  if (heroesWithAbilities < heroes.length) gaps.push(`${heroes.length - heroesWithAbilities} héroes no tienen habilidades sincronizadas.`);
  if (heroesWithStats < heroes.length) gaps.push(`${heroes.length - heroesWithStats} héroes no tienen estadísticas base sincronizadas.`);
  if (itemsWithEffects < items.length) gaps.push(`${items.length - itemsWithEffects} objetos visibles no tienen efectos descriptivos; algunos pueden ser componentes sin pasiva.`);
  if (perksWithDescription < perks.length) gaps.push(`${perks.length - perksWithDescription} elementos de loadout no tienen descripción.`);
  if (LEARNING_QUESTIONS.length < 10) gaps.push('El banco de diagnóstico no alcanza diez situaciones revisadas.');

  const latestSync = [...heroes.map((row) => row.syncedAt), ...items.map((row) => row.syncedAt), ...perks.map((row) => row.syncedAt)]
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  return {
    status: gaps.length === 0 ? 'ready' as const : 'partial' as const,
    patch: version ? { id: version.id, name: version.name, releaseDate: version.releaseDate } : null,
    latestObservedMatchPatch: latestObservedMatch?.version?.name ?? null,
    lastKnowledgeSync: latestSync,
    domains: {
      concepts: { total: FUNDAMENTALS.length, complete: FUNDAMENTALS.length, percent: 100 },
      heroes: { total: heroes.length, complete: Math.min(heroesWithAbilities, heroesWithStats), abilities: heroesWithAbilities, stats: heroesWithStats, percent: percentage(Math.min(heroesWithAbilities, heroesWithStats), heroes.length) },
      items: { total: items.length, complete: itemsWithEffects, withStats: itemsWithStats, percent: percentage(itemsWithEffects, items.length) },
      loadout: { total: perks.length, complete: perksWithDescription, percent: percentage(perksWithDescription, perks.length) },
      eternalCategories: { total: eternalCategories.length, complete: eternalCategories.filter((row) => plainText(row.description).length > 0).length, percent: percentage(eternalCategories.filter((row) => plainText(row.description).length > 0).length, eternalCategories.length) },
      competencies: { total: COMPETENCIES.length, complete: COMPETENCIES.length, percent: 100 },
      questions: { total: LEARNING_QUESTIONS.length, complete: LEARNING_QUESTIONS.length, percent: 100 },
      missions: { total: MISSION_TEMPLATES.length, complete: MISSION_TEMPLATES.length, percent: 100 },
    },
    gaps,
    disclaimer: 'Cobertura significa que RiftLine posee datos descriptivos, no que todas las interacciones, matchups o excepciones estén validadas. El conocimiento dependiente del juego conserva su parche.',
  };
}

export async function searchCoachEncyclopedia(input: {
  query?: string;
  kind?: EncyclopediaKind;
  role?: string;
  limit?: number;
}): Promise<{ entries: EncyclopediaEntry[]; patch: string | null }> {
  const query = input.query?.trim() ?? '';
  const normalized = query.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const limit = Math.min(60, Math.max(1, input.limit ?? 30));
  const version = await currentCatalogVersion();
  const allow = (kind: EncyclopediaKind) => !input.kind || input.kind === kind;
  const entries: EncyclopediaEntry[] = [];

  if (allow('concept')) {
    for (const concept of FUNDAMENTALS.filter((entry) => {
      if (!normalized) return true;
      return [entry.key, entry.label, entry.value, ...entry.keywords]
        .some((value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(normalized));
    })) {
      if (input.role && concept.roles && !concept.roles.includes(input.role)) continue;
      entries.push({
        key: concept.key, kind: 'concept', title: concept.label, summary: concept.value,
        details: { keywords: concept.keywords }, competencyKey: fundamentalCompetency(concept.key),
        roles: concept.roles ?? [], patch: null, source: 'Currículo RiftLine revisado · fundamentos MOBA v1', confidence: 'high',
      });
    }
  }

  const heroWhere = query ? {
    OR: [
      { slug: { contains: query, mode: 'insensitive' as const } },
      { displayName: { contains: query, mode: 'insensitive' as const } },
    ],
  } : {};
  const [heroes, items, perks, categories] = await Promise.all([
    allow('hero') ? db.heroMeta.findMany({
      where: heroWhere,
      orderBy: { displayName: 'asc' },
      take: limit,
      select: { slug: true, displayName: true, roles: true, classes: true, abilities: true, baseStats: true, syncedAt: true },
    }) : Promise.resolve([]),
    allow('item') && version ? db.gameItemVersion.findMany({
      where: {
        versionId: version.id,
        isHidden: false,
        ...(query ? { OR: [
          { displayName: { contains: query, mode: 'insensitive' as const } },
          { item: { slug: { contains: query, mode: 'insensitive' as const } } },
          { item: { name: { contains: query, mode: 'insensitive' as const } } },
        ] } : {}),
      },
      orderBy: { displayName: 'asc' }, take: limit,
      select: { displayName: true, rarity: true, slotType: true, heroClass: true, aggressionType: true, totalPrice: true, stats: true, effects: true, item: { select: { slug: true } } },
    }) : Promise.resolve([]),
    allow('loadout') && version ? db.gamePerkVersion.findMany({
      where: {
        versionId: version.id,
        ...(query ? { OR: [
          { displayName: { contains: query, mode: 'insensitive' as const } },
          { description: { contains: query, mode: 'insensitive' as const } },
        ] } : {}),
      },
      orderBy: [{ slot: 'asc' }, { displayName: 'asc' }], take: limit,
      select: { predggDataId: true, displayName: true, slot: true, description: true, simpleDescription: true, aggressionTypes: true, heroSlug: true, eternalCategoryPredggId: true },
    }) : Promise.resolve([]),
    allow('eternal_category') && version ? db.eternalCategoryVersion.findMany({
      where: { versionId: version.id, ...(query ? { OR: [
        { displayName: { contains: query, mode: 'insensitive' as const } },
        { description: { contains: query, mode: 'insensitive' as const } },
      ] } : {}) },
      orderBy: { displayName: 'asc' }, take: limit,
      select: { predggDataId: true, displayName: true, description: true, color: true, perkPredggIds: true },
    }) : Promise.resolve([]),
  ]);

  for (const hero of heroes) {
    const roles = arrayValue<string>(hero.roles);
    if (input.role && !roles.some((role) => role.toUpperCase() === input.role)) continue;
    const abilities = arrayValue<Record<string, unknown>>(hero.abilities);
    entries.push({
      key: hero.slug, kind: 'hero', title: hero.displayName,
      summary: `${roles.join(', ') || 'Rol no especificado'} · ${abilities.length} habilidades sincronizadas`,
      details: { roles, classes: arrayValue(hero.classes), abilities, baseStats: hero.baseStats },
      competencyKey: 'champion_pool', roles, patch: null,
      source: 'Metadatos de héroes sincronizados por RiftLine', confidence: abilities.length > 0 ? 'high' : 'low',
    });
  }
  for (const item of items) {
    const effects = arrayValue<{ name?: string; text?: string }>(item.effects);
    entries.push({
      key: item.item.slug, kind: 'item', title: item.displayName,
      summary: `${item.totalPrice} de oro · ${effects.map((effect) => effect.name).filter(Boolean).join(', ') || 'sin pasiva descrita'}`,
      details: { rarity: item.rarity, slotType: item.slotType, heroClass: item.heroClass, aggressionType: item.aggressionType, totalPrice: item.totalPrice, stats: item.stats, effects },
      competencyKey: 'builds', roles: [], patch: version?.name ?? null,
      source: 'Catálogo versionado sincronizado por RiftLine', confidence: effects.length > 0 ? 'high' : 'medium',
    });
  }
  for (const perk of perks) {
    entries.push({
      key: perk.predggDataId, kind: 'loadout', title: perk.displayName,
      summary: plainText(perk.simpleDescription ?? perk.description),
      details: { slot: perk.slot, aggressionTypes: perk.aggressionTypes, heroSlug: perk.heroSlug, eternalCategoryPredggId: perk.eternalCategoryPredggId },
      competencyKey: 'builds', roles: [], patch: version?.name ?? null,
      source: 'Catálogo versionado sincronizado por RiftLine', confidence: plainText(perk.description).length > 0 ? 'high' : 'low',
    });
  }
  for (const category of categories) {
    entries.push({
      key: category.predggDataId, kind: 'eternal_category', title: category.displayName,
      summary: plainText(category.description), details: { color: category.color, perkPredggIds: category.perkPredggIds },
      competencyKey: 'builds', roles: [], patch: version?.name ?? null,
      source: 'Catálogo versionado sincronizado por RiftLine', confidence: plainText(category.description).length > 0 ? 'high' : 'low',
    });
  }

  return { entries: entries.slice(0, limit), patch: version?.name ?? null };
}
