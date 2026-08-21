/**
 * src/controllers/equipo.controller.ts
 * Handlers for equipment CRUD and history management endpoints.
 */
import type { Request, Response } from 'express';
import * as equipoService from '../services/equipo.service.js';
import {
  createEquipoSchema,
  updateEquipoSchema,
  deactivateEquipoSchema,
  listEquiposQuerySchema,
  createCalibracionSchema,
  createVerificacionSchema,
  createMantenimientoSchema,
  associateTipoEnsayoSchema,
} from '../validators/equipo.validator.js';
import { AppError } from '../utils/app-error.js';
import { parseNumericParam } from '../utils/parse-numeric-param.js';
import { wrap, assertValid } from '../utils/controller-helpers.js';
import { generateFichaControlPdf } from '../pdf/generateFichaControl.js';

// Fase 2 (2026-08-06): usuario.id es text (nanoid de Better Auth a futuro),
// ya no se castea con Number(). El stub de auth.middleware.ts devuelve el
// literal 'stub-user-id' cuando no viene header x-debug-user-id — no es un
// id real de la tabla usuarios, así que se resuelve al mismo fallback fijo
// que usaba el esquema anterior (usuario '1', sembrado en init.sql) en vez
// de dejarlo pasar y reventar más abajo con 404.
function getUserId(res: Response): string {
  const val = res.locals.session?.user?.id;
  return typeof val === 'string' && val && val !== 'stub-user-id' ? val : '1';
}

export const listEquiposHandler = wrap(async (req, res) => {
  const query = assertValid(listEquiposQuerySchema.safeParse(req.query));
  const result = await equipoService.listEquipos(query);
  res.status(200).json({
    status: 'success',
    data: result.data,
    pagination: result.pagination,
  });
});

export const getEquipoByIdHandler = wrap(async (req: Request, res: Response) => {
  const id = parseNumericParam(req.params['id'] as string, 'id');
  const result = await equipoService.getEquipoById(id);
  res.status(200).json({
    status: 'success',
    data: result,
  });
});

/**
 * Ficha de Control de Equipo (FT-6.4.3/1, PDF). "Lugar Calibración/
 * Verificación" y "Codigo LI" se resolvieron por inferencia contra el schema
 * actual (no hay columnas con esos nombres literales) — ver
 * equipo.service.ts getFichaControlData para el detalle exacto de cada
 * resolución. Pendiente de confirmar contra la plantilla real del cliente.
 */
