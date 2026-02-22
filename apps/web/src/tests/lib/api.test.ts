import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiError, apiFetch } from '@/lib/api';

vi.mock('@/lib/auth', () => ({
  removeToken: vi.fn(),
  TOKEN_KEY: 'rv-trax-token',
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ApiError', () => {
  it('has code, status, message, and details properties', () => {
    const details = { field: 'email', reason: 'invalid' };
    const error = new ApiError('Bad request', 'BAD_REQUEST', 400, details);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.name).toBe('ApiError');
    expect(error.message).toBe('Bad request');
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.status).toBe(400);
    expect(error.details).toEqual(details);
  });

  it('works without details', () => {
    const error = new ApiError('Not found', 'NOT_FOUND', 404);

    expect(error.details).toBeUndefined();
    expect(error.status).toBe(404);
  });
});

describe('apiFetch', () => {
  it('makes a GET request with credentials', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' }),
    });

    const result = await apiFetch('/units');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/units');
    expect(opts.credentials).toBe('include');
    expect(result).toEqual({ data: 'test' });
  });

  it('sends JSON content-type for POST with body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    await apiFetch('/auth/login', {
      method: 'POST',
      body: { email: 'a@b.com', password: 'pw' },
    });

    const [, opts] = mockFetch.mock.calls[0]!;
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(opts.body).toBe(JSON.stringify({ email: 'a@b.com', password: 'pw' }));
  });

  it('skips JSON content-type when raw is true', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    await apiFetch('/upload', { method: 'POST', body: 'raw-data', raw: true });

    const [, opts] = mockFetch.mock.calls[0]!;
    expect(opts.headers['Content-Type']).toBeUndefined();
  });

  it('returns undefined for 204 No Content', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
    });

    const result = await apiFetch('/units/1', { method: 'DELETE' });
    expect(result).toBeUndefined();
  });

  it('throws ApiError on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({ message: 'Unit not found', code: 'NOT_FOUND' }),
    });

    await expect(apiFetch('/units/999')).rejects.toThrow(ApiError);

    try {
      await apiFetch('/units/999');
    } catch (err) {
      // This will also throw, but mockFetch was already consumed
    }
  });

  it('throws with statusText when JSON parse fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.reject(new Error('invalid json')),
    });

    await expect(apiFetch('/broken')).rejects.toMatchObject({
      message: 'Internal Server Error',
      status: 500,
    });
  });

  it('uses absolute URL directly when path starts with http', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    });

    await apiFetch('https://external.api.com/data');

    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toBe('https://external.api.com/data');
  });
});
