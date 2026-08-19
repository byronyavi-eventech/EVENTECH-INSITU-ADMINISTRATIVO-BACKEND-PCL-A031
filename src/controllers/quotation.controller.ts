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
  confirmarPago,
  getComprobantesByCotizacion,
  EstadoCotizacion,
} from '../services/quotation.service.js';
import { sendCotizacionEmail, sendCotizacionClienteEmail } from '../services/email.service.js';
import { verifyQuotationToken } from '../services/token.service.js';
import {
  generateUploadPresignedUrls,
  generateDownloadPresignedUrls,
} from '../services/s3.service.js';
import { CotizacionDocument, loadLogoDataUri } from '../pdf/cotizacion-document.js';
import { AppError } from '../utils/app-error.js';
import { db } from '../db/index.js';
import { cotizacion, cuentaBancaria } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

const wrap =
  (fn: AsyncHandler): AsyncHandler =>
  async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      next(err);
    }
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
  area: z.string().trim().min(1, '"area" es requerido'),
  subarea: z.string().trim().min(1, '"subarea" es requerido'),
  ensayo: z.string().trim().min(1, '"ensayo" es requerido'),
  cantidad: z.coerce.number().int().min(1, '"cantidad" debe ser al menos 1'),
  visitas: z.coerce.number().int().min(1, '"visitas" debe ser al menos 1'),
});

const submitWebQuotationSchema = z.object({
  rutEmpresa: z.string().trim().min(1),
  giroEmpresa: z.string().trim().min(2).max(255),
  nombreContacto: z.string().trim().min(2).max(255),
  celularContacto: z.string().trim().regex(phoneRegex),
  emailContacto: z
    .string()
    .trim()
    .email()
    .max(150)
    .transform((s) => s.toLowerCase()),
  direccionEmpresa: z.string().trim().min(5).max(250),
  regionEmpresa: z.string().trim().min(1).max(100),
  comunaEmpresa: z.string().trim().min(1).max(100),
  ciudadEmpresa: z.string().trim().min(2).max(100),
  nombreObra: z.string().trim().min(2).max(200),
  nombreMandante: z.string().trim().min(2).max(200),
  nombreContratista: z.string().trim().min(2).max(200),
  ubicacionObra: z.string().trim().min(5).max(300),
  regionObra: z.string().trim().min(1).max(100),
  comunaObra: z.string().trim().min(1).max(100),
  ciudadObra: z.string().trim().min(2).max(100),
  duracionObra: z.coerce.number().int().min(1),
  nombreEncargado: z.string().trim().min(2).max(150),
  correoEncargado: z
    .string()
    .trim()
    .email()
    .max(150)
    .transform((s) => s.toLowerCase()),
  telefonoEncargado: z.string().trim().regex(phoneRegex),
  ensayos: z.array(ensayoLineSchema).min(1),
});

export const submitWebQuotationHandler: AsyncHandler = wrap(async (req, res) => {
  const body = assertValid(submitWebQuotationSchema.safeParse(req.body));
  const data = await submitWebQuotation(body);
  res.status(201).json({ status: 'success', data });
});

// ─── GET /quotations ──────────────────────────────────────────────────────────

const listSchema = z.object({
  estado: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
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
  'ESPERA_VERIFICACION',
  'PAGO_VERIFICADO',
  'PAGO_RECHAZADO',
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
  tipoEnsayoId: z.coerce.number().int().min(1),
  cantidadEnsayos: z.coerce.number().int().min(1),
  cantidadVisitas: z.coerce.number().int().min(1),
  precioUnitario: z.string().trim().min(1),
});

const servicioGeneralUpdateSchema = z.object({
  descripcion: z.string().trim().min(1).max(255),
  cantidad: z.coerce.number().int().min(0),
  precioUnitario: z.string().trim().min(1),
});

