// ---------------------------------------------------------------------------
// RV Trax Mobile — useAuth Hook
// ---------------------------------------------------------------------------

import { useCallback } from 'react';
import { useAuthStore, type AuthUser } from '../stores/useAuthStore';

export interface UseAuthReturn {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

/**
 * Convenience hook that surfaces auth store state with stable callbacks.
 */
export function useAuth(): UseAuthReturn {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const storeLogin = useAuthStore((s) => s.login);
  const storeLogout = useAuthStore((s) => s.logout);
  const storeRefresh = useAuthStore((s) => s.refreshToken);

  const login = useCallback(
    (email: string, password: string) => storeLogin(email, password),
    [storeLogin],
  );

  const logout = useCallback(() => storeLogout(), [storeLogout]);

  const refreshToken = useCallback(() => storeRefresh(), [storeRefresh]);

  return {
    token,
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    refreshToken,
  };
}
