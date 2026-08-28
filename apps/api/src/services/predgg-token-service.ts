import type { Prisma } from '@prisma/client';
import { db } from '../db.js';
import { logger } from '../logger.js';
import { exchangeToken, predggOAuthConfig, type TokenResponse } from './predgg-oauth.js';

const REFRESH_TOKEN_KEY = 'predgg_refresh_token';
const ACCESS_TOKEN_KEY = 'predgg_access_token';
const ACCESS_EXPIRES_AT_KEY = 'predgg_access_expires_at';
const GRANTED_SCOPES_KEY = 'predgg_granted_scopes';
const ACCESS_TOKEN_BUFFER_MS = 10 * 60 * 1000;
const DEFAULT_ACCESS_TTL_SECONDS = 3600;
const ADVISORY_LOCK_KEY = 1_947_420_126;

export type PlatformTokenStatus = 'ok' | 'expired' | 'missing' | 'unknown';

export const platformTokenState: {
  status: PlatformTokenStatus;
  lastCheckedAt: string | null;
  lastError: string | null;
} = { status: 'unknown', lastCheckedAt: null, lastError: null };

export type PlatformAccessToken = {
  accessToken: string;
  expiresAt: number;
};

export type PredggOAuthCapability =
  | 'profile'
  | 'offlineRefresh'
  | 'playerIntervals'
  | 'heroLeaderboard'
  | 'matchupStatistics';

export interface PredggOAuthStatus {
  requestedScopes: string[];
  grantedScopes: string[];
  missingScopes: string[];
  capabilities: Record<PredggOAuthCapability, boolean>;
  checkedAt: string | null;
  error: string | null;
}

type CredentialClient = Pick<Prisma.TransactionClient, 'platformCredential'>;

let inFlightRefresh: Promise<PlatformAccessToken | null> | null = null;

function setTokenState(status: PlatformTokenStatus, error: string | null = null): void {
  platformTokenState.status = status;
  platformTokenState.lastCheckedAt = new Date().toISOString();
  platformTokenState.lastError = error;
}

async function readStoredAccessToken(client: CredentialClient): Promise<PlatformAccessToken | null> {
  const credentials = await client.platformCredential.findMany({
    where: { key: { in: [ACCESS_TOKEN_KEY, ACCESS_EXPIRES_AT_KEY] } },
  });
  const values = new Map(credentials.map((credential) => [credential.key, credential.value]));
  const accessToken = values.get(ACCESS_TOKEN_KEY);
  const expiresAt = Number(values.get(ACCESS_EXPIRES_AT_KEY));

  if (!accessToken || !Number.isFinite(expiresAt) || expiresAt <= Date.now() + ACCESS_TOKEN_BUFFER_MS) {
    return null;
  }

  return { accessToken, expiresAt };
}

async function persistTokenResponse(client: CredentialClient, data: TokenResponse): Promise<PlatformAccessToken> {
  if (!data.access_token) throw new Error('pred.gg token response did not contain an access token');

  const expiresAt = Date.now() + (data.expires_in ?? DEFAULT_ACCESS_TTL_SECONDS) * 1000;
  const writes = [
    client.platformCredential.upsert({
      where: { key: ACCESS_TOKEN_KEY },
      update: { value: data.access_token },
      create: { key: ACCESS_TOKEN_KEY, value: data.access_token },
    }),
    client.platformCredential.upsert({
      where: { key: ACCESS_EXPIRES_AT_KEY },
      update: { value: String(expiresAt) },
      create: { key: ACCESS_EXPIRES_AT_KEY, value: String(expiresAt) },
    }),
  ];

  if (data.refresh_token) {
    writes.push(client.platformCredential.upsert({
      where: { key: REFRESH_TOKEN_KEY },
      update: { value: data.refresh_token },
      create: { key: REFRESH_TOKEN_KEY, value: data.refresh_token },
    }));
  }

  if (data.scope?.trim()) {
    writes.push(client.platformCredential.upsert({
      where: { key: GRANTED_SCOPES_KEY },
      update: { value: normalizeScopes(data.scope).join(' ') },
      create: { key: GRANTED_SCOPES_KEY, value: normalizeScopes(data.scope).join(' ') },
    }));
  }

  await Promise.all(writes);
  return { accessToken: data.access_token, expiresAt };
}

function normalizeScopes(value: string | null | undefined): string[] {
  return [...new Set((value ?? '').trim().split(/\s+/).filter(Boolean))].sort();
}

