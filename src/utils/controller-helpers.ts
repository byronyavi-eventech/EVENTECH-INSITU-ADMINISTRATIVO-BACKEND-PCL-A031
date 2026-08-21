/**
 * src/utils/controller-helpers.ts
 * Helpers de controller compartidos por los endpoints de Equipos
 * (equipo/catalogos-equipos/dashboard-equipos/enum). El resto de controllers
 * del Core (catalog.controller.ts, quotation.controller.ts) declaran su
 * propio `wrap`/`assertValid` inline — acá se extraen a un solo archivo
 * porque se repetirían en 4+ controllers de este dominio (decisión F-5,
 * ver INTEGRACION-NATIVA-RESUMEN.md).
 */
import type { Request, Response, NextFunction } from 'express';
import type { z } from 'zod';
import { AppError } from './app-error.js';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

/**
 * Envuelve un handler async para propagar cualquier excepción a `next(err)`
 * sin repetir try/catch en cada controller. El error.middleware existente
 * (`AppError` → status/message, resto → 500 genérico + log) no cambia.
 */
export const wrap =
  (fn: AsyncHandler): AsyncHandler =>
  async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      next(err);
    }
  };

/**
 * Centraliza la traducción de un resultado `safeParse` de Zod a un `AppError`
 * 400, uniendo todos los issues (antes cada handler tomaba solo `issues[0]`
 * de forma inconsistente). Ningún test del proyecto depende del texto exacto
 * del mensaje de validación (solo del status code o de un `toContain`).
 */
export function assertValid<T>(
  parsed: { success: true; data: T } | { success: false; error: z.ZodError },
): T {
  if (!parsed.success) {
    const messages = parsed.error.issues.map((i) => i.message).join(' | ');
    throw new AppError(messages, 400);
  }
  return parsed.data;
}
