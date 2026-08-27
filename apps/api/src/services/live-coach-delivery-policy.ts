export const LIVE_COACH_EVENT_TYPES = [
  'RECALL_WINDOW',
  'OBJECTIVE_PREPARATION',
  'VISION_OPPORTUNITY',
  'BUILD_ADAPTATION',
  'SKILL_LEVEL_AVAILABLE',
  'MINIMAP_INFORMATION',
  'DEATH_REVIEW',
] as const;

export type LiveCoachEventType = typeof LIVE_COACH_EVENT_TYPES[number];

export interface LiveCoachAdviceCandidate {
  priority: 'NORMAL' | 'HIGH';
  title: string;
  cue: string;
  reason: string;
  principle: string;
}

export function decideLiveCoachDelivery(input: {
  eventType: LiveCoachEventType;
  confidence: number;
  inCombat: boolean;
  candidateAdvice?: LiveCoachAdviceCandidate | null;
  recentAdvice: Array<{ eventType: string; createdAt: Date }>;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const silent = (reason: string) => ({ delivery: 'SILENT_REVIEW' as const, reason, advice: null });
  if (!input.candidateAdvice) return silent('No existe una recomendación determinista para esta observación.');
  if (input.confidence < 0.85) return silent('La observación no alcanza la confianza mínima para interrumpir.');
  if (input.inCombat) return silent('El jugador está en combate; el momento se reserva para el informe.');

  const delivered = input.recentAdvice
    .filter((item) => now.getTime() - item.createdAt.getTime() <= 10 * 60_000)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const last = delivered[0];
  const minimumGap = input.candidateAdvice.priority === 'HIGH' ? 45_000 : 90_000;
  if (last && now.getTime() - last.createdAt.getTime() < minimumGap) {
    return silent('Ya se ha emitido un consejo recientemente.');
  }
  if (delivered.length >= 4) return silent('Se alcanzó el presupuesto máximo de cuatro intervenciones en diez minutos.');
  const duplicate = delivered.find((item) => item.eventType === input.eventType && now.getTime() - item.createdAt.getTime() < 5 * 60_000);
  if (duplicate) return silent('Este concepto ya se explicó recientemente.');

  return { delivery: 'SPEAK' as const, reason: null, advice: input.candidateAdvice };
}
