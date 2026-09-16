import type { NormalizedRect } from './modeTemplateDetector';

export type OcrModeSignal = {
  detectedGameMode: 'RANKED' | 'STANDARD' | 'QUICK' | 'ARAM' | 'LABS' | 'PRACTICE' | 'AI' | 'CUSTOM';
  confidence: number;
  capturedAt: string;
};

export type OcrHudSignal = {
  eventType: 'DEATH_REVIEW' | 'SKILL_LEVEL_AVAILABLE';
  confidence: number;
  capturedAt: string;
  matchedLabel: 'respawn_indicator' | 'ability_point_available';
};

const ALLOWED_CALIBRATION_MODES = new Set<OcrModeSignal['detectedGameMode']>(['STANDARD', 'QUICK', 'ARAM', 'LABS', 'PRACTICE', 'AI', 'CUSTOM']);
const ALLOWED_MODE_VERIFICATION_CONFIDENCE = 0.85;
const RANKED_MODE_BLOCKING_CONFIDENCE = 0.7;

export function isFreshModeSignalForCalibration(signal: OcrModeSignal | null, now = Date.now(), maxAgeMs = 20_000): signal is OcrModeSignal {
  if (!signal || !ALLOWED_CALIBRATION_MODES.has(signal.detectedGameMode)) return false;
  const capturedAt = Date.parse(signal.capturedAt);
  const age = now - capturedAt;
  return Number.isFinite(capturedAt) && age >= -5_000 && age <= maxAgeMs;
}

export function isModeSignalReliableForVerification(signal: OcrModeSignal): boolean {
  return signal.confidence >= (signal.detectedGameMode === 'RANKED'
    ? RANKED_MODE_BLOCKING_CONFIDENCE
    : ALLOWED_MODE_VERIFICATION_CONFIDENCE);
}

const MODE_PATTERNS: Array<[OcrModeSignal['detectedGameMode'], RegExp]> = [
  ['RANKED', /\b(RANKED|COMPETITIVE|CLASIFICATORIA|COMPETITIVA)\b/],
  ['STANDARD', /\b(STANDARD|ESTANDAR|NORMAL)\b/],
  ['QUICK', /\b(QUICK|RAPIDA|RAPIDO)\b/],
  ['ARAM', /\bARAM\b/],
  ['LABS', /\b(LABS?|LABORATORIO)\b/],
  ['PRACTICE', /\b(PRACTICE|PRACTICA|ENTRENAMIENTO)\b/],
  ['AI', /\b(VS\s*AI|BOTS?|IA)\b/],
  ['CUSTOM', /\b(CUSTOM|PERSONALIZADA|PERSONALIZADO)\b/],
];

const HUD_PATTERNS: Array<[OcrHudSignal['eventType'], OcrHudSignal['matchedLabel'], RegExp]> = [
  ['DEATH_REVIEW', 'respawn_indicator', /\b(RESPAWNING IN|YOU DIED|YOU HAVE BEEN SLAIN|REAPARECES EN|HAS MUERTO)\b/],
  ['SKILL_LEVEL_AVAILABLE', 'ability_point_available', /\b(UPGRADE ABILITY|LEVEL UP AVAILABLE|ABILITY POINT AVAILABLE|MEJORA UNA HABILIDAD|PUNTO DE HABILIDAD DISPONIBLE)\b/],
];

function normalizeOcrText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9\s]/g, ' ');
}

export function detectModeFromOcrText(text: string, ocrConfidence: number, capturedAt = new Date().toISOString()): OcrModeSignal | null {
  const normalized = normalizeOcrText(text);
  const match = MODE_PATTERNS.find(([, pattern]) => pattern.test(normalized));
  if (!match) return null;
  const rawConfidence = Math.max(0, Math.min(1, ocrConfidence / 100));
  return {
    detectedGameMode: match[0],
    confidence: match[0] === 'RANKED' ? Math.max(0.72, rawConfidence) : rawConfidence,
    capturedAt,
  };
}

export function detectModeFromOcrRegions(
  text: string,
  documentConfidence: number,
  regions: Array<{ text: string; confidence: number }>,
  capturedAt = new Date().toISOString(),
): OcrModeSignal | null {
  const documentSignal = detectModeFromOcrText(text, documentConfidence, capturedAt);
  if (!documentSignal) return null;
  return regions
    .map((region) => detectModeFromOcrText(region.text, region.confidence, capturedAt))
    .filter((signal): signal is OcrModeSignal => signal?.detectedGameMode === documentSignal.detectedGameMode)
    .reduce((best, signal) => signal.confidence > best.confidence ? signal : best, documentSignal);
}

