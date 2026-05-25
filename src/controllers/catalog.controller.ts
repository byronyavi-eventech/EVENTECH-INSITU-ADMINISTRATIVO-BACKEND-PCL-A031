/**
 * catalog.controller.ts
 * HTTP boundary for the catalog domain.
 *
 * Responsibilities:
 *   1. Parse and validate input with Zod (fail fast at the boundary).
 *   2. Call the service (no business logic here).
 *   3. Shape the HTTP response.
 *
 * POST   /ensayos      → createEnsayoHandler
 * GET    /areas        → getCatalogTreeHandler
 * GET    /ensayos      → listEnsayosHandler
 * GET    /ensayos/:id  → getEnsayoByIdHandler
 * PUT    /ensayos/:id  → updateEnsayoHandler
 * DELETE /ensayos/:id  → deactivateEnsayoHandler
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  createArea,
  createEnsayo,
  getCatalogTree,
  listEnsayos,
  getEnsayoById,
  updateEnsayo,
  deactivateEnsayo,
} from '../services/catalog.service.js';
import { AppError } from '../utils/app-error.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Forward any error (AppError or unexpected) to the global error handler. */
type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;
const wrap = (fn: AsyncHandler): AsyncHandler =>
  async (req, res, next) => {
    try { await fn(req, res, next); } catch (err) { next(err); }
  };

/** Parse a Zod result and throw a 400 AppError on failure. */
function assertValid<T>(parsed: { success: true; data: T } | { success: false; error: z.ZodError }): T {
  if (!parsed.success) {
    const messages = parsed.error.issues.map((i: z.core.$ZodIssue) => i.message).join(' | ');
    throw new AppError(messages, 400);
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------
// POST /api/catalog/areas — Create area
// ---------------------------------------------------------------------------

const createAreaSchema = z.object({
  nombreArea: z
    .string({ error: '"nombreArea" es requerido y debe ser texto.' })
    .trim()
    .min(1, '"nombreArea" no puede estar vacío.')
    .max(150, '"nombreArea" no puede exceder 150 caracteres.'),
});

/**
 * POST /api/catalog/areas
 * Body: { nombreArea }
 * Response 201: { status, data: { id, nombreArea, activo } }
 * Response 409: área con ese nombre ya existe
 */
export const createAreaHandler: AsyncHandler = wrap(async (req, res) => {
  const body = assertValid<z.infer<typeof createAreaSchema>>(createAreaSchema.safeParse(req.body));
  const result = await createArea(body);
  res.status(201).json({ status: 'success', data: result });
});

// ---------------------------------------------------------------------------
// POST /api/catalog/ensayos — Create
// ---------------------------------------------------------------------------

const createEnsayoSchema = z.object({
  nombreArea: z
    .string({ error: '"nombreArea" es requerido y debe ser texto.' })
    .trim()
    .min(1, '"nombreArea" no puede estar vacío.')
    .max(150, '"nombreArea" no puede exceder 150 caracteres.'),

  nombreSubarea: z
    .string({ error: '"nombreSubarea" es requerido y debe ser texto.' })
    .trim()
    .min(1, '"nombreSubarea" no puede estar vacío.')
    .max(150, '"nombreSubarea" no puede exceder 150 caracteres.'),

  nombreTipoEnsayo: z
    .string({ error: '"nombreTipoEnsayo" es requerido y debe ser texto.' })
    .trim()
    .min(1, '"nombreTipoEnsayo" no puede estar vacío.')
    .max(250, '"nombreTipoEnsayo" no puede exceder 250 caracteres.'),

  codigoNorma: z
    .string()
    .trim()
    .max(100, '"codigoNorma" no puede exceder 100 caracteres.')
    .optional(),

  precio: z
    .string({ error: '"precio" es requerido y debe ser texto numérico.' })
    .trim()
    .regex(
      /^\d+(\.\d{1,2})?$/,
      '"precio" debe ser un número positivo con hasta 2 decimales (ej: "85000" o "1250.50").',
    )
    .refine((v) => parseFloat(v) > 0, { message: '"precio" debe ser mayor que cero.' }),

  fechaInicio: z
    .string()
    .trim()
    .date('"fechaInicio" debe estar en formato ISO 8601: YYYY-MM-DD.')
    .optional(),
});

/**
 * POST /api/catalog/ensayos
 * Body: { nombreArea, nombreSubarea, nombreTipoEnsayo, codigoNorma?, precio, fechaInicio? }
 * Response 201: { status, data: CreateEnsayoResult }
 */
export const createEnsayoHandler: AsyncHandler = wrap(async (req, res) => {
  const body = assertValid<z.infer<typeof createEnsayoSchema>>(createEnsayoSchema.safeParse(req.body));
  const result = await createEnsayo(body);
  res.status(201).json({ status: 'success', data: result });
});

// ---------------------------------------------------------------------------
// GET /api/catalog/areas — Full catalog tree
// ---------------------------------------------------------------------------

/**
 * GET /api/catalog/areas
 * No query params — returns every active area with its subareas, tipos and active price.
 * Response 200: { status, data: AreaTreeItem[] }
 */
export const getCatalogTreeHandler: AsyncHandler = wrap(async (_req, res) => {
  const data = await getCatalogTree();
  res.status(200).json({ status: 'success', data });
});

// ---------------------------------------------------------------------------
// GET /api/catalog/ensayos — Paginated flat list
// ---------------------------------------------------------------------------

const listEnsayosSchema = z.object({
  areaId: z
    .string()
    .regex(/^\d+$/, '"areaId" debe ser un número entero positivo.')
    .transform(Number)
    .optional(),

  subareaId: z
    .string()
    .regex(/^\d+$/, '"subareaId" debe ser un número entero positivo.')
    .transform(Number)
    .optional(),

  // In Zod v4, .default() must match the OUTPUT type after .transform().
  // We keep the raw string default and let .transform() convert it.
  activo: z
    .enum(['true', 'false'], { error: '"activo" debe ser "true" o "false".' })
    .transform((v) => v === 'true')
    .default(true),

  q: z.string().trim().min(1).max(100).optional(),

  page: z
    .string()
    .regex(/^\d+$/, '"page" debe ser un número entero positivo.')
    .transform(Number)
    .refine((v) => v >= 1, { message: '"page" debe ser mayor o igual a 1.' })
    .default(1),

  limit: z
    .string()
    .regex(/^\d+$/, '"limit" debe ser un número entero positivo.')
    .transform(Number)
    .refine((v) => v >= 1 && v <= 100, {
      message: '"limit" debe estar entre 1 y 100.',
    })
    .default(20),
});

/**
 * GET /api/catalog/ensayos
 * Query params: areaId?, subareaId?, activo?, q?, page?, limit?
 * Response 200: { status, data: EnsayoListItem[], pagination }
 */
export const listEnsayosHandler: AsyncHandler = wrap(async (req, res) => {
  const query = assertValid<z.infer<typeof listEnsayosSchema>>(listEnsayosSchema.safeParse(req.query));
  const result = await listEnsayos(query);
  res.status(200).json({ status: 'success', ...result });
});

// ---------------------------------------------------------------------------
// GET /api/catalog/ensayos/:id — Single detail
// ---------------------------------------------------------------------------

const idParamSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, 'El parámetro "id" debe ser un número entero positivo.')
    .transform(Number),
});

