import { describe, it, expect, vi, afterEach } from 'vitest';
import { TOKEN_KEY, removeToken } from '@/lib/auth';

describe('TOKEN_KEY', () => {
  it('equals rv-trax-token', () => {
    expect(TOKEN_KEY).toBe('rv-trax-token');
  });
});

describe('removeToken', () => {
  afterEach(() => {
    // Clean up cookies
    document.cookie = 'rv-trax-token=; max-age=0';
    document.cookie = 'rv-trax-refresh=; max-age=0';
  });

  it('sets access token cookie to empty with max-age=0', () => {
    // Set a cookie first
    document.cookie = 'rv-trax-token=some-token; path=/';
    removeToken();

    // After removeToken, the cookie should be expired
    expect(document.cookie).not.toContain('rv-trax-token=some-token');
  });

  it('clears refresh token cookie', () => {
    document.cookie = 'rv-trax-refresh=some-refresh; path=/';
    removeToken();

    expect(document.cookie).not.toContain('rv-trax-refresh=some-refresh');
  });

  it('does not throw in browser environment', () => {
    expect(() => removeToken()).not.toThrow();
  });
});
