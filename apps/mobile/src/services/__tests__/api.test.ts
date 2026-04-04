import { vi, describe, it, expect } from 'vitest';

// Mock ky before any imports that reference it
vi.mock('ky', () => ({
  __esModule: true,
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    })),
  },
}));

// Mock @env
vi.mock('@env', () => ({ API_URL: 'http://localhost:3000' }));

import { AppError, bindAuthAccessors } from '../api';

describe('AppError', () => {
  it('creates an error with all properties', () => {
    const err = new AppError('Not found', 'NOT_FOUND', 404, { id: '123' }, 'req-1');

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe('Not found');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.status).toBe(404);
    expect(err.details).toEqual({ id: '123' });
    expect(err.requestId).toBe('req-1');
    expect(err.name).toBe('AppError');
  });

  it('works without optional fields', () => {
    const err = new AppError('Oops', 'UNKNOWN', 500);

    expect(err.message).toBe('Oops');
    expect(err.details).toBeUndefined();
    expect(err.requestId).toBeUndefined();
  });

  it('is catchable as a standard Error', () => {
    expect(() => {
      throw new AppError('fail', 'FAIL', 500);
    }).toThrow('fail');
  });
});

describe('bindAuthAccessors', () => {
  it('is a function that accepts three callbacks', () => {
    expect(typeof bindAuthAccessors).toBe('function');

    // Should not throw
    bindAuthAccessors(
      () => 'token',
      (_t: string) => {},
      () => {},
    );
  });
});