export const getFichaControlHandler = wrap(async (req: Request, res: Response) => {
  const id = parseNumericParam(req.params['id'] as string, 'id');
  const data = await equipoService.getFichaControlData(id);
  const pdfBuffer = await generateFichaControlPdf(data);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="ficha-control-${data.codigo}.pdf"`);
  res.status(200).send(pdfBuffer);
});

export const createEquipoHandler = wrap(async (req, res) => {
  const data = assertValid(createEquipoSchema.safeParse(req.body));
  const userId = getUserId(res);
  const input = { ...data, responsableId: data.responsableId ?? userId };
  // userId también sirve de fallback para registradoPorId/responsableId del
  // registro inicial de Calibración/Verificación/Mantenimiento (Fase 2,
  // 2026-08-07) cuando esos sub-objetos no traen su propio responsable.
  const result = await equipoService.createEquipo(input, userId);
  res.status(201).json({
    status: 'success',
    data: result,
  });
});

export const updateEquipoHandler = wrap(async (req, res) => {
  const id = parseNumericParam(req.params['id'] as string, 'id');
  const data = assertValid(updateEquipoSchema.safeParse(req.body));
  const result = await equipoService.updateEquipo(id, data);
  res.status(200).json({
    status: 'success',
    data: result,
  });
});

export const deactivateEquipoHandler = wrap(async (req, res) => {
  const id = parseNumericParam(req.params['id'] as string, 'id');
  const parsed = deactivateEquipoSchema.safeParse(req.body);
  const motivo = parsed.success ? parsed.data.motivo : 'Baja desde API';
  const result = await equipoService.deactivateEquipo(id, motivo);
  res.status(200).json({
    status: 'success',
    data: result,
  });
});

export const createCalibracionHandler = wrap(async (req, res) => {
  const id = parseNumericParam(req.params['id'] as string, 'id');
  const data = assertValid(createCalibracionSchema.safeParse(req.body));
  const userId = getUserId(res);
  const result = await equipoService.createCalibracion(id, data, userId);
  res.status(201).json({
    status: 'success',
    data: result,
  });
});

export const listCalibracionesHandler = wrap(async (req, res) => {
  const id = parseNumericParam(req.params['id'] as string, 'id');
  const result = await equipoService.listCalibraciones(id);
  res.status(200).json({
    status: 'success',
    data: result,
  });
});

export const attachCertificadoCalibracionHandler = wrap(async (req, res) => {
  const id = parseNumericParam(req.params['id'] as string, 'id');
  const calibracionId = parseNumericParam(req.params['calibracionId'] as string, 'calibracionId');
  if (!req.file) {
    throw new AppError('Debe adjuntar un archivo en el campo "file".', 400);
  }
  const result = await equipoService.attachCertificadoCalibracion(id, calibracionId, req.file);
  res.status(200).json({
    status: 'success',
    data: result,
  });
});

export const createVerificacionHandler = wrap(async (req, res) => {
  const id = parseNumericParam(req.params['id'] as string, 'id');
  const data = assertValid(createVerificacionSchema.safeParse(req.body));
  const userId = getUserId(res);
  const result = await equipoService.createVerificacion(id, data, userId);
  res.status(201).json({
    status: 'success',
    data: result,
  });
});

export const listVerificacionesHandler = wrap(async (req, res) => {
  const id = parseNumericParam(req.params['id'] as string, 'id');
  const result = await equipoService.listVerificaciones(id);
  res.status(200).json({
    status: 'success',
    data: result,
  });
});

export const attachRegistroVerificacionHandler = wrap(async (req, res) => {
  const id = parseNumericParam(req.params['id'] as string, 'id');
  const verificacionId = parseNumericParam(
    req.params['verificacionId'] as string,
    'verificacionId',
  );
  if (!req.file) {
    throw new AppError('Debe adjuntar un archivo en el campo "file".', 400);
  }
  const result = await equipoService.attachRegistroVerificacion(id, verificacionId, req.file);
  res.status(200).json({
    status: 'success',
    data: result,
  });
});

export const createMantenimientoHandler = wrap(async (req, res) => {
  const id = parseNumericParam(req.params['id'] as string, 'id');
  const data = assertValid(createMantenimientoSchema.safeParse(req.body));
  const userId = getUserId(res);
  const result = await equipoService.createMantenimiento(id, data, userId);
  res.status(201).json({
    status: 'success',
    data: result,
  });
});

export const listMantenimientosHandler = wrap(async (req, res) => {
  const id = parseNumericParam(req.params['id'] as string, 'id');
  const result = await equipoService.listMantenimientos(id);
  res.status(200).json({
    status: 'success',
    data: result,
  });
});

export const attachDocumentoMantenimientoHandler = wrap(async (req, res) => {
  const id = parseNumericParam(req.params['id'] as string, 'id');
  const mantenimientoId = parseNumericParam(
    req.params['mantenimientoId'] as string,
    'mantenimientoId',
  );
  if (!req.file) {
    throw new AppError('Debe adjuntar un archivo en el campo "file".', 400);
  }
  const result = await equipoService.attachDocumentoMantenimiento(id, mantenimientoId, req.file);
  res.status(200).json({
    status: 'success',
    data: result,
  });
});

export const associateTipoEnsayoHandler = wrap(async (req, res) => {
  const id = parseNumericParam(req.params['id'] as string, 'id');
  const data = assertValid(associateTipoEnsayoSchema.safeParse(req.body));
  const result = await equipoService.associateTipoEnsayo(id, data.tipoEnsayoId);
  res.status(201).json({
    status: 'success',
    data: result,
  });
});

export const listTiposEnsayoHandler = wrap(async (req, res) => {
  const id = parseNumericParam(req.params['id'] as string, 'id');
  const result = await equipoService.listTiposEnsayo(id);
  res.status(200).json({
    status: 'success',
    data: result,
  });
});

export const dissociateTipoEnsayoHandler = wrap(async (req, res) => {
  const id = parseNumericParam(req.params['id'] as string, 'id');
  const testTypeId = parseNumericParam(req.params['testTypeId'] as string, 'testTypeId');
  await equipoService.dissociateTipoEnsayo(id, testTypeId);
  res.status(200).json({
    status: 'success',
    data: null,
  });
});
