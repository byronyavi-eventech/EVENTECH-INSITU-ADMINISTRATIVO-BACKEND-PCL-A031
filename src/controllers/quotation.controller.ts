import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import {
  submitWebQuotation,
  listQuotations,
  updateEstadoCotizacion,
  updateQuotation,
  getCotizacionById,
  EstadoCotizacion,
} from '../services/quotation.service.js';
import {
  sendCotizacionEmail,
  sendCotizacionClienteEmail,
} from '../services/email.service.js';
import { verifyQuotationToken } from '../services/token.service.js';
import { CotizacionDocument } from '../pdf/cotizacion-document.js';
import { AppError } from '../utils/app-error.js';
import { db } from '../db/index.js';
import { cotizacion, cuentaBancaria } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

const wrap = (fn: AsyncHandler): AsyncHandler =>
  async (req, res, next) => {
    try { await fn(req, res, next); } catch (err) { next(err); }
  };

function assertValid<T>(
  parsed: { success: true; data: T } | { success: false; error: z.ZodError },
): T {
  if (!parsed.success) {
    const messages = parsed.error.issues.map((i) => i.message).join(' | ');
    throw new AppError(messages, 400);
  }
  return parsed.data;
}

const phoneRegex = /^(\+?56)?\s?9\s?[0-9]{4}\s?[0-9]{4}$/;

// ─── POST /quotations/web ─────────────────────────────────────────────────────

const ensayoLineSchema = z.object({
  area:     z.string().trim().min(1, '"area" es requerido'),
  subarea:  z.string().trim().min(1, '"subarea" es requerido'),
  ensayo:   z.string().trim().min(1, '"ensayo" es requerido'),
  cantidad: z.coerce.number().int().min(1, '"cantidad" debe ser al menos 1'),
  visitas:  z.coerce.number().int().min(1, '"visitas" debe ser al menos 1'),
});

const submitWebQuotationSchema = z.object({
  rutEmpresa:        z.string().trim().min(1),
  giroEmpresa:       z.string().trim().min(2).max(255),
  nombreContacto:    z.string().trim().min(2).max(255),
  celularContacto:   z.string().trim().regex(phoneRegex),
  emailContacto:     z.string().trim().email().max(150).transform((s) => s.toLowerCase()),
  direccionEmpresa:  z.string().trim().min(5).max(250),
  regionEmpresa:     z.string().trim().min(1).max(100),
  comunaEmpresa:     z.string().trim().min(1).max(100),
  ciudadEmpresa:     z.string().trim().min(2).max(100),
  nombreObra:        z.string().trim().min(2).max(200),
  nombreMandante:    z.string().trim().min(2).max(200),
  nombreContratista: z.string().trim().min(2).max(200),
  ubicacionObra:     z.string().trim().min(5).max(300),
  regionObra:        z.string().trim().min(1).max(100),
  comunaObra:        z.string().trim().min(1).max(100),
  ciudadObra:        z.string().trim().min(2).max(100),
  duracionObra:      z.coerce.number().int().min(1),
  nombreEncargado:   z.string().trim().min(2).max(150),
  correoEncargado:   z.string().trim().email().max(150).transform((s) => s.toLowerCase()),
  telefonoEncargado: z.string().trim().regex(phoneRegex),
  ensayos:           z.array(ensayoLineSchema).min(1),
});

export const submitWebQuotationHandler: AsyncHandler = wrap(async (req, res) => {
  const body = assertValid(submitWebQuotationSchema.safeParse(req.body));
  const data = await submitWebQuotation(body);
  res.status(201).json({ status: 'success', data });
});

// ─── GET /quotations ──────────────────────────────────────────────────────────

const listSchema = z.object({
  estado: z.string().optional(),
  q:      z.string().optional(),
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
});

export const listQuotationsHandler: AsyncHandler = wrap(async (req, res) => {
  const query = assertValid(listSchema.safeParse(req.query));
  const result = await listQuotations(query);
  res.json({ status: 'success', ...result });
});

// ─── PATCH /quotations/:id/estado ─────────────────────────────────────────────

const VALID_ESTADOS: EstadoCotizacion[] = [
  'NUEVA',
  'ENVIADA_FIRMA',
  'FIRMADA',
  'ENVIADA_CLIENTE',
  'ACEPTADA_CLIENTE',
  'RECHAZADA_CLIENTE',
  'RECHAZADA',
  'VENCIDA',
  'ANULADA',
];

const updateEstadoSchema = z.object({
  estado: z.enum(VALID_ESTADOS as [EstadoCotizacion, ...EstadoCotizacion[]], {
    error: `"estado" debe ser uno de: ${VALID_ESTADOS.join(', ')}`,
  }),
  firmaBase64: z.string().optional(),
});

