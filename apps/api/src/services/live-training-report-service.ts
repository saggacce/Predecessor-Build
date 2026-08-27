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

export type LiveDetectorReadinessStatus =
  | 'VERIFIED_THIS_SESSION'
  | 'SIGNAL_CAPTURED'
  | 'AVAILABLE_UNVALIDATED'
  | 'PENDING_IMPLEMENTATION'
  | 'SAFETY_BLOCKED';

export interface LiveDetectorReadinessItem {
  key: string;
  label: string;
  area: string;
  status: LiveDetectorReadinessStatus;
  sessionSignals: number;
  whatItCanProve: string;
  limitation: string;
  nextStep: string;
  quality: {
    labelledSamples: number;
    confirmedSignals: number;
    falsePositives: number;
    notVerifiable: number;
    minimumForEstimate: number;
    estimatedSignalPrecision: number | null;
    status: 'NO_SAMPLES' | 'COLLECTING' | 'MINIMUM_REACHED';
  };
}

export interface LiveDetectorReadiness {
  overallStatus: 'SAFETY_BLOCKED' | 'NEEDS_MODE_CALIBRATION' | 'MODE_ONLY' | 'PARTIAL_EVIDENCE';
  implementedCount: number;
  totalCount: number;
  observedThisSession: number;
  canEstimateAccuracy: false;
  accuracyExplanation: string;
  detectors: LiveDetectorReadinessItem[];
}

