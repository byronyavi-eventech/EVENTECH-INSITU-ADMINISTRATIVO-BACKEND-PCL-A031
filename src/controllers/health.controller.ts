import { Request, Response } from 'express';

export const checkHealth = (req: Request, res: Response): void => {
  res.status(200).json({
    status: 'success',
    message: 'Server is up and running!',
    timestamp: new Date().toISOString(),
  });
};