export const updateEstadoHandler: AsyncHandler = wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new AppError('ID inválido.', 400);

  const { estado, firmaBase64 } = assertValid(updateEstadoSchema.safeParse(req.body));
  const data = await updateEstadoCotizacion(id, estado, firmaBase64);
  res.json({ status: 'success', data });
});

// ─── PUT /quotations/:id ──────────────────────────────────────────────────────

const detalleUpdateSchema = z.object({
  tipoEnsayoId:    z.coerce.number().int().min(1),
  cantidadEnsayos: z.coerce.number().int().min(1),
  cantidadVisitas: z.coerce.number().int().min(1),
  precioUnitario:  z.string().trim().min(1),
});

const servicioGeneralUpdateSchema = z.object({
  descripcion:     z.string().trim().min(1).max(255),
  cantidad:        z.coerce.number().int().min(0),
  precioUnitario:  z.string().trim().min(1),
});

const updateQuotationSchema = z.object({
  giroEmpresa:       z.string().trim().min(2).max(255).optional(),
  nombreContacto:    z.string().trim().min(2).max(255).optional(),
  celularContacto:   z.string().trim().regex(phoneRegex).optional(),
  emailContacto:     z.string().trim().email().max(150).transform((s) => s.toLowerCase()).optional(),
  direccionEmpresa:  z.string().trim().min(5).max(250).optional(),
  regionEmpresa:     z.string().trim().min(1).max(100).optional(),
  comunaEmpresa:     z.string().trim().min(1).max(100).optional(),
  ciudadEmpresa:     z.string().trim().min(2).max(100).optional(),
  nombreEncargado:   z.string().trim().min(2).max(150).optional(),
  correoEncargado:   z.string().trim().email().max(150).optional(),
  telefonoEncargado: z.string().trim().regex(phoneRegex).optional(),
  observaciones:     z.string().trim().optional(),
  diasVigenciaToken: z.coerce.number().int().min(1).max(365).optional(),
  // Notas Comerciales
  condicionPago:     z.enum(['PAGO_100', 'PAGO_50', 'CREDITO_30_DIAS']).optional(),
  cuentaPrincipalId: z.coerce.number().int().min(1).nullable().optional(),
  cuentaSecundariaId: z.coerce.number().int().min(1).nullable().optional(),
  tipoAjuste:        z.enum(['SIN_AJUSTE', 'DESCUENTO', 'INCREMENTO']).optional(),
  porcentajeAjuste:  z.coerce.number().min(0).max(100).nullable().optional(),
  detalles:          z.array(detalleUpdateSchema).min(1).optional(),
  serviciosGenerales: z.array(servicioGeneralUpdateSchema).optional(),
});

export const updateQuotationHandler: AsyncHandler = wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new AppError('ID inválido.', 400);

  const body = assertValid(updateQuotationSchema.safeParse(req.body));
  const data = await updateQuotation(id, body);
  res.json({ status: 'success', data });
});

// ─── GET /quotations/cuentas ───────────────────────────────────────────────────

export const getCuentasHandler: AsyncHandler = wrap(async (_req, res) => {
  const cuentas = await db
    .select()
    .from(cuentaBancaria)
    .where(eq(cuentaBancaria.activo, true))
    .orderBy(cuentaBancaria.id);
  res.json({ status: 'success', data: cuentas });
});

// ─── GET /quotations/:id/pdf ──────────────────────────────────────────────────

/**
 * Lee el logo del disco y arma un data URI base64.
 * react-pdf resuelve un `src` de tipo path de filesystem plano internamente vía
 * fetch(), que falla en silencio con paths sin esquema `file://` — el mismo
 * enfoque de data URI que ya usamos para firmaBase64 evita ese problema.
 * Si el archivo no existe, se loguea un warning y se omite la imagen (no rompe
 * la generación del PDF).
 */
