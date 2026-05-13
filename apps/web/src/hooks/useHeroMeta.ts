import { useState, useEffect } from 'react';
import { apiClient, type HeroMeta } from '../api/client';

// Slugs that pred.gg uses differently from omeda.city
const SLUG_ALIASES: Record<string, string> = {
  belica: 'lt-belica',
};

let globalCache: Map<string, HeroMeta> | null = null;

export function normalizeHeroSlug(slug: string): string {
  return SLUG_ALIASES[slug] ?? slug;
}

export function useHeroMeta(): Map<string, HeroMeta> {
  const [meta, setMeta] = useState<Map<string, HeroMeta>>(globalCache ?? new Map());

  useEffect(() => {
    if (globalCache) return;
    void apiClient.heroes.meta().then(({ heroes }) => {
      const map = new Map<string, HeroMeta>();
      for (const h of heroes) {
        map.set(h.slug, h);
        // Add reverse alias so aliased slugs resolve too
        for (const [alias, canonical] of Object.entries(SLUG_ALIASES)) {
          if (canonical === h.slug) map.set(alias, h);
        }
      }
      globalCache = map;
      setMeta(map);
    });
  }, []);

  return meta;
}
