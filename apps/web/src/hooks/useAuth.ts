import { useEffect, useState } from 'react';
import { ApiErrorResponse, apiClient, type SessionUser } from '../api/client';

export interface AuthState {
  authenticated: boolean;
  internalAuthenticated: boolean;
  loading: boolean;
  internalLoading: boolean;
  user: SessionUser | null;
  refreshInternalSession: () => Promise<SessionUser | null>;
}

const EXPIRES_AT_COOKIE = 'predgg_expires_at';
const REFRESH_BUFFER_MS = 3 * 60 * 1000; // refresh 3 min before expiry

function getExpiresAt(): number {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${EXPIRES_AT_COOKIE}=`));
  return match ? parseInt(match.split('=')[1], 10) : 0;
}

export function useAuth(): AuthState {
  const [predggState, setPredggState] = useState({ authenticated: false, loading: true });
  const [internalState, setInternalState] = useState<{
    user: SessionUser | null;
    loading: boolean;
  }>({ user: null, loading: true });

  async function loadInternalSession(): Promise<SessionUser | null> {
    try {
      const res = await apiClient.auth.internalMe();
      setInternalState({ user: res.user, loading: false });
      return res.user;
    } catch (err) {
      if (err instanceof ApiErrorResponse && err.status === 401) {
        try {
          await apiClient.auth.refresh();
          const res = await apiClient.auth.internalMe();
          setInternalState({ user: res.user, loading: false });
          return res.user;
        } catch {
          setInternalState({ user: null, loading: false });
          return null;
        }
      }
      setInternalState({ user: null, loading: false });
      return null;
    }
  }

  useEffect(() => {
    // On mount: /auth/me auto-refreshes on the backend if the token is expired
    apiClient.auth
      .me()
      .then((res) => setPredggState({ authenticated: res.authenticated, loading: false }))
      .catch(() => setPredggState({ authenticated: false, loading: false }));

    void loadInternalSession();
  }, []);

  useEffect(() => {
    if (predggState.loading || !predggState.authenticated) return;

    // Set a timer to refresh proactively before the access token expires
    function scheduleRefresh() {
      const expiresAt = getExpiresAt();
      if (!expiresAt) return;

      const msUntilRefresh = expiresAt - Date.now() - REFRESH_BUFFER_MS;
      if (msUntilRefresh <= 0) {
        // Already expired or very close — refresh immediately
        void apiClient.auth.me().then((res) => {
          if (!res.authenticated) setPredggState({ authenticated: false, loading: false });
          else scheduleRefresh(); // reschedule after refresh
        });
        return;
      }

      const timer = setTimeout(() => {
        apiClient.auth
          .me() // /auth/me triggers silent refresh on the backend
          .then((res) => {
            if (!res.authenticated) setPredggState({ authenticated: false, loading: false });
            else scheduleRefresh(); // reschedule for the new token
          })
          .catch(() => setPredggState({ authenticated: false, loading: false }));
      }, msUntilRefresh);

      return timer;
    }

    const timer = scheduleRefresh();
    return () => { if (timer) clearTimeout(timer); };
  }, [predggState.loading, predggState.authenticated]);

  useEffect(() => {
    if (internalState.loading || !internalState.user) return;
    const timer = setInterval(() => {
      void loadInternalSession();
    }, 50 * 60 * 1000);
    return () => clearInterval(timer);
  }, [internalState.loading, internalState.user?.id]);

  return {
    authenticated: predggState.authenticated,
    internalAuthenticated: Boolean(internalState.user),
    loading: predggState.loading,
    internalLoading: internalState.loading,
    user: internalState.user,
    refreshInternalSession: loadInternalSession,
  };
}
