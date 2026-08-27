import { describe, expect, it } from 'vitest';
import { compareModeSignatures, isUsableTemplateRect, loadModeTemplates, saveModeTemplates, type ModeTemplate } from './modeTemplateDetector';

function template(overrides: Partial<ModeTemplate> = {}): ModeTemplate {
  return {
    id: 'template-1', mode: 'STANDARD', createdSessionId: 'session-1', createdAt: '2026-08-27T18:00:00.000Z',
    sourceWidth: 1920, sourceHeight: 1080, rect: { x: 0.35, y: 0.08, width: 0.3, height: 0.08 },
    signatureWidth: 40, signatureHeight: 16, signature: Array.from({ length: 640 }, (_, index) => (index % 7) - 3),
    calibrationOcrConfidence: 0.93, reviewedByOcr: true, ...overrides,
  };
}

describe('mode template detector', () => {
  it('accepts a focused crop and rejects full-screen or tiny regions', () => {
    expect(isUsableTemplateRect({ x: 0.35, y: 0.08, width: 0.3, height: 0.08 })).toBe(true);
    expect(isUsableTemplateRect({ x: 0, y: 0, width: 1, height: 1 })).toBe(false);
    expect(isUsableTemplateRect({ x: 0.1, y: 0.1, width: 0.01, height: 0.01 })).toBe(false);
  });

  it('scores identical normalized signatures as a perfect match', () => {
    const values = [3, -2, 7, -8, 5, -1];
    expect(compareModeSignatures(values, values)).toBeCloseTo(1);
    expect(compareModeSignatures(values, values.map((value) => -value))).toBeCloseTo(-1);
    expect(compareModeSignatures(values, [1])).toBe(0);
  });

  it('persists only OCR-reviewed, structurally valid templates', () => {
    let stored = '';
    const storage = { getItem: () => stored || null, setItem: (_key: string, value: string) => { stored = value; } };
    saveModeTemplates([template(), template({ id: 'unsafe', reviewedByOcr: false as true })], storage);
    expect(loadModeTemplates(storage)).toEqual([template()]);
  });
});
