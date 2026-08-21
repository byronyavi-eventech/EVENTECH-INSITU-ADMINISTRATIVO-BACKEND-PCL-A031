import type { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';
import { AppError } from '../utils/app-error.js';
import { logger } from '../utils/logger.js';

// Fase B (integración nativa): fusionado con el error.middleware.ts que
// traía el módulo de Equipos — le agrega manejo de MulterError (subida de
// archivos), guard de res.headersSent, y no asume 500 fijo para errores no
// controlados con forma { statusCode }. Único error.middleware.ts del backend
// a partir de acá.
// Express solo reconoce error-handlers de 4 parámetros.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) return;

  if (err instanceof MulterError) {
    logger.warn({ path: req.path, method: req.method, code: err.code }, 'MulterError handled');
    res.status(400).json({
      status: 'error',
      message: `Error al subir archivo: ${err.message}`,
    });
    return;
  }

  if (err instanceof AppError) {
    logger.warn(
      { path: req.path, method: req.method, statusCode: err.statusCode, message: err.message },
      'AppError handled',
    );
    res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
    return;
  }

  const error = err as { statusCode?: number; status?: number; message?: string };
  const statusCode = error.statusCode || error.status || 500;

  logger.error({ err, path: req.path, method: req.method }, 'Unhandled Error handled');

  // QA Audit (2026-08-04): errores no controlados (ej. violación de FK/unique
  // no capturada explícitamente) llegaban a exponer error.message completo al
  // cliente — para errores de Postgres/Drizzle eso incluye la query SQL entera
  // con nombres de columnas y valores de parámetros (information disclosure).
  // Cualquier error que llegue hasta acá es, por definición, no controlado —
  // nunca se expone su mensaje interno, solo se loggea server-side.
  res.status(statusCode).json({
    status: 'error',
    message: 'Error interno del servidor',
  });
}
