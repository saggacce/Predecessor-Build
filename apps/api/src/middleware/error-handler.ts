import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../logger.js';

export interface ApiError {
  status: number;
  message: string;
  code?: string;
}

export class AppError extends Error implements ApiError {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

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

  // Known application errors (404, 401, etc.)
  if (err instanceof AppError) {
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

  // Unhandled errors → 500
  logger.error({ err }, 'unhandled error');
  res.status(500).json({
    error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
  });
}
