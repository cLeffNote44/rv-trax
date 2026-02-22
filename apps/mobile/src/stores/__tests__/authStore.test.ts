import { MMKV } from 'react-native-mmkv';

// Mock the api module before importing the store
const mockLogin = jest.fn();
const mockLogout = jest.fn();
const mockRefresh = jest.fn();

jest.mock('../../services/api', () => ({
  apiClient: {
    login: (...args: unknown[]) => mockLogin(...args),
    logout: (...args: unknown[]) => mockLogout(...args),
    refresh: (...args: unknown[]) => mockRefresh(...args),
  },
  bindAuthAccessors: jest.fn(),
}));

import { useAuthStore, type AuthUser } from '../authStore';

const TEST_USER: AuthUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin' as any,
  dealershipId: 'dealer-1',
};

beforeEach(() => {
  // Reset store to initial state
  useAuthStore.setState({
    token: null,
    user: null,
    isAuthenticated: false,
    isLoading: false,
  });

  // Clear MMKV mock storage
  const storage = new MMKV({ id: 'rv-trax-auth' });
  storage.clearAll();

  mockLogin.mockReset();
  mockLogout.mockReset();
  mockRefresh.mockReset();
});

describe('authStore', () => {
  // ── Initial state ────────────────────────────────────────────────────────

  it('starts with unauthenticated state', () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  // ── Login ────────────────────────────────────────────────────────────────

  it('login sets token, user, and isAuthenticated', async () => {
    mockLogin.mockResolvedValueOnce({
      access_token: 'tok-123',
      user: {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin',
        dealership_id: 'dealer-1',
      },
    });

    await useAuthStore.getState().login('test@example.com', 'password');

    const state = useAuthStore.getState();
    expect(state.token).toBe('tok-123');
    expect(state.user).toEqual(TEST_USER);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it('login sets isLoading during the call', async () => {
    let resolveLogin: (v: unknown) => void;
    mockLogin.mockReturnValueOnce(
      new Promise((r) => { resolveLogin = r; }),
    );

    const loginPromise = useAuthStore.getState().login('a@b.com', 'pw');
    expect(useAuthStore.getState().isLoading).toBe(true);

    resolveLogin!({
      access_token: 'tok',
      user: { id: '1', name: 'A', email: 'a@b.com', role: 'admin', dealership_id: 'd1' },
    });
    await loginPromise;

    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('login clears isLoading on failure and rethrows', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'));

    await expect(
      useAuthStore.getState().login('bad@example.com', 'wrong'),
    ).rejects.toThrow('Invalid credentials');

    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  // ── Logout ───────────────────────────────────────────────────────────────

  it('logout clears all auth state', async () => {
    // Set up authenticated state first
    useAuthStore.setState({
      token: 'tok-123',
      user: TEST_USER,
      isAuthenticated: true,
    });
    mockLogout.mockResolvedValueOnce(undefined);

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('logout clears state even if API call fails', async () => {
    useAuthStore.setState({
      token: 'tok-123',
      user: TEST_USER,
      isAuthenticated: true,
    });
    mockLogout.mockRejectedValueOnce(new Error('Network error'));

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
  });

  // ── Refresh ──────────────────────────────────────────────────────────────

  it('refreshToken updates the token on success', async () => {
    useAuthStore.setState({ token: 'old-tok' });
    mockRefresh.mockResolvedValueOnce({ access_token: 'new-tok' });

    await useAuthStore.getState().refreshToken();

    expect(useAuthStore.getState().token).toBe('new-tok');
  });

  it('refreshToken triggers logout on failure', async () => {
    useAuthStore.setState({
      token: 'tok',
      user: TEST_USER,
      isAuthenticated: true,
    });
    mockRefresh.mockRejectedValueOnce(new Error('Expired'));
    mockLogout.mockResolvedValueOnce(undefined);

    await useAuthStore.getState().refreshToken();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
  });

  // ── Setters ──────────────────────────────────────────────────────────────

  it('setToken updates the token', () => {
    useAuthStore.getState().setToken('direct-tok');
    expect(useAuthStore.getState().token).toBe('direct-tok');
  });

  it('setUser sets user and marks authenticated', () => {
    useAuthStore.getState().setUser(TEST_USER);

    expect(useAuthStore.getState().user).toEqual(TEST_USER);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  // ── Hydrate ──────────────────────────────────────────────────────────────

  it('hydrate restores token and user from MMKV', () => {
    // Simulate stored values in MMKV
    const storage = new MMKV({ id: 'rv-trax-auth' });
    storage.set('auth.accessToken', 'stored-tok');
    storage.set('auth.user', JSON.stringify(TEST_USER));

    useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.token).toBe('stored-tok');
    expect(state.user).toEqual(TEST_USER);
    expect(state.isAuthenticated).toBe(true);
  });

  it('hydrate stays unauthenticated when MMKV is empty', () => {
    useAuthStore.getState().hydrate();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('hydrate handles corrupted user JSON gracefully', () => {
    const storage = new MMKV({ id: 'rv-trax-auth' });
    storage.set('auth.accessToken', 'tok');
    storage.set('auth.user', '{invalid-json');

    useAuthStore.getState().hydrate();

    expect(useAuthStore.getState().token).toBe('tok');
    expect(useAuthStore.getState().user).toBeNull();
    // Token present but no user → not authenticated
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
