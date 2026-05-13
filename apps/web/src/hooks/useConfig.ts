import { useState, useEffect } from 'react';
import { apiClient, type PlatformConfigEntry } from '../api/client';

let globalCache: Map<string, number> | null = null;

export function useConfig(): Map<string, number> {
  const [config, setConfig] = useState<Map<string, number>>(globalCache ?? new Map());

  useEffect(() => {
    if (globalCache) return;
    void apiClient.admin.getConfig().then(({ config: entries }) => {
      const map = new Map(entries.map((e) => [e.key, e.value]));
      globalCache = map;
      setConfig(map);
    }).catch(() => {
      // Non-admin users won't have access — use empty map (defaults apply)
    });
  }, []);

  return config;
}

export function invalidateConfigCache() {
  globalCache = null;
}

export type { PlatformConfigEntry };
