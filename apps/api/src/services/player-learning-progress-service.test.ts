import { describe, expect, it } from 'vitest';
import { buildLearningProgress } from './player-learning-progress-service.js';

describe('player learning progress', () => {
  it('keeps declared, guided and observed evidence distinguishable', () => {
    const result = buildLearningProgress({
      attempts: [{
        id: 'a1', competencyKey: 'macro', sourceType: 'PLACEMENT', evaluation: 'ADEQUATE', score: 1,
        answeredAt: new Date('2026-01-01T10:00:00Z'),
      }],
      cycles: [{
        id: 'c1', competencyKey: 'builds', title: 'Adaptar una compra',
        evaluation: { outcome: 'PARTIAL', reflection: 'Detecté la amenaza, pero compré demasiado tarde.' },
        completedAt: new Date('2026-01-03T10:00:00Z'),
      }],
      replayMarkers: [{
        id: 'r1', status: 'INCONCLUSIVE', title: 'Muerte antes de Fangtooth',
        updatedAt: new Date('2026-01-04T10:00:00Z'),
      }],
      liveEvents: [{
        id: 'l1', eventType: 'recall_window', confidence: 'high',
        evidence: { competencyKey: 'macro', learningScore: 0.8, explanation: 'Ventana observada con oro y oleada resuelta.' },
        createdAt: new Date('2026-01-05T10:00:00Z'),
      }],
    });

    expect(result.summary).toMatchObject({ totalEvidence: 4, completedMissions: 1, reviewedReplayMoments: 1, overlayObservations: 1 });
    expect(result.timeline.map((item) => item.confidence)).toEqual(['OBSERVED', 'GUIDED', 'GUIDED', 'DECLARED']);
    expect(result.timeline.find((item) => item.source === 'MISSION')?.score).toBe(0.6);
    expect(result.timeline.find((item) => item.source === 'REPLAY')?.competencyKey).toBe('review_autonomy');
  });

  it('calculates a recent evidence direction without calling it proven mastery', () => {
    const attempts = [0.2, 0.4, 0.8, 1].map((score, index) => ({
      id: `a${index}`, competencyKey: 'builds', sourceType: 'MATCH', evaluation: 'DEFENSIBLE', score,
      answeredAt: new Date(`2026-01-0${index + 1}T10:00:00Z`),
    }));
    const result = buildLearningProgress({ attempts, cycles: [], replayMarkers: [], liveEvents: [] });
    expect(result.trends[0]).toMatchObject({ competencyKey: 'builds', direction: 'IMPROVING', evidenceCount: 4 });
    expect(result.trends[0].delta).toBeCloseTo(0.6);
  });
});
