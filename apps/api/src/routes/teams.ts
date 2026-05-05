import { Router } from 'express';
import { z } from 'zod';
import {
  getTeamProfile,
  listTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  addRosterPlayer,
  updateRosterEntry,
  removeRosterPlayer,
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
    res.status(201).json(entry);
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