export interface LiveDetectorValidationInput {
  eventType: string;
  signalAssessment: 'CONFIRMED_SIGNAL' | 'FALSE_POSITIVE' | 'NOT_VERIFIABLE';
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

const DETECTOR_MINIMUM_LABELLED_SAMPLES = 20;

function detectorQuality(eventTypes: string[], validations: LiveDetectorValidationInput[]): LiveDetectorReadinessItem['quality'] {
  const relevant = validations.filter((validation) => eventTypes.includes(validation.eventType));
  const confirmedSignals = relevant.filter((validation) => validation.signalAssessment === 'CONFIRMED_SIGNAL').length;
  const falsePositives = relevant.filter((validation) => validation.signalAssessment === 'FALSE_POSITIVE').length;
  const notVerifiable = relevant.filter((validation) => validation.signalAssessment === 'NOT_VERIFIABLE').length;
  const evaluable = confirmedSignals + falsePositives;
  return {
    labelledSamples: relevant.length,
    confirmedSignals,
    falsePositives,
    notVerifiable,
    minimumForEstimate: DETECTOR_MINIMUM_LABELLED_SAMPLES,
    estimatedSignalPrecision: evaluable >= DETECTOR_MINIMUM_LABELLED_SAMPLES ? confirmedSignals / evaluable : null,
    status: relevant.length === 0 ? 'NO_SAMPLES' : evaluable >= DETECTOR_MINIMUM_LABELLED_SAMPLES ? 'MINIMUM_REACHED' : 'COLLECTING',
  };
}

export function buildLiveDetectorReadiness(
  modeVerification: string,
  events: LiveTrainingReportEventInput[],
  verificationSignals: unknown = [],
  validations: LiveDetectorValidationInput[] = [],
): LiveDetectorReadiness {
  const signalCount = Array.isArray(verificationSignals) ? verificationSignals.length : 0;
  const eventCount = (eventType: string) => events.filter((event) => event.eventType === eventType).length;
  const deathSignals = eventCount('DEATH_REVIEW');
  const skillSignals = eventCount('SKILL_LEVEL_AVAILABLE');
  const blocked = modeVerification === 'BLOCKED_RANKED' || modeVerification === 'BLOCKED_UNKNOWN';
  const verified = modeVerification === 'VERIFIED_ALLOWED';
  const detectors: LiveDetectorReadinessItem[] = [
    {
      key: 'mode_safety',
      label: 'Protección del modo de juego',
      area: 'Seguridad',
      status: blocked ? 'SAFETY_BLOCKED' : verified ? 'VERIFIED_THIS_SESSION' : 'AVAILABLE_UNVALIDATED',
      sessionSignals: signalCount,
      whatItCanProve: 'Reconoce el rótulo del modo mediante OCR y exige una segunda señal visual independiente antes de habilitar el coach.',
      limitation: 'No identifica por sí solo el estado de la partida ni sustituye una fuente oficial del modo.',
      nextStep: blocked ? 'La captura debe permanecer detenida.' : verified ? 'Mantener la regla de bloqueo ante cualquier señal contradictoria.' : 'Calibrar una plantilla en una sesión y verificarla en otra captura permitida.',
      quality: detectorQuality([], validations),
    },
    {
      key: 'death_review',
      label: 'Pantalla propia de reaparición',
      area: 'Revisión',
      status: deathSignals > 0 ? 'SIGNAL_CAPTURED' : 'AVAILABLE_UNVALIDATED',
      sessionSignals: deathSignals,
      whatItCanProve: 'Localiza un momento posterior a una muerte propia para abrir el replay en el intervalo anterior.',
      limitation: 'No demuestra la causa de la muerte, el posicionamiento ni qué alternativa era ejecutable.',
      nextStep: deathSignals > 0 ? 'Confirmar en el replay que el marcador coincide con una muerte propia.' : 'Probar una muerte propia en Práctica o contra IA y revisar el marcador generado.',
      quality: detectorQuality(['DEATH_REVIEW'], validations),
    },
    {
      key: 'skill_point',
      label: 'Punto de habilidad disponible',
      area: 'Habilidades',
      status: skillSignals > 0 ? 'SIGNAL_CAPTURED' : 'AVAILABLE_UNVALIDATED',
      sessionSignals: skillSignals,
      whatItCanProve: 'Detecta un aviso visible de punto de habilidad pendiente.',
      limitation: 'No sabe todavía cuánto tiempo estuvo pendiente ni qué habilidad convenía subir.',
      nextStep: skillSignals > 0 ? 'Comprobar en el replay la duración del aviso y el contexto de la subida.' : 'Provocar una subida de nivel en Práctica y comprobar si se registra una sola señal.',
      quality: detectorQuality(['SKILL_LEVEL_AVAILABLE'], validations),
    },
    {
      key: 'inventory_build',
      label: 'Inventario, compras y evolución de build',
      area: 'Build',
      status: 'PENDING_IMPLEMENTATION',
      sessionSignals: 0,
      whatItCanProve: 'Todavía no aporta evidencia automática.',
      limitation: 'No se leen de forma fiable objetos propios, orden de compra, oro ni momento de regreso a base.',
      nextStep: 'Calibrar regiones del HUD e identificar objetos con datos versionados antes de emitir recomendaciones.',
      quality: detectorQuality(['BUILD_ADAPTATION', 'RECALL_WINDOW'], validations),
    },
    {
      key: 'scoreboard_context',
      label: 'Marcador y builds de ambos equipos',
      area: 'Contexto rival',
      status: 'PENDING_IMPLEMENTATION',
      sessionSignals: 0,
      whatItCanProve: 'Todavía no aporta evidencia automática.',
      limitation: 'No se conoce la build visible de aliados o rivales ni la antigüedad de esa lectura.',
      nextStep: 'Detectar cuándo está abierto el marcador y extraer una instantánea con sello temporal.',
      quality: detectorQuality([], validations),
    },
    {
      key: 'minimap_context',
      label: 'Minimapa, visión y objetivos visibles',
      area: 'Macro',
      status: 'PENDING_IMPLEMENTATION',
      sessionSignals: 0,
      whatItCanProve: 'Todavía no aporta evidencia automática.',
      limitation: 'No se reconstruyen rutas, intención, niebla de guerra ni posiciones que no fueran visibles.',
      nextStep: 'Empezar por eventos discretos y verificables; no inferir pathing o posicionamiento desde una sola imagen.',
      quality: detectorQuality(['MINIMAP_INFORMATION', 'VISION_OPPORTUNITY', 'OBJECTIVE_PREPARATION'], validations),
    },
  ];
  const observedThisSession = detectors.filter((detector) => detector.status === 'VERIFIED_THIS_SESSION' || detector.status === 'SIGNAL_CAPTURED').length;
  return {
    overallStatus: blocked ? 'SAFETY_BLOCKED' : !verified ? 'NEEDS_MODE_CALIBRATION' : observedThisSession > 1 ? 'PARTIAL_EVIDENCE' : 'MODE_ONLY',
    implementedCount: detectors.filter((detector) => detector.status !== 'PENDING_IMPLEMENTATION').length,
    totalCount: detectors.length,
    observedThisSession,
    canEstimateAccuracy: false,
    accuracyExplanation: detectors.some((detector) => detector.quality.estimatedSignalPrecision !== null)
      ? 'La precisión mostrada sólo mide cuántas señales emitidas fueron confirmadas; todavía no permite medir eventos omitidos ni falsos negativos.'
      : 'Aún no hay suficientes capturas reales etiquetadas para estimar el acierto de las señales. Ver una señal no equivale a validar el detector y los falsos negativos requieren un estudio separado.',
    detectors,
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
