import { Router } from 'express';
import { getMatchDetail, getMatchEvents } from '../services/match-service.js';
import { resyncMatch } from '../services/sync-service.js';
import { getValidToken } from './auth.js';
import { db } from '../db.js';
import { AppError } from '../middleware/error-handler.js';
import { requireAuth } from '../middleware/require-auth.js';
import { logger } from '../logger.js';

export const matchesRouter = Router();

const GQL_URL = process.env.PRED_GG_GQL_URL ?? 'https://pred.gg/gql';
const API_KEY = process.env.PRED_GG_CLIENT_SECRET;

async function predggLiveQuery<T>(query: string, variables: Record<string, unknown>, userToken?: string | null): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (userToken) headers['Authorization'] = `Bearer ${userToken}`;
  else if (API_KEY) headers['X-Api-Key'] = API_KEY;
  const res = await fetch(GQL_URL, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
  if (!res.ok) throw new AppError(502, `pred.gg ${res.status}`, 'PREDGG_ERROR');
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new AppError(502, json.errors.map((e) => e.message).join(', '), 'PREDGG_ERROR');
  if (!json.data) throw new AppError(404, 'Match not found on pred.gg', 'MATCH_NOT_FOUND');
  return json.data as T;
}

const LIVE_MATCH_QUERY = `
  query GetMatchLive($uuid: String!) {
    match(by: { id: $uuid }) {
      id
      uuid
      startTime
      duration
      gameMode
      region
      winningTeam
      version { name }
      matchPlayers {
        player { id name }
        team
        role
        kills
        deaths
        assists
        gold
        goldSpent
        heroDamage
        heroDamageTaken
        totalDamageDealt
        physicalDamageDealtToHeroes
        magicalDamageDealtToHeroes
        trueDamageDealtToHeroes
        totalDamageTaken
        totalHealingDone
        totalDamageDealtToStructures
        totalDamageDealtToObjectives
        laneMinionsKilled
        wardsPlaced
        wardsDestroyed
        level
        largestCriticalStrike
        largestKillingSpree
        multiKill
        goldEarnedAtInterval
        hero {
          slug
          data { displayName icon promoIcon defaultSkin { icon portrait smallPortrait } }
        }
        inventoryItemData { item { slug } }
        wardPlacements { gameTime type location { x y z } }
        wardDestructions { gameTime type location { x y z } }
        transactions { gameTime transactionType itemData { name } }
      }
      heroKills {
        gameTime
        killerTeam
        killedTeam
        killerHero { slug }
        killedHero { slug }
        killerPlayer { id }
        killedPlayer { id }
        location { x y z }
      }
      objectiveKills {
        gameTime
        killedEntityType
        killerTeam
        killerPlayer { id }
        location { x y z }
      }
      structureDestructions {
        gameTime
        structureEntityType
        destructionTeam
        location { x y z }
      }
    }
  }
`;

type LiveMatchPlayer = {
  player?: { id?: string; name?: string } | null;
  team?: string | null;
  role?: string | null;
  kills?: number; deaths?: number; assists?: number;
  gold?: number; goldSpent?: number;
  heroDamage?: number; heroDamageTaken?: number;
  totalDamageDealt?: number;
  physicalDamageDealtToHeroes?: number; magicalDamageDealtToHeroes?: number; trueDamageDealtToHeroes?: number;
  totalDamageTaken?: number; totalHealingDone?: number;
  totalDamageDealtToStructures?: number; totalDamageDealtToObjectives?: number;
  laneMinionsKilled?: number; wardsPlaced?: number; wardsDestroyed?: number;
  level?: number; largestCriticalStrike?: number; largestKillingSpree?: number; multiKill?: number;
  goldEarnedAtInterval?: number[] | null;
  hero?: { slug?: string; data?: { displayName?: string; icon?: string; promoIcon?: string; defaultSkin?: { icon?: string; portrait?: string; smallPortrait?: string } | null } | null } | null;
  inventoryItemData?: Array<{ item?: { slug?: string } | null } | null> | null;
  wardPlacements?: Array<{ gameTime: number; type?: string | null; location?: { x?: number; y?: number } | null }> | null;
  wardDestructions?: Array<{ gameTime: number; type?: string | null; location?: { x?: number; y?: number } | null }> | null;
  transactions?: Array<{ gameTime: number; transactionType?: string | null; itemData?: { name?: string | null } | null }> | null;
};

