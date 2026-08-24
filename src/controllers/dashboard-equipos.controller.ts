/**
 * src/controllers/dashboard.controller.ts
 * Handlers for equipment status metrics and dashboard endpoints.
 */
import type { Request, Response } from 'express';
import * as equipoService from '../services/equipo.service.js';
import { parseNumericParam } from '../utils/parse-numeric-param.js';
import { wrap } from '../utils/controller-helpers.js';

export const getDashboardSummaryHandler = wrap(async (_req: Request, res: Response) => {
  const result = await equipoService.getDashboardSummary();
  res.status(200).json({
    status: 'success',
    data: result,
  });
});

export const getControlStatusHandler = wrap(async (_req: Request, res: Response) => {
  const result = await equipoService.getControlStatus();
  res.status(200).json({
    status: 'success',
    data: result,
  });
});

export const getCriticalEquiposHandler = wrap(async (_req: Request, res: Response) => {
  const result = await equipoService.getCriticalEquipos();
  res.status(200).json({
    status: 'success',
    data: result,
  });
});

export const getEquipoControlStatusHandler = wrap(async (req, res) => {
  const id = parseNumericParam(req.params['id'] as string, 'id');
  const result = await equipoService.getControlStatus(id);
  if (!result) {
    // QA Audit (2026-08-04): mensaje decía "no encontrado o inactivo", pero
    // desde Fase 3 "inactivo" es un estado calculado válido que SÍ se
    // devuelve — getControlStatus(id) solo da null si el equipo no existe o
    // está dado_de_baja.
    res
      .status(404)
      .json({ status: 'error', message: `Equipo con id ${id} no encontrado o dado de baja.` });
    return;
  }
  res.status(200).json({
    status: 'success',
    data: result,
  });
});
