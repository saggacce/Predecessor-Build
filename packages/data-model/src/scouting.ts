// Internal normalized types for the scouting layer.
// These mirror the Prisma schema in workers/data-sync/prisma/schema.prisma
// but are plain TypeScript for use in API and frontend packages.

export type TeamType = 'OWN' | 'RIVAL';

export interface PlayerRecord {
  id: string;
  predggId: string;
  predggUuid: string;
  displayName: string;
  isPrivate: boolean;
  inferredRegion: string | null;
  firstSeen: Date;
  lastSynced: Date;
}

export interface PlayerSnapshot {
  id: string;
  playerId: string;
  versionId: string | null;
  syncedAt: Date;
  generalStats: Record<string, unknown>;
  heroStats: unknown[];
  roleStats: unknown[];
  rankLabel: string | null;
  ratingPoints: number | null;
}

export interface TeamRecord {
  id: string;
  name: string;
  abbreviation: string | null;
  type: TeamType;
  region: string | null;
  notes: string | null;
  createdAt: Date;
}

export interface TeamRosterEntry {
  id: string;
  teamId: string;
  playerId: string;
  role: string | null;
  activeFrom: Date;
  activeTo: Date | null;
}

export interface MatchRecord {
  id: string;
  predggUuid: string;
  startTime: Date;
  duration: number;
  gameMode: string;
  region: string | null;
  winningTeam: string | null;
  versionId: string | null;
  syncedAt: Date;
}

export interface MatchPlayerRecord {
  id: string;
  matchId: string;
  playerId: string | null;
  playerName: string;
  team: string;
  role: string | null;
  heroSlug: string;
  kills: number;
  deaths: number;
  assists: number;
  heroDamage: number | null;
  totalDamage: number | null;
  gold: number | null;
  wardsPlaced: number | null;
  inventoryItems: string[];
  perkSlug: string | null;
  abilityOrder: { ability: string; gameTime: number }[] | null;
}

export interface VersionRecord {
  id: string;
  predggId: string;
  name: string;
  releaseDate: Date;
  patchType: string;
  syncedAt: Date;
}

export interface SyncLogEntry {
  id: string;
  entity: string;
  entityId: string;
  operation: string;
  status: 'ok' | 'error' | 'skipped';
  syncedAt: Date;
  error: string | null;
}
