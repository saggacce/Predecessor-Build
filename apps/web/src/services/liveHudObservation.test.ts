import { describe, expect, it } from 'vitest';
import { buildSilentHudObservation, shouldRecordHudSignal } from './liveHudObservation';
import type { OcrHudSignal } from './liveModeOcr';

const deathSignal: OcrHudSignal = {
  eventType: 'DEATH_REVIEW', confidence: 0.92, capturedAt: '2026-08-27T18:01:00.000Z', matchedLabel: 'respawn_indicator',
};

describe('live HUD observations', () => {
  it('deduplicates a persistent death screen inside the cooldown', () => {
    expect(shouldRecordHudSignal(deathSignal)).toBe(true);
    expect(shouldRecordHudSignal(deathSignal, '2026-08-27T18:00:30.000Z')).toBe(false);
    expect(shouldRecordHudSignal(deathSignal, '2026-08-27T18:00:00.000Z')).toBe(true);
  });

  it('creates a silent replay marker without inventing a cause or score', () => {
    const observation = buildSilentHudObservation(deathSignal);
    expect(observation.candidateAdvice).toBeNull();
    expect(observation.observation.inCombat).toBe(true);
    expect(observation.observation).not.toHaveProperty('learningScore');
    expect(observation.observation.missingInputs).toContain('positioning');
  });
});