const updateQuotationSchema = z.object({
  giroEmpresa: z.string().trim().min(2).max(255).optional(),
  nombreContacto: z.string().trim().min(2).max(255).optional(),
  celularContacto: z.string().trim().regex(phoneRegex).optional(),
  emailContacto: z
    .string()
    .trim()
    .email()
    .max(150)
    .transform((s) => s.toLowerCase())
    .optional(),
  direccionEmpresa: z.string().trim().min(5).max(250).optional(),
  regionEmpresa: z.string().trim().min(1).max(100).optional(),
  comunaEmpresa: z.string().trim().min(1).max(100).optional(),
  ciudadEmpresa: z.string().trim().min(2).max(100).optional(),
  nombreEncargado: z.string().trim().min(2).max(150).optional(),
  correoEncargado: z.string().trim().email().max(150).optional(),
  telefonoEncargado: z.string().trim().regex(phoneRegex).optional(),
  observaciones: z.string().trim().optional(),
  diasVigenciaToken: z.coerce.number().int().min(1).max(365).optional(),
  // Notas Comerciales
  condicionPago: z.enum(['PAGO_100', 'PAGO_50', 'CREDITO_30_DIAS']).optional(),
  cuentaPrincipalId: z.coerce.number().int().min(1).nullable().optional(),
  cuentaSecundariaId: z.coerce.number().int().min(1).nullable().optional(),
  tipoAjuste: z.enum(['SIN_AJUSTE', 'DESCUENTO', 'INCREMENTO']).optional(),
  porcentajeAjuste: z.coerce.number().min(0).max(100).nullable().optional(),
  detalles: z.array(detalleUpdateSchema).min(1).optional(),
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

export const getPdfHandler: AsyncHandler = wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new AppError('ID inválido.', 400);

  const cotizacion = await getCotizacionById(id);

  if (cotizacion.estado !== 'FIRMADA') {
    throw new AppError('Solo se puede generar PDF de cotizaciones en estado FIRMADA.', 422);
  }

  const pdfBuffer = await renderToBuffer(
    React.createElement(CotizacionDocument, {
      cotizacion,
      firmaBase64: cotizacion.firmaBase64,
      logoDataUri: loadLogoDataUri(),
    }) as React.ReactElement<DocumentProps>,
  );

  const docCode = cotizacion.codigoCotizacion ?? `${String(cotizacion.id + 9999)}-LIA`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="cotizacion-${docCode}.pdf"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  res.end(pdfBuffer);
});

// ─── POST /quotations/:id/send-email ─────────────────────────────────────────

