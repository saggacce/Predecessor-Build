import { Router } from 'express';
import { getTeamProfile, listTeams } from '../services/team-service.js';

export const teamsRouter = Router();

/**
 * GET /teams
 * List all teams. Optional query param: ?type=OWN|RIVAL
 */
teamsRouter.get('/', async (req, res, next) => {
  try {
    const type = req.query.type as 'OWN' | 'RIVAL' | undefined;
    const teams = await listTeams(type);
    res.json({ teams });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /teams/:id
 * Get team profile with active roster and aggregate stats.
 */
teamsRouter.get('/:id', async (req, res, next) => {
  try {
    const profile = await getTeamProfile(req.params.id);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});
