import { Router } from 'express';
import { randomBytes } from 'crypto';
import { logger } from '../logger.js';

const TOKEN_URL = 'https://pred.gg/api/oauth2/token';
const AUTHORIZE_URL = 'https://pred.gg/authorize';
const CLIENT_ID = process.env.PRED_GG_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.PRED_GG_CLIENT_SECRET; // public client — may not be needed
const CALLBACK_URL = process.env.PRED_GG_CALLBACK_URL ?? 'http://localhost:3001/auth/callback';
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

// Scopes needed for scouting
const SCOPES = [
  'offline_access',
  'profile',
  'player:read:interval',
  'hero_leaderboard:read',
  'matchup_statistic:read',
].join(' ');

export const COOKIE_TOKEN = 'predgg_token';
export const COOKIE_REFRESH = 'predgg_refresh';
const COOKIE_STATE = 'predgg_state';
const COOKIE_OPTS = { httpOnly: true, sameSite: 'lax' as const };

export const authRouter = Router();

// ── Initiate login ────────────────────────────────────────────────────────────

authRouter.get('/predgg', (_req, res) => {
  const state = randomBytes(16).toString('hex');

  res.cookie(COOKIE_STATE, state, { ...COOKIE_OPTS, maxAge: 5 * 60 * 1000 });

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', CALLBACK_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('state', state);

  logger.info({ url: url.toString() }, 'initiating pred.gg OAuth2 login');
  res.redirect(url.toString());
});

// ── Callback — exchange code for token ────────────────────────────────────────

authRouter.get('/callback', async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    logger.warn({ error }, 'OAuth callback returned error');
    res.redirect(`${FRONTEND_URL}/?auth_error=${encodeURIComponent(error)}`);
    return;
  }

  // CSRF protection
  const expectedState = (req as any).cookies?.[COOKIE_STATE];
  if (!expectedState || state !== expectedState) {
    logger.warn({ state, expectedState }, 'OAuth state mismatch — possible CSRF');
    res.redirect(`${FRONTEND_URL}/?auth_error=state_mismatch`);
    return;
  }
  res.clearCookie(COOKIE_STATE);

  if (!code) {
    res.redirect(`${FRONTEND_URL}/?auth_error=no_code`);
    return;
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      redirect_uri: CALLBACK_URL,
      code,
    });
    // Only add secret if the app is configured as confidential
    if (CLIENT_SECRET) body.set('client_secret', CLIENT_SECRET);

    logger.info({ code: code.slice(0, 8) + '...' }, 'exchanging authorization code');

    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      token_type?: string;
      error?: string;
    };

    if (!tokenRes.ok || tokenData.error) {
      logger.error({ status: tokenRes.status, tokenData }, 'token exchange failed');
      res.redirect(`${FRONTEND_URL}/?auth_error=${encodeURIComponent(tokenData.error ?? 'token_failed')}`);
      return;
    }

    const { access_token, refresh_token, expires_in } = tokenData;
    const tokenMaxAge = (expires_in ?? 3600) * 1000;

    res.cookie(COOKIE_TOKEN, access_token!, { ...COOKIE_OPTS, maxAge: tokenMaxAge });

    if (refresh_token) {
      res.cookie(COOKIE_REFRESH, refresh_token, {
        ...COOKIE_OPTS,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
    }

    logger.info('pred.gg OAuth2 login successful');
    res.redirect(`${FRONTEND_URL}/players`);
  } catch (err) {
    logger.error({ err }, 'token exchange threw error');
    res.redirect(`${FRONTEND_URL}/?auth_error=server_error`);
  }
});

// ── Auth status ───────────────────────────────────────────────────────────────

authRouter.get('/me', (req, res) => {
  const token = (req as any).cookies?.[COOKIE_TOKEN];
  res.json({ authenticated: !!token });
});

// ── Logout ────────────────────────────────────────────────────────────────────

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_TOKEN);
  res.clearCookie(COOKIE_REFRESH);
  logger.info('user logged out');
  res.json({ ok: true });
});

// ── Token refresh ─────────────────────────────────────────────────────────────

authRouter.post('/refresh', async (req, res, next) => {
  const refreshToken = (req as any).cookies?.[COOKIE_REFRESH];
  if (!refreshToken) {
    res.status(401).json({ error: { message: 'Not authenticated', code: 'NOT_AUTHENTICATED' } });
    return;
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    });

    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };

    if (!tokenRes.ok || tokenData.error) {
      res.clearCookie(COOKIE_TOKEN);
      res.clearCookie(COOKIE_REFRESH);
      res.status(401).json({ error: { message: 'Session expired — please log in again', code: 'SESSION_EXPIRED' } });
      return;
    }

    const { access_token, refresh_token: newRefresh, expires_in } = tokenData;
    res.cookie(COOKIE_TOKEN, access_token!, { ...COOKIE_OPTS, maxAge: (expires_in ?? 3600) * 1000 });
    if (newRefresh) {
      res.cookie(COOKIE_REFRESH, newRefresh, { ...COOKIE_OPTS, maxAge: 30 * 24 * 60 * 60 * 1000 });
    }

    logger.info('token refreshed successfully');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
