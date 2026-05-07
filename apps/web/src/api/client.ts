import type { VersionRecord } from '@predecessor/data-model';

export const API_BASE = '/api';
// Direct API URL — bypasses Vite proxy for OAuth redirects (proxy intercepts 302s internally)
export const API_DIRECT = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export interface ApiError {
  message: string;
  code?: string;
}

export class ApiErrorResponse extends Error {
  status: number;
  error: ApiError;

  constructor(status: number, error: ApiError) {
    super(error.message);
    this.status = status;
    this.error = error;
  }
}

// ── Response shapes ──────────────────────────────────────────────────────────

export interface PlayerSearchResult {
  id: string;
  displayName: string;
  customName: string | null;
  isPrivate: boolean;
  isConsole: boolean;
  inferredRegion: string | null;
  lastSynced: string;
}

export interface HeroStat {
  heroData: { slug: string; name: string; imageUrl?: string | null };
  matches?: number;
  wins: number;
  losses: number;
  winRate?: number;
  kills: number;
  deaths: number;
  assists: number;
  heroDamage?: number;
  gold?: number;
}

export interface RoleStat {
  role: string;
  wins: number;
  losses: number;
  matches: number;
  winRate?: number;
  kills?: number;
  deaths?: number;
  assists?: number;
  heroDamage?: number;
  gold?: number;
}

export interface RecentMatch {
  matchId: string;
  matchUuid: string;
  heroSlug: string;
  role: string | null;
  kills: number;
  deaths: number;
  assists: number;
  gold: number | null;
  heroDamage: number | null;
  result: 'win' | 'loss' | 'unknown';
  date: string;
  duration: number;
  gameMode: string;
  heroName: string | null;
  heroImageUrl: string | null;
  wardsPlaced: number | null;
  wardsDestroyed: number | null;
  level: number | null;
  laneMinionsKilled: number | null;
  totalDamageDealtToStructures: number | null;
  totalDamageDealtToObjectives: number | null;
  totalHealingDone: number | null;
}

export interface PlayerProfile {
  id: string;
  displayName: string;
  customName: string | null;
  isPrivate: boolean;
  isConsole: boolean;
  inferredRegion: string | null;
  firstSeen: string;
  lastSynced: string;
  rating: { rankLabel: string | null; ratingPoints: number | null } | null;
  generalStats: Record<string, unknown>;
  heroStats: HeroStat[];
  roleStats: RoleStat[];
  recentMatches: RecentMatch[];
}

export interface RosterMember {
  rosterId: string;
  playerId: string;
  displayName: string;
  customName: string | null;
  role: string | null;
  activeFrom: string;
  activeTo: string | null;
  lastSynced: string;
  rating: { rankLabel: string | null; ratingPoints: number | null } | null;
}

export type TeamRole = 'carry' | 'jungle' | 'midlane' | 'offlane' | 'support';

export interface TeamProfile {
  id: string;
  name: string;
  abbreviation: string | null;
  logoUrl: string | null;
  type: 'OWN' | 'RIVAL';
  region: string | null;
  notes: string | null;
  createdAt: string;
  roster: RosterMember[];
  aggregateStats: { totalMatches: number; averageKDA: number };
}

export interface SeasonRating {
  rank: { name: string; tierName: string; icon: string };
  points: number;
  rating: { name: string; group: string };
}

export interface PlayerSeasons {
  favRegion: string | null;
  ratings: SeasonRating[];
}

export interface HeroMeta {
  slug: string;
  displayName: string;
  classes: string[];
  roles: string[];
  icon: string | null;
}

export interface MatchPlayerDetail {
  id: string;
  playerId: string | null;
  predggPlayerUuid: string | null;
  playerName: string;
  customName: string | null;
  team: string;
  role: string | null;
  heroSlug: string;
  heroName: string | null;
  heroImageUrl: string | null;
  isConsole: boolean;
  kills: number;
  deaths: number;
  assists: number;
  heroDamage: number | null;
  totalDamage: number | null;
  gold: number | null;
  wardsPlaced: number | null;
  wardsDestroyed: number | null;
  level: number | null;
  inventoryItems: string[];
  perkSlug: string | null;
  rankLabel: string | null;
  ratingPoints: number | null;
  physicalDamageDealtToHeroes: number | null;
  magicalDamageDealtToHeroes: number | null;
  trueDamageDealtToHeroes: number | null;
  heroDamageTaken: number | null;
  totalDamageTaken: number | null;
  totalHealingDone: number | null;
  totalDamageDealtToStructures: number | null;
  totalDamageDealtToObjectives: number | null;
  largestCriticalStrike: number | null;
  laneMinionsKilled: number | null;
  goldSpent: number | null;
  largestKillingSpree: number | null;
  multiKill: number | null;
  physicalDamageDealt: number | null;
  magicalDamageDealt: number | null;
  trueDamageDealt: number | null;
  goldEarnedAtInterval: number[] | null;
}

