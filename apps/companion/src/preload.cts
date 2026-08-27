import { contextBridge, ipcRenderer } from 'electron';

type Advice = {
  title: string;
  cue: string;
  reason: string;
  principle: string;
  priority: 'NORMAL' | 'HIGH';
  durationMs?: number;
};

contextBridge.exposeInMainWorld('riftlineCompanion', {
  getEnvironment: () => ipcRenderer.invoke('companion:environment'),
  scanGameWindows: () => ipcRenderer.invoke('companion:scan-game-windows'),
  selectGameWindow: (sourceId: string) => ipcRenderer.invoke('companion:select-game-window', String(sourceId).slice(0, 200)),
  showAdvice: (advice: Advice) => ipcRenderer.invoke('companion:show-advice', advice),
  clearAdvice: () => ipcRenderer.invoke('companion:clear-advice'),
  onPanicStop: (listener: () => void) => {
    const handler = () => listener();
    ipcRenderer.on('companion:panic-stop', handler);
    return () => ipcRenderer.removeListener('companion:panic-stop', handler);
  },
});
