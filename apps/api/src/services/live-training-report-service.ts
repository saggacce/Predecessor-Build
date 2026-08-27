export interface LiveTrainingReportEventInput {
  id: string;
  eventType: string;
  gameTime: number | null;
  evidence: unknown;
  advice: string | null;
  createdAt: Date;
}

export interface LiveTrainingReviewMoment {
  eventId: string;
  eventType: string;
  title: string;
  category: string;
  captureTimeSeconds: number;
  observedFact: string;
  inference: string;
  limitation: string;
  replayQuestion: string;
  suggestedClip: { startSeconds: number; endSeconds: number };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

const missingInputLabels: Record<string, string> = {
  positioning: 'el posicionamiento',
  available_vision: 'la visión disponible',
  movement: 'el movimiento previo',
  cooldowns: 'los recursos disponibles',
  player_intent: 'la intención de la jugada',
  hero: 'el héroe utilizado',
  current_ability_levels: 'los niveles de habilidad',
  recommended_skill_order: 'el orden contextual',
  combat_state: 'el estado de combate',
};

function eventCopy(eventType: string) {
  if (eventType === 'DEATH_REVIEW') return {
    title: 'Revisa la decisión anterior a la muerte',
    category: 'review_autonomy',
    observedFact: 'El HUD mostró la pantalla propia de reaparición.',
    inference: 'Hubo una secuencia previa que merece revisión; la causa no está determinada por esta señal.',
    replayQuestion: 'Mira los 15 segundos anteriores: ¿qué información era visible, qué recursos tenías y qué alternativa más segura existía?',
  };
  if (eventType === 'SKILL_LEVEL_AVAILABLE') return {
    title: 'Comprueba el tiempo con una habilidad pendiente',
    category: 'micro_concepts',
    observedFact: 'El HUD mostró un aviso explícito de punto de habilidad disponible.',
    inference: 'El punto pudo permanecer sin asignar durante esta lectura; no se conoce todavía cuánto tiempo ni qué habilidad convenía.',
    replayQuestion: '¿Cuánto tiempo estuvo disponible el punto y qué necesidad inmediata —limpieza, daño, movilidad o supervivencia— debía guiar la elección?',
  };
  return {
    title: 'Revisa esta señal visible',
    category: 'review_autonomy',
    observedFact: 'El acompañante registró una señal visible durante la captura.',
    inference: 'La señal puede ayudar a localizar una decisión, pero no demuestra por sí sola si fue correcta.',
    replayQuestion: '¿Qué información tenías en ese momento y qué alternativas eran realmente ejecutables?',
  };
}

export function buildLiveTrainingReview(startedAt: Date, events: LiveTrainingReportEventInput[]) {
  const reviewMoments: LiveTrainingReviewMoment[] = events.map((event) => {
    const evidence = objectValue(event.evidence);
    const copy = eventCopy(event.eventType);
    const captureTimeSeconds = event.gameTime ?? Math.max(0, Math.floor((event.createdAt.getTime() - startedAt.getTime()) / 1000));
    const missingInputs = stringArray(evidence.missingInputs);
    const limitation = missingInputs.length
      ? `Antes de concluir faltan ${missingInputs.map((input) => missingInputLabels[input] ?? input).join(', ')}.`
      : 'La señal visible no sustituye el contexto completo del replay.';
    return {
      eventId: event.id,
      eventType: event.eventType,
      title: copy.title,
      category: copy.category,
      captureTimeSeconds,
      observedFact: copy.observedFact,
      inference: copy.inference,
      limitation,
      replayQuestion: copy.replayQuestion,
      suggestedClip: { startSeconds: Math.max(0, captureTimeSeconds - 15), endSeconds: captureTimeSeconds + 10 },
    };
  });
  const priority = (eventType: string) => eventType === 'DEATH_REVIEW' ? 0 : eventType === 'BUILD_ADAPTATION' ? 1 : eventType === 'SKILL_LEVEL_AVAILABLE' ? 2 : 3;
  const focus = [...reviewMoments].sort((left, right) => priority(left.eventType) - priority(right.eventType) || left.captureTimeSeconds - right.captureTimeSeconds);
  const scoredObservations = events.filter((event) => {
    const evidence = objectValue(event.evidence);
    return typeof evidence.learningScore === 'number' && typeof evidence.rubricId === 'string';
  }).length;
  return {
    primaryFocus: focus[0] ?? null,
    secondaryFocus: focus.slice(1, 3),
    reviewMoments,
    strengths: [] as Array<{ title: string; explanation: string }>,
    strengthsLimitation: 'Los detectores actuales localizan momentos de revisión, pero todavía no identifican decisiones positivas con fiabilidad.',
    learningImpact: {
      scoredObservations,
      unscoredObservations: events.length - scoredObservations,
      canPromote: false,
      explanation: scoredObservations
        ? 'Las observaciones con rúbrica pueden contribuir a una competencia, pero una sesión de overlay nunca concede un ascenso por sí sola.'
        : 'Estas observaciones no modifican tu dominio ni permiten ascender: primero debes confirmarlas mediante práctica, replay o una prueba.',
    },
    nextPractice: focus[0]
      ? { title: focus[0].title, cue: focus[0].replayQuestion }
      : null,
  };
}
