/**
 * @fileoverview Centralized Express error handling middleware.
 *
 * All unhandled errors thrown inside route handlers bubble up to `errorHandler`.
 * Three error types are handled:
 * 1. `ZodError` — request validation failures → 400 with per-field detail
 * 2. `AppError` — intentional application errors (404, 401, etc.) → their status code
 * 3. Everything else → 500 Internal Server Error
 *
 * Usage: register as the last middleware in index.ts after all routes.
 * `app.use(errorHandler)`
 *
 * To throw a handled error from any route or service:
 * `throw new AppError(404, 'Player not found', 'PLAYER_NOT_FOUND')`
 */

import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../logger.js';

/** Shape of the error object returned in all error responses */
export interface ApiError {
  status: number;
  message: string;
  /** Machine-readable error code for frontend error handling (e.g. 'NOT_FOUND') */
  code?: string;
}

/**
 * Intentional application error with an HTTP status code.
 * Throw this from any route or service to return a specific status.
 *
 * @example
 * throw new AppError(404, 'Match not found', 'MATCH_NOT_FOUND');
 * throw new AppError(403, 'Insufficient permissions', 'FORBIDDEN');
 */
export class AppError extends Error implements ApiError {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Express error handling middleware. Must be registered with 4 parameters
 * (err, req, res, next) so Express recognizes it as an error handler.
 *
 * Response format for all errors:
 * `{ error: { message: string, code?: string, fields?: [...] } }`
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  // Zod validation errors → 400 with field-level detail
  if (err instanceof ZodError) {
    const fields = err.errors.map((e) => ({ path: e.path.join('.'), message: e.message }));
    logger.warn({ fields }, 'validation error');
    res.status(400).json({
      error: {
        message: 'Validation error',
        code: 'VALIDATION_ERROR',
        fields,
      },
    });
    return;
  }

  // Known application errors (404, 401, 403, etc.)
  if (err instanceof AppError) {
    // Log 5xx as errors, 4xx as warnings (expected client mistakes)
    if (err.status >= 500) {
      logger.error({ err, status: err.status, code: err.code }, 'app error');
    } else {
      logger.warn({ status: err.status, code: err.code, message: err.message }, 'app error');
    }
    res.status(err.status).json({
      error: { message: err.message, code: err.code },
    });
    return;
  }

  // Unexpected errors — log full stack and return generic 500
  logger.error({ err }, 'unhandled error');
  res.status(500).json({
    error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
  });
}
