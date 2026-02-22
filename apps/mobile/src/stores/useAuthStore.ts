// Re-export from the full auth store with MMKV persistence.
// This file exists for backwards compatibility with imports
// that reference '@/stores/useAuthStore'.
export { useAuthStore, type AuthState, type AuthUser } from './authStore';
