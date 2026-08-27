import { describe, expect, it } from 'vitest';
import { buildLiveTrainingReview } from './live-training-report-service.js';

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
});
