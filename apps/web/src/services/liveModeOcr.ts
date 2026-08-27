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
  async function inspect(frame: HTMLVideoElement | HTMLCanvasElement) {
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
    const result = await worker.recognize(canvas);
    const capturedAt = new Date().toISOString();
    return {
      modeSignal: detectModeFromOcrText(result.data.text, result.data.confidence, capturedAt),
      hudSignals: detectHudSignalsFromOcrText(result.data.text, result.data.confidence, capturedAt),
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
