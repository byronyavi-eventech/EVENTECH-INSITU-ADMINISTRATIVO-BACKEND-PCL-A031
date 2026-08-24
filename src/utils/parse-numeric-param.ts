import { AppError } from './app-error.js';

/**
 * QA Audit (2026-08-04): extraído de equipo.controller.ts — dashboard.controller.ts
 * tenía su propia validación de :id duplicada, con mensaje distinto ("ID de
 * equipo inválido.") y sin pasar por AppError/error.middleware. Unificado acá.
 */
export function parseNumericParam(val: string, paramName = 'id'): number {
  const num = Number(val);
  if (isNaN(num) || !Number.isInteger(num) || num <= 0) {
    throw new AppError(`Parámetro ${paramName} inválido. Debe ser un entero positivo.`, 400);
  }
  return num;
}