export interface MatchEventKill {
  gameTime: number;
  killerTeam: string | null;
  killedTeam: string | null;
  killerHeroSlug: string | null;
  killedHeroSlug: string | null;
  killerPlayerId: string | null;
  killedPlayerId: string | null;
  locationX: number | null;
  locationY: number | null;
}

export interface MatchEventObjective {
  gameTime: number;
  entityType: string;
  killerTeam: string | null;
  killerPlayerId: string | null;
  locationX: number | null;
  locationY: number | null;
}

export interface MatchEventStructure {
  gameTime: number;
  structureType: string;
  destructionTeam: string | null;
  locationX: number | null;
  locationY: number | null;
}

export interface MatchEventWard {
  gameTime: number;
  eventType: string;
  wardType: string;
  team: string | null;
  locationX: number | null;
  locationY: number | null;
}

export interface MatchEventTransaction {
  gameTime: number;
  transactionType: string;
  itemName: string | null;
  team: string | null;
  playerId: string | null;
}

export interface MatchEvents {
  heroKills: MatchEventKill[];
  objectiveKills: MatchEventObjective[];
  structureDestructions: MatchEventStructure[];
  wardEvents: MatchEventWard[];
  transactions: MatchEventTransaction[];
}

export interface MatchDetail {
  id: string;
  predggUuid: string;
  startTime: string;
  duration: number;
  gameMode: string;
  region: string | null;
  winningTeam: string | null;
  version: string | null;
  rosterSynced: boolean;
  eventStreamSynced: boolean;
  dusk: MatchPlayerDetail[];
  dawn: MatchPlayerDetail[];
}

export interface ScrimReport {
  generatedAt: string;
  ownTeam: { name: string; roster: Array<{ displayName: string; role: string | null; rankLabel: string | null; topHeroes: Array<{ slug: string; wins: number; losses: number }> }> };
  rivalTeam: { name: string; roster: Array<{ displayName: string; role: string | null; rankLabel: string | null; topHeroes: Array<{ slug: string; wins: number; losses: number }> }> };
  matchupNotes: string[];
}

export interface SyncedPlayer {
  id: string;
  predggId: string;
  displayName: string;
  isPrivate: boolean;
  inferredRegion: string | null;
  lastSynced: Date;
}

export interface PlayerAnalysisStat {
  playerId: string;
  displayName: string;
  customName: string | null;
  role: string | null;
  rankLabel: string | null;
  ratingPoints: number | null;
  matches: number;
  winRate: number;
  kda: number;
  avgGPM: number | null;
  avgDPM: number | null;
  avgCS: number | null;
  avgWardsPlaced: number | null;
  recentWins: number;
  recentLosses: number;
  topHeroes: Array<{ slug: string; name: string; matches: number; winRate: number; imageUrl: string | null }>;
}

export interface TeamMatch {
  matchId: string;
  predggUuid: string;
  startTime: string;
  duration: number;
  gameMode: string;
  teamSide: string;
  won: boolean | null;
  playerCount: number;
}

export interface TeamObjectiveControl {
  entityType: string;
  teamCaptures: number;
  rivalCaptures: number;
  total: number;
  controlPct: number;
}

export interface TeamAnalysis {
  teamId: string;
  teamName: string;
  teamType: string;
  playerStats: PlayerAnalysisStat[];
  teamMatches: TeamMatch[];
  teamWins: number;
  teamLosses: number;
  objectiveControl: TeamObjectiveControl[];
}

export interface AdminSyncVersionsResult {
  synced: number;
  elapsed: number;
  timestamp: string;
}

export interface AdminSyncStaleResult {
  synced: number;
  skipped: number;
  errors: number;
  elapsed: number;
  timestamp: string;
}

// ── Fetch helper ─────────────────────────────────────────────────────────────

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const response = await fetch(url, { ...options, headers, credentials: 'include' });

  const data = await response.json().catch((err) => {
    console.warn(`[api] failed to parse JSON from ${url}:`, err);
    return null;
  });

  if (!response.ok) {
    throw new ApiErrorResponse(
      response.status,
      data?.error ?? { message: `HTTP ${response.status}` },
    );
  }

  return data as T;
}

