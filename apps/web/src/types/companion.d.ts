declare global {
  type RiftLineCompanionAdvice = {
    title: string;
    cue: string;
    reason: string;
    principle: string;
    priority: 'NORMAL' | 'HIGH';
    durationMs?: number;
  };

  type RiftLineGameWindow = { id: string; name: string; selected: boolean };

  interface RiftLineCompanionBridge {
    getEnvironment(): Promise<{
      version: string;
      portalOrigin: string;
      platform: string;
      capturePolicy: 'predecessor-window-only';
      panicShortcut: string;
    } | null>;
    scanGameWindows(): Promise<RiftLineGameWindow[]>;
    selectGameWindow(sourceId: string): Promise<{ selected: boolean; source?: { id: string; name: string } }>;
    showAdvice(advice: RiftLineCompanionAdvice): Promise<{ shown: boolean }>;
    clearAdvice(): Promise<{ cleared: boolean }>;
    onPanicStop(listener: () => void): () => void;
  }

  interface Window {
    riftlineCompanion?: RiftLineCompanionBridge;
  }
}

export {};
