import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';

export interface AuthState {
  authenticated: boolean;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ authenticated: false, loading: true });

  useEffect(() => {
    apiClient.auth.me()
      .then((res) => setState({ authenticated: res.authenticated, loading: false }))
      .catch(() => setState({ authenticated: false, loading: false }));
  }, []);

  return state;
}