// ── API client ────────────────────────────────────────────────────────────────

export const apiClient = {
  health: () => fetchApi<{ status: string; timestamp: string }>('/health'),

  patches: {
    latest: () => fetchApi<VersionRecord>('/patches/latest'),
    all: () => fetchApi<{ patches: VersionRecord[] }>('/patches'),
  },

  players: {
    search: (query: string, limit?: number) => {
      const params = new URLSearchParams({ q: query });
      if (limit) params.set('limit', String(limit));
      return fetchApi<{ results: PlayerSearchResult[] }>(`/players/search?${params}`);
    },
    sync: (name: string) =>
      fetchApi<{ synced: boolean; player: SyncedPlayer }>('/players/sync', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    getProfile: (id: string) => fetchApi<PlayerProfile>(`/players/${id}`),
    compare: (playerIdA: string, playerIdB: string) =>
      fetchApi<{ players: [PlayerProfile, PlayerProfile]; deltas: unknown[] }>('/players/compare', {
        method: 'POST',
        body: JSON.stringify({ playerIdA, playerIdB }),
      }),
    seasons: (id: string) => fetchApi<PlayerSeasons>(`/players/${id}/seasons`),
    setCustomName: (id: string, customName: string | null) =>
      fetchApi<{ player: { id: string; customName: string | null; displayName: string } }>(`/players/${id}/name`, {
        method: 'PATCH',
        body: JSON.stringify({ customName }),
      }),
  },

  teams: {
    list: (type?: 'OWN' | 'RIVAL') => {
      const params = type ? `?type=${type}` : '';
      return fetchApi<{ teams: TeamProfile[] }>(`/teams${params}`);
    },
    getProfile: (id: string) => fetchApi<TeamProfile>(`/teams/${id}`),
    create: (data: { name: string; abbreviation?: string; logoUrl?: string; type: 'OWN' | 'RIVAL'; region?: string; notes?: string }) =>
      fetchApi<TeamProfile>('/teams', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; abbreviation?: string | null; logoUrl?: string | null; region?: string | null; notes?: string | null }) =>
      fetchApi<TeamProfile>(`/teams/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      fetchApi<{ ok: boolean }>(`/teams/${id}`, { method: 'DELETE' }),
    addPlayer: (teamId: string, playerId: string, role?: TeamRole) =>
      fetchApi<{ id: string }>(`/teams/${teamId}/roster`, { method: 'POST', body: JSON.stringify({ playerId, role }) }),
    updateRoster: (teamId: string, rosterId: string, role: TeamRole | null) =>
      fetchApi<{ id: string }>(`/teams/${teamId}/roster/${rosterId}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    removePlayer: (teamId: string, rosterId: string) =>
      fetchApi<{ ok: boolean }>(`/teams/${teamId}/roster/${rosterId}`, { method: 'DELETE' }),
    getAnalysis: (id: string) => fetchApi<TeamAnalysis>(`/teams/${id}/analysis`),
  },

  heroes: {
    meta: () => fetchApi<{ heroes: HeroMeta[] }>('/hero-meta'),
  },

  matches: {
    getDetail: (id: string) => fetchApi<MatchDetail>(`/matches/${id}`),
    syncPlayers: (id: string) => fetchApi<MatchDetail>(`/matches/${id}/sync`, { method: 'POST' }),
    getEvents: (id: string) => fetchApi<MatchEvents>(`/matches/${id}/events`),
  },

  reports: {
    scrim: (ownTeamId: string, rivalTeamId: string) =>
      fetchApi<ScrimReport>('/reports/scrim', {
        method: 'POST',
        body: JSON.stringify({ ownTeamId, rivalTeamId }),
      }),
  },

  auth: {
    me: () => fetchApi<{ authenticated: boolean }>('/auth/me'),
    logout: () => fetchApi<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
    loginUrl: () => `${API_DIRECT}/auth/predgg`,
  },

  admin: {
    syncVersions: () =>
      fetchApi<AdminSyncVersionsResult>('/admin/sync-versions', { method: 'POST' }),
    syncStale: () =>
      fetchApi<AdminSyncStaleResult>('/admin/sync-stale', { method: 'POST' }),
    syncLogs: (limit = 50, entity?: string, status?: string) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (entity) params.set('entity', entity);
      if (status) params.set('status', status);
      return fetchApi<{ logs: unknown[]; total: number }>(`/admin/sync-logs?${params}`);
    },
  },
};
