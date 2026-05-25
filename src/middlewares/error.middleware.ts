import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error.js';
import { logger } from '../utils/logger.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction): void => {
  // Operational errors: expected failure cases with a known HTTP status.
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
    return;
  }

  // Unexpected errors: log the full stack and return a generic 500.
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
  });
};
