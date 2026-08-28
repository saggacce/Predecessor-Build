import type { OcrModeSignal } from './liveModeOcr';

export type NormalizedRect = { x: number; y: number; width: number; height: number };

export type ModeTemplate = {
  id: string;
  mode: OcrModeSignal['detectedGameMode'];
  createdSessionId: string;
  createdAt: string;
  sourceWidth: number;
  sourceHeight: number;
  rect: NormalizedRect;
  signatureWidth: number;
  signatureHeight: number;
  signature: number[];
  calibrationOcrConfidence: number;
  reviewedByOcr: true;
};

const STORAGE_KEY = 'riftline.mode-templates.v1';
const SIGNATURE_WIDTH = 40;
const SIGNATURE_HEIGHT = 16;
const MODES = new Set(['RANKED', 'STANDARD', 'QUICK', 'ARAM', 'LABS', 'PRACTICE', 'AI', 'CUSTOM']);

export function isUsableTemplateRect(rect: NormalizedRect): boolean {
  const inside = rect.x >= 0 && rect.y >= 0 && rect.width > 0 && rect.height > 0
    && rect.x + rect.width <= 1.001 && rect.y + rect.height <= 1.001;
  return inside && rect.width >= 0.025 && rect.height >= 0.015 && rect.width <= 0.65 && rect.height <= 0.35;
}

export function compareModeSignatures(left: number[], right: number[]): number {
  if (!left.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] ** 2;
    rightNorm += right[index] ** 2;
  }
  if (!leftNorm || !rightNorm) return 0;
  return Math.max(-1, Math.min(1, dot / Math.sqrt(leftNorm * rightNorm)));
}

function frameDimensions(frame: HTMLVideoElement | HTMLCanvasElement) {
  return frame instanceof HTMLVideoElement
    ? { width: frame.videoWidth, height: frame.videoHeight }
    : { width: frame.width, height: frame.height };
}

export function captureFrame(video: HTMLVideoElement): HTMLCanvasElement | null {
  if (!video.videoWidth || !video.videoHeight || video.readyState < 2) return null;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(video, 0, 0);
  return canvas;
}

export function cropFrame(frame: HTMLVideoElement | HTMLCanvasElement, rect: NormalizedRect): HTMLCanvasElement | null {
  if (!isUsableTemplateRect(rect)) return null;
  const source = frameDimensions(frame);
  if (!source.width || !source.height) return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * rect.width));
  canvas.height = Math.max(1, Math.round(source.height * rect.height));
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(
    frame,
    Math.round(source.width * rect.x),
    Math.round(source.height * rect.y),
    canvas.width,
    canvas.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
}

function signatureFromCrop(crop: HTMLCanvasElement, width = SIGNATURE_WIDTH, height = SIGNATURE_HEIGHT): number[] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return [];
  context.drawImage(crop, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const grayscale: number[] = [];
  for (let index = 0; index < pixels.length; index += 4) {
    grayscale.push((pixels[index] * 0.299) + (pixels[index + 1] * 0.587) + (pixels[index + 2] * 0.114));
  }
  const mean = grayscale.reduce((sum, value) => sum + value, 0) / grayscale.length;
  const variance = grayscale.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / grayscale.length;
  const deviation = Math.sqrt(variance);
  if (deviation < 2) return [];
  return grayscale.map((value) => Math.max(-64, Math.min(64, Math.round(((value - mean) / deviation) * 20))));
}

export function createModeTemplate(frame: HTMLCanvasElement, rect: NormalizedRect, signal: OcrModeSignal, sessionId: string): ModeTemplate | null {
  const crop = cropFrame(frame, rect);
  if (!crop || signal.confidence < 0.75) return null;
  const signature = signatureFromCrop(crop);
  if (!signature.length) return null;
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `template-${Date.now()}`,
    mode: signal.detectedGameMode,
    createdSessionId: sessionId,
    createdAt: new Date().toISOString(),
    sourceWidth: frame.width,
    sourceHeight: frame.height,
    rect,
    signatureWidth: SIGNATURE_WIDTH,
    signatureHeight: SIGNATURE_HEIGHT,
    signature,
    calibrationOcrConfidence: signal.confidence,
    reviewedByOcr: true,
  };
}

export function modeTemplateRectCandidates(template: ModeTemplate, targetWidth: number, targetHeight: number): NormalizedRect[] {
  if (!targetWidth || !targetHeight) return [];
  const candidates: NormalizedRect[] = [template.rect];
  const heightScale = targetHeight / template.sourceHeight;
  const heightAnchored = {
    x: (template.rect.x * template.sourceWidth * heightScale) / targetWidth,
    y: template.rect.y,
    width: (template.rect.width * template.sourceWidth * heightScale) / targetWidth,
    height: template.rect.height,
  };
  if (isUsableTemplateRect(heightAnchored)) {
    const duplicate = candidates.some((rect) => Math.abs(rect.x - heightAnchored.x) < 0.001
      && Math.abs(rect.y - heightAnchored.y) < 0.001
      && Math.abs(rect.width - heightAnchored.width) < 0.001
      && Math.abs(rect.height - heightAnchored.height) < 0.001);
    if (!duplicate) candidates.push(heightAnchored);
  }
  return candidates;
}

function isModeTemplate(value: unknown): value is ModeTemplate {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ModeTemplate>;
  return typeof item.id === 'string' && typeof item.mode === 'string' && MODES.has(item.mode)
    && typeof item.createdSessionId === 'string' && typeof item.createdAt === 'string'
    && typeof item.sourceWidth === 'number' && typeof item.sourceHeight === 'number'
    && !!item.rect && isUsableTemplateRect(item.rect)
    && item.signatureWidth === SIGNATURE_WIDTH && item.signatureHeight === SIGNATURE_HEIGHT
    && Array.isArray(item.signature) && item.signature.length === SIGNATURE_WIDTH * SIGNATURE_HEIGHT
    && item.signature.every((entry) => Number.isInteger(entry) && entry >= -64 && entry <= 64)
    && item.reviewedByOcr === true && typeof item.calibrationOcrConfidence === 'number' && item.calibrationOcrConfidence >= 0.75;
}

export function loadModeTemplates(storage: Pick<Storage, 'getItem'> = localStorage): ModeTemplate[] {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isModeTemplate).slice(-20) : [];
  } catch {
    return [];
  }
}

export function saveModeTemplates(templates: ModeTemplate[], storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(templates.filter(isModeTemplate).slice(-20)));
}

export function findModeTemplateMatch(frame: HTMLVideoElement | HTMLCanvasElement, sessionId: string, templates: ModeTemplate[]): { template: ModeTemplate; confidence: number; rect: NormalizedRect } | null {
  const dimensions = frameDimensions(frame);
  if (!dimensions.width || !dimensions.height) return null;
  let best: { template: ModeTemplate; confidence: number; rect: NormalizedRect } | null = null;
  for (const template of [...templates].reverse()) {
    if (template.createdSessionId === sessionId) continue;
    for (const rect of modeTemplateRectCandidates(template, dimensions.width, dimensions.height)) {
      const crop = cropFrame(frame, rect);
      if (!crop) continue;
      const signature = signatureFromCrop(crop, template.signatureWidth, template.signatureHeight);
      const confidence = compareModeSignatures(template.signature, signature);
      if (confidence >= 0.94 && (!best || confidence > best.confidence)) best = { template, confidence, rect };
    }
  }
  return best;
}
