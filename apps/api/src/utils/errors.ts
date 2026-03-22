// ---------------------------------------------------------------------------
// RV Trax API — Error helpers
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodIssue } from 'zod';

// ── AppError ----------------------------------------------------------------

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

// ── Factory functions -------------------------------------------------------

export function notFound(message = 'Resource not found'): AppError {
  return new AppError(message, 404, 'NOT_FOUND');
}

export function conflict(message = 'Resource already exists'): AppError {
  return new AppError(message, 409, 'CONFLICT');
}

export function forbidden(message = 'Forbidden'): AppError {
  return new AppError(message, 403, 'FORBIDDEN');
}

export function validationError(
  message = 'Validation failed',
  details?: Record<string, unknown>,
): AppError {
  return new AppError(message, 422, 'VALIDATION_ERROR', details);
}

export function unauthorized(message = 'Unauthorized'): AppError {
  return new AppError(message, 401, 'UNAUTHORIZED');
}

export function badRequest(message = 'Bad request'): AppError {
  return new AppError(message, 400, 'BAD_REQUEST');
}

// ── Fastify error handler ---------------------------------------------------

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (error: Error & { statusCode?: number; code?: string; validation?: unknown }, request: FastifyRequest, reply: FastifyReply) => {
      const requestId = request.id;

      // Handle AppError
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? null,
            request_id: requestId,
          },
        });
      }

      // Handle Zod validation errors (name check avoids monorepo instanceof issues)
      if (error.name === 'ZodError' && 'issues' in error) {
        const issues = (error as unknown as { issues: ZodIssue[] }).issues;
        return reply.status(422).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: issues.map((i) => i.message).join(', '),
            details: issues,
            request_id: requestId,
          },
        });
      }

      // Handle Fastify validation errors
      if (error.validation) {
        return reply.status(422).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: error.validation,
            request_id: requestId,
          },
        });
      }

      // Handle JWT errors
      if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' || error.code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED') {
        return reply.status(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: error.message,
            details: null,
            request_id: requestId,
          },
        });
      }

      // Handle rate limit errors
      if (error.statusCode === 429) {
        return reply.status(429).send({
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests',
            details: null,
            request_id: requestId,
          },
        });
      }

      // Unknown error — log and return 500
      request.log.error(error, 'Unhandled error');
      return reply.status(error.statusCode ?? 500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: process.env['NODE_ENV'] === 'production'
            ? 'An unexpected error occurred'
            : error.message,
          details: null,
          request_id: requestId,
        },
      });
    },
  );
}
