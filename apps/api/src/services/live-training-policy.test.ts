import { describe, expect, it } from 'vitest';
import { evaluateLiveMode, evaluateLiveModeSignals } from './live-training-policy.js';

describe('live training safety policy', () => {
  it.each(['RANKED', 'competitive', 'ranked_solo', 'RANKED_DUO'])('permanently blocks ranked alias %s', (mode) => {
    expect(evaluateLiveMode(mode, 1)).toMatchObject({ verification: 'BLOCKED_RANKED', status: 'BLOCKED', canAdvise: false });
  });

  it('never advises from a manually requested allowed mode', () => {
    expect(evaluateLiveMode('STANDARD')).toMatchObject({ verification: 'UNVERIFIED', status: 'PENDING', canAdvise: false });
  });

  it('fails closed on unknown and low-confidence detections', () => {
    expect(evaluateLiveMode('UNKNOWN', 1).canAdvise).toBe(false);
    expect(evaluateLiveMode('ARAM', 0.84).canAdvise).toBe(false);
  });

  it('allows only a high-confidence detection of an explicit non-ranked mode', () => {
    expect(evaluateLiveMode('labs', 0.9)).toMatchObject({ verification: 'VERIFIED_ALLOWED', status: 'ACTIVE', canAdvise: true });
  });

  it('requires two different automatic sources before enabling advice', () => {
    const first = { source: 'screen_ocr' as const, detectedGameMode: 'QUICK', confidence: 0.96, capturedAt: '2026-08-27T12:00:00.000Z' };
    expect(evaluateLiveModeSignals([first])).toMatchObject({ verification: 'UNVERIFIED', canAdvise: false });
    expect(evaluateLiveModeSignals([first, { ...first, source: 'screen_template' }])).toMatchObject({ verification: 'VERIFIED_ALLOWED', status: 'ACTIVE', canAdvise: true });
  });

  it('blocks immediately when a reliable automatic signal identifies ranked', () => {
    expect(evaluateLiveModeSignals([{ source: 'screen_ocr', detectedGameMode: 'competitive', confidence: 0.75, capturedAt: '2026-08-27T12:00:00.000Z' }])).toMatchObject({ verification: 'BLOCKED_RANKED', canAdvise: false });
  });

  it('fails closed when automatic signals conflict', () => {
    expect(evaluateLiveModeSignals([
      { source: 'screen_ocr', detectedGameMode: 'QUICK', confidence: 0.95, capturedAt: '2026-08-27T12:00:00.000Z' },
      { source: 'screen_template', detectedGameMode: 'ARAM', confidence: 0.95, capturedAt: '2026-08-27T12:00:01.000Z' },
    ])).toMatchObject({ verification: 'BLOCKED_UNKNOWN', canAdvise: false });
  });
});
