import { Router } from 'express';
import { createHash, randomBytes } from 'crypto';
import { logger } from '../logger.js';
import { exchangeToken, predggOAuthConfig, type TokenResponse } from '../services/predgg-oauth.js';
import { getPlatformAccessToken, savePlatformOAuthTokens } from '../services/predgg-token-service.js';

export const COOKIE_TOKEN = 'predgg_token';
export const COOKIE_REFRESH = 'predgg_refresh';
export const COOKIE_EXPIRES_AT = 'predgg_expires_at'; // readable by JS (not httpOnly)
const COOKIE_STATE = 'predgg_state';
const COOKIE_CODE_VERIFIER = 'predgg_code_verifier';
const COOKIE_OPTS = { httpOnly: true, sameSite: 'lax' as const };
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const authRouter = Router();

// ── Cookie helpers ────────────────────────────────────────────────────────────

import type { Request, Response } from 'express';

function setTokenCookies(res: Response, data: TokenResponse) {
  const expiresIn = data.expires_in ?? 3600;
  const expiresAt = Date.now() + expiresIn * 1000;
  res.cookie(COOKIE_TOKEN, data.access_token!, { ...COOKIE_OPTS, maxAge: expiresIn * 1000 });
  // This is a browser marker and expiry hint, not a second copy of the rotating refresh token.
  res.cookie(COOKIE_EXPIRES_AT, String(expiresAt), { sameSite: 'lax', maxAge: REFRESH_TTL_MS });
  res.clearCookie(COOKIE_REFRESH);
}

/**
 * Returns a valid Bearer token for the current request.
 * If the access token is expired (or close to expiry), automatically refreshes
 * using the refresh token and sets new cookies — the user never re-logs in
 * as long as the refresh token is valid (30 days).
 */
export async function getValidToken(req: Request, res: Response): Promise<string | undefined> {
  const token = (req as any).cookies?.[COOKIE_TOKEN] as string | undefined;
  const expiresAt = parseInt((req as any).cookies?.[COOKIE_EXPIRES_AT] ?? '0', 10);

  // Token is still valid with >2 min buffer — use it directly
  if (token && expiresAt > Date.now() + 2 * 60 * 1000) {
    return token;
  }

  // No browser marker means this browser has not connected pred.gg (or explicitly logged out).
  if (!expiresAt) return token;

  logger.info('access token expired or missing — requesting server-owned platform token');
  const platformToken = await getPlatformAccessToken();

  if (platformToken) {
    const ttlSeconds = Math.max(1, Math.floor((platformToken.expiresAt - Date.now()) / 1000));
    setTokenCookies(res, { access_token: platformToken.accessToken, expires_in: ttlSeconds });
    logger.info('silent token refresh successful');
    return platformToken.accessToken;
  }

  logger.warn({ error: result.data.error }, 'silent refresh failed — user must re-login');
  // Clear stale cookies so /auth/me returns unauthenticated
  res.clearCookie(COOKIE_TOKEN);
  res.clearCookie(COOKIE_EXPIRES_AT);
  res.clearCookie(COOKIE_REFRESH);
  return undefined;
}

