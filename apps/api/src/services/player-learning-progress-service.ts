import { competencyLabel } from './player-learning-catalog.js';

export type LearningEvidenceSource = 'PLACEMENT' | 'PROMOTION' | 'MATCH' | 'REPLAY' | 'REVIEW' | 'MISSION' | 'OVERLAY';

export interface LearningProgressAttempt {
  id: string;
  competencyKey: string;
  sourceType: string;
  evaluation: string;
  score: number;
  answeredAt: Date;
}

export interface LearningProgressCycle {
  id: string;
  competencyKey: string | null;
  title: string;
  evaluation: unknown;
  completedAt: Date | null;
}

export interface LearningProgressReplayMarker {
  id: string;
  status: string;
  title: string;
  updatedAt: Date;
}

export interface LearningProgressLiveEvent {
  id: string;
  eventType: string;
  confidence: string;
  evidence: unknown;
  createdAt: Date;
}

interface EvaluationPayload {
  outcome?: string;
  reflection?: string;
}

interface OverlayEvidencePayload {
  competencyKey?: string;
  learningScore?: number;
  explanation?: string;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function missionScore(value: unknown): number | null {
  const outcome = String((objectValue(value) as EvaluationPayload).outcome ?? '').toUpperCase();
  if (outcome === 'ACHIEVED') return 1;
  if (outcome === 'PARTIAL') return 0.6;
  if (outcome === 'NOT_YET') return 0.25;
  return null;
}

function sourceLabel(source: LearningEvidenceSource) {
  const labels: Record<LearningEvidenceSource, string> = {
    PLACEMENT: 'Diagnóstico inicial',
    PROMOTION: 'Prueba de ascenso',
    MATCH: 'Pregunta de partida',
    REPLAY: 'Pregunta de replay',
    REVIEW: 'Revisión guiada',
    MISSION: 'Misión completada',
    OVERLAY: 'Observación del entrenamiento local',
  };
  return labels[source];
}

export function buildLearningProgress(input: {
  attempts: LearningProgressAttempt[];
  cycles: LearningProgressCycle[];
  replayMarkers: LearningProgressReplayMarker[];
  liveEvents: LearningProgressLiveEvent[];
}) {
  const timeline: Array<{
    id: string;
    competencyKey: string;
    competencyLabel: string;
    source: LearningEvidenceSource;
    sourceLabel: string;
    score: number | null;
    evaluation: string | null;
    title: string;
    detail: string;
    confidence: 'DECLARED' | 'GUIDED' | 'OBSERVED';
    occurredAt: string;
  }> = [];

  for (const attempt of input.attempts) {
    const source = (['PLACEMENT', 'PROMOTION', 'MATCH', 'REPLAY', 'REVIEW'].includes(attempt.sourceType)
      ? attempt.sourceType
      : 'REVIEW') as LearningEvidenceSource;
    timeline.push({
      id: `attempt-${attempt.id}`,
      competencyKey: attempt.competencyKey,
      competencyLabel: competencyLabel(attempt.competencyKey),
      source,
      sourceLabel: sourceLabel(source),
      score: attempt.score,
      evaluation: attempt.evaluation,
      title: sourceLabel(source),
      detail: attempt.evaluation === 'ADEQUATE'
        ? 'La respuesta aplicó el principio con un criterio adecuado.'
        : attempt.evaluation === 'UNKNOWN'
          ? 'El jugador declaró que todavía no tenía criterio suficiente.'
          : 'La respuesta señaló un concepto que conviene practicar y revisar.',
      confidence: source === 'PLACEMENT' ? 'DECLARED' : 'GUIDED',
      occurredAt: attempt.answeredAt.toISOString(),
    });
  }

  for (const cycle of input.cycles) {
    if (!cycle.competencyKey || !cycle.completedAt) continue;
    const evaluation = objectValue(cycle.evaluation) as EvaluationPayload;
    timeline.push({
      id: `mission-${cycle.id}`,
      competencyKey: cycle.competencyKey,
      competencyLabel: competencyLabel(cycle.competencyKey),
      source: 'MISSION',
      sourceLabel: sourceLabel('MISSION'),
      score: missionScore(cycle.evaluation),
      evaluation: evaluation.outcome ?? null,
      title: cycle.title,
      detail: evaluation.reflection?.trim() || 'Misión cerrada después de revisar las partidas de práctica.',
      confidence: 'GUIDED',
      occurredAt: cycle.completedAt.toISOString(),
    });
  }

  for (const marker of input.replayMarkers) {
    timeline.push({
      id: `replay-${marker.id}`,
      competencyKey: 'review_autonomy',
      competencyLabel: competencyLabel('review_autonomy'),
      source: 'REPLAY',
      sourceLabel: 'Conclusión de replay',
      score: marker.status === 'INCONCLUSIVE' ? 0.5 : 0.75,
      evaluation: marker.status,
      title: marker.title,
      detail: marker.status === 'INCONCLUSIVE'
        ? 'La evidencia no permitió confirmar una causa; reconocerlo también es una revisión válida.'
        : 'El jugador revisó el vídeo y clasificó el momento con evidencia adicional.',
      confidence: 'GUIDED',
      occurredAt: marker.updatedAt.toISOString(),
    });
  }

  for (const event of input.liveEvents) {
    const evidence = objectValue(event.evidence) as OverlayEvidencePayload;
    if (!evidence.competencyKey) continue;
    const score = typeof evidence.learningScore === 'number'
      ? Math.max(0, Math.min(1, evidence.learningScore))
      : null;
    timeline.push({
      id: `overlay-${event.id}`,
      competencyKey: evidence.competencyKey,
      competencyLabel: competencyLabel(evidence.competencyKey),
      source: 'OVERLAY',
      sourceLabel: sourceLabel('OVERLAY'),
      score,
      evaluation: null,
      title: event.eventType,
      detail: evidence.explanation?.trim() || 'Se registró una señal visible durante una sesión permitida.',
      confidence: event.confidence === 'high' ? 'OBSERVED' : 'GUIDED',
      occurredAt: event.createdAt.toISOString(),
    });
  }

  timeline.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const scoredByCompetency = new Map<string, Array<{ score: number; occurredAt: string }>>();
  for (const item of [...timeline].reverse()) {
    if (item.score == null) continue;
    const values = scoredByCompetency.get(item.competencyKey) ?? [];
    values.push({ score: item.score, occurredAt: item.occurredAt });
    scoredByCompetency.set(item.competencyKey, values);
  }

  const trends = [...scoredByCompetency.entries()].map(([competencyKey, values]) => {
    const split = Math.max(1, Math.floor(values.length / 2));
    const previous = values.slice(0, split);
    const recent = values.slice(split);
    const average = (items: typeof values) => items.length ? items.reduce((sum, item) => sum + item.score, 0) / items.length : null;
    const previousAverage = average(previous);
    const recentAverage = average(recent.length ? recent : previous);
    const delta = previousAverage == null || recentAverage == null ? null : recentAverage - previousAverage;
    return {
      competencyKey,
      competencyLabel: competencyLabel(competencyKey),
      evidenceCount: values.length,
      previousAverage,
      recentAverage,
      delta,
      direction: delta == null || Math.abs(delta) < 0.05 ? 'STABLE' : delta > 0 ? 'IMPROVING' : 'NEEDS_ATTENTION',
      points: values.slice(-12),
    };
  });

  const counts = timeline.reduce<Record<string, number>>((totals, item) => {
    totals[item.source] = (totals[item.source] ?? 0) + 1;
    return totals;
  }, {});

  return {
    summary: {
      totalEvidence: timeline.length,
      completedMissions: input.cycles.filter((cycle) => cycle.completedAt).length,
      reviewedReplayMoments: input.replayMarkers.length,
      overlayObservations: input.liveEvents.filter((event) => objectValue(event.evidence).competencyKey).length,
      counts,
    },
    trends,
    timeline: timeline.slice(0, 80),
    note: 'La evolución combina conocimiento declarado, práctica guiada y señales observadas. Cada fuente conserva su nivel de confianza; no todas pesan igual para ascender.',
  };
}
