import type { OcrHudSignal } from './liveModeOcr';

const EVENT_COOLDOWNS_MS: Record<OcrHudSignal['eventType'], number> = {
  DEATH_REVIEW: 45_000,
  SKILL_LEVEL_AVAILABLE: 60_000,
};

type SilentHudObservation = {
  eventType: OcrHudSignal['eventType'];
  confidence: number;
  observation: {
    competencyKey: 'review_autonomy' | 'micro_concepts';
    explanation: string;
    detector: string;
    inputs: string[];
    missingInputs: string[];
    capturedAt: string;
    inCombat: boolean;
    state: Record<string, unknown>;
  };
  candidateAdvice: null;
};

export function shouldRecordHudSignal(signal: OcrHudSignal, previousCapturedAt?: string): boolean {
  if (!previousCapturedAt) return true;
  const current = Date.parse(signal.capturedAt);
  const previous = Date.parse(previousCapturedAt);
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return false;
  return current - previous >= EVENT_COOLDOWNS_MS[signal.eventType];
}

export function buildSilentHudObservation(signal: OcrHudSignal): SilentHudObservation {
  if (signal.eventType === 'DEATH_REVIEW') {
    return {
      eventType: signal.eventType,
      confidence: signal.confidence,
      observation: {
        competencyKey: 'review_autonomy',
        explanation: 'La pantalla muestra el estado de reaparición. Se guarda este momento para revisar la causa en el replay, sin atribuirla a posicionamiento, visión ni mecánicas.',
        detector: 'screen-ocr-hud-v1',
        inputs: ['respawn_indicator'],
        missingInputs: ['positioning', 'available_vision', 'movement', 'cooldowns', 'player_intent'],
        capturedAt: signal.capturedAt,
        inCombat: true,
        state: { matchedLabel: signal.matchedLabel, use: 'post_match_review_only' },
      },
      candidateAdvice: null,
    };
  }
  return {
    eventType: signal.eventType,
    confidence: signal.confidence,
    observation: {
      competencyKey: 'micro_concepts',
      explanation: 'El HUD parece mostrar un punto de habilidad disponible. Se registra para revisar cuánto tiempo permaneció sin asignar, pero no se juzga el orden sin conocer héroe, nivel y situación.',
      detector: 'screen-ocr-hud-v1',
      inputs: ['ability_point_available'],
      missingInputs: ['hero', 'current_ability_levels', 'recommended_skill_order', 'combat_state'],
      capturedAt: signal.capturedAt,
      inCombat: true,
      state: { matchedLabel: signal.matchedLabel, use: 'post_match_review_only' },
    },
    candidateAdvice: null,
  };
}
