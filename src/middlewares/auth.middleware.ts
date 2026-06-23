import { Request, Response, NextFunction } from 'express';
import { auth } from '../auth.js';

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const session = await auth.api.getSession({
      headers: new Headers(req.headers as Record<string, string>),
    });

    if (!session) {
      res.status(401).json({
        status: 'error',
        message: 'No autenticado. Por favor inicia sesión.',
      });
      return;
    }

    res.locals.session = session;

    next();
  } catch (err) {
    next(err);
  }
};