function loadLogoDataUri(): string | undefined {
  const logoPath = path.join(process.cwd(), 'src', 'pdf', 'logo-insitu.png');
  try {
    const buffer = fs.readFileSync(logoPath);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch (err) {
    logger.warn(
      { err, logoPath },
      'quotation.controller: no se pudo leer logo-insitu.png para el PDF, se omitirá la imagen.',
    );
    return undefined;
  }
}

export const getPdfHandler: AsyncHandler = wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new AppError('ID inválido.', 400);

  const cotizacion = await getCotizacionById(id);

  if (cotizacion.estado !== 'FIRMADA') {
    throw new AppError(
      'Solo se puede generar PDF de cotizaciones en estado FIRMADA.',
      422,
    );
  }

  const pdfBuffer = await renderToBuffer(
    React.createElement(CotizacionDocument, {
      cotizacion,
      firmaBase64: cotizacion.firmaBase64,
      logoDataUri: loadLogoDataUri(),
    }) as React.ReactElement<DocumentProps>,
  );

  const docCode =
    cotizacion.codigoCotizacion ??
    `${String(cotizacion.id + 9999)}-LIA`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="cotizacion-${docCode}.pdf"`,
  );
  res.setHeader('Content-Length', pdfBuffer.length);
  res.end(pdfBuffer);
});

// ─── POST /quotations/:id/send-email ─────────────────────────────────────────

export const sendEmailHandler: AsyncHandler = wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new AppError('ID inválido.', 400);

  const cotizacion = await getCotizacionById(id);

  if (cotizacion.estado !== 'FIRMADA') {
    throw new AppError(
      'Solo se puede enviar email de cotizaciones en estado FIRMADA.',
      422,
    );
  }

  await sendCotizacionEmail(cotizacion);

  res.json({
    status: 'success',
    message: `Email enviado a ${cotizacion.cliente.email}`,
  });
});

// ─── POST /quotations/:id/send-cliente-email ───────────────────────────────────────

export const sendClienteEmailHandler: AsyncHandler = wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new AppError('ID invalido.', 400);

  const cot = await getCotizacionById(id);

  if (cot.estado !== 'FIRMADA') {
    throw new AppError(
      'Solo se puede enviar email al cliente de cotizaciones en estado FIRMADA.',
      422,
    );
  }

  // Send email with Accept/Reject buttons using the per-quotation TTL
  await sendCotizacionClienteEmail(cot, cot.diasVigenciaToken);

  // Transition to ENVIADA_CLIENTE and record timestamp
  await db
    .update(cotizacion)
    .set({
      estado: 'ENVIADA_CLIENTE',
      tokenEnviadoAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(cotizacion.id, id));

  res.json({
    status: 'success',
    message: `Email enviado al cliente ${cot.cliente.email}. Estado actualizado a ENVIADA_CLIENTE.`,
  });
});

// ─── GET /quotations/respond (PUBLIC — cliente hace click en el email) ─────────

export const respondQuotationHandler: AsyncHandler = wrap(async (req, res) => {
  const token = String(req.query.token ?? '');
  if (!token) throw new AppError('Token requerido.', 400);

  const frontendUrl =
    process.env.FRONTEND_URL ?? 'http://localhost:5173';

  let payload: Awaited<ReturnType<typeof verifyQuotationToken>>;
  try {
    payload = await verifyQuotationToken(token);
  } catch (err) {
    const msg = (err as Error).message;
    return res.redirect(
      302,
      `${frontendUrl}/cotizacion/respuesta?estado=error&mensaje=${encodeURIComponent(msg)}`,
    );
  }

  const { cotizacionId, accion } = payload;

  // Fetch current state
  const [existing] = await db
    .select({ estado: cotizacion.estado })
    .from(cotizacion)
    .where(eq(cotizacion.id, cotizacionId))
    .limit(1);

  if (!existing) {
    return res.redirect(
      302,
      `${frontendUrl}/cotizacion/respuesta?estado=error&mensaje=${encodeURIComponent('Cotizacion no encontrada.')}`,
    );
  }

  // Idempotencia: si ya respondio, redirigir con el estado actual
  if (
    existing.estado === 'ACEPTADA_CLIENTE' ||
    existing.estado === 'RECHAZADA_CLIENTE'
  ) {
    const estadoLabel = existing.estado === 'ACEPTADA_CLIENTE' ? 'aceptada' : 'rechazada';
    return res.redirect(
      302,
      `${frontendUrl}/cotizacion/respuesta?estado=${estadoLabel}&cotizacionId=${cotizacionId}`,
    );
  }

  // Solo se puede responder en estado ENVIADA_CLIENTE
  if (existing.estado !== 'ENVIADA_CLIENTE') {
    return res.redirect(
      302,
      `${frontendUrl}/cotizacion/respuesta?estado=error&mensaje=${encodeURIComponent('Esta cotizacion no esta disponible para respuesta.')}`,
    );
  }

  const nuevoEstado: EstadoCotizacion =
    accion === 'ACEPTAR' ? 'ACEPTADA_CLIENTE' : 'RECHAZADA_CLIENTE';

  await db
    .update(cotizacion)
    .set({
      estado: nuevoEstado,
      respuestaClienteAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(cotizacion.id, cotizacionId));

  const estadoLabel = nuevoEstado === 'ACEPTADA_CLIENTE' ? 'aceptada' : 'rechazada';

  return res.redirect(
    302,
    `${frontendUrl}/cotizacion/respuesta?estado=${estadoLabel}&cotizacionId=${cotizacionId}`,
  );
});
