import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { resyncMatch, syncPlayerByName } from '../services/sync-service.js';
import { logger } from '../logger.js';
import { getValidToken } from './auth.js';
import {
  getTeamProfile,
  listTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  addRosterPlayer,
  updateRosterEntry,
  removeRosterPlayer,
  getTeamAnalysis,
  getTeamPhaseAnalysis,
  getTeamVisionAnalysis,
  getTeamObjectiveAnalysis,
  getTeamDraftAnalysis,
} from '../services/team-service.js';

export const teamsRouter = Router();

const listQuerySchema = z.object({
  type: z.enum(['OWN', 'RIVAL']).optional(),
});

const logoUrlSchema = z.string().max(300000).refine(
  (val) => val.startsWith('data:image/') || /^https?:\/\/.+/.test(val),
  { message: 'Must be a valid URL or an image data URL (data:image/...)' }
);

const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  abbreviation: z.string().max(10).optional(),
  logoUrl: logoUrlSchema.optional(),
  type: z.enum(['OWN', 'RIVAL']),
  region: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  abbreviation: z.string().max(10).nullable().optional(),
  logoUrl: logoUrlSchema.nullable().optional(),
  region: z.string().max(100).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

const addRosterSchema = z.object({
  playerId: z.string().min(1),
  role: z.enum(['carry', 'jungle', 'midlane', 'offlane', 'support']).optional(),
});

const updateRosterSchema = z.object({
  role: z.enum(['carry', 'jungle', 'midlane', 'offlane', 'support']).nullable(),
});

teamsRouter.get('/', async (req, res, next) => {
  try {
    const { type } = listQuerySchema.parse(req.query);
    const teams = await listTeams(type);
    res.json({ teams });
  } catch (err) {
    next(err);
  }
});

teamsRouter.post('/', async (req, res, next) => {
  try {
    const data = createTeamSchema.parse(req.body);
    const team = await createTeam(data);
    res.status(201).json(team);
  } catch (err) {
    next(err);
  }
});

teamsRouter.get('/:id', async (req, res, next) => {
  try {
    const profile = await getTeamProfile(req.params.id);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

teamsRouter.get('/:id/analysis', async (req, res, next) => {
  try {
    const analysis = await getTeamAnalysis(req.params.id);
    res.json(analysis);
  } catch (err) {
    next(err);
  }
});

teamsRouter.patch('/:id', async (req, res, next) => {
  try {
    const data = updateTeamSchema.parse(req.body);
    const team = await updateTeam(req.params.id, data);
    res.json(team);
  } catch (err) {
    next(err);
  }
});

teamsRouter.delete('/:id', async (req, res, next) => {
  try {
    await deleteTeam(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

teamsRouter.post('/:id/roster', async (req, res, next) => {
  try {
    const { playerId, role } = addRosterSchema.parse(req.body);
    const entry = await addRosterPlayer(req.params.id, playerId, role);

    // Get token before sending response (needed for pred.gg auth)
    let userToken: string | null = null;
    try { userToken = await getValidToken(req, res); } catch { /* no session — sync without auth */ }

    res.status(201).json(entry);

    // Background sync — fire and forget, don't block the response
    db.player.findUnique({ where: { id: playerId }, select: { displayName: true } })
      .then((player) => {
        if (!player) return;
        return syncPlayerByName(db, player.displayName, userToken ?? undefined);
      })
      .catch((err) => logger.warn({ playerId, err }, 'background sync after roster add failed'));

  } catch (err) {
    next(err);
  }
});

teamsRouter.patch('/:id/roster/:rosterId', async (req, res, next) => {
  try {
    const { role } = updateRosterSchema.parse(req.body);
    const entry = await updateRosterEntry(req.params.id, req.params.rosterId, role);
    res.json(entry);
  } catch (err) {
    next(err);
  }
});

teamsRouter.delete('/:id/roster/:rosterId', async (req, res, next) => {
  try {
    await removeRosterPlayer(req.params.id, req.params.rosterId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /teams/:id/sync-matches
 * Syncs event stream for up to `limit` unsynced matches of roster players.
 * Requires Bearer token. Returns { synced, errors, remaining }.
 */
teamsRouter.post('/:id/sync-matches', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.body?.limit ?? 10), 20);
    const userToken = await getValidToken(req, res);

    // Get roster player IDs
    const roster = await db.teamRoster.findMany({
      where: { teamId: req.params.id, activeTo: null },
      select: { playerId: true },
    });
    const playerIds = roster.map((r) => r.playerId);
    if (playerIds.length === 0) { res.json({ synced: 0, errors: 0, remaining: 0 }); return; }

    // Find matches with players in this team that lack event stream
    const pending = await db.match.findMany({
      where: {
        eventStreamSynced: false,
        matchPlayers: { some: { playerId: { in: playerIds } } },
      },
      select: { id: true, predggUuid: true },
      orderBy: { startTime: 'desc' },
      take: limit,
    });

    const total = await db.match.count({
      where: {
        eventStreamSynced: false,
        matchPlayers: { some: { playerId: { in: playerIds } } },
      },
    });

    let synced = 0;
    let errors = 0;

    // Sync in groups of 3 concurrently
    for (let i = 0; i < pending.length; i += 3) {
      const chunk = pending.slice(i, i + 3);
      const results = await Promise.allSettled(
        chunk.map((m) => resyncMatch(db, m.predggUuid, userToken ?? undefined, true))
      );
      for (const r of results) {
        if (r.status === 'fulfilled') synced++;
        else errors++;
      }
    }

    res.json({ synced, errors, remaining: Math.max(0, total - synced) });
  } catch (err) {
    next(err);
  }
});

teamsRouter.get('/:id/phase-analysis', async (req, res, next) => {
  try {
    const data = await getTeamPhaseAnalysis(req.params.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

teamsRouter.get('/:id/vision-analysis', async (req, res, next) => {
  try {
    const data = await getTeamVisionAnalysis(req.params.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

teamsRouter.get('/:id/objective-analysis', async (req, res, next) => {
  try {
    const data = await getTeamObjectiveAnalysis(req.params.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

teamsRouter.get('/:id/draft-analysis', async (req, res, next) => {
  try {
    const data = await getTeamDraftAnalysis(req.params.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});
