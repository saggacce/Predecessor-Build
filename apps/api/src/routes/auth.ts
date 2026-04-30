import { Router } from 'express';
import { createHash, randomBytes } from 'crypto';
import { logger } from '../logger.js';

const DEFAULT_AUTHORIZE_URL = 'https://pred.gg/oauth2/authorize';
const DEFAULT_SCOPES = 'offline_access profile player:read:interval hero_leaderboard:read matchup_statistic:read';

function resolveAuthorizeUrl(value: string | undefined): string {
  if (!value) {
    return DEFAULT_AUTHORIZE_URL;
  }

  if (value.includes('/api/oauth2/authorize')) {
    logger.warn({ configuredUrl: value }, 'ignoring direct OAuth API authorize URL; using pred.gg SPA authorize route');
    return DEFAULT_AUTHORIZE_URL;
  }

  return value;
}

function resolveScopes(value: string | undefined): string {
  const scopes = (value ?? DEFAULT_SCOPES)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return scopes.length > 0 ? scopes.join(' ') : DEFAULT_SCOPES;
}

const AUTHORIZE_URL = resolveAuthorizeUrl(process.env.PRED_GG_AUTHORIZE_URL);
const TOKEN_URLS = [
  process.env.PRED_GG_TOKEN_URL ?? 'https://pred.gg/api/oauth2/token',
  process.env.PRED_GG_TOKEN_URL_FALLBACK ?? 'https://pred.saibotu.de/api/oauth2/token',
].filter((url, index, urls) => url && urls.indexOf(url) === index);

const CLIENT_ID = process.env.PRED_GG_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.PRED_GG_CLIENT_SECRET;
const SEND_CLIENT_SECRET = process.env.PRED_GG_SEND_CLIENT_SECRET === 'true';
const CALLBACK_URL = process.env.PRED_GG_CALLBACK_URL ?? 'http://localhost:3001/auth/callback';
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

const SCOPES = resolveScopes(process.env.PRED_GG_OAUTH_SCOPES);

type ClientAuthMethod = 'none' | 'body' | 'basic';

function resolveClientAuthMethod(value: string | undefined): ClientAuthMethod {
  if (value === 'none' || value === 'public') return 'none';
  if (value === 'body' || value === 'client_secret_post') return 'body';
  if (value === 'basic' || value === 'client_secret_basic') return 'basic';

  if (value && value !== 'auto') {
    logger.warn({ configuredMethod: value }, 'unknown pred.gg token client auth method; using auto');
  }

  if (SEND_CLIENT_SECRET) return 'body';
  return CLIENT_SECRET ? 'basic' : 'none';
}

const CLIENT_AUTH_METHOD = resolveClientAuthMethod(process.env.PRED_GG_CLIENT_AUTH_METHOD);

export const COOKIE_TOKEN = 'predgg_token';
export const COOKIE_REFRESH = 'predgg_refresh';
const COOKIE_STATE = 'predgg_state';
const COOKIE_CODE_VERIFIER = 'predgg_code_verifier';
const COOKIE_OPTS = { httpOnly: true, sameSite: 'lax' as const };

export const authRouter = Router();

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
};

type TokenGrant =
  | { grant_type: 'authorization_code'; code: string; code_verifier: string }
  | { grant_type: 'refresh_token'; refresh_token: string };

type TokenAuthAttempt = {
  label: string;
  method: ClientAuthMethod;
  includeClientId: boolean;
  includeClientSecret: boolean;
  browserLikeHeaders: boolean;
};

