export const ALLOWED_LIVE_MODES = new Set(['STANDARD', 'QUICK', 'ARAM', 'LABS', 'PRACTICE', 'AI', 'CUSTOM']);
export const RANKED_LIVE_MODES = new Set(['RANKED', 'COMPETITIVE', 'RANKED_SOLO', 'RANKED_DUO']);

export function evaluateLiveMode(mode: string, confidence?: number) {
  const normalized = mode.trim().toUpperCase();
  if (RANKED_LIVE_MODES.has(normalized)) {
    return { normalized, verification: 'BLOCKED_RANKED' as const, status: 'BLOCKED' as const, canAdvise: false };
  }
  if (confidence === undefined) {
    return { normalized, verification: 'UNVERIFIED' as const, status: 'PENDING' as const, canAdvise: false };
  }
  if (ALLOWED_LIVE_MODES.has(normalized) && confidence >= 0.85) {
    return { normalized, verification: 'VERIFIED_ALLOWED' as const, status: 'ACTIVE' as const, canAdvise: true };
  }
  return { normalized, verification: 'BLOCKED_UNKNOWN' as const, status: 'BLOCKED' as const, canAdvise: false };
}