export function detectHudSignalsFromOcrText(text: string, ocrConfidence: number, capturedAt = new Date().toISOString()): OcrHudSignal[] {
  const confidence = Math.max(0, Math.min(1, ocrConfidence / 100));
  if (confidence < 0.75) return [];
  const normalized = normalizeOcrText(text);
  return HUD_PATTERNS
    .filter(([, , pattern]) => pattern.test(normalized))
    .map(([eventType, matchedLabel]) => ({ eventType, matchedLabel, confidence, capturedAt }));
}

export async function createLiveModeOcr(onProgress?: (progress: number) => void) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', undefined, {
    logger: (message) => {
      if (message.status === 'recognizing text' && typeof message.progress === 'number') onProgress?.(message.progress);
    },
  });
  async function recognize(canvas: HTMLCanvasElement) {
    const result = await worker.recognize(canvas, {}, { text: true, blocks: true });
    const regions = result.data.blocks?.flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines.flatMap((line) => [
      { text: line.text, confidence: line.confidence },
      ...line.words.map((word) => ({ text: word.text, confidence: word.confidence })),
    ]))) ?? [];
    return { text: result.data.text, confidence: result.data.confidence, regions };
  }
  function modeCrop(frame: HTMLVideoElement | HTMLCanvasElement, rect: NormalizedRect) {
    const sourceWidth = frame instanceof HTMLVideoElement ? frame.videoWidth : frame.width;
    const sourceHeight = frame instanceof HTMLVideoElement ? frame.videoHeight : frame.height;
    const sourceX = Math.round(sourceWidth * rect.x);
    const sourceY = Math.round(sourceHeight * rect.y);
    const cropWidth = Math.max(1, Math.round(sourceWidth * rect.width));
    const cropHeight = Math.max(1, Math.round(sourceHeight * rect.height));
    const upscale = Math.max(1, Math.min(4, 96 / cropHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(cropWidth * upscale));
    canvas.height = Math.max(1, Math.round(cropHeight * upscale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.filter = 'grayscale(1) contrast(1.9)';
    context.drawImage(frame, sourceX, sourceY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
    return canvas;
  }
  async function inspect(frame: HTMLVideoElement | HTMLCanvasElement, modeRegions: NormalizedRect[] = []) {
    const sourceWidth = frame instanceof HTMLVideoElement ? frame.videoWidth : frame.width;
    const sourceHeight = frame instanceof HTMLVideoElement ? frame.videoHeight : frame.height;
    if (!sourceWidth || !sourceHeight) return { modeSignal: null, hudSignals: [] as OcrHudSignal[] };
    const scale = Math.min(1, 1280 / sourceWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return { modeSignal: null, hudSignals: [] as OcrHudSignal[] };
    context.filter = 'grayscale(1) contrast(1.65)';
    context.drawImage(frame, 0, 0, canvas.width, canvas.height);
    const fullScreen = await recognize(canvas);
    const capturedAt = new Date().toISOString();
    let modeSignal = modeRegions.length
      ? null
      : detectModeFromOcrRegions(fullScreen.text, fullScreen.confidence, fullScreen.regions, capturedAt);
    for (const rect of modeRegions.slice(0, 2)) {
      const crop = modeCrop(frame, rect);
      if (!crop) continue;
      const localized = await recognize(crop);
      const localizedSignal = detectModeFromOcrRegions(localized.text, localized.confidence, localized.regions, capturedAt);
      if (localizedSignal && (!modeSignal || localizedSignal.confidence > modeSignal.confidence)) modeSignal = localizedSignal;
    }
    return {
      modeSignal,
      hudSignals: detectHudSignalsFromOcrText(fullScreen.text, fullScreen.confidence, capturedAt),
    };
  }
  return {
    async scan(frame: HTMLVideoElement | HTMLCanvasElement): Promise<OcrModeSignal | null> {
      return (await inspect(frame)).modeSignal;
    },
    inspect,
    terminate: () => worker.terminate(),
  };
}
