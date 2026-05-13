/**
 * Dual-tier access model for PrimeSight.
 *
 * Two independent tier axes:
 *   - Team tier  (FREE → PRO → TEAM → ENTERPRISE): controls org/team features
 *   - Player tier (FREE → PRO → PREMIUM):           controls individual player features
 *
 * Access is ADDITIVE: a user gets features from BOTH their effective team tier
 * AND their player tier simultaneously. There is no conflict — the domains are separate.
 *
 * Effective team tier = highest tier among all OWN teams the user is a member of
 *   (not expired). A user in a TEAM-tier org sees TEAM features even if their
 *   personal playerTier is FREE.
 *
 * Effective player tier = user.playerTier (if not expired).
 *
 * Feature gating: call canAccess(feature, { teamTier, playerTier }) where
 *   feature is a key from FEATURE_REQUIREMENTS.
 */

// ── Tier rank helpers ─────────────────────────────────────────────────────────

export type TeamTier = 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE';
export type PlayerTier = 'FREE' | 'PRO' | 'PREMIUM';

const TEAM_TIER_RANK: Record<TeamTier, number> = {
  FREE: 0, PRO: 1, TEAM: 2, ENTERPRISE: 3,
};

const PLAYER_TIER_RANK: Record<PlayerTier, number> = {
  FREE: 0, PRO: 1, PREMIUM: 2,
};

export function teamTierAtLeast(effective: TeamTier, required: TeamTier): boolean {
  return TEAM_TIER_RANK[effective] >= TEAM_TIER_RANK[required];
}

export function playerTierAtLeast(effective: PlayerTier, required: PlayerTier): boolean {
  return PLAYER_TIER_RANK[effective] >= PLAYER_TIER_RANK[required];
}

// ── Feature map ───────────────────────────────────────────────────────────────
//
// Each feature specifies the minimum tier on each axis.
// null means "not gated by this axis" (always accessible if the other axis grants).
// A feature gated on BOTH axes requires both conditions.
// A feature gated on ONE axis only needs that one condition.

interface FeatureRequirement {
  teamTier?: TeamTier;   // min team tier required (null = not gated on team axis)
  playerTier?: PlayerTier; // min player tier required (null = not gated on player axis)
}

export const FEATURES = {
  // ── Always free ────────────────────────────────────────────────────────────
  DASHBOARD:              {} as FeatureRequirement,
  PLAYER_SEARCH:          {} as FeatureRequirement,
  MATCH_VIEW_BASIC:       {} as FeatureRequirement,

  // ── Team features ──────────────────────────────────────────────────────────
  TEAM_ANALYSIS:          { teamTier: 'FREE'        } as FeatureRequirement,
  TEAM_ROSTER:            { teamTier: 'FREE'        } as FeatureRequirement,
  RIVAL_SCOUTING:         { teamTier: 'FREE'        } as FeatureRequirement,
  SCRIM_REPORT:           { teamTier: 'PRO'         } as FeatureRequirement,
  REVIEW_QUEUE:           { teamTier: 'PRO'         } as FeatureRequirement,
  TEAM_GOALS:             { teamTier: 'PRO'         } as FeatureRequirement,
  ANALYST_INSIGHTS:       { teamTier: 'PRO'         } as FeatureRequirement,
  DISCORD_BOT:            { teamTier: 'TEAM'        } as FeatureRequirement,
  LLM_TEAM_INSIGHTS:      { teamTier: 'TEAM'        } as FeatureRequirement,
  TACTICAL_BOARD:         { teamTier: 'TEAM'        } as FeatureRequirement,
  TACTICAL_TIMELINE:      { teamTier: 'TEAM'        } as FeatureRequirement,
  MULTI_TEAM:             { teamTier: 'TEAM'        } as FeatureRequirement,
  API_ACCESS:             { teamTier: 'ENTERPRISE'  } as FeatureRequirement,
  WHITE_LABEL:            { teamTier: 'ENTERPRISE'  } as FeatureRequirement,

  // ── Player features ────────────────────────────────────────────────────────
  PERSONAL_STATS_BASIC:   { playerTier: 'FREE'      } as FeatureRequirement,  // last 20 matches
  PERSONAL_STATS_FULL:    { playerTier: 'PRO'       } as FeatureRequirement,  // full history
  PERSONAL_ADVANCED:      { playerTier: 'PRO'       } as FeatureRequirement,  // GPM, DPM, KP…
  PERSONAL_INSIGHTS:      { playerTier: 'PRO'       } as FeatureRequirement,  // individual insight rules
  PLAYER_GOALS:           { playerTier: 'PRO'       } as FeatureRequirement,
  LLM_PERSONAL_COACH:     { playerTier: 'PREMIUM'   } as FeatureRequirement,
  FOCUS_OF_THE_DAY:       { playerTier: 'PREMIUM'   } as FeatureRequirement,
  PERSONAL_TREND_ANALYSIS:{ playerTier: 'PREMIUM'   } as FeatureRequirement,

  // ── Hybrid (either team PRO OR player PRO grants access) ──────────────────
  MATCH_DETAIL_FULL:      { teamTier: 'PRO', playerTier: 'PRO' } as FeatureRequirement,
  EVENT_STREAM_VIEW:      { teamTier: 'PRO', playerTier: 'PRO' } as FeatureRequirement,
} as const;

