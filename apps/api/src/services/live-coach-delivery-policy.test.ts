import { describe, expect, it } from 'vitest';
import { decideLiveCoachDelivery } from './live-coach-delivery-policy.js';

const candidate = {
  priority: 'NORMAL' as const,
  title: 'Ventana de compra',
  cue: 'Puede ser un buen momento para volver a base.',
  reason: 'Hay oro para completar una pieza y la oleada está resuelta.',
  principle: 'Convierte el oro cuando el coste de volver sea bajo.',
};
const now = new Date('2026-08-27T12:10:00Z');

describe('live coach delivery policy', () => {
  it('speaks only when the observation is reliable and the player is not fighting', () => {
    expect(decideLiveCoachDelivery({ eventType: 'RECALL_WINDOW', confidence: 0.92, inCombat: false, candidateAdvice: candidate, recentAdvice: [], now })).toMatchObject({ delivery: 'SPEAK', advice: candidate });
    expect(decideLiveCoachDelivery({ eventType: 'RECALL_WINDOW', confidence: 0.7, inCombat: false, candidateAdvice: candidate, recentAdvice: [], now }).delivery).toBe('SILENT_REVIEW');
    expect(decideLiveCoachDelivery({ eventType: 'RECALL_WINDOW', confidence: 0.95, inCombat: true, candidateAdvice: candidate, recentAdvice: [], now }).delivery).toBe('SILENT_REVIEW');
  });

  it('enforces a cooldown and suppresses repeated concepts', () => {
    expect(decideLiveCoachDelivery({
      eventType: 'BUILD_ADAPTATION', confidence: 0.95, inCombat: false, candidateAdvice: candidate,
      recentAdvice: [{ eventType: 'OBJECTIVE_PREPARATION', createdAt: new Date('2026-08-27T12:09:20Z') }], now,
    }).reason).toContain('recientemente');
    expect(decideLiveCoachDelivery({
      eventType: 'BUILD_ADAPTATION', confidence: 0.95, inCombat: false, candidateAdvice: candidate,
      recentAdvice: [{ eventType: 'BUILD_ADAPTATION', createdAt: new Date('2026-08-27T12:06:00Z') }], now,
    }).reason).toContain('concepto');
  });

  it('limits normal interventions to four in ten minutes', () => {
    const recentAdvice = [2, 4, 6, 8].map((minutes) => ({ eventType: `OTHER_${minutes}`, createdAt: new Date(now.getTime() - minutes * 60_000) }));
    expect(decideLiveCoachDelivery({ eventType: 'VISION_OPPORTUNITY', confidence: 0.95, inCombat: false, candidateAdvice: candidate, recentAdvice, now }).reason).toContain('presupuesto');
  });
});
