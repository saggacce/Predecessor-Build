import { describe, expect, it } from 'vitest';
import { evaluateLiveMode } from './live-training-policy.js';

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
});
