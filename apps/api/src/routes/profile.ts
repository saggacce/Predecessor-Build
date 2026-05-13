import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { requireAuth } from '../middleware/require-auth.js';
import { getEffectiveAccess, getAccessSummary } from '../services/tier-access.js';

export const profileRouter = Router();
profileRouter.use(requireAuth);

const SAFE_USER_SELECT = {
  id: true, email: true, name: true, globalRole: true, isActive: true,
  createdAt: true, lastLoginAt: true,
  avatarUrl: true, bio: true, timezone: true,
  playerTier: true, playerTierExpiresAt: true,
  discordId: true, discordUsername: true,
  epicGamesId: true, epicGamesUsername: true,
  steamId: true, steamUsername: true,
  memberships: {
    select: {
      role: true,
      team: {
        select: {
          id: true, name: true, type: true,
          teamTier: true, teamTierExpiresAt: true,
        },
      },
    },
  },
};

// GET /profile — own profile
profileRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const user = await db.user.findUnique({ where: { id: userId }, select: SAFE_USER_SELECT });
    if (!user) { res.status(404).json({ error: { message: 'User not found' } }); return; }
    res.json({ user });
  } catch (err) { next(err); }
});

// PATCH /profile — update own profile fields
profileRouter.patch('/', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const body = z.object({
      name: z.string().min(2).max(60).optional(),
      bio: z.string().max(300).optional().nullable(),
      avatarUrl: z.string().url().max(500).optional().nullable(),
      timezone: z.string().max(60).optional().nullable(),
    }).parse(req.body);

    const user = await db.user.update({
      where: { id: userId },
      data: body,
      select: SAFE_USER_SELECT,
    });
    res.json({ user });
  } catch (err) { next(err); }
});

// PATCH /profile/email — change own email
profileRouter.patch('/email', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { email, currentPassword } = z.object({
      email: z.string().email().max(120),
      currentPassword: z.string().min(1),
    }).parse(req.body);

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) { res.status(404).json({ error: { message: 'User not found' } }); return; }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) { res.status(401).json({ error: { message: 'Contraseña incorrecta', code: 'WRONG_PASSWORD' } }); return; }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing && existing.id !== userId) {
      res.status(409).json({ error: { message: 'Email ya en uso', code: 'EMAIL_TAKEN' } }); return;
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: { email },
      select: SAFE_USER_SELECT,
    });
    res.json({ user: updated });
  } catch (err) { next(err); }
});

// PATCH /profile/password — change own password
profileRouter.patch('/password', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8).max(128),
    }).parse(req.body);

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) { res.status(404).json({ error: { message: 'User not found' } }); return; }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) { res.status(401).json({ error: { message: 'Contraseña actual incorrecta', code: 'WRONG_PASSWORD' } }); return; }

    const hash = await bcrypt.hash(newPassword, 12);
    await db.user.update({ where: { id: userId }, data: { passwordHash: hash } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /profile/social/:provider — disconnect a social account
profileRouter.delete('/social/:provider', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { provider } = z.object({
      provider: z.enum(['discord', 'epic', 'steam']),
    }).parse(req.params);

    const fieldMap: Record<string, object> = {
      discord: { discordId: null, discordUsername: null },
      epic: { epicGamesId: null, epicGamesUsername: null },
      steam: { steamId: null, steamUsername: null },
    };

    await db.user.update({ where: { id: userId }, data: fieldMap[provider] });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /profile/access — effective tier access for the authenticated user
profileRouter.get('/access', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        playerTier: true, playerTierExpiresAt: true,
        memberships: {
          select: {
            team: {
              select: { type: true, teamTier: true, teamTierExpiresAt: true },
            },
          },
        },
      },
    });
    if (!user) { res.status(404).json({ error: { message: 'User not found' } }); return; }
    const access = getEffectiveAccess(user);
    const features = getAccessSummary(access);
    res.json({ access, features });
  } catch (err) { next(err); }
});
