import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';

export interface AuthState {
  authenticated: boolean;
  loading: boolean;
}

const EXPIRES_AT_COOKIE = 'predgg_expires_at';
const REFRESH_BUFFER_MS = 3 * 60 * 1000; // refresh 3 min before expiry

function getExpiresAt(): number {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${EXPIRES_AT_COOKIE}=`));
  return match ? parseInt(match.split('=')[1], 10) : 0;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ authenticated: false, loading: true });

  useEffect(() => {
    // On mount: /auth/me auto-refreshes on the backend if the token is expired
    apiClient.auth
      .me()
      .then((res) => setState({ authenticated: res.authenticated, loading: false }))
      .catch(() => setState({ authenticated: false, loading: false }));
  }, []);

  useEffect(() => {
    if (state.loading || !state.authenticated) return;

    // Set a timer to refresh proactively before the access token expires
    function scheduleRefresh() {
      const expiresAt = getExpiresAt();
      if (!expiresAt) return;

      const msUntilRefresh = expiresAt - Date.now() - REFRESH_BUFFER_MS;
      if (msUntilRefresh <= 0) {
        // Already expired or very close — refresh immediately
        void apiClient.auth.me().then((res) => {
          if (!res.authenticated) setState({ authenticated: false, loading: false });
          else scheduleRefresh(); // reschedule after refresh
        });
        return;
      }

      const timer = setTimeout(() => {
        apiClient.auth
          .me() // /auth/me triggers silent refresh on the backend
          .then((res) => {
            if (!res.authenticated) setState({ authenticated: false, loading: false });
            else scheduleRefresh(); // reschedule for the new token
          })
          .catch(() => setState({ authenticated: false, loading: false }));
      }, msUntilRefresh);

      return timer;
    }

    const timer = scheduleRefresh();
    return () => { if (timer) clearTimeout(timer); };
  }, [state.loading, state.authenticated]);

  return state;
}
