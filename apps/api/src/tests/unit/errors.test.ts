import { describe, it, expect } from 'vitest';
import { AppError, notFound, conflict, forbidden, validationError, unauthorized, badRequest } from '../../utils/errors.js';

describe('error helpers', () => {
  it('creates an AppError with correct properties', () => {
    const err = new AppError('test msg', 418, 'TEAPOT', { a: 1 });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe('test msg');
    expect(err.statusCode).toBe(418);
    expect(err.code).toBe('TEAPOT');
    expect(err.details).toEqual({ a: 1 });
  });

  it('notFound creates 404', () => {
    const err = notFound();
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });

  it('conflict creates 409', () => {
    const err = conflict('dup');
    expect(err.statusCode).toBe(409);
    expect(err.message).toBe('dup');
  });

  it('forbidden creates 403', () => {
    expect(forbidden().statusCode).toBe(403);
  });

  it('unauthorized creates 401', () => {
    expect(unauthorized().statusCode).toBe(401);
  });

  it('badRequest creates 400', () => {
    expect(badRequest().statusCode).toBe(400);
  });

  it('validationError creates 422 with details', () => {
    const err = validationError('bad data', { field: 'email' });
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual({ field: 'email' });
  });
});
