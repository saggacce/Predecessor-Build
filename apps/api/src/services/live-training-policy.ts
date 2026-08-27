export const ALLOWED_LIVE_MODES = new Set(['STANDARD', 'QUICK', 'ARAM', 'LABS', 'PRACTICE', 'AI', 'CUSTOM']);
export const RANKED_LIVE_MODES = new Set(['RANKED', 'COMPETITIVE', 'RANKED_SOLO', 'RANKED_DUO']);

export interface LiveModeSignal {
  source: 'screen_ocr' | 'screen_template' | 'match_api';
  detectedGameMode: string;
  confidence: number;
  capturedAt: string;
}

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

export function evaluateLiveModeSignals(signals: LiveModeSignal[]) {
  const normalizedSignals = signals.map((signal) => ({ ...signal, detectedGameMode: signal.detectedGameMode.trim().toUpperCase() }));
  const ranked = normalizedSignals.find((signal) => RANKED_LIVE_MODES.has(signal.detectedGameMode) && signal.confidence >= 0.7);
  if (ranked) {
    return { normalized: ranked.detectedGameMode, verification: 'BLOCKED_RANKED' as const, status: 'BLOCKED' as const, canAdvise: false };
  }

  const reliable = normalizedSignals.filter((signal) => signal.confidence >= 0.85 && ALLOWED_LIVE_MODES.has(signal.detectedGameMode));
  for (const mode of ALLOWED_LIVE_MODES) {
    const sources = new Set(reliable.filter((signal) => signal.detectedGameMode === mode).map((signal) => signal.source));
    if (sources.size >= 2) {
      return { normalized: mode, verification: 'VERIFIED_ALLOWED' as const, status: 'ACTIVE' as const, canAdvise: true };
    }
  }

  const conflictingModes = new Set(reliable.map((signal) => signal.detectedGameMode));
  if (normalizedSignals.length >= 3 || conflictingModes.size > 1) {
    return { normalized: 'UNKNOWN', verification: 'BLOCKED_UNKNOWN' as const, status: 'BLOCKED' as const, canAdvise: false };
  }
  return { normalized: reliable[0]?.detectedGameMode ?? 'UNKNOWN', verification: 'UNVERIFIED' as const, status: 'PENDING' as const, canAdvise: false };
}
