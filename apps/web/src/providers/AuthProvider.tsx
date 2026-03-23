'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@rv-trax/shared';
import { removeToken } from '@/lib/auth';
import { login as apiLogin, logout as apiLogout, getMe, type LoginRequest } from '@/lib/api';
import { initAnalytics, identifyUser, resetAnalytics, trackEvent } from '@/lib/analytics';
import { initSentry } from '@/lib/sentry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthState {
  user: User | null;
  /** In-memory only — used for WebSocket auth. NOT stored in cookies from JS. */
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
}

export type { AuthContextValue };

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Idle timeout (30 minutes)
// ---------------------------------------------------------------------------

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Logout ────────────────────────────────────────────────────────────────

  const logout = useCallback(() => {
    // Best-effort API call to revoke server-side tokens
    apiLogout().catch(() => {});
    removeToken();
    resetAnalytics();
    trackEvent('user_logged_out');
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }, []);

  // ── Idle timeout ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!state.isAuthenticated) return;

    const resetTimer = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        logout();
      }, IDLE_TIMEOUT_MS);
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer(); // start the timer

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [state.isAuthenticated, logout]);

  // ── Initialise analytics & error tracking on mount ────────────────────────

  useEffect(() => {
    initAnalytics();
    initSentry();
  }, []);

  // ── Hydrate on mount (cookie sent automatically) ──────────────────────────

  useEffect(() => {
    getMe()
      .then((user) => {
        setState((prev) => ({
          ...prev,
          user,
          isAuthenticated: true,
          isLoading: false,
        }));
        // Identify user in analytics
        identifyUser(user.id, { role: user.role, dealership_id: user.dealership_id });
      })
      .catch(() => {
        setState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      });
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────

  const login = useCallback(async (credentials: LoginRequest) => {
    const response = await apiLogin(credentials);
    // API sets HttpOnly cookies via Set-Cookie header; we keep token in memory for WS only
    setState({
      user: response.user,
      token: response.access_token,
      isAuthenticated: true,
      isLoading: false,
    });
    identifyUser(response.user.id, {
      role: response.user.role,
      dealership_id: response.user.dealership_id,
    });
    trackEvent('user_logged_in');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      logout,
    }),
    [state, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
