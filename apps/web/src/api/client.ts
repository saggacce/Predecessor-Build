import type { VersionRecord } from '@predecessor/data-model';

export type ConfigurableRole = 'PLATFORM_ADMIN' | 'MANAGER' | 'COACH' | 'ANALISTA' | 'JUGADOR' | 'PLAYER';
export type PermissionKey =
  | 'teams.own.view' | 'teams.own.create' | 'teams.own.edit' | 'teams.own.delete'
  | 'teams.own.addPlayer' | 'teams.own.removePlayer' | 'teams.own.editPlayerName' | 'teams.own.syncMatches'
  | 'invitations.view' | 'invitations.create' | 'invitations.revoke'
  | 'teams.rival.view' | 'teams.rival.create' | 'teams.rival.edit' | 'teams.rival.delete'
  | 'teams.rival.addPlayer' | 'teams.rival.removePlayer' | 'teams.rival.syncMatches'
  | 'teamAnalysis.view' | 'teamAnalysis.performance' | 'teamAnalysis.draft'
  | 'teamAnalysis.vision' | 'teamAnalysis.analyst'
  | 'teamGoals.view' | 'teamGoals.create' | 'teamGoals.edit' | 'teamGoals.delete'
  | 'playerScouting.view' | 'playerScouting.syncPlayer' | 'playerScouting.editPlayerName'
  | 'playerGoals.view' | 'playerGoals.create' | 'playerGoals.edit' | 'playerGoals.delete'
  | 'matchDetail.view' | 'matchDetail.syncMatch' | 'matchDetail.editPlayerName'
  | 'matchDetail.scoreboard' | 'matchDetail.statistics' | 'matchDetail.timeline' | 'matchDetail.analysis'
  | 'scrimPlanner.view' | 'scrimPlanner.create' | 'scrimPlanner.delete'
  | 'scrimReport.view' | 'scrimReport.export'
  | 'reviewQueue.view' | 'reviewQueue.createItem' | 'reviewQueue.editItem' | 'reviewQueue.deleteItem'
  | 'reviewSessions.view' | 'reviewSessions.create' | 'reviewSessions.manage'
  | 'playbook.view' | 'playbook.create' | 'playbook.edit' | 'playbook.delete'
  | 'tacticalBoard.view' | 'tacticalBoard.save'
  | 'vodIndex.view' | 'vodIndex.create' | 'vodIndex.edit' | 'vodIndex.delete'
  | 'platformAdmin.view' | 'platformAdmin.dataControls' | 'platformAdmin.staff'
  | 'platformAdmin.auditLogs' | 'platformAdmin.feedback' | 'platformAdmin.permissions';
export type RolePermissions = Record<PermissionKey, boolean>;
export type PlatformPermissions = Record<ConfigurableRole, RolePermissions>;

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
  version: string | null;
  ratingDelta: number | null;
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

export interface PlayerPeriodMetrics {
  matches: number;
  wins: number;
  winRate: number | null;
  kills: number;
  deaths: number;
  assists: number;
  kda: number | null;
  averageHeroDamage: number | null;
  averageGold: number | null;
  averageLaneMinions: number | null;
}

export interface PlayerMetricTrend {
  metric: 'kda' | 'winRate' | 'averageHeroDamage' | 'averageGold' | 'averageLaneMinions';
  weekly: number | null;
  baseline: number | null;
  delta: number | null;
  direction: 'up' | 'down' | 'stable' | 'insufficient_data';
  deltaUnit: 'percent' | 'percentage_points';
}

export interface PlayerWeeklyReport {
  generatedAt: string;
  period: { weeklyFrom: string; baselineFrom: string; to: string };
  player: { id: string; displayName: string; customName: string | null };
  weekly: PlayerPeriodMetrics;
  baseline30d: PlayerPeriodMetrics;
  trends: PlayerMetricTrend[];
  topHero: {
    heroSlug: string;
    matches: number;
    wins: number;
    winRate: number;
    shareOfWeeklyMatches: number;
  } | null;
  focusOfWeek: {
    category: 'activity' | 'survivability' | 'consistency' | 'hero_pool' | 'momentum';
    title: string;
    rationale: string;
    action: string;
  };
  roleCoach: {
    role: 'CARRY' | 'SUPPORT' | 'MIDLANE' | 'JUNGLE' | 'OFFLANE';
    label: string;
    matches: number;
    shareOfMatches: number;
    confidence: 'low' | 'medium' | 'high';
    metrics: Array<{
      key: string;
      label: string;
      value: number | null;
      baseline: number | null;
      unit: 'ratio' | 'per_match' | 'per_minute' | 'percent';
    }>;
    focus: { title: string; rationale: string; action: string };
    training: {
      metricKey: 'cs_per_min' | 'dpm' | 'deaths_per_match' | 'wards_per_min' | 'kill_participation' | 'objective_damage_per_min' | 'structure_damage_per_min';
      metricLabel: string;
      direction: 'higher' | 'lower';
      targetValue: number | null;
      targetMatches: 5;
    };
  } | null;
  championPool: {
    currentPatch: string | null;
    totalMatches30d: number;
    heroes: Array<{
      heroSlug: string;
      role: string | null;
      designation: 'main' | 'alternate' | 'experimental';
      matches30d: number;
      wins30d: number;
      winRate30d: number;
      kda30d: number;
      currentPatchMatches: number;
      currentPatchWinRate: number | null;
      currentPatchKda: number | null;
      trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
    }>;
    mainHero: string | null;
    alternativeHero: string | null;
    recommendation: { title: string; rationale: string; action: string };
  };
}

export interface PlayerMatchEnrichmentStatus {
  playerId: string;
  windowDays: number;
  totalMatches: number;
  rosterSynced: number;
  eventStreamSynced: number;
  fullyEnriched: number;
  failed: number;
  pending: number;
  coveragePercent: number;
  lastMatchSyncedAt: string | null;
  job: {
    running: boolean;
    total: number;
    processed: number;
    succeeded: number;
    errors: number;
    startedAt: string;
    finishedAt: string | null;
  } | null;
}

