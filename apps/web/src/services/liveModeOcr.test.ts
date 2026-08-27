import { describe, expect, it } from 'vitest';
import { detectHudSignalsFromOcrText, detectModeFromOcrText } from './liveModeOcr';

describe('live mode OCR interpretation', () => {
  it('recognizes ranked labels before all allowed modes and raises a safe blocking signal', () => {
    expect(detectModeFromOcrText('Predecessor — Partida Clasificatoria', 61, '2026-08-27T18:00:00.000Z')).toEqual({
      detectedGameMode: 'RANKED', confidence: 0.72, capturedAt: '2026-08-27T18:00:00.000Z',
    });
  });

  it.each([
    ['STANDARD MATCH', 'STANDARD'],
    ['PARTIDA RÁPIDA', 'QUICK'],
    ['ARAM', 'ARAM'],
    ['LABORATORIO', 'LABS'],
    ['PRACTICE MODE', 'PRACTICE'],
    ['VS AI', 'AI'],
    ['PARTIDA PERSONALIZADA', 'CUSTOM'],
  ])('maps %s to %s without inflating allowed-mode confidence', (text, expected) => {
    expect(detectModeFromOcrText(text, 88)?.detectedGameMode).toBe(expected);
    expect(detectModeFromOcrText(text, 88)?.confidence).toBe(0.88);
  });

  it('returns no signal for unrelated HUD text', () => {
    expect(detectModeFromOcrText('LEVEL 7 GOLD 2150 FANGTOOTH', 96)).toBeNull();
  });

  it('extracts only conservative HUD observations without retaining OCR text', () => {
    expect(detectHudSignalsFromOcrText('YOU HAVE BEEN SLAIN · RESPAWNING IN 18', 91, '2026-08-27T18:00:00.000Z')).toEqual([{
      eventType: 'DEATH_REVIEW', confidence: 0.91, capturedAt: '2026-08-27T18:00:00.000Z', matchedLabel: 'respawn_indicator',
    }]);
    expect(detectHudSignalsFromOcrText('UPGRADE ABILITY', 88)[0]).toMatchObject({ eventType: 'SKILL_LEVEL_AVAILABLE', confidence: 0.88 });
    expect(detectHudSignalsFromOcrText('RESPAWNING IN 12', 64)).toEqual([]);
  });
});