function buildOAuthStatus(grantedScope: string | null | undefined, error: string | null = null): PredggOAuthStatus {
  const requestedScopes = normalizeScopes(predggOAuthConfig.scopes);
  const grantedScopes = normalizeScopes(grantedScope);
  const granted = new Set(grantedScopes);
  return {
    requestedScopes,
    grantedScopes,
    missingScopes: requestedScopes.filter((scope) => !granted.has(scope)),
    capabilities: {
      profile: granted.has('profile'),
      offlineRefresh: granted.has('offline_access'),
      playerIntervals: granted.has('player:read:interval'),
      heroLeaderboard: granted.has('hero_leaderboard:read'),
      matchupStatistics: granted.has('matchup_statistic:read'),
    },
    checkedAt: platformTokenState.lastCheckedAt,
    error,
  };
}

/** Returns the last known grant without exposing any credential values. */
export async function readPlatformOAuthStatus(): Promise<PredggOAuthStatus> {
  const credential = await db.platformCredential.findUnique({ where: { key: GRANTED_SCOPES_KEY } });
  return buildOAuthStatus(credential?.value, credential ? null : 'Granted scopes have not been inspected yet');
}

/**
 * Verifies the grant carried by the current access token against pred.gg.
 * This also backfills scope metadata for credentials stored before scope tracking existed.
 */
export async function inspectPlatformOAuthStatus(accessToken: string): Promise<PredggOAuthStatus> {
  const endpoint = process.env.PRED_GG_GQL_URL ?? 'https://pred.gg/gql';
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ query: 'query RiftlineOAuthCapabilities { currentAuth { scope } }' }),
      signal: AbortSignal.timeout(5000),
    });
    const payload = await response.json() as {
      data?: { currentAuth?: { scope?: string | null } | null };
      errors?: Array<{ message?: string }>;
    };
    const scope = payload.data?.currentAuth?.scope;
    if (!response.ok || !scope) {
      const message = payload.errors?.map((item) => item.message).filter(Boolean).join('; ')
        || `pred.gg capability check failed (HTTP ${response.status})`;
      const stored = await readPlatformOAuthStatus();
      return { ...stored, checkedAt: new Date().toISOString(), error: message };
    }

    const normalized = normalizeScopes(scope).join(' ');
    await db.platformCredential.upsert({
      where: { key: GRANTED_SCOPES_KEY },
      update: { value: normalized },
      create: { key: GRANTED_SCOPES_KEY, value: normalized },
    });
    return { ...buildOAuthStatus(normalized), checkedAt: new Date().toISOString() };
  } catch (error) {
    const stored = await readPlatformOAuthStatus();
    return {
      ...stored,
      checkedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Stores an OAuth callback response as the single platform credential source. */
export async function savePlatformOAuthTokens(data: TokenResponse): Promise<PlatformAccessToken> {
  const stored = await db.$transaction((tx) => persistTokenResponse(tx, data));
  setTokenState('ok');
  return stored;
}

async function refreshPlatformAccessToken(): Promise<PlatformAccessToken | null> {
  try {
    return await db.$transaction(async (tx) => {
      // Serializes rotating refresh-token use across API processes as well as in this process.
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`);

      const cached = await readStoredAccessToken(tx);
      if (cached) {
        setTokenState('ok');
        return cached;
      }

      const credential = await tx.platformCredential.findUnique({ where: { key: REFRESH_TOKEN_KEY } });
      if (!credential) {
        setTokenState('missing', 'No platform credential stored — connect pred.gg from the admin panel');
        return null;
      }

      const result = await exchangeToken({ grant_type: 'refresh_token', refresh_token: credential.value });
      if (!result.ok || !result.data.access_token) {
        const error = result.data.error ?? 'unknown_error';
        setTokenState('expired', `Token refresh failed (${error}) — reconnect pred.gg from the admin panel`);
        logger.warn({ error }, 'platform token manager: refresh failed');
        return null;
      }

      const stored = await persistTokenResponse(tx, result.data);
      setTokenState('ok');
      logger.info('platform token manager: access token refreshed and rotated credentials persisted');
      return stored;
    }, { maxWait: 10_000, timeout: 30_000 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setTokenState('unknown', message);
    logger.warn({ err: error }, 'platform token manager: unexpected refresh error');
    return null;
  }
}

/**
 * Returns a valid server-owned pred.gg access token.
 * All callers share one in-flight refresh and the database advisory lock protects
 * rotating refresh tokens when more than one API process is running.
 */
export async function getPlatformAccessToken(): Promise<PlatformAccessToken | null> {
  const cached = await readStoredAccessToken(db);
  if (cached) {
    setTokenState('ok');
    return cached;
  }

  if (!inFlightRefresh) {
    inFlightRefresh = refreshPlatformAccessToken().finally(() => {
      inFlightRefresh = null;
    });
  }

  return inFlightRefresh;
}
