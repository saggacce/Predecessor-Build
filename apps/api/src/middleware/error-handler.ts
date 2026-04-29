import type { Request, Response, NextFunction } from 'express';

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
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: {
        message: err.message,
        code: err.code,
      },
    });
    return;
  }

  console.error('[api] unhandled error:', err);
  res.status(500).json({
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
  });
}