/**
 * GET /api/catalog/ensayos/:id
 * Response 200: { status, data: EnsayoDetail }
 * Response 404: { status, message } when not found
 */
export const getEnsayoByIdHandler: AsyncHandler = wrap(async (req, res) => {
  const { id } = assertValid<z.infer<typeof idParamSchema>>(idParamSchema.safeParse(req.params));
  const data = await getEnsayoById(id);
  res.status(200).json({ status: 'success', data });
});

// ---------------------------------------------------------------------------
// PUT /api/catalog/ensayos/:id — Partial update
// ---------------------------------------------------------------------------

/**
 * At least one of the four fields must be present.
 * Using a superRefine keeps Zod error messages granular and consistent
 * with the rest of the codebase (they all surface through assertValid).
 */
const updateEnsayoSchema = z
  .object({
    nombreTipoEnsayo: z
      .string()
      .trim()
      .min(1,   '"nombreTipoEnsayo" no puede estar vacío.')
      .max(250, '"nombreTipoEnsayo" no puede exceder 250 caracteres.')
      .optional(),

    codigoNorma: z
      .string()
      .trim()
      .max(100, '"codigoNorma" no puede exceder 100 caracteres.')
      .nullable()
      .optional(),

    precio: z
      .string()
      .trim()
      .regex(
        /^\d+(\.\d{1,2})?$/,
        '"precio" debe ser un número positivo con hasta 2 decimales (ej: "95000" o "1250.50").',
      )
      .refine((v) => parseFloat(v) > 0, { message: '"precio" debe ser mayor que cero.' })
      .optional(),

    fechaInicio: z
      .string()
      .trim()
      .date('"fechaInicio" debe estar en formato ISO 8601: YYYY-MM-DD.')
      .optional(),
  })
  .superRefine((body, ctx) => {
    const hasPayload =
      body.nombreTipoEnsayo !== undefined ||
      body.codigoNorma      !== undefined ||
      body.precio           !== undefined;

    if (!hasPayload) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'El cuerpo debe incluir al menos uno de: nombreTipoEnsayo, codigoNorma, precio.',
      });
    }

    if (body.fechaInicio !== undefined && body.precio === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '"fechaInicio" sólo aplica cuando también se envía un nuevo "precio".',
      });
    }
  });

/**
 * PUT /api/catalog/ensayos/:id
 * Body: { nombreTipoEnsayo?, codigoNorma?, precio?, fechaInicio? }  (at least one required)
 * Response 200: { status, data: UpdateEnsayoResult }
 * Response 404: tipo de ensayo no encontrado
 * Response 409: nombre duplicado en la misma subárea
 */
export const updateEnsayoHandler: AsyncHandler = wrap(async (req, res) => {
  const { id } = assertValid<z.infer<typeof idParamSchema>>(idParamSchema.safeParse(req.params));
  const body   = assertValid<z.infer<typeof updateEnsayoSchema>>(updateEnsayoSchema.safeParse(req.body));
  const data   = await updateEnsayo(id, body);
  res.status(200).json({ status: 'success', data });
});

// ---------------------------------------------------------------------------
// DELETE /api/catalog/ensayos/:id — Soft-delete
// ---------------------------------------------------------------------------

/**
 * DELETE /api/catalog/ensayos/:id
 * No body — sets activo = false (soft-delete preserves price history & audit trail).
 * Response 200: { status, data: { id, activo: false } }
 * Response 404: tipo de ensayo no encontrado
 * Response 409: ensayo ya estaba inactivo
 */
export const deactivateEnsayoHandler: AsyncHandler = wrap(async (req, res) => {
  const { id } = assertValid<z.infer<typeof idParamSchema>>(idParamSchema.safeParse(req.params));
  const data   = await deactivateEnsayo(id);
  res.status(200).json({ status: 'success', data });
});
