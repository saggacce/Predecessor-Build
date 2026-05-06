import { useState, useEffect } from 'react';
import { apiClient, type HeroMeta } from '../api/client';

let globalCache: Map<string, HeroMeta> | null = null;

export function useHeroMeta(): Map<string, HeroMeta> {
  const [meta, setMeta] = useState<Map<string, HeroMeta>>(globalCache ?? new Map());

  useEffect(() => {
    if (globalCache) return;
    void apiClient.heroes.meta().then(({ heroes }) => {
      const map = new Map(heroes.map((h) => [h.slug, h]));
      globalCache = map;
      setMeta(map);
    });
  }, []);

  return meta;
}