export const sendEmailHandler: AsyncHandler = wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new AppError('ID inválido.', 400);

  const cotizacion = await getCotizacionById(id);

  if (cotizacion.estado !== 'FIRMADA') {
    throw new AppError('Solo se puede enviar email de cotizaciones en estado FIRMADA.', 422);
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
// Al hacer click en ACEPTAR → redirige a la página de upload en la landing page.
// Al hacer click en RECHAZAR → cambia estado a RECHAZADA_CLIENTE directamente.

export const respondQuotationHandler: AsyncHandler = wrap(async (req, res) => {
  const token = String(req.query.token ?? '');
  if (!token) throw new AppError('Token requerido.', 400);

  const landingUrl = process.env.LANDING_PAGE_URL ?? 'http://localhost:3001';
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

  let payload: Awaited<ReturnType<typeof verifyQuotationToken>>;
  try {
    payload = await verifyQuotationToken(token);
  } catch (err) {
    const msg = (err as Error).message;
    res.redirect(
      302,
      `${frontendUrl}/cotizacion/respuesta?estado=error&mensaje=${encodeURIComponent(msg)}`,
    );
    return;
  }

  const { cotizacionId, accion } = payload;

  // Fetch current state
  const [existing] = await db
    .select({ estado: cotizacion.estado })
    .from(cotizacion)
    .where(eq(cotizacion.id, cotizacionId))
    .limit(1);

  if (!existing) {
    res.redirect(
      302,
      `${frontendUrl}/cotizacion/respuesta?estado=error&mensaje=${encodeURIComponent('Cotizacion no encontrada.')}`,
    );
    return;
  }

  // Idempotencia: si ya subió comprobantes, redirigir a upload page
  if (existing.estado === 'ESPERA_VERIFICACION') {
    res.redirect(
      302,
      `${landingUrl}/cotizacion/pago-upload?token=${encodeURIComponent(token)}&ya_enviado=1`,
    );
    return;
  }

  // Idempotencia: ya rechazó — redirigir a la landing page (pantalla de éxito)
  if (existing.estado === 'RECHAZADA_CLIENTE') {
    res.redirect(
      302,
      `${landingUrl}/cotizacion/rechazar?token=${encodeURIComponent(token)}&ya_rechazado=1`,
    );
    return;
  }

  // Solo se puede responder en estado ENVIADA_CLIENTE
  if (existing.estado !== 'ENVIADA_CLIENTE') {
    res.redirect(
      302,
      `${frontendUrl}/cotizacion/respuesta?estado=error&mensaje=${encodeURIComponent('Esta cotizacion no esta disponible para respuesta.')}`,
    );
    return;
  }

  if (accion === 'RECHAZAR') {
    // No commit yet — redirect to landing page so the client can give a reason
    res.redirect(302, `${landingUrl}/cotizacion/rechazar?token=${encodeURIComponent(token)}`);
    return;
  }

  // ACEPTAR → redirigir a la página de upload de comprobantes en la landing page
  res.redirect(302, `${landingUrl}/cotizacion/pago-upload?token=${encodeURIComponent(token)}`);
});

// ─── POST /quotations/rechazar-cliente (PUBLIC — cliente confirma rechazo con comentario) ──
// El cliente llega desde la landing page /cotizacion/rechazar con el token de email.
// Valida token, guarda el comentario y confirma el estado RECHAZADA_CLIENTE.

const rechazarClienteSchema = z.object({
  token: z.string().min(1),
  comentarioRechazo: z.string().max(500).optional(),
});

export const rechazarClienteHandler: AsyncHandler = wrap(async (req, res) => {
  const body = assertValid(rechazarClienteSchema.safeParse(req.body));

  let payload: Awaited<ReturnType<typeof verifyQuotationToken>>;
  try {
    payload = await verifyQuotationToken(body.token);
  } catch (err) {
    throw new AppError((err as Error).message, 401);
  }

  if (payload.accion !== 'RECHAZAR') {
    throw new AppError('Token inválido para esta operación.', 401);
  }

  const { cotizacionId } = payload;

  const [existing] = await db
    .select({ estado: cotizacion.estado })
    .from(cotizacion)
    .where(eq(cotizacion.id, cotizacionId))
    .limit(1);

  if (!existing) throw new AppError('Cotización no encontrada.', 404);

  // Idempotencia: ya rechazó — responder OK sin error
  if (existing.estado === 'RECHAZADA_CLIENTE') {
    res.json({ status: 'success', message: 'Cotización ya había sido rechazada.' });
    return;
  }

  if (existing.estado !== 'ENVIADA_CLIENTE') {
    throw new AppError('Esta cotización no está disponible para rechazo.', 409);
  }

  await db
    .update(cotizacion)
    .set({
      estado: 'RECHAZADA_CLIENTE',
      comentarioRechazo: body.comentarioRechazo ?? null,
      respuestaClienteAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(cotizacion.id, cotizacionId));

  logger.info({ cotizacionId }, 'quotation.service: cliente rechazó cotización');

  res.json({ status: 'success', message: 'Cotización rechazada correctamente.' });
});

// ─── GET /quotations/upload-session (PUBLIC — cliente obtiene presigned URLs) ──
// El cliente llega con el token del email y obtiene las presigned PUT URLs de S3.


const fileDescriptorSchema = z.object({
  nombreArchivo: z.string().trim().min(1).max(255),
  contentType: z.enum(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']),
  sizeBytes: z.coerce
    .number()
    .int()
    .min(1)
    .max(10 * 1024 * 1024),
});

const uploadSessionSchema = z.object({
  token: z.string().min(1),
  files: z.array(fileDescriptorSchema).min(1).max(5),
});

export const getUploadSessionHandler: AsyncHandler = wrap(async (req, res) => {
  const body = assertValid(uploadSessionSchema.safeParse(req.body));

  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

  // Verificar token
  let payload: Awaited<ReturnType<typeof verifyQuotationToken>>;
  try {
    payload = await verifyQuotationToken(body.token);
  } catch (err) {
    throw new AppError((err as Error).message, 401);
  }

  if (payload.accion !== 'ACEPTAR') {
    throw new AppError('Token inválido para esta operación.', 401);
  }

  // Verificar estado de la cotización
  const [existing] = await db
    .select({ estado: cotizacion.estado })
    .from(cotizacion)
    .where(eq(cotizacion.id, payload.cotizacionId))
    .limit(1);

  if (!existing) {
    throw new AppError('Cotización no encontrada.', 404);
  }

  if (existing.estado !== 'ENVIADA_CLIENTE') {
    throw new AppError(
      `No se pueden generar URLs de subida para cotizaciones en estado ${existing.estado}.`,
      422,
    );
  }

  // Generar presigned PUT URLs
  const targets = await generateUploadPresignedUrls(payload.cotizacionId, body.files);

  res.json({
    status: 'success',
    data: {
      cotizacionId: payload.cotizacionId,
      frontendUrl,
      targets: targets.map((t) => ({
        s3Key: t.s3Key,
        nombreArchivo: t.nombreArchivo,
        contentType: t.contentType,
        sizeBytes: t.sizeBytes,
        uploadUrl: t.uploadUrl,
      })),
    },
  });
});

// ─── POST /quotations/confirmar-pago (PUBLIC — cliente confirma pago) ──────────

const confirmarPagoSchema = z.object({
  token: z.string().min(1),
  comprobantes: z
    .array(
      z.object({
        s3Key: z.string().min(1).max(512),
        nombreArchivo: z.string().min(1).max(255),
        contentType: z.enum(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']),
        sizeBytes: z.coerce.number().int().min(1),
      }),
    )
    .min(1)
    .max(5),
});

export const confirmarPagoHandler: AsyncHandler = wrap(async (req, res) => {
  const body = assertValid(confirmarPagoSchema.safeParse(req.body));

  // Verificar token
  let payload: Awaited<ReturnType<typeof verifyQuotationToken>>;
  try {
    payload = await verifyQuotationToken(body.token);
  } catch (err) {
    throw new AppError((err as Error).message, 401);
  }

  if (payload.accion !== 'ACEPTAR') {
    throw new AppError('Token inválido para esta operación.', 401);
  }

  const result = await confirmarPago(payload.cotizacionId, body.comprobantes);

  res.json({
    status: 'success',
    data: result,
    message: 'Comprobantes recibidos. La cotización está en espera de verificación de pago.',
  });
});

// ─── GET /quotations/:id/comprobantes (PROTECTED — admin descarga comprobantes) ─

export const getComprobantesHandler: AsyncHandler = wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new AppError('ID inválido.', 400);

  const comprobantes = await getComprobantesByCotizacion(id);

  if (comprobantes.length === 0) {
    res.json({ status: 'success', data: [] });
    return;
  }

  // Generar presigned GET URLs para descarga
  const withUrls = await generateDownloadPresignedUrls(comprobantes);

  res.json({ status: 'success', data: withUrls });
});

// ─── PATCH /quotations/:id/verificar-pago (PROTECTED — admin verifica pago) ───

export const verificarPagoHandler: AsyncHandler = wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new AppError('ID inválido.', 400);

  const data = await updateEstadoCotizacion(id, 'PAGO_VERIFICADO');
  res.json({ status: 'success', data, message: 'Pago verificado exitosamente.' });
});

// ─── PATCH /quotations/:id/rechazar-pago (PROTECTED — admin rechaza comprobantes) ─

export const rechazarPagoHandler: AsyncHandler = wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new AppError('ID inválido.', 400);

  const data = await updateEstadoCotizacion(id, 'PAGO_RECHAZADO');
  res.json({ status: 'success', data, message: 'Comprobantes de pago rechazados.' });
});