type LiveMatchData = {
  match?: {
    id?: string; uuid?: string; startTime?: string; duration?: number; gameMode?: string;
    region?: string | null; winningTeam?: string | null; version?: { name?: string } | null;
    matchPlayers?: LiveMatchPlayer[];
    heroKills?: Array<{ gameTime: number; killerTeam?: string | null; killedTeam?: string | null; killerHero?: { slug?: string } | null; killedHero?: { slug?: string } | null; killerPlayer?: { id?: string } | null; killedPlayer?: { id?: string } | null; location?: { x?: number; y?: number } | null }>;
    objectiveKills?: Array<{ gameTime: number; killedEntityType?: string | null; killerTeam?: string | null; killerPlayer?: { id?: string } | null; location?: { x?: number; y?: number } | null }>;
    structureDestructions?: Array<{ gameTime: number; structureEntityType?: string | null; destructionTeam?: string | null; location?: { x?: number; y?: number } | null }>;
  } | null;
};

function pickHeroImage(data?: { displayName?: string; icon?: string; promoIcon?: string; defaultSkin?: { icon?: string; portrait?: string; smallPortrait?: string } | null } | null): string | null {
  if (!data) return null;
  return data.defaultSkin?.smallPortrait ?? data.defaultSkin?.portrait ?? data.defaultSkin?.icon ?? data.promoIcon ?? data.icon ?? null;
}

function safeN(v: unknown): number { return typeof v === 'number' && isFinite(v) ? v : 0; }

export function buildLiveDetail(raw: LiveMatchData) {
  const m = raw.match;
  if (!m) throw new AppError(404, 'Match not found on pred.gg', 'MATCH_NOT_FOUND');

  const players = (m.matchPlayers ?? []).map((mp) => {
    const predggId = mp.player?.id ?? null;
    const heroSlug = mp.hero?.slug ?? 'unknown';
    const heroName = mp.hero?.data?.displayName ?? heroSlug;
    const heroImageUrl = pickHeroImage(mp.hero?.data);
    const inventoryItems = (mp.inventoryItemData ?? [])
      .map((d) => d?.item?.slug)
      .filter((s): s is string => typeof s === 'string' && s.length > 0);

    return {
      id: predggId ?? `anon-${Math.random().toString(36).slice(2)}`,
      playerId: predggId,
      predggPlayerUuid: predggId,
      playerName: mp.player?.name ?? 'HIDDEN',
      customName: null as null,
      team: mp.team ?? 'DUSK',
      role: mp.role ?? null,
      heroSlug,
      heroName,
      heroImageUrl,
      isConsole: false,
      kills: safeN(mp.kills),
      deaths: safeN(mp.deaths),
      assists: safeN(mp.assists),
      heroDamage: mp.heroDamage ?? null,
      totalDamage: mp.totalDamageDealt ?? null,
      gold: mp.gold ?? null,
      wardsPlaced: mp.wardsPlaced ?? null,
      wardsDestroyed: mp.wardsDestroyed ?? null,
      level: mp.level ?? null,
      inventoryItems,
      perkSlug: null as null,
      perks: null as null,
      rankLabel: null as null,
      ratingPoints: null as null,
      physicalDamageDealtToHeroes: mp.physicalDamageDealtToHeroes ?? null,
      magicalDamageDealtToHeroes: mp.magicalDamageDealtToHeroes ?? null,
      trueDamageDealtToHeroes: mp.trueDamageDealtToHeroes ?? null,
      heroDamageTaken: mp.heroDamageTaken ?? null,
      totalDamageTaken: mp.totalDamageTaken ?? null,
      totalHealingDone: mp.totalHealingDone ?? null,
      totalDamageDealtToStructures: mp.totalDamageDealtToStructures ?? null,
      totalDamageDealtToObjectives: mp.totalDamageDealtToObjectives ?? null,
      largestCriticalStrike: mp.largestCriticalStrike ?? null,
      laneMinionsKilled: mp.laneMinionsKilled ?? null,
      goldSpent: mp.goldSpent ?? null,
      largestKillingSpree: mp.largestKillingSpree ?? null,
      multiKill: mp.multiKill ?? null,
      physicalDamageDealt: null as null,
      magicalDamageDealt: null as null,
      trueDamageDealt: null as null,
      goldEarnedAtInterval: mp.goldEarnedAtInterval ?? null,
      // Keep ward/tx data for event stream construction
      _wardPlacements: mp.wardPlacements ?? [],
      _wardDestructions: mp.wardDestructions ?? [],
      _transactions: mp.transactions ?? [],
    };
  });

  const dusk = players.filter((p) => p.team === 'DUSK').sort((a, b) => b.kills - a.kills);
  const dawn = players.filter((p) => p.team !== 'DUSK').sort((a, b) => b.kills - a.kills);

  const detail = {
    id: m.uuid ?? m.id ?? '',
    predggUuid: m.uuid ?? m.id ?? '',
    startTime: m.startTime ?? new Date().toISOString(),
    duration: m.duration ?? 0,
    gameMode: m.gameMode ?? 'UNKNOWN',
    region: typeof m.region === 'string' ? m.region : null,
    winningTeam: m.winningTeam ?? null,
    version: m.version?.name ?? null,
    rosterSynced: true,
    eventStreamSynced: true,
    dusk: dusk.map(({ _wardPlacements: _w, _wardDestructions: _d, _transactions: _t, ...rest }) => rest),
    dawn: dawn.map(({ _wardPlacements: _w, _wardDestructions: _d, _transactions: _t, ...rest }) => rest),
  };

  // Build event stream
  const wardEvents = players.flatMap((mp) => [
    ...(mp._wardPlacements ?? []).map((w) => ({
      gameTime: w.gameTime,
      eventType: 'PLACEMENT',
      wardType: w.type ?? 'STEALTH',
      team: mp.team,
      locationX: w.location?.x ?? null,
      locationY: w.location?.y ?? null,
    })),
    ...(mp._wardDestructions ?? []).map((w) => ({
      gameTime: w.gameTime,
      eventType: 'DESTRUCTION',
      wardType: w.type ?? 'STEALTH',
      team: mp.team,
      locationX: w.location?.x ?? null,
      locationY: w.location?.y ?? null,
    })),
  ]).sort((a, b) => a.gameTime - b.gameTime);

  const transactions = players.flatMap((mp) =>
    (mp._transactions ?? [])
      .filter((t) => t.transactionType === 'BUY' || t.transactionType === 'SELL')
      .map((t) => ({
        gameTime: t.gameTime,
        transactionType: t.transactionType ?? 'BUY',
        itemName: t.itemData?.name ?? null,
        team: mp.team,
        playerId: mp.playerId,
      }))
  ).sort((a, b) => a.gameTime - b.gameTime);

  const events = {
    heroKills: (m.heroKills ?? []).map((k) => ({
      gameTime: k.gameTime,
      killerTeam: k.killerTeam ?? null,
      killedTeam: k.killedTeam ?? null,
      killerHeroSlug: k.killerHero?.slug ?? null,
      killedHeroSlug: k.killedHero?.slug ?? null,
      killerPlayerId: k.killerPlayer?.id ?? null,
      killedPlayerId: k.killedPlayer?.id ?? null,
      locationX: k.location?.x ?? null,
      locationY: k.location?.y ?? null,
    })),
    objectiveKills: (m.objectiveKills ?? []).map((o) => ({
      gameTime: o.gameTime,
      entityType: o.killedEntityType ?? 'UNKNOWN',
      killerTeam: o.killerTeam ?? null,
      killerPlayerId: o.killerPlayer?.id ?? null,
      locationX: o.location?.x ?? null,
      locationY: o.location?.y ?? null,
    })),
    structureDestructions: (m.structureDestructions ?? []).map((s) => ({
      gameTime: s.gameTime,
      structureType: s.structureEntityType ?? 'UNKNOWN',
      destructionTeam: s.destructionTeam ?? null,
      locationX: s.location?.x ?? null,
      locationY: s.location?.y ?? null,
    })),
    wardEvents,
    transactions,
  };

  return { detail, events };
}

