import { describe, expect, it } from 'vitest';
import { buildLiveDetectorReadiness, buildLiveTrainingReview } from './live-training-report-service.js';

describe('live training review report', () => {
  it('turns visible signals into replay questions without inventing a cause', () => {
    const result = buildLiveTrainingReview(new Date('2026-08-27T18:00:00Z'), [{
      id: 'death-1', eventType: 'DEATH_REVIEW', gameTime: null, advice: null,
      evidence: { competencyKey: 'review_autonomy', missingInputs: ['positioning', 'available_vision'] },
      createdAt: new Date('2026-08-27T18:06:40Z'),
    }]);
    expect(result.primaryFocus).toMatchObject({ eventId: 'death-1', captureTimeSeconds: 400 });
    expect(result.primaryFocus?.observedFact).toContain('reaparición');
    expect(result.primaryFocus?.inference).toContain('causa no está determinada');
    expect(result.primaryFocus?.limitation).toContain('posicionamiento');
    expect(result.primaryFocus?.suggestedClip).toEqual({ startSeconds: 385, endSeconds: 410 });
  });

  it('keeps unscored overlay observations out of promotion decisions', () => {
    const result = buildLiveTrainingReview(new Date('2026-08-27T18:00:00Z'), [{
      id: 'skill-1', eventType: 'SKILL_LEVEL_AVAILABLE', gameTime: 75, advice: null,
      evidence: { competencyKey: 'micro_concepts' }, createdAt: new Date('2026-08-27T18:01:15Z'),
    }]);
    expect(result.learningImpact).toEqual(expect.objectContaining({ scoredObservations: 0, unscoredObservations: 1, canPromote: false }));
    expect(result.strengths).toEqual([]);
    expect(result.strengthsLimitation).toContain('todavía no');
  });

  it('prioritizes a death review but preserves chronological review moments', () => {
    const startedAt = new Date('2026-08-27T18:00:00Z');
    const result = buildLiveTrainingReview(startedAt, [
      { id: 'skill-1', eventType: 'SKILL_LEVEL_AVAILABLE', gameTime: 40, advice: null, evidence: {}, createdAt: new Date('2026-08-27T18:00:40Z') },
      { id: 'death-1', eventType: 'DEATH_REVIEW', gameTime: 80, advice: null, evidence: {}, createdAt: new Date('2026-08-27T18:01:20Z') },
    ]);
    expect(result.reviewMoments.map((moment) => moment.eventId)).toEqual(['skill-1', 'death-1']);
    expect(result.primaryFocus?.eventId).toBe('death-1');
    expect(result.secondaryFocus[0]?.eventId).toBe('skill-1');
  });

  it('reports detector capability without claiming accuracy before real labelled samples exist', () => {
    const events = [{
      id: 'death-1', eventType: 'DEATH_REVIEW', gameTime: 80, advice: null,
      evidence: { detector: 'screen-ocr-hud-v1' }, createdAt: new Date('2026-08-27T18:01:20Z'),
    }];
    const readiness = buildLiveDetectorReadiness('VERIFIED_ALLOWED', events, [
      { source: 'screen_ocr' }, { source: 'screen_template' },
    ]);
    expect(readiness).toMatchObject({
      overallStatus: 'PARTIAL_EVIDENCE', implementedCount: 3, totalCount: 6,
      observedThisSession: 2, canEstimateAccuracy: false,
    });
    expect(readiness.detectors.find((detector) => detector.key === 'mode_safety')).toMatchObject({ status: 'VERIFIED_THIS_SESSION', sessionSignals: 2 });
    expect(readiness.detectors.find((detector) => detector.key === 'death_review')).toMatchObject({ status: 'SIGNAL_CAPTURED', sessionSignals: 1 });
    expect(readiness.detectors.find((detector) => detector.key === 'inventory_build')).toMatchObject({ status: 'PENDING_IMPLEMENTATION', sessionSignals: 0 });
    expect(readiness.accuracyExplanation).toContain('no hay suficientes');
  });

  it('keeps the readiness gate closed until mode verification succeeds', () => {
    const readiness = buildLiveDetectorReadiness('UNVERIFIED', []);
    expect(readiness.overallStatus).toBe('NEEDS_MODE_CALIBRATION');
    expect(readiness.observedThisSession).toBe(0);
    expect(readiness.detectors.slice(0, 3).every((detector) => detector.status === 'AVAILABLE_UNVALIDATED')).toBe(true);
  });

  it('estimates only emitted-signal precision after the minimum labelled sample', () => {
    const validations = [
      ...Array.from({ length: 18 }, () => ({ eventType: 'DEATH_REVIEW', signalAssessment: 'CONFIRMED_SIGNAL' as const })),
      ...Array.from({ length: 2 }, () => ({ eventType: 'DEATH_REVIEW', signalAssessment: 'FALSE_POSITIVE' as const })),
      { eventType: 'DEATH_REVIEW', signalAssessment: 'NOT_VERIFIABLE' as const },
    ];
    const readiness = buildLiveDetectorReadiness('UNVERIFIED', [], [], validations);
    const quality = readiness.detectors.find((detector) => detector.key === 'death_review')?.quality;
    expect(quality).toEqual({
      labelledSamples: 21, confirmedSignals: 18, falsePositives: 2, notVerifiable: 1,
      minimumForEstimate: 20, estimatedSignalPrecision: 0.9, status: 'MINIMUM_REACHED',
    });
    expect(readiness.accuracyExplanation).toContain('eventos omitidos');
  });
});
