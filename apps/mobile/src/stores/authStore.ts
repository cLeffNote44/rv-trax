// ---------------------------------------------------------------------------
// RV Trax Mobile — Auth Store (Zustand + MMKV persistence)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';
import type { UserRole } from '@rv-trax/shared';
import { apiClient, bindAuthAccessors } from '../services/api';

// ---------------------------------------------------------------------------
// MMKV instance for auth tokens
// ---------------------------------------------------------------------------

const storage = new MMKV({ id: 'rv-trax-auth' });

const STORAGE_KEY_TOKEN = 'auth.accessToken';
const STORAGE_KEY_USER = 'auth.user';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  dealershipId: string;
  dealershipName?: string;
}

export interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  /** Authenticate with email/password. */
  login: (email: string, password: string) => Promise<void>;
  /** Clear session and call the logout endpoint. */
  logout: () => Promise<void>;
  /** Attempt to silently refresh the access token. */
  refreshToken: () => Promise<void>;
  /** Set the access token directly (used by the API interceptor). */
  setToken: (token: string) => void;
  /** Set the current user profile. */
  setUser: (user: AuthUser) => void;
  /** Hydrate from MMKV on app start. */
  hydrate: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isLoading: false,

  // ── Login ───────────────────────────────────────────────────────────────
  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { access_token, user } = await apiClient.login(email, password);

      const authUser: AuthUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        dealershipId: user.dealership_id,
      };

      storage.set(STORAGE_KEY_TOKEN, access_token);
      storage.set(STORAGE_KEY_USER, JSON.stringify(authUser));

      set({
        token: access_token,
        user: authUser,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  // ── Logout ──────────────────────────────────────────────────────────────
  logout: async () => {
    try {
      await apiClient.logout();
    } catch {
      // Best-effort — clear local state regardless.
    }

    storage.delete(STORAGE_KEY_TOKEN);
    storage.delete(STORAGE_KEY_USER);

    set({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  // ── Refresh ─────────────────────────────────────────────────────────────
  refreshToken: async () => {
    try {
      const { access_token } = await apiClient.refresh();
      storage.set(STORAGE_KEY_TOKEN, access_token);
      set({ token: access_token });
    } catch {
      // Refresh failed — force logout.
      await get().logout();
    }
  },

  // ── Setters ─────────────────────────────────────────────────────────────
  setToken: (token) => {
    storage.set(STORAGE_KEY_TOKEN, token);
    set({ token });
  },

  setUser: (user) => {
    storage.set(STORAGE_KEY_USER, JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },

  // ── Hydrate ─────────────────────────────────────────────────────────────
  hydrate: () => {
    const token = storage.getString(STORAGE_KEY_TOKEN) ?? null;
    const userJson = storage.getString(STORAGE_KEY_USER) ?? null;

    let user: AuthUser | null = null;
    if (userJson) {
      try {
        user = JSON.parse(userJson) as AuthUser;
      } catch {
        user = null;
      }
    }

    set({
      token,
      user,
      isAuthenticated: !!token && !!user,
    });
  },
}));

// ---------------------------------------------------------------------------
// Bind auth accessors so the API client can read/write tokens without
// importing this module directly (avoids circular dependency).
// ---------------------------------------------------------------------------

bindAuthAccessors(
  () => useAuthStore.getState().token,
  (token: string) => useAuthStore.getState().setToken(token),
  () => {
    // Synchronous clear — the async logout() will be called by the user flow.
    storage.delete(STORAGE_KEY_TOKEN);
    storage.delete(STORAGE_KEY_USER);
    useAuthStore.setState({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },
);