export type FeatureKey = keyof typeof FEATURES;

// ── Access check ──────────────────────────────────────────────────────────────

export interface EffectiveAccess {
  teamTier: TeamTier;
  playerTier: PlayerTier;
}

/**
 * Returns true if the user's effective tiers grant access to the feature.
 *
 * For hybrid features (both axes defined), access is granted if EITHER axis
 * satisfies the requirement (union/OR logic).
 */
export function canAccess(feature: FeatureKey, access: EffectiveAccess): boolean {
  const req = FEATURES[feature];

  const teamOk = req.teamTier
    ? teamTierAtLeast(access.teamTier, req.teamTier)
    : false;

  const playerOk = req.playerTier
    ? playerTierAtLeast(access.playerTier, req.playerTier)
    : false;

  // No requirements on either axis → always accessible
  if (!req.teamTier && !req.playerTier) return true;

  // Only team axis gated
  if (req.teamTier && !req.playerTier) return teamOk;

  // Only player axis gated
  if (!req.teamTier && req.playerTier) return playerOk;

  // Both axes defined (hybrid) → OR: either axis sufficient
  return teamOk || playerOk;
}

// ── Compute effective access from raw user data ───────────────────────────────

interface UserWithMemberships {
  playerTier: string;
  playerTierExpiresAt: Date | null;
  memberships: Array<{
    team: {
      type: string;
      teamTier: string;
      teamTierExpiresAt: Date | null;
    };
  }>;
}

export function getEffectiveAccess(user: UserWithMemberships): EffectiveAccess {
  const now = new Date();

  // Player tier (check expiry)
  const playerTier: PlayerTier =
    !user.playerTierExpiresAt || user.playerTierExpiresAt > now
      ? (user.playerTier as PlayerTier) ?? 'FREE'
      : 'FREE';

  // Effective team tier = highest active tier across all OWN teams
  const teamTier: TeamTier = user.memberships
    .filter((m) => m.team.type === 'OWN')
    .filter((m) => !m.team.teamTierExpiresAt || m.team.teamTierExpiresAt > now)
    .map((m) => (m.team.teamTier as TeamTier) ?? 'FREE')
    .sort((a, b) => TEAM_TIER_RANK[b] - TEAM_TIER_RANK[a])[0] ?? 'FREE';

  return { teamTier, playerTier };
}

// ── Full access summary (for profile / admin display) ─────────────────────────

export function getAccessSummary(access: EffectiveAccess): Record<FeatureKey, boolean> {
  return Object.fromEntries(
    (Object.keys(FEATURES) as FeatureKey[]).map((key) => [key, canAccess(key, access)]),
  ) as Record<FeatureKey, boolean>;
}