export interface PlayerCoachChatResponse {
  answer: string;
  evidence: Array<{ id: string; label: string; value: string; scope: string }>;
  knowledge: Array<{
    id: string;
    kind: 'fundamental' | 'hero' | 'item' | 'loadout';
    label: string;
    value: string;
    source: string;
    patch: string | null;
  }>;
  coverage: { complete: number; total: number; percent: number };
  model: string;
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

export type RosterStatus = 'STARTER' | 'BENCH';

export interface RosterMember {
  rosterId: string;
  playerId: string;
  displayName: string;
  customName: string | null;
  role: string | null;
  rosterStatus: RosterStatus;
  activeFrom: string;
  activeTo: string | null;
  lastSynced: string;
  rating: { rankLabel: string | null; ratingPoints: number | null } | null;
}

export type TeamRole = 'carry' | 'jungle' | 'midlane' | 'offlane' | 'support';

export interface TeamStaffMember {
  userId: string;
  role: string;
  extraRoles: string[];
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface TeamProfile {
  id: string;
  name: string;
  abbreviation: string | null;
  logoUrl: string | null;
  type: 'OWN' | 'RIVAL';
  region: string | null;
  notes: string | null;
  createdAt: string;
  staff: TeamStaffMember[];
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

export interface PlatformConfigEntry {
  key: string;
  value: number;
  defaultValue: number;
  minValue: number | null;
  maxValue: number | null;
  label: string;
  description: string;
  group: string;
  unit: string | null;
  textValue: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

export type TeamTier = 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE';
export type PlayerTier = 'FREE' | 'PRO' | 'PREMIUM';

export interface EffectiveAccess {
  teamTier: TeamTier;
  playerTier: PlayerTier;
}

export interface FeedbackItem {
  id: string;
  type: 'bug' | 'suggestion' | 'improvement';
  section: string;
  description: string;
  status: 'NEW' | 'REVIEWED' | 'DISMISSED';
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  globalRole: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  avatarUrl: string | null;
  bio: string | null;
  timezone: string | null;
  playerTier: PlayerTier;
  playerTierExpiresAt: string | null;
  linkedPlayerId: string | null;
  discordId: string | null;
  discordUsername: string | null;
  epicGamesId: string | null;
  epicGamesUsername: string | null;
  steamId: string | null;
  steamUsername: string | null;
  memberships: Array<{
    role: string;
    team: { id: string; name: string; type: string; teamTier: TeamTier; teamTierExpiresAt: string | null };
  }>;
}

export interface HeroMeta {
  slug: string;
  displayName: string;
  classes: string[];
  roles: string[];
  imageUrl: string | null;
  abilities?: unknown[];
  baseStats?: Record<string, number[]>;
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
  perks: Array<{
    id: string; name: string; displayName: string; slot: string | null;
    icon?: string | null; simpleDescription?: string | null; description?: string | null;
    unlockLevel?: number | null; eternalCategory?: { id: string; name: string } | null;
  }> | null;
  abilityOrder: Array<{ ability: string; gameTime: number }> | null;
  rankLabel: string | null;
  ratingPoints: number | null;
  physicalDamageDealtToHeroes: number | null;
  magicalDamageDealtToHeroes: number | null;
  trueDamageDealtToHeroes: number | null;
  heroDamageTaken: number | null;
  totalDamageTaken: number | null;
  totalHealingDone: number | null;
  crestHealingDone: number | null;
  itemHealingDone: number | null;
  utilityHealingDone: number | null;
  totalShieldingReceived: number | null;
  totalDamageMitigated: number | null;
  physicalDamageTaken: number | null;
  magicalDamageTaken: number | null;
  trueDamageTaken: number | null;
  physicalDamageTakenFromHeroes: number | null;
  magicalDamageTakenFromHeroes: number | null;
  trueDamageTakenFromHeroes: number | null;
  totalDamageDealtToStructures: number | null;
  totalDamageDealtToObjectives: number | null;
  largestCriticalStrike: number | null;
  laneMinionsKilled: number | null;
  minionsKilled: number | null;
  neutralMinionsKilled: number | null;
  neutralMinionsTeamJungle: number | null;
  neutralMinionsEnemyJungle: number | null;
  goldSpent: number | null;
  largestKillingSpree: number | null;
  multiKill: number | null;
  physicalDamageDealt: number | null;
  magicalDamageDealt: number | null;
  trueDamageDealt: number | null;
  matchRating: {
    ratingId: string | null; points: number | null; newPoints: number | null; delta: number | null;
    rankName: string | null; tierName: string | null; isRankup: boolean | null;
  } | null;
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
  playerId: string | null;
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
  endTime: string | null;
  duration: number;
  gameMode: string;
  region: string | null;
  winningTeam: string | null;
  endReason: string | null;
  spoilerBlockedUntil: string | null;
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

export interface PlayerAdvancedMetrics {
  sampleSize: number;
  eventStreamSampleSize: number;
  goldSharePct: number | null;
  damageSharePct: number | null;
  killSharePct: number | null;
  efficiencyGap: number | null;
  earlyDeathRate: number | null;
  firstDeathRate: number | null;
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
  earlyDeathRate: number | null;
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
  version: string | null;
  firstTowerWon: boolean | null;
  rivalTeamName: string | null;
}

export interface TeamObjectiveControl {
  entityType: string;
  teamCaptures: number;
  rivalCaptures: number;
  total: number;
  controlPct: number;
  avgGameTimeSecs: number | null;
}

export interface RivalHeroStat {
  playerId: string;
  heroSlug: string;
  games: number;
  wins: number;
  winRate: number;
  avgKda: number;
}

export interface HeroPickStat {
  heroSlug: string;
  pickCount: number;
  pickRate: number;
  wins: number;
  winRate: number;
  playedBy: string[];
}

export interface HeroBanStat {
  heroSlug: string;
  count: number;
  rate: number;
}

export interface PlayerHeroDepth {
  playerId: string;
  heroCount: number;
  topHeroes: Array<{ heroSlug: string; games: number; winRate: number; comfortScore: number }>;
}

export interface HeroOverlapEntry {
  heroSlug: string;
  playerIds: string[];
}

export interface ThreatPlayer {
  playerId: string;
  displayName: string;
  customName: string | null;
  role: string | null;
  threatScore: number;
  games: number;
  winRate: number;
  kda: number;
  avgDPM: number | null;
  topHeroes: Array<{ heroSlug: string; games: number; winRate: number }>;
}

export interface RivalScoutingReport {
  teamId: string;
  teamName: string;
  sampleSize: number;
  recentForm: { wins: number; losses: number; last10: string[]; trend: 'improving' | 'declining' | 'stable' };
  identity: string[];
  strongPhase: 'early' | 'mid' | 'late' | null;
  weakPhase: 'early' | 'mid' | 'late' | null;
  throwRate: number | null;
  threatPlayers: ThreatPlayer[];
  weakRole: string | null;
  objectivePriority: Array<{ entityType: string; controlPct: number; avgGameTimeSecs: number | null }>;
}

export interface TeamDraftAnalysis {
  sampleSize: number;
  rankedSampleSize: number;
  pickRates: HeroPickStat[];
  ownBanRates: HeroBanStat[];
  receivedBanRates: HeroBanStat[];
  playerDepth: PlayerHeroDepth[];
  heroOverlap: HeroOverlapEntry[];
}

export interface ObjectiveConversionStat {
  entityType: string;
  taken: number;
  toAnyStructureRate: number | null;
  toInhibitorRate: number | null;
  toCoreRate: number | null;
}

export interface ObjectiveTimingStat {
  entityType: string;
  teamTaken: number;
  avgGameTimeSecs: number | null;
  stdDevSecs: number | null;
  priorityShare: number | null;
}

export interface TeamObjectiveAnalysis {
  sampleSize: number;
  conversions: ObjectiveConversionStat[];
  timingStats: ObjectiveTimingStat[];
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
  rivalHeroPool: RivalHeroStat[];
  primeConversionRate: number | null;
  fangtoolhConversionRate: number | null;
}

export interface MatchPhaseStat {
  matchId: string;
  predggUuid: string;
  won: boolean | null;
  killDiff10: number;
  killDiff15: number;
  objectiveDiff10: number;
  objectiveDiff15: number;
  objectiveDiff20: number;
}

export interface TeamPhaseAnalysis {
  sampleSize: number;
  avgKillDiff10: number | null;
  avgKillDiff15: number | null;
  avgObjectiveDiff10: number | null;
  avgObjectiveDiff15: number | null;
  avgObjectiveDiff20: number | null;
  throwRate: number | null;
  comebackRate: number | null;
  perMatch: MatchPhaseStat[];
}

export interface MapZone {
  id: string;
  key: string;
  name: string;
  polygon: [number, number][];
  zoneType: 'objective' | 'lane' | 'jungle' | 'river';
  relatedObjective: string | null;
}

export interface VisionObjectiveStat {
  entityType: string;
  teamTaken: number;
  avgWardsNearby: number | null;
  avgWardsLost: number | null;
  avgEnemyWardsCleared: number | null;
  junglerAliveRate: number | null;
  supportAliveRate: number | null;
}

export interface TeamVisionAnalysis {
  sampleSize: number;
  visionControlScore: number | null;
  objectiveLostAfterAllyDeathRate: number | null;
  objectiveTakenAfterEnemyDeathRate: number | null;
  byObjective: VisionObjectiveStat[];
}

export interface Insight {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'positive';
  category: 'macro' | 'vision' | 'draft' | 'performance' | 'economy';
  title: string;
  body: string;
  evidence: string[];
  recommendation: string;
  reviewRequired: boolean;
  affectedPlayers?: string[];
}

export interface ReviewItem {
  id: string;
  teamId: string;
  matchId: string | null;
  playerId: string | null;
  insightId: string | null;
  gameTime: number | null;
  eventType: string;
  priority: string;
  reason: string;
  status: string;
  tag: string | null;
  coachComment: string | null;
  assignedTo: string | null;
  actionItem: string | null;
  vodUrl: string | null;
  vodTimestamp: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamGoal {
  id: string;
  teamId: string;
  title: string;
  description: string | null;
  metricId: string | null;
  baselineValue: number | null;
  targetValue: number | null;
  currentValue: number | null;
  timeframe: string | null;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerGoal {
  id: string;
  playerId: string;
  teamId: string;
  title: string;
  description: string | null;
  metricId: string | null;
  baselineValue: number | null;
  targetValue: number | null;
  currentValue: number | null;
  coachNote: string | null;
  visibility: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export type VodLinkType =
  | 'full_match'
  | 'player_pov'
  | 'clip'
  | 'coach_review'
  | 'scrim_recording'
  | 'tournament_vod'
  | 'ingame_replay_ref';

export type VodVisibility = 'staff' | 'team' | 'player';

export interface VodLink {
  id: string;
  matchId: string | null;
  playerId: string | null;
  teamId: string;
  type: VodLinkType | string;
  url: string;
  gameTimeStart: number | null;
  gameTimeEnd: number | null;
  videoTimestampStart: number | null;
  videoTimestampEnd: number | null;
  tags: string[];
  notes: string | null;
  visibility: VodVisibility | string;
  createdAt: string;
  match: {
    id: string;
    startTime: string;
    gameMode: string;
    winningTeam: string | null;
  } | null;
}

export interface VodLinkInput {
  teamId: string;
  matchId?: string | null;
  playerId?: string | null;
  type: VodLinkType;
  url: string;
  gameTimeStart?: number | null;
  gameTimeEnd?: number | null;
  videoTimestampStart?: number | null;
  videoTimestampEnd?: number | null;
  tags?: string[];
  notes?: string | null;
  visibility?: VodVisibility;
}

export interface SessionMembership {
  teamId: string;
  role: 'MANAGER' | 'COACH' | 'ANALISTA' | 'JUGADOR' | string;
  playerId: string | null;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  globalRole: 'PLATFORM_ADMIN' | 'PLAYER' | 'VIEWER' | string;
  linkedPlayerId: string | null;
  avatarUrl?: string | null;
  language?: string;
  onboardingModalSeen?: boolean;
  memberships: SessionMembership[];
}

export interface MissionItem {
  id: string;
  title: Record<'en' | 'es', string>;
  description: Record<'en' | 'es', string>;
  ctaPath: string;
  order: number;
  completed: boolean;
  completedAt: string | null;
}

export interface UserAchievement {
  id: string;
  userId: string;
  achievementId: string;
  awardedAt: string;
}

export interface Invitation {
  id: string;
  token: string;
  email: string;
  teamId: string | null;
  role: 'MANAGER' | 'COACH' | 'ANALISTA' | 'JUGADOR' | 'PLATFORM_ADMIN' | string;
  playerId?: string | null;
  expiresAt: string;
  usedAt?: string | null;
  createdAt?: string;
  invitedBy?: { name: string; email: string } | null;
}

export interface PublicInvitation {
  email: string;
  teamId: string | null;
  role: string;
  playerId?: string | null;
  expiresAt: string;
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

export interface CronJob {
  enabled: boolean;
  running: boolean;
  lastRunAt: string | null;
  lastRunResult: { newMatches: number; eventStreamSynced: number; players: number; errors: number } | null;
  nextRunAt: string | null;
}

export interface PlatformTokenState {
  status: 'ok' | 'expired' | 'missing' | 'unknown';
  lastCheckedAt: string | null;
  lastError: string | null;
}

export interface SyncStatus {
  players: { total: number; synced: number; stale: number; hidden: number };
  matches: { total: number; complete: number; partial: number; incomplete: number };
  eventStreamJob: EventStreamJob;
  cronJob: CronJob;
  platformToken: PlatformTokenState;
}

export interface EventStreamJob {
  running: boolean;
  total: number;
  synced: number;
  errors: number;
  skipped: number;
  startedAt: string | null;
  lastActivity: string | null;
  tokenError: boolean;
}

export interface SyncLog {
  id: string;
  entity: string;
  entityId: string;
  operation: string;
  status: string;
  syncedAt: string;
  error?: string | null;
  source?: string | null;
  userName?: string | null;
}

export interface ScrimScheduleItem {
  id: string;
  teamId: string;
  rivalTeamId: string | null;
  rivalName: string | null;
  scheduledAt: string;
  type: 'SCRIM' | 'OFFICIAL' | 'PRACTICE';
  status: 'PENDIENTE' | 'CONFIRMADO' | 'CANCELADO';
  notes: string | null;
  result: 'WIN' | 'LOSS' | 'DRAW' | null;
  analysedAt: string | null;
  reviewedAt: string | null;
  /** pred.gg match UUID auto-detected by the scrim-results worker */
  predggMatchId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  rivalTeam: { id: string; name: string; abbreviation: string | null; logoUrl: string | null } | null;
  createdBy: { id: string; name: string };
}

export interface PostMatchTask extends ScrimScheduleItem {
  analysisPending: boolean;
  reviewPending: boolean;
}

export type PlaybookPhase = 'ALL' | 'EARLY' | 'MID' | 'LATE';
export type PlaybookRole  = 'CARRY' | 'JUNGLE' | 'MIDLANE' | 'OFFLANE' | 'SUPPORT';

export interface PlaybookEntry {
  id: string;
  teamId: string;
  title: string;
  body: string;
  category: string;
  phase: PlaybookPhase;
  roles: PlaybookRole[];
  pinned: boolean;
  mapSnapshot: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string };
}

export type ReviewSessionStatus = 'PENDIENTE' | 'EN_CURSO' | 'COMPLETADA';
export type ActionItemStatus = 'ABIERTO' | 'EN_PROGRESO' | 'COMPLETADO';

export interface AgendaItem {
  id: string;
  sessionId: string;
  order: number;
  title: string;
  description: string | null;
  vodTimestamp: number | null;
  playerRef: string | null;
  reviewed: boolean;
  createdAt: string;
}

export interface ActionItem {
  id: string;
  sessionId: string;
  title: string;
  assignedTo: string | null;
  status: ActionItemStatus;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: { id: string; name: string } | null;
}

export interface ReviewSession {
  id: string;
  teamId: string;
  scrimId: string | null;
  title: string;
  notes: string | null;
  status: ReviewSessionStatus;
  scheduledAt: string | null;
  completedAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string };
  scrim: { id: string; scheduledAt: string; type: string; rivalName: string | null; result: string | null } | null;
  agendaItems: AgendaItem[];
  actionItems: ActionItem[];
}

export interface PredggSearchResult {
  predggId: string;
  name: string;
  customName: string | null;
  internalId: string | null;
  rankName: string | null;
  ratingPoints: number | null;
}

export interface RivalRosterEntry {
  id: string;
  role: string | null;
  addedAt: string;
  player: {
    id: string;
    predggId: string;
    name: string;
    rankLabel: string | null;
    ratingPoints: number | null;
  };
}

export interface WeeklyGoalItem {
  id: string;
  userId: string;
  playerId: string | null;
  title: string;
  metricKey: 'winrate' | 'kda' | 'cs_per_min' | 'gpm' | 'dpm' | 'deaths_per_match' | 'wards_per_min' | 'kill_participation' | 'objective_damage_per_min' | 'structure_damage_per_min' | 'custom';
  targetValue: number | null;
  currentValue: number;
  weekStart: string;
  status: 'ACTIVE' | 'ACHIEVED' | 'FAILED';
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyGoalEvaluation {
  goal: WeeklyGoalItem;
  targetMatches: number;
  matchesTracked: number;
  metricValue: number | null;
  baselineValue: number | null;
  outcome: 'collecting' | 'target_achieved' | 'improved' | 'declined' | 'stable' | 'ready_for_review' | 'no_player';
}

export interface TeamCommItem {
  id: string;
  teamId: string;
  fromUserId: string;
  toRole: string | null;
  toUserId: string | null;
  type: 'REQUEST' | 'ANNOUNCEMENT' | 'NOTE';
  subject: string;
  body: string;
  priority: 'normal' | 'urgent';
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'DISMISSED';
  resolvedAt: string | null;
  resolvedById: string | null;
  createdAt: string;
  updatedAt: string;
  fromUser: { id: string; name: string; avatarUrl: string | null };
  toUser: { id: string; name: string } | null;
}

export interface ScoutingHero {
  heroSlug: string;
  heroName: string;
  heroImageUrl: string | null;
  matches: number;
  wins: number;
  winRate: number;
  kda: number;
  heroDamagePerMatch: number;
}

export interface ScoutingRoleStat {
  role: string;
  matches: number;
  winRate: number;
  kda: number;
}

export interface ScoutingFormMatch {
  predggMatchId: string;
  date: string;
  heroSlug: string;
  heroName: string | null;
  heroImageUrl: string | null;
  result: 'win' | 'loss';
  kills: number;
  deaths: number;
  assists: number;
  gold: number | null;
  heroDamage: number | null;
  wardsPlaced: number | null;
  gameMode: string;
  duration: number;
  patch: string | null;
  role: string | null;
}

export interface ScoutingProfile {
  predggUuid: string;
  name: string;
  favRole: string | null;
  firstPlayedAt: string | null;
  lastPlayedAt: string | null;
  rating: {
    current: { points: number; rankName: string; tierName: string; percentile: number | null } | null;
    peak: { points: number; rankName: string; tierName: string } | null;
  };
  generalStats: {
    matches: number;
    wins: number;
    losses: number;
    winRate: number;
    kills: number;
    deaths: number;
    assists: number;
    kda: number;
    heroDamagePerMatch: number;
    wardsPlacedPerMatch: number;
    wardsDestroyedPerMatch: number;
    csPerMatch: number;
    objectiveDamagePerMatch: number;
    avgGameMinutes: number | null;
    multiKills: { double: number; triple: number; quadra: number; penta: number };
  };
  heroPool: ScoutingHero[];
  roleDistribution: ScoutingRoleStat[];
  recentForm: ScoutingFormMatch[];
}

export interface LiveMatchResponse {
  detail: MatchDetail;
  events: MatchEvents;
}

export interface ChampionPoolContextRow {
  heroSlug: string;
  matches: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  winRate: number;
  kda: number;
}

export interface ChampionPoolContext {
  period: { days: number; from: string; to: string };
  filters: {
    role: string | null;
    gameMode: string | null;
    heroSlug: string | null;
    available: { roles: string[]; gameModes: string[]; heroes: string[] };
  };
  sampleSize: number;
  heroes: ChampionPoolContextRow[];
  matchups: ChampionPoolContextRow[];
  synergies: ChampionPoolContextRow[];
  strongestMatchup: ChampionPoolContextRow | null;
  hardestMatchup: ChampionPoolContextRow | null;
}

export interface MatchBuildAnalysis {
  dataContext: {
    matchPatch: string | null;
    catalogPatch: string | null;
    catalogFallback: boolean;
    disclosure: string;
  };
  matchId: string;
  matchPlayerId: string;
  heroSlug: string;
  role: string | null;
  result: 'win' | 'loss';
  context: {
    catalogVersionId: string | null;
    deaths: number;
    damageReceived: { physical: number; magical: number; true: number; total: number };
    enemyHealing: number;
    enemyShielding: number;
    enemyMitigation: number;
    enemyHeroes: Array<{
      heroSlug: string;
      role: string | null;
      playerName: string;
      healing: number;
      shieldingReceived: number;
      damageMitigated: number;
    }>;
  };
  globalAnalysis: {
    playerIdentity: Array<{ key: string; label: string; description: string; evidence: string[] }>;
    enemyThreats: Array<{
      key: string;
      label: string;
      description: string;
      severity: 'warning' | 'critical';
      evidence: string;
      response: string;
      sources: Array<{ heroSlug: string; sourceType: 'ability' | 'item'; name: string; description: string }>;
    }>;
    buildProfile: Array<{ key: string; label: string; description: string; items: string[] }>;
    coherence: { score: number; summary: string };
    strengths: string[];
    tradeoffs: string[];
  };
  inventory: Array<{
    slug: string;
    displayName: string;
    aggressionType: string | null;
    rarity: string | null;
    slotType: string | null;
    isEvolved: boolean;
    isHidden: boolean;
    stats: Array<{ stat: string; value: number; showPercent?: boolean }>;
    effects: Array<{ name: string; text: string; condition?: string | null; cooldown?: string | null }>;
  }>;
  inventoryAssessments: Array<{
    slug: string;
    displayName: string;
    verdict: 'correct' | 'neutral';
    purpose: string[];
    functions: Array<{ key: string; label: string; description: string }>;
    roleFit: string;
    matchupFit: string;
    tradeoff: string;
    explanation: string;
  }>;
  verdict: {
    grade: 'correct' | 'mostly_correct' | 'mixed' | 'poor';
    summary: string;
    score: number;
  };
  recommendedBuild: {
    principle: string;
    changes: Array<{
      signalKey: string;
      action: 'add' | 'replace';
      item: {
        slug: string; displayName: string; aggressionType: string | null; reason: string; totalPrice: number;
        stats: Array<{ stat: string; value: number; showPercent?: boolean }>;
        effects: Array<{ name: string; text: string; condition?: string | null; cooldown?: string | null }>;
      };
      insteadOf: { slug: string; displayName: string } | null;
      timing: string;
      why: string;
    }>;
    sequence: Array<{
      position: number;
      slug: string;
      displayName: string;
      phase: string;
      reason: string;
      replaces: { slug: string; displayName: string } | null;
      stats: Array<{ stat: string; value: number; showPercent?: boolean }>;
      effects: Array<{ name: string; text: string; condition?: string | null; cooldown?: string | null }>;
    }>;
  };
  purchaseTimeline: {
    available: boolean;
    ownPurchases: Array<{ gameTime: number; minute: string; itemName: string; itemSlug: string }>;
    opponentResponses: Array<{
      gameTime: number;
      minute: string;
      heroSlug: string;
      playerName: string;
      itemName: string;
      itemSlug: string;
      explanation: string;
    }>;
    lesson: string;
  };
  eternalLoadout: Array<{
    id: string;
    displayName: string;
    slot: string;
    verdict: 'correct' | 'conditional' | 'questionable';
    why: string;
    effect: string | null;
    icon?: string | null;
  }>;
  recommendedLoadout: {
    augment: {
      id: string; slug: string; displayName: string; slot: string; icon: string | null; effect: string; reason: string;
      replaces: { id: string; displayName: string } | null;
    } | null;
    eternal: {
      id: string; slug: string; displayName: string; slot: string; icon: string | null; effect: string; reason: string;
      replaces: { id: string; displayName: string } | null;
    } | null;
    blessings: Array<{
      id: string; slug: string; displayName: string; slot: string; icon: string | null; effect: string; reason: string;
      replaces: { id: string; displayName: string } | null;
    }>;
    explanation: string;
    confidence: { level: 'low' | 'medium' | 'high'; basis: string };
    limitation: string;
  };
  localBenchmark: {
    source: 'riftline_local';
    disclosure: string;
    exactBuild: { matches: number; wins: number; winRate: number; confidence: 'low' | 'medium' | 'high' } | null;
    laneMatchup: { opponentHeroSlug: string; matches: number; wins: number; winRate: number; confidence: 'low' | 'medium' | 'high' } | null;
  };
  abilityOrder: Array<{ ability: string; gameTime: number }>;
  signals: Array<{
    key: string;
    severity: 'info' | 'warning' | 'critical';
    title: string;
    evidence: string;
    recommendation: string;
    whyItMatters?: string;
    learningPrompt?: string;
    whenNotToApply?: string;
    confidence?: { level: 'low' | 'medium' | 'high'; basis: string };
    sources?: Array<{ heroSlug: string; sourceType: 'ability' | 'item'; name: string; description: string }>;
    appliesAgainst?: string[];
    suggestedItems?: Array<{
      slug: string; displayName: string; aggressionType: string | null; reason: string; totalPrice: number;
      stats: Array<{ stat: string; value: number; showPercent?: boolean }>;
      effects: Array<{ name: string; text: string; condition?: string | null; cooldown?: string | null }>;
    }>;
  }>;
}

export interface EducationalCoachObservation {
  id: string;
  category: 'abilities' | 'economy' | 'combat' | 'objectives';
  priority: 'primary' | 'secondary' | 'reference';
  tone: 'strength' | 'development' | 'context';
  title: string;
  evidence: string;
  interpretation: string;
  action: string;
  exception: string;
  transferExamples: string[];
  confidence: { level: 'low' | 'medium' | 'high'; basis: string };
  limitation: string | null;
}

export interface LearningMoment {
  id: string;
  scope: 'personal';
  context: 'soloq';
  type: 'pre_objective_death' | 'gold_swing' | 'death_review' | 'vision_preparation';
  tone: 'review' | 'reinforce';
  priority: 'high' | 'medium' | 'low';
  gameTime: number;
  reviewWindow: { start: number; end: number };
  title: string;
  fact: string;
  inference: string;
  whyItMatters: string;
  reviewChecklist: string[];
  transferablePrinciple: string;
  confidence: { level: 'low' | 'medium' | 'high'; basis: string };
  limitation: string;
}

export type LearningReviewStatus = 'PENDING' | 'CONFIRMED_MISTAKE' | 'GOOD_DECISION' | 'INCONCLUSIVE';

export interface LearningMomentReview {
  id: string;
  userId: string;
  matchId: string;
  matchPlayerId: string;
  momentId: string;
  status: LearningReviewStatus;
  note: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerTrainingCycle {
  id: string;
  userId: string;
  playerId: string;
  focusKey: string;
  title: string;
  cue: string;
  targetMatches: number;
  status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  sourceMatchId: string | null;
  sourceMomentId: string | null;
  profileId?: string | null;
  competencyKey?: string | null;
  learningLevel?: number | null;
  successCriteria?: Record<string, unknown> | null;
  evaluation?: Record<string, unknown> | null;
  startedAt: string;
  completedAt: string | null;
  matchesPlayed: number;
  progress: number;
}

export interface PlayerLearningProfile {
  id: string;
  playerId: string;
  overallLevel: number;
  overallLevelLabel: string;
  placementStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'PROVISIONAL' | 'CONFIRMED';
  activeRole: 'CARRY' | 'SUPPORT' | 'MIDLANE' | 'JUNGLE' | 'OFFLANE' | null;
  explanationDepth: 'FOUNDATIONAL' | 'STANDARD' | 'ADVANCED';
  confidence: number;
  competencies: Array<{ key: string; label: string; description: string; level: number; levelLabel: string; mastery: number; estimatedMastery: number; confidence: number; evidenceCount: number; nextReviewAt: string | null }>;
  levels: Array<{ level: number; key: string; label: string; description: string }>;
}

export interface PlayerLearningProgress {
  profile: PlayerLearningProfile;
  summary: {
    totalEvidence: number;
    completedMissions: number;
    reviewedReplayMoments: number;
    overlayObservations: number;
    counts: Record<string, number>;
  };
  trends: Array<{
    competencyKey: string;
    competencyLabel: string;
    evidenceCount: number;
    previousAverage: number | null;
    recentAverage: number | null;
    delta: number | null;
    direction: 'STABLE' | 'IMPROVING' | 'NEEDS_ATTENTION';
    points: Array<{ score: number; occurredAt: string }>;
  }>;
  timeline: Array<{
    id: string;
    competencyKey: string;
    competencyLabel: string;
    source: 'PLACEMENT' | 'PROMOTION' | 'MATCH' | 'REPLAY' | 'REVIEW' | 'MISSION' | 'OVERLAY';
    sourceLabel: string;
    score: number | null;
    evaluation: string | null;
    title: string;
    detail: string;
    confidence: 'DECLARED' | 'GUIDED' | 'OBSERVED';
    occurredAt: string;
  }>;
  note: string;
}

export interface LearningQuestionView {
  key: string;
  competencyKey: string;
  competencyLabel: string;
  level: number;
  prompt: string;
  context: string;
  principle: string;
  knowledgeKeys: string[];
  options: Array<{ id: string; text: string }>;
}

export interface PlacementSummary {
  band: { key: string; label: string; description: string };
  overallScore: number;
  generalScore: number;
  roleScore: number;
  answered: number;
  total: number;
  strongest: { key: string; label: string; score: number; evidenceCount: number } | null;
  priority: { key: string; label: string; score: number; evidenceCount: number } | null;
  competencies: Array<{ key: string; label: string; score: number; evidenceCount: number }>;
  limitation: string;
}

export interface MissionRecommendation {
  key: string;
  competencyKey: string;
  competencyLabel: string;
  minLevel: number;
  title: string;
  cue: string;
  targetMatches: number;
  observable: boolean;
  successCriteria: Record<string, unknown>;
  replayChecks: string[];
}

export interface EncyclopediaEntry {
  key: string;
  kind: 'concept' | 'hero' | 'item' | 'loadout' | 'eternal_category';
  title: string;
  summary: string;
  details: unknown;
  competencyKey: string | null;
  roles: string[];
  patch: string | null;
  source: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ReplayMarker {
  id: string; gameTime: number; videoTime: number; category: string; title: string; question: string;
  status: LearningReviewStatus; conclusion: string | null;
}

export interface PlayerReplaySession {
  id: string; matchId: string | null; matchPlayerId: string | null; title: string; recordingUrl: string | null;
  durationSeconds: number | null; offsetSeconds: number; status: string; markers: ReplayMarker[]; updatedAt: string;
}

export interface PlayerMatchCoachAnalysis {
  matchId: string;
  matchPlayerId: string;
  heroSlug: string;
  role: string | null;
  result: 'win' | 'loss';
  learningContext: {
    profile: { overallLevel: number; levelLabel: string; explanationDepth: string };
    checkpoint: { key: string; competencyKey: string; competencyLabel: string; prompt: string; context: string; principle: string; options: Array<{ id: string; text: string }> };
  } | null;
  summary: {
    headline: string;
    explanation: string;
    nextMatchCue: string;
    positive: { title: string; evidence: string };
    secondaryInsights: Array<{ id: string; title: string; evidence: string }>;
    confidence: { level: 'low' | 'medium' | 'high'; basis: string };
  };
  metrics: {
    killParticipation: number;
    teamKillParticipationAverage: number;
    gpm: number | null;
    dpm: number | null;
    csPerMinute: number | null;
    laneGoldDelta: number | null;
    laneGoldMinute: number | null;
    deathsBeforeObjectives: number;
    positionedDeaths: number;
    wardsPlaced: number;
    wardEvents: number;
    objectiveSecures: number;
  };
  coverage: {
    scoreboard: boolean;
    goldTimeline: boolean;
    abilityOrder: boolean;
    eventPositions: boolean;
    wardEvents: boolean;
    objectiveEvents: boolean;
    disclaimer: string;
  };
  learningMoments: LearningMoment[];
  sections: {
    abilities: EducationalCoachObservation[];
    economy: EducationalCoachObservation[];
    combat: EducationalCoachObservation[];
    objectives: EducationalCoachObservation[];
  };
}

export interface PlayerBuildReview {
  playerId: string;
  period: { days: number; from: string; to: string };
  matches: Array<{
    match: {
      id: string;
      predggUuid: string;
      startTime: string;
      duration: number;
      gameMode: string;
      version: string | null;
    };
    analysis: MatchBuildAnalysis;
  }>;
}

export interface PlayerBenchmarkResponse {
  heroSlug: string;
  role: string | null;
  gameMode: string | null;
  oauth: { grantedScopes: string[]; missingScopes: string[] };
  benchmark: {
    available: boolean;
    reason: string | null;
    player?: Record<string, number> | null;
    population?: Record<string, number> | null;
    comparison?: Array<{ key: string; player: number; population: number; delta: number }>;
    rating?: { points: number; percentile: number | null; rating: { id: string; name: string; startTime: string; endTime: string | null }; rank: { name: string; tierName: string } | null } | null;
  };
  specialists: { available: boolean; reason: string | null; results: Array<{ player: { id: string; name: string }; matchesPlayed: number; matchesWon: number; winrate: number }> };
  matchups: { available: boolean; reason: string | null; results: unknown[] };
  ratingDistribution: { available: boolean; reason: string | null; results: unknown[] };
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
    scout: (id: string) => fetchApi<ScoutingProfile>(`/players/${id}/scout`),
    championPoolContext: (id: string, filters: { days?: number; role?: string; gameMode?: string; heroSlug?: string }) => {
      const params = new URLSearchParams();
      if (filters.days) params.set('days', String(filters.days));
      if (filters.role) params.set('role', filters.role);
      if (filters.gameMode) params.set('gameMode', filters.gameMode);
      if (filters.heroSlug) params.set('heroSlug', filters.heroSlug);
      return fetchApi<ChampionPoolContext>(`/players/${id}/champion-pool-context?${params}`);
    },
    benchmarks: (id: string, filters: { heroSlug: string; role?: string; gameMode?: string }) => {
      const params = new URLSearchParams({ heroSlug: filters.heroSlug });
      if (filters.role) params.set('role', filters.role);
      if (filters.gameMode) params.set('gameMode', filters.gameMode);
      return fetchApi<PlayerBenchmarkResponse>(`/players/${id}/benchmarks?${params}`);
    },
    compare: (playerIdA: string, playerIdB: string) =>
      fetchApi<{ players: [PlayerProfile, PlayerProfile]; deltas: unknown[] }>('/players/compare', {
        method: 'POST',
        body: JSON.stringify({ playerIdA, playerIdB }),
      }),
    seasons: (id: string) => fetchApi<PlayerSeasons>(`/players/${id}/seasons`),
    advancedMetrics: (id: string) => fetchApi<PlayerAdvancedMetrics>(`/players/${id}/advanced-metrics`),
    setCustomName: (id: string, customName: string | null) =>
      fetchApi<{ player: { id: string; customName: string | null; displayName: string } }>(`/players/${id}/name`, {
        method: 'PATCH',
        body: JSON.stringify({ customName }),
      }),
    searchPredgg: (q: string) =>
      fetchApi<{ results: PredggSearchResult[] }>(`/players/search-predgg?q=${encodeURIComponent(q)}`),
  },

  teams: {
    list: (type?: 'OWN' | 'RIVAL') => {
      const params = type ? `?type=${type}` : '';
      return fetchApi<{ teams: TeamProfile[] }>(`/teams${params}`);
    },
    getProfile: (id: string) => fetchApi<TeamProfile>(`/teams/${id}`),
    create: (data: { name: string; abbreviation?: string; logoUrl?: string; type: 'OWN' | 'RIVAL'; region?: string; notes?: string; additionalRoles?: string[] }) =>
      fetchApi<TeamProfile>('/teams', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; abbreviation?: string | null; logoUrl?: string | null; region?: string | null; notes?: string | null }) =>
      fetchApi<TeamProfile>(`/teams/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      fetchApi<{ ok: boolean }>(`/teams/${id}`, { method: 'DELETE' }),
    addPlayer: (teamId: string, playerId: string, role?: TeamRole, rosterStatus?: RosterStatus) =>
      fetchApi<{ id: string }>(`/teams/${teamId}/roster`, { method: 'POST', body: JSON.stringify({ playerId, role, rosterStatus }) }),
    updateRoster: (teamId: string, rosterId: string, role: TeamRole | null, rosterStatus?: RosterStatus) =>
      fetchApi<{ id: string }>(`/teams/${teamId}/roster/${rosterId}`, { method: 'PATCH', body: JSON.stringify({ role, rosterStatus }) }),
    removePlayer: (teamId: string, rosterId: string) =>
      fetchApi<{ ok: boolean }>(`/teams/${teamId}/roster/${rosterId}`, { method: 'DELETE' }),
    updateMember: (teamId: string, userId: string, role: string) =>
      fetchApi<{ ok: boolean }>(`/teams/${teamId}/members/${userId}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    removeMember: (teamId: string, userId: string) =>
      fetchApi<{ ok: boolean }>(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' }),
    getAnalysis: (id: string) => fetchApi<TeamAnalysis>(`/teams/${id}/analysis`),
    getPhaseAnalysis: (id: string) => fetchApi<TeamPhaseAnalysis>(`/teams/${id}/phase-analysis`),
    getVisionAnalysis: (id: string) => fetchApi<TeamVisionAnalysis>(`/teams/${id}/vision-analysis`),
    getObjectiveAnalysis: (id: string) => fetchApi<TeamObjectiveAnalysis>(`/teams/${id}/objective-analysis`),
    getDraftAnalysis: (id: string) => fetchApi<TeamDraftAnalysis>(`/teams/${id}/draft-analysis`),
    getRivalScouting: (id: string) => fetchApi<RivalScoutingReport>(`/teams/${id}/rival-scouting`),
    syncMatches: (id: string, limit = 10) =>
      fetchApi<{ synced: number; errors: number; remaining: number }>(`/teams/${id}/sync-matches`, {
        method: 'POST', body: JSON.stringify({ limit }),
      }),
    getRivalRoster: (teamId: string) =>
      fetchApi<{ entries: RivalRosterEntry[] }>(`/teams/${teamId}/rival-roster`),
    addRivalRosterPlayer: (teamId: string, predggId: string, role?: string | null) =>
      fetchApi<RivalRosterEntry>(`/teams/${teamId}/rival-roster`, {
        method: 'POST', body: JSON.stringify({ predggId, role: role ?? null }),
      }),
    removeRivalRosterPlayer: (teamId: string, playerId: string) =>
      fetchApi<{ ok: boolean }>(`/teams/${teamId}/rival-roster/${playerId}`, { method: 'DELETE' }),
  },

  heroes: {
    meta: () => fetchApi<{ heroes: HeroMeta[] }>('/hero-meta'),
  },

  feedback: {
    submit: (data: { type: 'bug' | 'suggestion' | 'improvement'; section: string; description: string; screenshotBase64?: string | null }) =>
      fetchApi<{ ok: boolean; id: string }>('/feedback', { method: 'POST', body: JSON.stringify(data) }),
    unreadCount: () => fetchApi<{ count: number }>('/feedback/unread-count'),
    list: (status?: string, type?: string) => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (type) params.set('type', type);
      return fetchApi<{ reports: FeedbackItem[] }>(`/feedback?${params}`);
    },
    getDetail: (id: string) => fetchApi<{ report: FeedbackItem & { screenshotBase64?: string | null } }>(`/feedback/${id}`),
    update: (id: string, data: { status?: 'NEW' | 'REVIEWED' | 'DISMISSED'; reviewNote?: string | null }) =>
      fetchApi<{ report: FeedbackItem }>(`/feedback/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    sections: () => fetchApi<{ sections: string[] }>('/feedback/sections'),
  },

  profile: {
    get: () => fetchApi<{ user: UserProfile }>('/profile'),
    update: (data: { name?: string; bio?: string | null; avatarUrl?: string | null; timezone?: string | null; language?: string }) =>
      fetchApi<{ user: UserProfile }>('/profile', { method: 'PATCH', body: JSON.stringify(data) }),
    changeEmail: (email: string, currentPassword: string) =>
      fetchApi<{ user: UserProfile }>('/profile/email', { method: 'PATCH', body: JSON.stringify({ email, currentPassword }) }),
    changePassword: (currentPassword: string, newPassword: string) =>
      fetchApi<{ ok: boolean }>('/profile/password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) }),
    linkPlayer: (playerId: string) =>
      fetchApi<{ user: UserProfile; player: { id: string; displayName: string; customName: string | null } }>('/profile/link-player', { method: 'POST', body: JSON.stringify({ playerId }) }),
    unlinkPlayer: () =>
      fetchApi<{ ok: boolean }>('/profile/link-player', { method: 'DELETE' }),
    disconnectSocial: (provider: 'discord' | 'epic' | 'steam') =>
      fetchApi<{ ok: boolean }>(`/profile/social/${provider}`, { method: 'DELETE' }),
    getAccess: () =>
      fetchApi<{ access: EffectiveAccess; features: Record<string, boolean> }>('/profile/access'),
  },

  matches: {
    getDetail: (id: string) => fetchApi<MatchDetail>(`/matches/${id}`),
    syncPlayers: (id: string) => fetchApi<MatchDetail>(`/matches/${id}/sync`, { method: 'POST' }),
    getEvents: (id: string) => fetchApi<MatchEvents>(`/matches/${id}/events`),
    getLive: (predggUuid: string) => fetchApi<LiveMatchResponse>(`/matches/live/${predggUuid}`),
    buildAnalysis: (matchId: string, matchPlayerId: string) =>
      fetchApi<MatchBuildAnalysis>(`/matches/${matchId}/build-analysis/${matchPlayerId}`),
    liveBuildAnalysis: (predggUuid: string) =>
      fetchApi<MatchBuildAnalysis>(`/matches/live/${predggUuid}/build-analysis`),
    coachAnalysis: (matchId: string, matchPlayerId: string) =>
      fetchApi<PlayerMatchCoachAnalysis>(`/matches/${matchId}/coach-analysis/${matchPlayerId}`),
    liveCoachAnalysis: (predggUuid: string) =>
      fetchApi<PlayerMatchCoachAnalysis>(`/matches/live/${predggUuid}/coach-analysis`),
  },

  playerLearning: {
    profile: () => fetchApi<{ profile: PlayerLearningProfile; recommendation: MissionRecommendation }>('/player-learning/profile/me'),
    progress: () => fetchApi<PlayerLearningProgress>('/player-learning/progress/me'),
    updateProfile: (activeRole: PlayerLearningProfile['activeRole']) => fetchApi<{ profile: PlayerLearningProfile }>('/player-learning/profile/me', { method: 'PATCH', body: JSON.stringify({ activeRole }) }),
    placement: () => fetchApi<{ status: PlayerLearningProfile['placementStatus']; questions: LearningQuestionView[]; answered: number; total: number; summary: PlacementSummary | null; note: string }>('/player-learning/placement'),
    answerQuestion: (questionKey: string, selectedOptionId: string, sourceType: 'PLACEMENT' | 'MATCH' | 'REPLAY' | 'REVIEW' | 'PROMOTION' = 'PLACEMENT', sourceMatchId?: string | null) =>
      fetchApi<{ result: { questionKey: string; competencyKey: string; competencyLabel: string; evaluation: string; score: number; feedback: string; principle: string; nextReviewAt: string | null } }>(`/player-learning/questions/${encodeURIComponent(questionKey)}/answer`, { method: 'POST', body: JSON.stringify({ selectedOptionId, sourceType, sourceMatchId }) }),
    recommendedMission: () => fetchApi<{ mission: MissionRecommendation; templates: MissionRecommendation[] }>('/player-learning/missions/recommended'),
    promotion: () => fetchApi<{ eligible: boolean; reason?: string; competency?: { key: string; label: string; currentLevel: number }; question?: LearningQuestionView }>('/player-learning/promotion'),
    knowledgeCoverage: () => fetchApi<{ status: 'ready' | 'partial'; patch: { name: string } | null; lastKnowledgeSync: string | null; domains: Record<string, { total: number; complete: number; percent: number }>; gaps: string[]; disclaimer: string }>('/player-learning/knowledge/coverage'),
    searchKnowledge: (query: string, kind?: EncyclopediaEntry['kind']) => {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (kind) params.set('kind', kind);
      return fetchApi<{ entries: EncyclopediaEntry[]; patch: string | null }>(`/player-learning/knowledge?${params}`);
    },
    reviews: (matchId: string, matchPlayerId: string) =>
      fetchApi<{ reviews: LearningMomentReview[] }>(`/player-learning/matches/${encodeURIComponent(matchId)}/reviews?matchPlayerId=${encodeURIComponent(matchPlayerId)}`),
    saveReview: (matchId: string, momentId: string, data: { matchPlayerId: string; status: LearningReviewStatus; note?: string | null }) =>
      fetchApi<{ review: LearningMomentReview }>(`/player-learning/matches/${encodeURIComponent(matchId)}/reviews/${encodeURIComponent(momentId)}`, { method: 'PUT', body: JSON.stringify(data) }),
    cycles: () => fetchApi<{ cycles: PlayerTrainingCycle[] }>('/player-learning/cycles/me'),
    createCycle: (data: { focusKey: string; title: string; cue: string; targetMatches?: number; sourceMatchId?: string | null; sourceMomentId?: string | null; competencyKey?: string | null; learningLevel?: number | null; successCriteria?: Record<string, unknown> | null }) =>
      fetchApi<{ cycle: PlayerTrainingCycle }>('/player-learning/cycles', { method: 'POST', body: JSON.stringify(data) }),
    updateCycle: (id: string, status: 'COMPLETED' | 'ARCHIVED', evaluation?: { outcome: 'ACHIEVED' | 'PARTIAL' | 'NOT_YET'; reflection: string }) =>
      fetchApi<{ cycle: PlayerTrainingCycle }>(`/player-learning/cycles/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status, evaluation }) }),
    replays: () => fetchApi<{ sessions: PlayerReplaySession[] }>('/player-learning/replays'),
    createReplay: (data: { matchId?: string | null; matchPlayerId?: string | null; title: string; recordingUrl?: string | null; durationSeconds?: number | null; offsetSeconds?: number; markers?: Array<{ gameTime: number; sourceEventId?: string | null; category: string; title: string; question: string }> }) =>
      fetchApi<{ session: PlayerReplaySession }>('/player-learning/replays', { method: 'POST', body: JSON.stringify(data) }),
    updateReplayMarker: (sessionId: string, markerId: string, status: LearningReviewStatus, conclusion?: string | null) =>
      fetchApi<{ marker: ReplayMarker }>(`/player-learning/replays/${encodeURIComponent(sessionId)}/markers/${encodeURIComponent(markerId)}`, { method: 'PATCH', body: JSON.stringify({ status, conclusion }) }),
    startLiveSession: (requestedGameMode: string) => fetchApi<{ session: { id: string; requestedGameMode: string; modeVerification: string; status: string }; canAdvise: boolean; reason: string }>('/player-learning/live/sessions', { method: 'POST', body: JSON.stringify({ requestedGameMode, captureConsent: true }) }),
    verifyLiveMode: (sessionId: string, detectedGameMode: string, signal: { source: 'screen_ocr' | 'screen_template' | 'match_api'; confidence: number; capturedAt: string }) =>
      fetchApi<{ session: { id: string; detectedGameMode: string | null; modeVerification: string; status: string }; canAdvise: boolean; reason: string | null }>(`/player-learning/live/sessions/${encodeURIComponent(sessionId)}/verify-mode`, { method: 'POST', body: JSON.stringify({ detectedGameMode, signal }) }),
    submitLiveObservation: (sessionId: string, data: {
      gameTime?: number | null;
      eventType: 'RECALL_WINDOW' | 'OBJECTIVE_PREPARATION' | 'VISION_OPPORTUNITY' | 'BUILD_ADAPTATION' | 'SKILL_LEVEL_AVAILABLE' | 'MINIMAP_INFORMATION' | 'DEATH_REVIEW';
      confidence: number;
      observation: { competencyKey: string; learningScore?: number; explanation: string; detector: string; rubricId?: string; inputs: string[]; missingInputs?: string[]; capturedAt: string; inCombat: boolean; state?: Record<string, unknown> };
      candidateAdvice?: { priority: 'NORMAL' | 'HIGH'; title: string; cue: string; reason: string; principle: string } | null;
    }) => fetchApi<{ event: { id: string }; delivery: 'SPEAK' | 'SILENT_REVIEW'; advice: { priority: 'NORMAL' | 'HIGH'; title: string; cue: string; reason: string; principle: string } | null; reason: string | null }>(`/player-learning/live/sessions/${encodeURIComponent(sessionId)}/observations`, { method: 'POST', body: JSON.stringify(data) }),
  },

  reports: {
    scrim: (ownTeamId: string, rivalTeamId: string) =>
      fetchApi<ScrimReport>('/reports/scrim', {
        method: 'POST',
        body: JSON.stringify({ ownTeamId, rivalTeamId }),
      }),
    playerWeekly: (playerId: string) =>
      fetchApi<PlayerWeeklyReport>(`/reports/player-weekly/${encodeURIComponent(playerId)}`),
    playerBuilds: (playerId: string, options: { days?: number; limit?: number } = {}) => {
      const params = new URLSearchParams();
      if (options.days) params.set('days', String(options.days));
      if (options.limit) params.set('limit', String(options.limit));
      return fetchApi<PlayerBuildReview>(`/reports/player-builds/${encodeURIComponent(playerId)}${params.size ? `?${params}` : ''}`);
    },
    playerCoachChat: (playerId: string, question: string, history: Array<{ role: 'user' | 'assistant'; content: string }>) =>
      fetchApi<PlayerCoachChatResponse>(`/reports/player-coach/${encodeURIComponent(playerId)}/chat`, {
        method: 'POST',
        body: JSON.stringify({ question, history }),
      }),
  },

  analyst: {
    insights: (teamId: string, lang?: string) => {
      const params = lang ? `?lang=${encodeURIComponent(lang)}` : '';
      return fetchApi<{ insights: Insight[] }>(`/analysis/insights/${teamId}${params}`);
    },
    summaryUrl: (teamId: string) => `${API_BASE}/analysis/insights/${teamId}/summary`,
    llmStatus: () => fetchApi<{ enabled: boolean }>('/analysis/llm-status'),
    saveFeedback: (analysisId: string, feedback: 'positive' | 'negative', correction?: string) =>
      fetchApi<{ ok: boolean }>(`/analysis/insights/summary/${analysisId}/feedback`, {
        method: 'PATCH',
        body: JSON.stringify({ feedback, correction }),
      }),
  },

  mapZones: {
    list: () => fetchApi<{ zones: MapZone[] }>('/map-zones'),
    seed: () => fetchApi<{ ok: boolean; created: number; updated: number; total: number }>(
      '/map-zones/seed', { method: 'POST' }
    ),
  },

  review: {
    list: (teamId: string, params?: { status?: string; priority?: string; limit?: number }) => {
      const p = new URLSearchParams({ teamId });
      if (params?.status) p.set('status', params.status);
      if (params?.priority) p.set('priority', params.priority);
      if (params?.limit) p.set('limit', String(params.limit));
      return fetchApi<{ items: ReviewItem[]; total: number }>(`/review/items?${p}`);
    },
    create: (data: { teamId: string; eventType: string; priority: string; reason: string; insightId?: string; matchId?: string; playerId?: string }) =>
      fetchApi<ReviewItem>('/review/items', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { status?: string; tag?: string; coachComment?: string; assignedTo?: string; actionItem?: string; vodUrl?: string }) =>
      fetchApi<ReviewItem>(`/review/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      fetchApi<{ ok: boolean }>(`/review/items/${id}`, { method: 'DELETE' }),
  },

  vod: {
    list: (params: { teamId?: string; matchId?: string }) => {
      const p = new URLSearchParams();
      if (params.teamId) p.set('teamId', params.teamId);
      if (params.matchId) p.set('matchId', params.matchId);
      return fetchApi<{ vods: VodLink[] }>(`/vod?${p}`);
    },
    create: (data: VodLinkInput) =>
      fetchApi<{ vod: VodLink }>('/vod', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<VodLinkInput>) =>
      fetchApi<{ vod: VodLink }>(`/vod/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      fetchApi<{ ok: boolean }>(`/vod/${id}`, { method: 'DELETE' }),
  },

  goals: {
    listTeam: (teamId: string) =>
      fetchApi<{ goals: TeamGoal[] }>(`/review/goals/team/${teamId}`),
    createTeam: (data: { teamId: string; title: string; description?: string; metricId?: string; baselineValue?: number; targetValue?: number; timeframe?: string; priority?: string }) =>
      fetchApi<TeamGoal>('/review/goals/team', { method: 'POST', body: JSON.stringify(data) }),
    updateTeam: (id: string, data: { title?: string; currentValue?: number; status?: string; targetValue?: number; timeframe?: string }) =>
      fetchApi<TeamGoal>(`/review/goals/team/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteTeam: (id: string) =>
      fetchApi<{ ok: boolean }>(`/review/goals/team/${id}`, { method: 'DELETE' }),
    listPlayer: (teamId: string, playerId?: string) => {
      const p = new URLSearchParams();
      if (playerId) p.set('playerId', playerId);
      return fetchApi<{ goals: PlayerGoal[] }>(`/review/goals/player/${teamId}?${p}`);
    },
    createPlayer: (data: { playerId: string; teamId: string; title: string; description?: string; metricId?: string; baselineValue?: number; targetValue?: number; coachNote?: string; visibility?: string }) =>
      fetchApi<PlayerGoal>('/review/goals/player', { method: 'POST', body: JSON.stringify(data) }),
    updatePlayer: (id: string, data: { title?: string; description?: string | null; metricId?: string | null; targetValue?: number | null; currentValue?: number | null; coachNote?: string | null; visibility?: string; status?: string }) =>
      fetchApi<PlayerGoal>(`/review/goals/player/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deletePlayer: (id: string) =>
      fetchApi<{ ok: boolean }>(`/review/goals/player/${id}`, { method: 'DELETE' }),
  },

  auth: {
    me: () => fetchApi<{ authenticated: boolean }>('/auth/me'),
    logout: () => fetchApi<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
    loginUrl: () => `${API_DIRECT}/auth/predgg`,
    internalMe: () => fetchApi<{ user: SessionUser }>('/internal-auth/me'),
    internalLogin: (email: string, password: string) =>
      fetchApi<{ user: SessionUser }>('/internal-auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    internalLogout: () => fetchApi<{ ok: boolean }>('/internal-auth/logout', { method: 'POST' }),
    refresh: () => fetchApi<{ ok: boolean }>('/internal-auth/refresh', { method: 'POST' }),
    register: (token: string, name: string, password: string) =>
      fetchApi<{ user: SessionUser }>('/internal-auth/register', {
        method: 'POST',
        body: JSON.stringify({ token, name, password }),
      }),
  },

  invitations: {
    get: (token: string) => fetchApi<{ invitation: PublicInvitation }>(`/invitations/${encodeURIComponent(token)}`),
    list: (teamId?: string) => {
      const params = new URLSearchParams(teamId ? { teamId } : {});
      return fetchApi<{ invitations: Invitation[] }>(`/invitations${params.toString() ? `?${params}` : ''}`);
    },
    create: (data: { email: string; teamId?: string; role: string; playerId?: string }) =>
      fetchApi<{ invitation: Invitation }>('/invitations', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) => fetchApi<{ ok: boolean }>(`/invitations/${id}`, { method: 'DELETE' }),
  },

  admin: {
    syncHeroes: () =>
      fetchApi<{ ok: boolean; synced: number; errors: number }>('/admin/sync-heroes', { method: 'POST' }),
    syncGameCatalog: (versionId?: string) =>
      fetchApi<{ ok: boolean; version: string; items: number; perks: number; eternalCategories: number }>('/admin/sync-game-catalog', { method: 'POST', body: JSON.stringify({ versionId }) }),
    syncVersions: () =>
      fetchApi<AdminSyncVersionsResult>('/admin/sync-versions', { method: 'POST' }),
    syncStaleAll: () =>
      fetchApi<{ ok: boolean; totalStale: number; totalSynced: number; totalErrors: number; batches: number }>('/admin/sync-stale-all', { method: 'POST' }),
    syncStale: () =>
      fetchApi<AdminSyncStaleResult>('/admin/sync-stale', { method: 'POST' }),
    syncIncompleteMatches: () =>
      fetchApi<{ synced: number; errors: number; elapsed: number }>('/admin/sync-incomplete-matches', { method: 'POST' }),
    syncStatus: () => fetchApi<SyncStatus>('/admin/sync-status'),
    startEventStreamSync: () => fetchApi<{ ok: boolean; message: string; job: EventStreamJob }>('/admin/sync-event-streams/start', { method: 'POST' }),
    stopEventStreamSync: () => fetchApi<{ ok: boolean; job: EventStreamJob }>('/admin/sync-event-streams/stop', { method: 'POST' }),
    eventStreamSyncStatus: () => fetchApi<EventStreamJob>('/admin/sync-event-streams/status'),
    fixHeroKillPlayerIds: () =>
      fetchApi<{ heroKillsUpdated: number; objectiveKillsUpdated: number; wardEventsUpdated: number; placeholdersCreated: number; elapsed: number }>('/admin/fix-herokill-player-ids', { method: 'POST' }),
    startCron: () => fetchApi<{ ok: boolean; cron: CronJob }>('/admin/sync-cron/start', { method: 'POST' }),
    stopCron: () => fetchApi<{ ok: boolean; cron: CronJob }>('/admin/sync-cron/stop', { method: 'POST' }),
    runCronNow: () => fetchApi<{ ok: boolean; message: string }>('/admin/sync-cron/run-now', { method: 'POST' }),
    cronStatus: () => fetchApi<CronJob>('/admin/sync-cron/status'),
    users: () => fetchApi<{ users: unknown[] }>('/admin/users'),
    updateUser: (id: string, data: { isActive?: boolean; globalRole?: string; name?: string; email?: string; playerTier?: string; playerTierExpiresAt?: string | null }) =>
      fetchApi<{ user: unknown }>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    resetPassword: (id: string, newPassword: string) =>
      fetchApi<{ ok: boolean }>(`/admin/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),
    verifyNonsyncable: (limit = 50) =>
      fetchApi<{ ok: boolean; checked: number; recovered: number }>('/admin/verify-nonsyncable', { method: 'POST', body: JSON.stringify({ limit }) }),
    updateTeamTier: (teamId: string, teamTier: string, teamTierExpiresAt?: string | null) =>
      fetchApi<{ team: unknown }>(`/admin/teams/${teamId}/tier`, { method: 'PATCH', body: JSON.stringify({ teamTier, teamTierExpiresAt }) }),
    apiStatus: () => fetchApi<unknown>('/admin/api-status'),
    getConfig: () => fetchApi<{ config: PlatformConfigEntry[] }>('/admin/config'),
    updateConfig: (key: string, value: number) =>
      fetchApi<{ config: PlatformConfigEntry }>(`/admin/config/${key}`, { method: 'PATCH', body: JSON.stringify({ value }) }),
    resetConfig: (key: string) =>
      fetchApi<{ config: PlatformConfigEntry }>(`/admin/config/${key}/reset`, { method: 'POST' }),
    updateConfigText: (key: string, textValue: string) =>
      fetchApi<{ config: PlatformConfigEntry }>(`/admin/config/${key}/text`, { method: 'PATCH', body: JSON.stringify({ textValue }) }),
    syncLogs: (limit = 50, entity?: string, status?: string, source?: string) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (entity) params.set('entity', entity);
      if (status) params.set('status', status);
      if (source) params.set('source', source);
      return fetchApi<{ logs: SyncLog[]; total: number }>(`/admin/sync-logs?${params}`);
    },
    getPermissions: () =>
      fetchApi<{ permissions: PlatformPermissions; roles: string[]; defaults: PlatformPermissions }>('/admin/permissions'),
    savePermissions: (permissions: PlatformPermissions) =>
      fetchApi<{ ok: boolean }>('/admin/permissions', { method: 'PUT', body: JSON.stringify({ permissions }) }),
    resetPermissions: () =>
      fetchApi<{ ok: boolean; permissions: PlatformPermissions }>('/admin/permissions/reset', { method: 'POST' }),
  },

  sync: {
    myMatches: () =>
      fetchApi<{ newMatches: number; syncedMatches: number; message: string; enrichment: PlayerMatchEnrichmentStatus }>('/sync/my-matches', { method: 'POST' }),
    matchCoverage: () =>
      fetchApi<PlayerMatchEnrichmentStatus>('/sync/my-matches/coverage'),
    enrichMyMatches: (retryFailed = false) =>
      fetchApi<PlayerMatchEnrichmentStatus>('/sync/my-matches/enrich', {
        method: 'POST',
        body: JSON.stringify({ retryFailed }),
      }),
  },

  schedule: {
    list: (teamId: string) =>
      fetchApi<{ items: ScrimScheduleItem[] }>(`/schedule?teamId=${encodeURIComponent(teamId)}`),
    create: (data: { teamId: string; scheduledAt: string; type?: 'SCRIM' | 'OFFICIAL' | 'PRACTICE'; rivalTeamId?: string; rivalName?: string; notes?: string }) =>
      fetchApi<{ item: ScrimScheduleItem }>('/schedule', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { scheduledAt?: string; type?: 'SCRIM' | 'OFFICIAL' | 'PRACTICE'; status?: 'PENDIENTE' | 'CONFIRMADO' | 'CANCELADO'; rivalTeamId?: string | null; rivalName?: string | null; notes?: string | null; result?: 'WIN' | 'LOSS' | 'DRAW' | null }) =>
      fetchApi<{ item: ScrimScheduleItem }>(`/schedule/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      fetchApi<{ ok: boolean }>(`/schedule/${id}`, { method: 'DELETE' }),
    pendingTasks: (teamId: string) =>
      fetchApi<{ tasks: PostMatchTask[] }>(`/schedule/pending-tasks?teamId=${encodeURIComponent(teamId)}`),
    dismissTask: (id: string, taskType: 'analysis' | 'review') =>
      fetchApi<{ item: ScrimScheduleItem; session: { id: string; title: string } | null }>(`/schedule/${id}/dismiss`, { method: 'PATCH', body: JSON.stringify({ taskType }) }),
  },

  weeklyGoals: {
    mine: () => fetchApi<{ goals: WeeklyGoalItem[]; weekStart: string }>('/weekly-goals/me'),
    progress: () => fetchApi<{ evaluations: WeeklyGoalEvaluation[]; weekStart: string }>('/weekly-goals/me/progress'),
    create: (data: { title: string; metricKey?: WeeklyGoalItem['metricKey']; targetValue?: number; playerId?: string }) =>
      fetchApi<{ goal: WeeklyGoalItem }>('/weekly-goals', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { currentValue?: number; status?: WeeklyGoalItem['status']; title?: string; targetValue?: number | null }) =>
      fetchApi<{ goal: WeeklyGoalItem }>(`/weekly-goals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      fetchApi<{ ok: boolean }>(`/weekly-goals/${id}`, { method: 'DELETE' }),
  },

  comms: {
    list: (teamId: string) =>
      fetchApi<{ items: TeamCommItem[] }>(`/comms?teamId=${encodeURIComponent(teamId)}`),
    create: (data: { teamId: string; type: TeamCommItem['type']; subject: string; body: string; toRole?: string; toUserId?: string; priority?: 'normal' | 'urgent' }) =>
      fetchApi<{ item: TeamCommItem }>('/comms', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { status?: TeamCommItem['status']; body?: string }) =>
      fetchApi<{ item: TeamCommItem }>(`/comms/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      fetchApi<{ ok: boolean }>(`/comms/${id}`, { method: 'DELETE' }),
  },

  playbook: {
    list: (teamId: string) =>
      fetchApi<{ entries: PlaybookEntry[] }>(`/playbook?teamId=${encodeURIComponent(teamId)}`),
    create: (data: { teamId: string; title: string; body: string; category?: string; phase?: PlaybookEntry['phase']; roles?: PlaybookEntry['roles']; pinned?: boolean; mapSnapshot?: string | null }) =>
      fetchApi<{ entry: PlaybookEntry }>('/playbook', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { title?: string; body?: string; category?: string; phase?: PlaybookEntry['phase']; roles?: PlaybookEntry['roles']; pinned?: boolean; mapSnapshot?: string | null }) =>
      fetchApi<{ entry: PlaybookEntry }>(`/playbook/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      fetchApi<{ ok: boolean }>(`/playbook/${id}`, { method: 'DELETE' }),
  },

  reviewSessions: {
    list: (teamId: string) =>
      fetchApi<{ sessions: ReviewSession[] }>(`/review-sessions?teamId=${encodeURIComponent(teamId)}`),
    get: (id: string) =>
      fetchApi<{ session: ReviewSession }>(`/review-sessions/${id}`),
    create: (data: { teamId: string; title: string; notes?: string; scrimId?: string; scheduledAt?: string }) =>
      fetchApi<{ session: ReviewSession }>('/review-sessions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { title?: string; notes?: string | null; status?: ReviewSessionStatus; scheduledAt?: string | null; completedAt?: string | null }) =>
      fetchApi<{ session: ReviewSession }>(`/review-sessions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      fetchApi<{ ok: boolean }>(`/review-sessions/${id}`, { method: 'DELETE' }),
    createAgendaItem: (sessionId: string, data: { title: string; description?: string; vodTimestamp?: number; playerRef?: string }) =>
      fetchApi<{ item: AgendaItem }>(`/review-sessions/${sessionId}/agenda`, { method: 'POST', body: JSON.stringify(data) }),
    updateAgendaItem: (sessionId: string, itemId: string, data: { title?: string; description?: string | null; vodTimestamp?: number | null; playerRef?: string | null; reviewed?: boolean; order?: number }) =>
      fetchApi<{ item: AgendaItem }>(`/review-sessions/${sessionId}/agenda/${itemId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteAgendaItem: (sessionId: string, itemId: string) =>
      fetchApi<{ ok: boolean }>(`/review-sessions/${sessionId}/agenda/${itemId}`, { method: 'DELETE' }),
    createActionItem: (sessionId: string, data: { title: string; assignedTo?: string; dueDate?: string }) =>
      fetchApi<{ item: ActionItem }>(`/review-sessions/${sessionId}/actions`, { method: 'POST', body: JSON.stringify(data) }),
    updateActionItem: (sessionId: string, itemId: string, data: { title?: string; assignedTo?: string | null; status?: ActionItemStatus; dueDate?: string | null }) =>
      fetchApi<{ item: ActionItem }>(`/review-sessions/${sessionId}/actions/${itemId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteActionItem: (sessionId: string, itemId: string) =>
      fetchApi<{ ok: boolean }>(`/review-sessions/${sessionId}/actions/${itemId}`, { method: 'DELETE' }),
  },

  missions: {
    me: (role?: string) => fetchApi<{ missions: MissionItem[]; role: string | null; allComplete: boolean }>(`/missions/me${role ? `?role=${encodeURIComponent(role)}` : ''}`),
    complete: (missionId: string) => fetchApi<{ ok: boolean }>(`/missions/complete/${missionId}`, { method: 'POST' }),
    achievements: () => fetchApi<{ achievements: UserAchievement[] }>('/missions/achievements'),
    markOnboardingSeen: () => fetchApi<{ ok: boolean }>('/missions/onboarding-seen', { method: 'PATCH' }),
  },
};
