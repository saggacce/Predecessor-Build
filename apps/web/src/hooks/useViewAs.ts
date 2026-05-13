/**
 * "View As Role" — lets PLATFORM_ADMIN preview the UI as a different role.
 * The selected role is stored in sessionStorage (auto-clears on browser close).
 * Does NOT modify any DB data — purely a UI simulation.
 */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { createElement } from 'react';

export type ViewAsRole = 'MANAGER' | 'COACH' | 'ANALISTA' | 'JUGADOR' | 'PLAYER' | null;

const SESSION_KEY = 'rl_view_as_role';

interface ViewAsCtx {
  viewAs: ViewAsRole;
  setViewAs: (role: ViewAsRole) => void;
}

const ViewAsContext = createContext<ViewAsCtx>({ viewAs: null, setViewAs: () => {} });

export function ViewAsProvider({ children }: { children: ReactNode }) {
  const [viewAs, setViewAsState] = useState<ViewAsRole>(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    return (stored as ViewAsRole) ?? null;
  });

  const setViewAs = useCallback((role: ViewAsRole) => {
    setViewAsState(role);
    if (role) sessionStorage.setItem(SESSION_KEY, role);
    else sessionStorage.removeItem(SESSION_KEY);
  }, []);

  return createElement(ViewAsContext.Provider, { value: { viewAs, setViewAs } }, children);
}

export function useViewAs() {
  return useContext(ViewAsContext);
}