function tokenAuthAttempts(): TokenAuthAttempt[] {
  if (CLIENT_AUTH_METHOD === 'none') {
    return [
      { label: 'public-browser', method: 'none', includeClientId: true, includeClientSecret: false, browserLikeHeaders: true },
      { label: 'public-server', method: 'none', includeClientId: true, includeClientSecret: false, browserLikeHeaders: false },
    ];
  }

  if (CLIENT_AUTH_METHOD === 'body') {
    return [
      { label: 'client-secret-post', method: 'body', includeClientId: true, includeClientSecret: true, browserLikeHeaders: false },
      { label: 'client-secret-post-browser', method: 'body', includeClientId: true, includeClientSecret: true, browserLikeHeaders: true },
    ];
  }

  return [
    { label: 'client-secret-basic', method: 'basic', includeClientId: false, includeClientSecret: false, browserLikeHeaders: false },
    { label: 'client-secret-basic-browser', method: 'basic', includeClientId: false, includeClientSecret: false, browserLikeHeaders: true },
    { label: 'client-secret-basic-with-id', method: 'basic', includeClientId: true, includeClientSecret: false, browserLikeHeaders: true },
    { label: 'public-browser', method: 'none', includeClientId: true, includeClientSecret: false, browserLikeHeaders: true },
    { label: 'client-secret-post', method: 'body', includeClientId: true, includeClientSecret: true, browserLikeHeaders: false },
  ];
}

function tokenRequestHeaders(attempt: TokenAuthAttempt): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (attempt.browserLikeHeaders) {
    headers.Origin = FRONTEND_URL;
    headers.Referer = `${FRONTEND_URL}/`;
  }

  if (attempt.method === 'basic') {
    if (CLIENT_SECRET) {
      headers.Authorization = `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`;
    } else {
      logger.warn('pred.gg token auth method is basic but PRED_GG_CLIENT_SECRET is not configured');
    }
  }

  return headers;
}

function tokenBody(params: TokenGrant, attempt: TokenAuthAttempt): URLSearchParams {
  const body = new URLSearchParams();
  body.set('grant_type', params.grant_type);

  if (params.grant_type === 'authorization_code') {
    body.set('redirect_uri', CALLBACK_URL);
    body.set('code', params.code);
    body.set('code_verifier', params.code_verifier);
  } else {
    body.set('refresh_token', params.refresh_token);
  }

  if (attempt.includeClientId) {
    body.set('client_id', CLIENT_ID);
  }
  if (attempt.includeClientSecret && CLIENT_SECRET) {
    body.set('client_secret', CLIENT_SECRET);
  }

  return body;
}

async function exchangeToken(params: TokenGrant): Promise<{
  ok: boolean;
  status: number;
  endpoint: string;
  attempt: string;
  data: TokenResponse;
}> {
  let lastResult: { ok: boolean; status: number; endpoint: string; attempt: string; data: TokenResponse } | undefined;

  for (const endpoint of TOKEN_URLS) {
    for (const attempt of tokenAuthAttempts()) {
      const body = tokenBody(params, attempt);
      const tokenRes = await fetch(endpoint, {
        method: 'POST',
        headers: tokenRequestHeaders(attempt),
        body: body.toString(),
      });
      const data = await tokenRes.json().catch(() => ({ error: 'invalid_token_response' })) as TokenResponse;
      lastResult = { ok: tokenRes.ok && !data.error, status: tokenRes.status, endpoint, attempt: attempt.label, data };
      logger.info({
        endpoint,
        status: tokenRes.status,
        error: data.error,
        clientAuthMethod: CLIENT_AUTH_METHOD,
        tokenAuthAttempt: attempt.label,
      }, 'token exchange attempt');

      if (lastResult.ok) return lastResult;
      if (data.error === 'invalid_grant') return lastResult;
    }
  }

  return lastResult ?? {
    ok: false,
    status: 500,
    endpoint: 'none',
    attempt: 'none',
    data: { error: 'token_endpoint_not_configured' },
  };
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
  if (!CLIENT_ID) {
    logger.error('PRED_GG_CLIENT_ID is not configured');
    res.redirect(`${FRONTEND_URL}/?auth_error=missing_client_id`);
    return;
  }

  const state = randomBytes(16).toString('hex');
  const pkce = createPkcePair();

  res.setHeader('X-Predgg-Auth-Flow', 'oauth2-pkce-v2');
  res.setHeader('X-Predgg-Token-Client-Auth', CLIENT_AUTH_METHOD);
  res.cookie(COOKIE_STATE, state, { ...COOKIE_OPTS, maxAge: 5 * 60 * 1000 });
  res.cookie(COOKIE_CODE_VERIFIER, pkce.verifier, { ...COOKIE_OPTS, maxAge: 5 * 60 * 1000 });

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', CALLBACK_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', pkce.challenge);
  url.searchParams.set('code_challenge_method', 'S256');

  logger.info({ authorizeUrl: AUTHORIZE_URL, scopes: SCOPES, pkce: true, clientAuthMethod: CLIENT_AUTH_METHOD }, 'initiating OAuth2 login');
  res.redirect(url.toString());
});

