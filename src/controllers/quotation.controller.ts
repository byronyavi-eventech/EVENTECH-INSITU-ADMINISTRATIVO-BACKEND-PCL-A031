import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import React from 'react';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import {
  submitWebQuotation,
  listQuotations,
  updateEstadoCotizacion,
  updateQuotation,
  getCotizacionById,
  EstadoCotizacion,
} from '../services/quotation.service.js';
import { sendCotizacionEmail } from '../services/email.service.js';
import { CotizacionDocument } from '../pdf/cotizacion-document.js';
import { AppError } from '../utils/app-error.js';

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
  nombreContacto:    z.string().trim().min(2).max(100),
  apellidosContacto: z.string().trim().min(2).max(150),
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
  'BORRADOR', 'ENVIADA', 'ACEPTADA', 'RECHAZADA', 'VENCIDA', 'ANULADA',
];

const updateEstadoSchema = z.object({
  estado: z.enum(VALID_ESTADOS as [EstadoCotizacion, ...EstadoCotizacion[]], {
    error: `"estado" debe ser uno de: ${VALID_ESTADOS.join(', ')}`,
  }),
});

export const updateEstadoHandler: AsyncHandler = wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new AppError('ID inválido.', 400);

  const { estado } = assertValid(updateEstadoSchema.safeParse(req.body));
  const data = await updateEstadoCotizacion(id, estado);
  res.json({ status: 'success', data });
});

// ─── PUT /quotations/:id ──────────────────────────────────────────────────────

const detalleUpdateSchema = z.object({
  tipoEnsayoId:    z.coerce.number().int().min(1),
  cantidadEnsayos: z.coerce.number().int().min(1),
  cantidadVisitas: z.coerce.number().int().min(1),
  precioUnitario:  z.string().trim().min(1),
});

const updateQuotationSchema = z.object({
  giroEmpresa:       z.string().trim().min(2).max(255).optional(),
  nombreContacto:    z.string().trim().min(2).max(100).optional(),
  apellidosContacto: z.string().trim().min(2).max(150).optional(),
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
  detalles:          z.array(detalleUpdateSchema).min(1).optional(),
});

export const updateQuotationHandler: AsyncHandler = wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new AppError('ID inválido.', 400);

  const body = assertValid(updateQuotationSchema.safeParse(req.body));
  const data = await updateQuotation(id, body);
  res.json({ status: 'success', data });
});

// ─── GET /quotations/:id/pdf ──────────────────────────────────────────────────

export const getPdfHandler: AsyncHandler = wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new AppError('ID inválido.', 400);

  const cotizacion = await getCotizacionById(id);

  if (cotizacion.estado !== 'ACEPTADA') {
    throw new AppError(
      'Solo se puede generar PDF de cotizaciones en estado ACEPTADA.',
      422,
    );
  }

  const pdfBuffer = await renderToBuffer(
    React.createElement(CotizacionDocument, { cotizacion }) as React.ReactElement<DocumentProps>,
  );

  const docCode =
    cotizacion.codigoCotizacion ??
    `COT-${String(cotizacion.id).padStart(5, '0')}`;

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

  if (cotizacion.estado !== 'ACEPTADA') {
    throw new AppError(
      'Solo se puede enviar email de cotizaciones en estado ACEPTADA.',
      422,
    );
  }

  await sendCotizacionEmail(cotizacion);

  res.json({
    status: 'success',
    message: `Email enviado a ${cotizacion.cliente.email}`,
  });
});