function base64Url(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = base64Url(randomBytes(64));
  const challenge = base64Url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

// ── Initiate login ────────────────────────────────────────────────────────────

authRouter.get('/predgg', (_req, res) => {
  if (!predggOAuthConfig.clientId) {
    logger.error('PRED_GG_CLIENT_ID is not configured');
    res.redirect(`${predggOAuthConfig.frontendUrl}/?auth_error=missing_client_id`);
    return;
  }

  const state = randomBytes(16).toString('hex');
  const pkce = createPkcePair();

  res.setHeader('X-Predgg-Auth-Flow', 'oauth2-pkce-v2');
  res.setHeader('X-Predgg-Token-Client-Auth', predggOAuthConfig.clientAuthMethod);
  res.cookie(COOKIE_STATE, state, { ...COOKIE_OPTS, maxAge: 5 * 60 * 1000 });
  res.cookie(COOKIE_CODE_VERIFIER, pkce.verifier, { ...COOKIE_OPTS, maxAge: 5 * 60 * 1000 });

  const url = new URL(predggOAuthConfig.authorizeUrl);
  url.searchParams.set('client_id', predggOAuthConfig.clientId);
  url.searchParams.set('redirect_uri', predggOAuthConfig.callbackUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', predggOAuthConfig.scopes);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', pkce.challenge);
  url.searchParams.set('code_challenge_method', 'S256');

  logger.info({
    authorizeUrl: predggOAuthConfig.authorizeUrl,
    scopes: predggOAuthConfig.scopes,
    pkce: true,
    clientAuthMethod: predggOAuthConfig.clientAuthMethod,
  }, 'initiating OAuth2 login');
  res.redirect(url.toString());
});

// ── Callback — exchange code for token ────────────────────────────────────────

authRouter.get('/callback', async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    logger.warn({ error }, 'OAuth callback returned error');
    res.clearCookie(COOKIE_STATE);
    res.clearCookie(COOKIE_CODE_VERIFIER);
    res.redirect(`${predggOAuthConfig.frontendUrl}/?auth_error=${encodeURIComponent(error)}`);
    return;
  }

  const expectedState = (req as any).cookies?.[COOKIE_STATE];
  if (!expectedState || state !== expectedState) {
    logger.warn({ state, expectedState }, 'OAuth state mismatch — possible CSRF');
    res.clearCookie(COOKIE_STATE);
    res.clearCookie(COOKIE_CODE_VERIFIER);
    res.redirect(`${predggOAuthConfig.frontendUrl}/?auth_error=state_mismatch`);
    return;
  }
  res.clearCookie(COOKIE_STATE);

  if (!code) {
    res.clearCookie(COOKIE_CODE_VERIFIER);
    res.redirect(`${predggOAuthConfig.frontendUrl}/?auth_error=no_code`);
    return;
  }

  const codeVerifier = (req as any).cookies?.[COOKIE_CODE_VERIFIER];
  res.clearCookie(COOKIE_CODE_VERIFIER);
  if (!codeVerifier) {
    logger.warn('OAuth callback missing PKCE code verifier');
    res.redirect(`${predggOAuthConfig.frontendUrl}/?auth_error=missing_code_verifier`);
    return;
  }

  try {
    logger.info({ code: code.slice(0, 8) + '...' }, 'exchanging authorization code');

    const tokenResult = await exchangeToken({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
    });

    const tokenData = tokenResult.data;

    if (!tokenResult.ok) {
      logger.error({ endpoint: tokenResult.endpoint, attempt: tokenResult.attempt, status: tokenResult.status, tokenData }, 'token exchange failed');
      res.redirect(`${predggOAuthConfig.frontendUrl}/?auth_error=${encodeURIComponent(tokenData.error ?? 'token_failed')}`);
      return;
    }

    logger.info({ grantedScope: tokenData.scope, expires_in: tokenData.expires_in }, 'token exchange successful');
    // Durability comes before browser success: never advertise a connected
    // account if the server failed to persist the rotating credentials.
    await savePlatformOAuthTokens(tokenData);
    setTokenCookies(res, tokenData);
    logger.info('OAuth callback: platform credential updated, token state set to ok');

    logger.info('OAuth2 login successful — redirecting to players');
    res.redirect(`${predggOAuthConfig.frontendUrl}/players`);
  } catch (err) {
    logger.error({ err }, 'token exchange threw error');
    res.clearCookie(COOKIE_TOKEN);
    res.clearCookie(COOKIE_EXPIRES_AT);
    res.clearCookie(COOKIE_REFRESH);
    res.redirect(`${predggOAuthConfig.frontendUrl}/?auth_error=server_error`);
  }
});

// ── Auth status ───────────────────────────────────────────────────────────────

authRouter.get('/me', async (req, res) => {
  // getValidToken silently refreshes if the access token is expired
  const token = await getValidToken(req, res);
  res.json({ authenticated: !!token });
});

// ── Logout ────────────────────────────────────────────────────────────────────

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_TOKEN);
  res.clearCookie(COOKIE_REFRESH);
  res.clearCookie(COOKIE_EXPIRES_AT);
  logger.info('user logged out');
  res.json({ ok: true });
});

// ── Token refresh ─────────────────────────────────────────────────────────────

authRouter.post('/refresh', async (req, res, next) => {
  const browserMarker = (req as any).cookies?.[COOKIE_EXPIRES_AT];
  if (!browserMarker) {
    res.status(401).json({ error: { message: 'Not authenticated', code: 'NOT_AUTHENTICATED' } });
    return;
  }

  try {
    const platformToken = await getPlatformAccessToken();
    if (!platformToken) {
      res.clearCookie(COOKIE_TOKEN);
      res.clearCookie(COOKIE_EXPIRES_AT);
      res.clearCookie(COOKIE_REFRESH);
      res.status(401).json({ error: { message: 'Session expired — please log in again', code: 'SESSION_EXPIRED' } });
      return;
    }

    const ttlSeconds = Math.max(1, Math.floor((platformToken.expiresAt - Date.now()) / 1000));
    setTokenCookies(res, { access_token: platformToken.accessToken, expires_in: ttlSeconds });

    logger.info('token refreshed successfully');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
