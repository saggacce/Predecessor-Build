import { PrismaClient } from '@prisma/client';
import { logger } from '../logger';

const OMEDA_HEROES_URL = 'https://omeda.city/heroes.json';
const OMEDA_BASE_URL = 'https://omeda.city';

// Slugs that pred.gg uses differently from omeda.city
const SLUG_ALIASES: Record<string, string> = {
  belica: 'lt-belica',
};

export function normalizeHeroSlug(slug: string): string {
  return SLUG_ALIASES[slug] ?? slug;
}

interface OmedaHero {
  slug: string;
  display_name: string;
  image: string | null;
  classes: string[];
  roles: string[];
  abilities: unknown[];
  base_stats: unknown;
}

export async function syncHeroMeta(db: PrismaClient): Promise<{ synced: number; errors: number }> {
  let synced = 0;
  let errors = 0;

  try {
    const res = await fetch(OMEDA_HEROES_URL);
    if (!res.ok) throw new Error(`omeda.city returned ${res.status}`);
    const heroes: OmedaHero[] = await res.json();

    for (const hero of heroes) {
      try {
        const imageUrl = hero.image ? `${OMEDA_BASE_URL}${hero.image}` : null;
        await db.heroMeta.upsert({
          where: { slug: hero.slug },
          create: {
            slug: hero.slug,
            displayName: hero.display_name,
            classes: hero.classes,
            roles: hero.roles,
            imageUrl,
            abilities: hero.abilities ?? [],
            baseStats: hero.base_stats ?? {},
          },
          update: {
            displayName: hero.display_name,
            classes: hero.classes,
            roles: hero.roles,
            imageUrl,
            abilities: hero.abilities ?? [],
            baseStats: hero.base_stats ?? {},
            syncedAt: new Date(),
          },
        });
        synced++;
      } catch (err) {
        logger.warn({ err, slug: hero.slug }, 'hero-meta: failed to upsert hero');
        errors++;
      }
    }

    logger.info({ synced, errors }, 'hero-meta: sync complete');
  } catch (err) {
    logger.error({ err }, 'hero-meta: sync failed');
    throw err;
  }

  return { synced, errors };
}

export async function getAllHeroMeta(db: PrismaClient) {
  return db.heroMeta.findMany({ orderBy: { displayName: 'asc' } });
}

export async function getHeroMetaBySlug(db: PrismaClient, slug: string) {
  const normalized = normalizeHeroSlug(slug);
  return db.heroMeta.findUnique({ where: { slug: normalized } });
}
