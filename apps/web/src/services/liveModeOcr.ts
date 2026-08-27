export type OcrModeSignal = {
  detectedGameMode: 'RANKED' | 'STANDARD' | 'QUICK' | 'ARAM' | 'LABS' | 'PRACTICE' | 'AI' | 'CUSTOM';
  confidence: number;
  capturedAt: string;
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

export function detectModeFromOcrText(text: string, ocrConfidence: number, capturedAt = new Date().toISOString()): OcrModeSignal | null {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9\s]/g, ' ');
  const match = MODE_PATTERNS.find(([, pattern]) => pattern.test(normalized));
  if (!match) return null;
  const rawConfidence = Math.max(0, Math.min(1, ocrConfidence / 100));
  return {
    detectedGameMode: match[0],
    confidence: match[0] === 'RANKED' ? Math.max(0.72, rawConfidence) : rawConfidence,
    capturedAt,
  };
}

export async function createLiveModeOcr(onProgress?: (progress: number) => void) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', undefined, {
    logger: (message) => {
      if (message.status === 'recognizing text' && typeof message.progress === 'number') onProgress?.(message.progress);
    },
  });
  return {
    async scan(frame: HTMLVideoElement | HTMLCanvasElement): Promise<OcrModeSignal | null> {
      const sourceWidth = frame instanceof HTMLVideoElement ? frame.videoWidth : frame.width;
      const sourceHeight = frame instanceof HTMLVideoElement ? frame.videoHeight : frame.height;
      if (!sourceWidth || !sourceHeight) return null;
      const scale = Math.min(1, 1280 / sourceWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return null;
      context.filter = 'grayscale(1) contrast(1.65)';
      context.drawImage(frame, 0, 0, canvas.width, canvas.height);
      const result = await worker.recognize(canvas);
      return detectModeFromOcrText(result.data.text, result.data.confidence);
    },
    terminate: () => worker.terminate(),
  };
}