// ── Callback — exchange code for token ────────────────────────────────────────

authRouter.get('/callback', async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    logger.warn({ error }, 'OAuth callback returned error');
    res.clearCookie(COOKIE_STATE);
    res.clearCookie(COOKIE_CODE_VERIFIER);
    res.redirect(`${FRONTEND_URL}/?auth_error=${encodeURIComponent(error)}`);
    return;
  }

  const expectedState = (req as any).cookies?.[COOKIE_STATE];
  if (!expectedState || state !== expectedState) {
    logger.warn({ state, expectedState }, 'OAuth state mismatch — possible CSRF');
    res.clearCookie(COOKIE_STATE);
    res.clearCookie(COOKIE_CODE_VERIFIER);
    res.redirect(`${FRONTEND_URL}/?auth_error=state_mismatch`);
    return;
  }
  res.clearCookie(COOKIE_STATE);

  if (!code) {
    res.clearCookie(COOKIE_CODE_VERIFIER);
    res.redirect(`${FRONTEND_URL}/?auth_error=no_code`);
    return;
  }

  const codeVerifier = (req as any).cookies?.[COOKIE_CODE_VERIFIER];
  res.clearCookie(COOKIE_CODE_VERIFIER);
  if (!codeVerifier) {
    logger.warn('OAuth callback missing PKCE code verifier');
    res.redirect(`${FRONTEND_URL}/?auth_error=missing_code_verifier`);
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
      res.redirect(`${FRONTEND_URL}/?auth_error=${encodeURIComponent(tokenData.error ?? 'token_failed')}`);
      return;
    }

    const { access_token, refresh_token, expires_in, scope: grantedScope } = tokenData;
    const tokenMaxAge = (expires_in ?? 3600) * 1000;

    logger.info({ grantedScope, expires_in }, 'token exchange successful');

    res.cookie(COOKIE_TOKEN, access_token!, { ...COOKIE_OPTS, maxAge: tokenMaxAge });
    if (refresh_token) {
      res.cookie(COOKIE_REFRESH, refresh_token, { ...COOKIE_OPTS, maxAge: 30 * 24 * 60 * 60 * 1000 });
    }

    logger.info('OAuth2 login successful — redirecting to players');
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
    const tokenResult = await exchangeToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const tokenData = tokenResult.data;

    if (!tokenResult.ok) {
      res.clearCookie(COOKIE_TOKEN);
      res.clearCookie(COOKIE_REFRESH);
      res.status(401).json({ error: { message: 'Session expired — please log in again', code: 'SESSION_EXPIRED' } });
      return;
    }

    res.cookie(COOKIE_TOKEN, tokenData.access_token!, { ...COOKIE_OPTS, maxAge: (tokenData.expires_in ?? 3600) * 1000 });
    if (tokenData.refresh_token) {
      res.cookie(COOKIE_REFRESH, tokenData.refresh_token, { ...COOKIE_OPTS, maxAge: 30 * 24 * 60 * 60 * 1000 });
    }

    logger.info('token refreshed successfully');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
