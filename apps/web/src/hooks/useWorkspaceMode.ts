import { createContext, createElement, useCallback, useContext, useState, type ReactNode } from 'react';

export type WorkspaceMode = 'player' | 'team' | null;

const STORAGE_KEY = 'riftline_workspace_mode';
const WorkspaceModeContext = createContext<{ mode: WorkspaceMode; setMode: (mode: WorkspaceMode) => void }>({ mode: null, setMode: () => undefined });

export function WorkspaceModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<WorkspaceMode>(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored === 'player' || stored === 'team' ? stored : null;
  });
  const setMode = useCallback((next: WorkspaceMode) => {
    setModeState(next);
    if (next) sessionStorage.setItem(STORAGE_KEY, next);
    else sessionStorage.removeItem(STORAGE_KEY);
  }, []);
  return createElement(WorkspaceModeContext.Provider, { value: { mode, setMode } }, children);
}

export function useWorkspaceMode() {
  return useContext(WorkspaceModeContext);
}