/**
 * GET /matches/:id
 * Full match detail: both teams, per-player stats, hero meta.
 */
matchesRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const detail = await getMatchDetail(req.params.id);
    res.json(detail);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /matches/:id/events
 * Returns all stored event stream data for a match (kills, objectives, structures, wards, transactions).
 */
matchesRouter.get('/:id/events', async (req, res, next) => {
  try {
    const events = await getMatchEvents(req.params.id);
    res.json(events);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /matches/live/:predggUuid
 * Fetches match scoreboard + event stream directly from pred.gg.
 * No DB read or write — data is ephemeral (returned to client only).
 */
matchesRouter.get('/live/:predggUuid', requireAuth, async (req, res, next) => {
  try {
    const { predggUuid } = req.params;
    const userToken = await getValidToken(req, res);
    logger.info({ predggUuid }, 'live match fetch');

    const raw = await predggLiveQuery<LiveMatchData>(
      LIVE_MATCH_QUERY,
      { uuid: predggUuid },
      userToken,
    );
    const result = buildLiveDetail(raw);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /matches/:id/sync
 * Re-fetches this match from pred.gg using the user's Bearer token.
 * Reveals player names that appear as HIDDEN without auth.
 */
matchesRouter.post('/:id/sync', async (req, res, next) => {
  try {
    const match = await db.match.findUnique({ where: { id: req.params.id } });
    if (!match) throw new AppError(404, 'Match not found', 'MATCH_NOT_FOUND');
    const userToken = await getValidToken(req, res);
    // Force full re-sync when user explicitly requests it
    await resyncMatch(db, match.predggUuid, userToken ?? undefined, true);
    // Also force event stream re-sync to get goldEarnedAtInterval and latest events
    if (userToken) {
      await (await import('../services/sync-service.js')).syncMatchEventStream(
        db, match.id, match.predggUuid, userToken, true
      );
    }
    const detail = await getMatchDetail(req.params.id);
    res.json(detail);
  } catch (err) {
    next(err);
  }
});
