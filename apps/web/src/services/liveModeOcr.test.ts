import { describe, expect, it } from 'vitest';
import { detectModeFromOcrText } from './liveModeOcr';

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
});
