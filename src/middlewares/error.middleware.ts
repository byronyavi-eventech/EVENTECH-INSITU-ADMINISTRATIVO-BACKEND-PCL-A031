import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction): void => {
  logger.error(err.message);

  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
  });
};
