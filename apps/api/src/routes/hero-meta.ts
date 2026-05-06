import { Router } from 'express';

export const heroMetaRouter = Router();

const GQL_URL = process.env.PRED_GG_GQL_URL ?? 'https://pred.gg/gql';
const API_KEY = process.env.PRED_GG_CLIENT_SECRET;

const QUERY = `{ heroes { slug data { displayName classes roles icon } } }`;

let cache: { data: HeroMeta[]; ts: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface HeroMeta {
  slug: string;
  displayName: string;
  classes: string[];
  roles: string[];
  icon: string | null;
}

heroMetaRouter.get('/', async (_req, res, next) => {
  try {
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      res.json({ heroes: cache.data });
      return;
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (API_KEY) headers['X-Api-Key'] = API_KEY;

    const r = await fetch(GQL_URL, { method: 'POST', headers, body: JSON.stringify({ query: QUERY }) });
    const json = (await r.json()) as { data?: { heroes: Array<{ slug: string; data: { displayName: string; classes: string[]; roles: string[]; icon: string } }> } };

    const heroes: HeroMeta[] = (json.data?.heroes ?? []).map((h) => ({
      slug: h.slug,
      displayName: h.data.displayName,
      classes: h.data.classes ?? [],
      roles: h.data.roles ?? [],
      icon: h.data.icon ?? null,
    }));

    cache = { data: heroes, ts: Date.now() };
    res.json({ heroes });
  } catch (err) {
    next(err);
  }
});
