import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('riftlineOverlay', {
  onAdvice: (listener: (advice: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, advice: unknown) => listener(advice);
    ipcRenderer.on('overlay:advice', handler);
    return () => ipcRenderer.removeListener('overlay:advice', handler);
  },
  onClear: (listener: () => void) => {
    const handler = () => listener();
    ipcRenderer.on('overlay:clear', handler);
    return () => ipcRenderer.removeListener('overlay:clear', handler);
  },
});
