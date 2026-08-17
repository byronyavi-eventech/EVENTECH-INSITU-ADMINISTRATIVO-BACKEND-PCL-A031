import { db } from '../db/index.js';
import {
  cliente,
  obra,
  encargadoObra,
  cotizacion,
  cotizacionDetalle,
  cotizacionServicioGeneral,
  cotizacionComprobante,
  cuentaBancaria,
  tipoEnsayo,
  subareaEnsayo,
  areaEnsayo,
  precioEnsayo,
} from '../db/schema/index.js';
import { eq, and, ilike, isNull, or, count, sql, SQL, desc } from 'drizzle-orm';
import { AppError } from '../utils/app-error.js';
import { logger } from '../utils/logger.js';

export interface EnsayoLineInput {
  area: string;
  subarea: string;
  ensayo: string;
  cantidad: number;
  visitas: number;
}

export interface SubmitWebQuotationInput {
  rutEmpresa: string;
  giroEmpresa: string;
  nombreContacto: string;
  celularContacto: string;
  emailContacto: string;
  direccionEmpresa: string;
  regionEmpresa: string;
  comunaEmpresa: string;
  ciudadEmpresa: string;
  nombreObra: string;
  nombreMandante: string;
  nombreContratista: string;
  ubicacionObra: string;
  regionObra: string;
  comunaObra: string;
  ciudadObra: string;
  duracionObra: number;
  nombreEncargado: string;
  correoEncargado: string;
  telefonoEncargado: string;
  ensayos: EnsayoLineInput[];
}

export interface SubmitWebQuotationResult {
  cotizacionId: number;
  clienteId: number;
  obraId: number;
}

// List

export interface ListQuotationsInput {
  estado?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export interface QuotationListItem {
  id: number;
  codigoCotizacion: string | null;
  estado: string;
  origen: string;
  fechaSolicitud: string;
  createdAt: string;
  observaciones: string | null;
  diasVigenciaToken: number;
  // ── Notas Comerciales ─────────────────────────────────
  condicionPago: string;
  tipoAjuste: string;
  porcentajeAjuste: string | null;
  cuentaPrincipal: {
    id: number;
    banco: string;
    tipoCuenta: string;
    numeroCuenta: string;
    titular: string;
    rut: string;
  } | null;
  cuentaSecundaria: {
    id: number;
    banco: string;
    tipoCuenta: string;
    numeroCuenta: string;
    titular: string;
    rut: string;
  } | null;
  // ───────────────────────────────────────────────
  cliente: {
    id: number;
    rutEmpresa: string | null;
    giroEmpresa: string;
    nombreContacto: string;
    celularContacto: string;
    email: string;
    direccionEmpresa: string;
    region: string;
    comuna: string;
    ciudad: string;
  };
  obra: {
    id: number;
    nombreObra: string;
    nombreMandante: string;
    nombreContratista: string;
    ubicacionObra: string;
    region: string;
    comuna: string;
    ciudad: string;
    duracionMeses: number;
  };
  encargado: {
    id: number;
    nombreEncargado: string;
    correoEncargado: string;
    telefonoEncargado: string;
  } | null;
  detalles: Array<{
    id: number;
    tipoEnsayoId: number;
    nombreTipoEnsayo: string;
    nombreArea: string;
    nombreSubarea: string;
    cantidadEnsayos: number;
    cantidadVisitas: number;
    precioUnitario: string;
  }>;
  serviciosGenerales: Array<{
    id: number;
    descripcion: string;
    cantidad: number;
    precioUnitario: string;
  }>;
  comprobantesCount: number;
}

export interface ListQuotationsResult {
  data: QuotationListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export async function listQuotations(input: ListQuotationsInput): Promise<ListQuotationsResult> {
  const { estado, q, page = 1, limit = 20 } = input;
  const offset = (page - 1) * limit;

  logger.debug({ estado, q, page, limit }, 'quotation.service: listQuotations');

  // Build filter conditions on cotizacion level
  const conditions: SQL[] = [isNull(cotizacion.deletedAt)];
  if (estado)
    conditions.push(eq(cotizacion.estado, estado as (typeof cotizacion.$inferSelect)['estado']));

  const baseWhere = and(...conditions);

  // Get paginated cotizacion IDs with joins for search
  const rows = await db
    .select({
      id: cotizacion.id,
      codigoCotizacion: cotizacion.codigoCotizacion,
      estado: cotizacion.estado,
      origen: cotizacion.origen,
      fechaSolicitud: cotizacion.fechaSolicitud,
      createdAt: cotizacion.createdAt,
      observaciones: cotizacion.observaciones,
      diasVigenciaToken: cotizacion.diasVigenciaToken,
      condicionPago: cotizacion.condicionPago,
      tipoAjuste: cotizacion.tipoAjuste,
      porcentajeAjuste: cotizacion.porcentajeAjuste,
      cuentaPrincipalId: cotizacion.cuentaPrincipalId,
      cuentaSecundariaId: cotizacion.cuentaSecundariaId,
      // cliente fields
      clienteId: cliente.id,
      rutEmpresa: cliente.rutEmpresa,
      giroEmpresa: cliente.giroEmpresa,
      nombreContacto: cliente.nombreContacto,
      celularContacto: cliente.celularContacto,
      email: cliente.email,
      direccionEmpresa: cliente.direccionEmpresa,
      clienteRegion: cliente.region,
      clienteComuna: cliente.comuna,
      clienteCiudad: cliente.ciudad,
      // obra fields
      obraId: obra.id,
      nombreObra: obra.nombreObra,
      nombreMandante: obra.nombreMandante,
      nombreContratista: obra.nombreContratista,
      ubicacionObra: obra.ubicacionObra,
      obraRegion: obra.region,
      obraComuna: obra.comuna,
      obraCiudad: obra.ciudad,
      duracionMeses: obra.duracionMeses,
    })
    .from(cotizacion)
    .innerJoin(obra, eq(cotizacion.obraId, obra.id))
    .innerJoin(cliente, eq(obra.clienteId, cliente.id))
    .where(
      q
        ? and(
            baseWhere,
            or(
              ilike(cliente.giroEmpresa, `%${q}%`),
              ilike(cliente.nombreContacto, `%${q}%`),
              ilike(cotizacion.codigoCotizacion, `%${q}%`),
              ilike(obra.nombreObra, `%${q}%`),
            ),
          )
        : baseWhere,
    )
    .orderBy(desc(cotizacion.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(cotizacion)
    .innerJoin(obra, eq(cotizacion.obraId, obra.id))
    .innerJoin(cliente, eq(obra.clienteId, cliente.id))
    .where(
      q
        ? and(
            baseWhere,
            or(
              ilike(cliente.giroEmpresa, `%${q}%`),
              ilike(cliente.nombreContacto, `%${q}%`),
              ilike(cotizacion.codigoCotizacion, `%${q}%`),
              ilike(obra.nombreObra, `%${q}%`),
            ),
          )
        : baseWhere,
    );

  if (rows.length === 0) {
    return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
  }

  const cotizacionIds = rows.map((r) => r.id);

  // Fetch cuentas bancarias (principal + secundaria) for these cotizaciones
  const allCuentaIds = [
    ...rows.map((r) => r.cuentaPrincipalId).filter(Boolean),
    ...rows.map((r) => r.cuentaSecundariaId).filter(Boolean),
  ] as number[];
  const cuentaRows = allCuentaIds.length
    ? await db
        .select()
        .from(cuentaBancaria)
        .where(or(...allCuentaIds.map((cid) => eq(cuentaBancaria.id, cid))))
    : [];
  const cuentaById = new Map(cuentaRows.map((c) => [c.id, c]));

  // Fetch encargados for these obras
  const encargadoRows = await db
    .select()
    .from(encargadoObra)
    .where(or(...rows.map((r) => eq(encargadoObra.obraId, r.obraId))));

  // Fetch detalles with catalog names
  const detalleRows = await db
    .select({
      id: cotizacionDetalle.id,
      cotizacionId: cotizacionDetalle.cotizacionId,
      tipoEnsayoId: cotizacionDetalle.tipoEnsayoId,
      nombreTipoEnsayo: tipoEnsayo.nombreTipoEnsayo,
      nombreArea: areaEnsayo.nombreArea,
      nombreSubarea: subareaEnsayo.nombreSubarea,
      cantidadEnsayos: cotizacionDetalle.cantidadEnsayos,
      cantidadVisitas: cotizacionDetalle.cantidadVisitas,
      precioUnitario: cotizacionDetalle.precioUnitario,
    })
    .from(cotizacionDetalle)
    .innerJoin(tipoEnsayo, eq(cotizacionDetalle.tipoEnsayoId, tipoEnsayo.id))
    .innerJoin(subareaEnsayo, eq(tipoEnsayo.subareaId, subareaEnsayo.id))
    .innerJoin(areaEnsayo, eq(subareaEnsayo.areaId, areaEnsayo.id))
    .where(or(...cotizacionIds.map((id) => eq(cotizacionDetalle.cotizacionId, id))));

  // Fetch servicios generales
  const servicioRows = await db
    .select({
      id: cotizacionServicioGeneral.id,
      cotizacionId: cotizacionServicioGeneral.cotizacionId,
      descripcion: cotizacionServicioGeneral.descripcion,
      cantidad: cotizacionServicioGeneral.cantidad,
      precioUnitario: cotizacionServicioGeneral.precioUnitario,
    })
    .from(cotizacionServicioGeneral)
    .where(or(...cotizacionIds.map((id) => eq(cotizacionServicioGeneral.cotizacionId, id))));

  // Fetch comprobante counts per cotización (only relevant for ESPERA_VERIFICACION but cheap to always include)
  const comprobanteCountRows = await db
    .select({
      cotizacionId: cotizacionComprobante.cotizacionId,
      count: count(),
    })
    .from(cotizacionComprobante)
    .where(or(...cotizacionIds.map((id) => eq(cotizacionComprobante.cotizacionId, id))))
    .groupBy(cotizacionComprobante.cotizacionId);

  const comprobantesCountById = new Map<number, number>();
  for (const row of comprobanteCountRows) {
    comprobantesCountById.set(row.cotizacionId, Number(row.count));
  }

  // Group by cotizacion
  const encargadoByObraId = new Map<number, (typeof encargadoRows)[0]>();
  for (const enc of encargadoRows) {
    if (!encargadoByObraId.has(enc.obraId)) encargadoByObraId.set(enc.obraId, enc);
  }

  const detallesByCotizacionId = new Map<number, typeof detalleRows>();
  for (const det of detalleRows) {
    const arr = detallesByCotizacionId.get(det.cotizacionId) ?? [];
    arr.push(det);
    detallesByCotizacionId.set(det.cotizacionId, arr);
  }

  const serviciosByCotizacionId = new Map<number, typeof servicioRows>();
  for (const srv of servicioRows) {
    const arr = serviciosByCotizacionId.get(srv.cotizacionId) ?? [];
    arr.push(srv);
    serviciosByCotizacionId.set(srv.cotizacionId, arr);
  }

  const data: QuotationListItem[] = rows.map((r) => {
    const enc = encargadoByObraId.get(r.obraId);
    const cp = r.cuentaPrincipalId ? (cuentaById.get(r.cuentaPrincipalId) ?? null) : null;
    const cs = r.cuentaSecundariaId ? (cuentaById.get(r.cuentaSecundariaId) ?? null) : null;
    return {
      id: r.id,
      codigoCotizacion: r.codigoCotizacion,
      estado: r.estado,
      origen: r.origen,
      fechaSolicitud: r.fechaSolicitud.toISOString(),
      createdAt: r.createdAt.toISOString(),
      observaciones: r.observaciones,
      diasVigenciaToken: r.diasVigenciaToken,
      condicionPago: r.condicionPago,
      tipoAjuste: r.tipoAjuste,
      porcentajeAjuste: r.porcentajeAjuste,
      cuentaPrincipal: cp
        ? {
            id: cp.id,
            banco: cp.banco,
            tipoCuenta: cp.tipoCuenta,
            numeroCuenta: cp.numeroCuenta,
            titular: cp.titular,
            rut: cp.rut,
          }
        : null,
      cuentaSecundaria: cs
        ? {
            id: cs.id,
            banco: cs.banco,
            tipoCuenta: cs.tipoCuenta,
            numeroCuenta: cs.numeroCuenta,
            titular: cs.titular,
            rut: cs.rut,
          }
        : null,
      cliente: {
        id: r.clienteId,
        rutEmpresa: r.rutEmpresa,
        giroEmpresa: r.giroEmpresa,
        nombreContacto: r.nombreContacto,
        celularContacto: r.celularContacto,
        email: r.email,
        direccionEmpresa: r.direccionEmpresa,
        region: r.clienteRegion,
        comuna: r.clienteComuna,
        ciudad: r.clienteCiudad,
      },
      obra: {
        id: r.obraId,
        nombreObra: r.nombreObra,
        nombreMandante: r.nombreMandante,
        nombreContratista: r.nombreContratista,
        ubicacionObra: r.ubicacionObra,
        region: r.obraRegion,
        comuna: r.obraComuna,
        ciudad: r.obraCiudad,
        duracionMeses: r.duracionMeses,
      },
      encargado: enc
        ? {
            id: enc.id,
            nombreEncargado: enc.nombreEncargado,
            correoEncargado: enc.correoEncargado,
            telefonoEncargado: enc.telefonoEncargado,
          }
        : null,
      detalles: (detallesByCotizacionId.get(r.id) ?? []).map((d) => ({
        id: d.id,
        tipoEnsayoId: d.tipoEnsayoId,
        nombreTipoEnsayo: d.nombreTipoEnsayo,
        nombreArea: d.nombreArea,
        nombreSubarea: d.nombreSubarea,
        cantidadEnsayos: d.cantidadEnsayos,
        cantidadVisitas: d.cantidadVisitas,
        precioUnitario: d.precioUnitario,
      })),
      serviciosGenerales: (serviciosByCotizacionId.get(r.id) ?? []).map((s) => ({
        id: s.id,
        descripcion: s.descripcion,
        cantidad: s.cantidad,
        precioUnitario: s.precioUnitario,
      })),
      comprobantesCount: comprobantesCountById.get(r.id) ?? 0,
    };
  });

  return {
    data,
    pagination: {
      page,
      limit,
      total: Number(total),
      totalPages: Math.ceil(Number(total) / limit),
    },
  };
}

// ─── Get by ID ───────────────────────────────────────────────────────────────

export async function getCotizacionById(
  id: number,
): Promise<QuotationListItem & { firmaBase64: string | null }> {
  const [row] = await db
    .select({
      id: cotizacion.id,
      codigoCotizacion: cotizacion.codigoCotizacion,
      estado: cotizacion.estado,
      origen: cotizacion.origen,
      fechaSolicitud: cotizacion.fechaSolicitud,
      createdAt: cotizacion.createdAt,
      observaciones: cotizacion.observaciones,
      diasVigenciaToken: cotizacion.diasVigenciaToken,
      condicionPago: cotizacion.condicionPago,
      tipoAjuste: cotizacion.tipoAjuste,
      porcentajeAjuste: cotizacion.porcentajeAjuste,
      cuentaPrincipalId: cotizacion.cuentaPrincipalId,
      cuentaSecundariaId: cotizacion.cuentaSecundariaId,
      firmaBase64: cotizacion.firmaBase64,
      clienteId: cliente.id,
      rutEmpresa: cliente.rutEmpresa,
      giroEmpresa: cliente.giroEmpresa,
      nombreContacto: cliente.nombreContacto,
      celularContacto: cliente.celularContacto,
      email: cliente.email,
      direccionEmpresa: cliente.direccionEmpresa,
      clienteRegion: cliente.region,
      clienteComuna: cliente.comuna,
      clienteCiudad: cliente.ciudad,
      obraId: obra.id,
      nombreObra: obra.nombreObra,
      nombreMandante: obra.nombreMandante,
      nombreContratista: obra.nombreContratista,
      ubicacionObra: obra.ubicacionObra,
      obraRegion: obra.region,
      obraComuna: obra.comuna,
      obraCiudad: obra.ciudad,
      duracionMeses: obra.duracionMeses,
    })
    .from(cotizacion)
    .innerJoin(obra, eq(cotizacion.obraId, obra.id))
    .innerJoin(cliente, eq(obra.clienteId, cliente.id))
    .where(and(eq(cotizacion.id, id), isNull(cotizacion.deletedAt)))
    .limit(1);

  if (!row) throw new AppError(`Cotización ${id} no encontrada.`, 404);

  const [encRow] = await db
    .select()
    .from(encargadoObra)
    .where(eq(encargadoObra.obraId, row.obraId))
    .limit(1);

  const detalleRows = await db
    .select({
      id: cotizacionDetalle.id,
      cotizacionId: cotizacionDetalle.cotizacionId,
      tipoEnsayoId: cotizacionDetalle.tipoEnsayoId,
      nombreTipoEnsayo: tipoEnsayo.nombreTipoEnsayo,
      nombreArea: areaEnsayo.nombreArea,
      nombreSubarea: subareaEnsayo.nombreSubarea,
      cantidadEnsayos: cotizacionDetalle.cantidadEnsayos,
      cantidadVisitas: cotizacionDetalle.cantidadVisitas,
      precioUnitario: cotizacionDetalle.precioUnitario,
    })
    .from(cotizacionDetalle)
    .innerJoin(tipoEnsayo, eq(cotizacionDetalle.tipoEnsayoId, tipoEnsayo.id))
    .innerJoin(subareaEnsayo, eq(tipoEnsayo.subareaId, subareaEnsayo.id))
    .innerJoin(areaEnsayo, eq(subareaEnsayo.areaId, areaEnsayo.id))
    .where(eq(cotizacionDetalle.cotizacionId, id));

  const servicioGeneralRows = await db
    .select({
      id: cotizacionServicioGeneral.id,
      cotizacionId: cotizacionServicioGeneral.cotizacionId,
      descripcion: cotizacionServicioGeneral.descripcion,
      cantidad: cotizacionServicioGeneral.cantidad,
      precioUnitario: cotizacionServicioGeneral.precioUnitario,
    })
    .from(cotizacionServicioGeneral)
    .where(eq(cotizacionServicioGeneral.cotizacionId, id));

  // Fetch cuentas bancarias for this cotizacion
  const cuentaIdList = [row.cuentaPrincipalId, row.cuentaSecundariaId].filter(Boolean) as number[];
  const cuentaRowsSingle = cuentaIdList.length
    ? await db
        .select()
        .from(cuentaBancaria)
        .where(or(...cuentaIdList.map((cid) => eq(cuentaBancaria.id, cid))))
    : [];
  const cuentaByIdSingle = new Map(cuentaRowsSingle.map((c) => [c.id, c]));
  const cpSingle = row.cuentaPrincipalId
    ? (cuentaByIdSingle.get(row.cuentaPrincipalId) ?? null)
    : null;
  const csSingle = row.cuentaSecundariaId
    ? (cuentaByIdSingle.get(row.cuentaSecundariaId) ?? null)
    : null;

  return {
    id: row.id,
    codigoCotizacion: row.codigoCotizacion,
    estado: row.estado,
    origen: row.origen,
    fechaSolicitud: row.fechaSolicitud.toISOString(),
    createdAt: row.createdAt.toISOString(),
    observaciones: row.observaciones,
    diasVigenciaToken: row.diasVigenciaToken,
    condicionPago: row.condicionPago,
    tipoAjuste: row.tipoAjuste,
    porcentajeAjuste: row.porcentajeAjuste,
    cuentaPrincipal: cpSingle
      ? {
          id: cpSingle.id,
          banco: cpSingle.banco,
          tipoCuenta: cpSingle.tipoCuenta,
          numeroCuenta: cpSingle.numeroCuenta,
          titular: cpSingle.titular,
          rut: cpSingle.rut,
        }
      : null,
    cuentaSecundaria: csSingle
      ? {
          id: csSingle.id,
          banco: csSingle.banco,
          tipoCuenta: csSingle.tipoCuenta,
          numeroCuenta: csSingle.numeroCuenta,
          titular: csSingle.titular,
          rut: csSingle.rut,
        }
      : null,
    firmaBase64: row.firmaBase64,
    cliente: {
      id: row.clienteId,
      rutEmpresa: row.rutEmpresa,
      giroEmpresa: row.giroEmpresa,
      nombreContacto: row.nombreContacto,
      celularContacto: row.celularContacto,
      email: row.email,
      direccionEmpresa: row.direccionEmpresa,
      region: row.clienteRegion,
      comuna: row.clienteComuna,
      ciudad: row.clienteCiudad,
    },
    obra: {
      id: row.obraId,
      nombreObra: row.nombreObra,
      nombreMandante: row.nombreMandante,
      nombreContratista: row.nombreContratista,
      ubicacionObra: row.ubicacionObra,
      region: row.obraRegion,
      comuna: row.obraComuna,
      ciudad: row.obraCiudad,
      duracionMeses: row.duracionMeses,
    },
    encargado: encRow
      ? {
          id: encRow.id,
          nombreEncargado: encRow.nombreEncargado,
          correoEncargado: encRow.correoEncargado,
          telefonoEncargado: encRow.telefonoEncargado,
        }
      : null,
    detalles: detalleRows.map((d) => ({
      id: d.id,
      tipoEnsayoId: d.tipoEnsayoId,
      nombreTipoEnsayo: d.nombreTipoEnsayo,
      nombreArea: d.nombreArea,
      nombreSubarea: d.nombreSubarea,
      cantidadEnsayos: d.cantidadEnsayos,
      cantidadVisitas: d.cantidadVisitas,
      precioUnitario: d.precioUnitario,
    })),
    serviciosGenerales: servicioGeneralRows.map((s) => ({
      id: s.id,
      descripcion: s.descripcion,
      cantidad: s.cantidad,
      precioUnitario: s.precioUnitario,
    })),
  };
}

// Update estado

export type EstadoCotizacion = (typeof cotizacion.$inferSelect)['estado'];

export async function updateEstadoCotizacion(
  id: number,
  nuevoEstado: EstadoCotizacion,
  firmaBase64?: string,
): Promise<{ id: number; estado: EstadoCotizacion }> {
  logger.info({ id, nuevoEstado }, 'quotation.service: updateEstado');

  const [existing] = await db
    .select({ id: cotizacion.id, estado: cotizacion.estado, deletedAt: cotizacion.deletedAt })
    .from(cotizacion)
    .where(eq(cotizacion.id, id))
    .limit(1);

  if (!existing || existing.deletedAt) throw new AppError(`Cotización ${id} no encontrada.`, 404);

  // State-machine guardrails
  // Flujo: NUEVA → ENVIADA_FIRMA → FIRMADA → ENVIADA_CLIENTE
  //                                               ↓
  //                                       ESPERA_VERIFICACION → PAGO_VERIFICADO
  //                                                           ↘ PAGO_RECHAZADO
  //                                               ↘ RECHAZADA_CLIENTE
  const allowed: Record<string, EstadoCotizacion[]> = {
    NUEVA: ['ENVIADA_FIRMA', 'RECHAZADA', 'ANULADA'],
    ENVIADA_FIRMA: ['FIRMADA', 'RECHAZADA', 'ANULADA'],
    FIRMADA: ['ENVIADA_CLIENTE', 'RECHAZADA', 'ANULADA'],
    ENVIADA_CLIENTE: ['ESPERA_VERIFICACION', 'RECHAZADA_CLIENTE', 'VENCIDA', 'ANULADA'],
    ESPERA_VERIFICACION: ['PAGO_VERIFICADO', 'PAGO_RECHAZADO', 'ANULADA'],
    PAGO_VERIFICADO: ['ANULADA'],
    PAGO_RECHAZADO: ['ESPERA_VERIFICACION', 'ANULADA'],
    RECHAZADA_CLIENTE: ['NUEVA', 'ANULADA'],
    RECHAZADA: ['NUEVA'],
    VENCIDA: ['ANULADA'],
    ANULADA: [],
  };

  if (!allowed[existing.estado]?.includes(nuevoEstado)) {
    throw new AppError(`Transición inválida: ${existing.estado} → ${nuevoEstado}.`, 422);
  }

  const [updated] = await db
    .update(cotizacion)
    .set({
      estado: nuevoEstado,
      updatedAt: new Date(),
      ...(firmaBase64 !== undefined ? { firmaBase64 } : {}),
    })
    .where(eq(cotizacion.id, id))
    .returning({ id: cotizacion.id, estado: cotizacion.estado });

  logger.info({ id, nuevoEstado }, 'quotation.service: estado updated OK');
  return updated;
}

// Update cotización data

export interface UpdateQuotationInput {
  // Cliente fields (partial)
  giroEmpresa?: string;
  nombreContacto?: string;
  celularContacto?: string;
  emailContacto?: string;
  direccionEmpresa?: string;
  regionEmpresa?: string;
  comunaEmpresa?: string;
  ciudadEmpresa?: string;
  // Encargado fields (partial)
  nombreEncargado?: string;
  correoEncargado?: string;
  telefonoEncargado?: string;
  // Observaciones
  observaciones?: string;
  // Vigencia del token de respuesta del cliente (días)
  diasVigenciaToken?: number;
  // ── Notas Comerciales ─────────────────────────────────
  condicionPago?: 'PAGO_100' | 'PAGO_50' | 'CREDITO_30_DIAS';
  cuentaPrincipalId?: number | null;
  cuentaSecundariaId?: number | null;
  tipoAjuste?: 'SIN_AJUSTE' | 'DESCUENTO' | 'INCREMENTO';
  porcentajeAjuste?: number | null;
  // ─────────────────────────────────────────────
  // Detalles — replace all line items when provided
  detalles?: Array<{
    tipoEnsayoId: number;
    cantidadEnsayos: number;
    cantidadVisitas: number;
    precioUnitario: string;
  }>;
  // Servicios generales — replace all when provided
  serviciosGenerales?: Array<{
    descripcion: string;
    cantidad: number;
    precioUnitario: string;
  }>;
}

export async function updateQuotation(
  id: number,
  input: UpdateQuotationInput,
): Promise<{ id: number }> {
  logger.info({ id }, 'quotation.service: updateQuotation');

  await db.transaction(async (tx) => {
    const [cot] = await tx
      .select()
      .from(cotizacion)
      .where(and(eq(cotizacion.id, id), isNull(cotizacion.deletedAt)))
      .limit(1);

    if (!cot) throw new AppError(`Cotizacion ${id} no encontrada.`, 404);
    if (!['NUEVA', 'RECHAZADA', 'ENVIADA_FIRMA'].includes(cot.estado)) {
      throw new AppError(
        'Solo se pueden editar cotizaciones en estado NUEVA, RECHAZADA o ENVIADA_FIRMA.',
        422,
      );
    }

    // Update cotización own fields (observaciones, diasVigenciaToken, Notas Comerciales)
    const hasCotPatch =
      input.observaciones !== undefined ||
      input.diasVigenciaToken !== undefined ||
      input.condicionPago !== undefined ||
      input.cuentaPrincipalId !== undefined ||
      input.cuentaSecundariaId !== undefined ||
      input.tipoAjuste !== undefined ||
      input.porcentajeAjuste !== undefined;
    if (hasCotPatch) {
      await tx
        .update(cotizacion)
        .set({
          ...(input.observaciones !== undefined && { observaciones: input.observaciones }),
          ...(input.diasVigenciaToken !== undefined && {
            diasVigenciaToken: input.diasVigenciaToken,
          }),
          ...(input.condicionPago !== undefined && { condicionPago: input.condicionPago }),
          ...(input.cuentaPrincipalId !== undefined && {
            cuentaPrincipalId: input.cuentaPrincipalId,
          }),
          ...(input.cuentaSecundariaId !== undefined && {
            cuentaSecundariaId: input.cuentaSecundariaId,
          }),
          ...(input.tipoAjuste !== undefined && { tipoAjuste: input.tipoAjuste }),
          ...(input.porcentajeAjuste !== undefined && {
            porcentajeAjuste:
              input.porcentajeAjuste !== null ? String(input.porcentajeAjuste) : null,
          }),
          updatedAt: new Date(),
        })
        .where(eq(cotizacion.id, id));
    }

    // Update cliente
    const clientePatch: Partial<typeof cliente.$inferInsert> = {};
    if (input.giroEmpresa !== undefined) clientePatch.giroEmpresa = input.giroEmpresa;
    if (input.nombreContacto !== undefined) clientePatch.nombreContacto = input.nombreContacto;
    if (input.celularContacto !== undefined) clientePatch.celularContacto = input.celularContacto;
    if (input.emailContacto !== undefined) clientePatch.email = input.emailContacto;
    if (input.direccionEmpresa !== undefined)
      clientePatch.direccionEmpresa = input.direccionEmpresa;
    if (input.regionEmpresa !== undefined) clientePatch.region = input.regionEmpresa;
    if (input.comunaEmpresa !== undefined) clientePatch.comuna = input.comunaEmpresa;
    if (input.ciudadEmpresa !== undefined) clientePatch.ciudad = input.ciudadEmpresa;

    if (Object.keys(clientePatch).length > 0) {
      // Get clienteId via obra
      const [obraRow] = await tx
        .select({ clienteId: obra.clienteId })
        .from(obra)
        .where(eq(obra.id, cot.obraId))
        .limit(1);
      if (obraRow) {
        clientePatch.updatedAt = new Date();
        await tx.update(cliente).set(clientePatch).where(eq(cliente.id, obraRow.clienteId));
      }
    }

    // Update encargado
    const encPatch: Partial<typeof encargadoObra.$inferInsert> = {};
    if (input.nombreEncargado !== undefined) encPatch.nombreEncargado = input.nombreEncargado;
    if (input.correoEncargado !== undefined) encPatch.correoEncargado = input.correoEncargado;
    if (input.telefonoEncargado !== undefined) encPatch.telefonoEncargado = input.telefonoEncargado;

    if (Object.keys(encPatch).length > 0) {
      encPatch.updatedAt = new Date();
      await tx.update(encargadoObra).set(encPatch).where(eq(encargadoObra.obraId, cot.obraId));
    }

    // Replace detalles when provided
    if (input.detalles !== undefined) {
      await tx.delete(cotizacionDetalle).where(eq(cotizacionDetalle.cotizacionId, id));
      if (input.detalles.length > 0) {
        await tx.insert(cotizacionDetalle).values(
          input.detalles.map((d) => ({
            cotizacionId: id,
            tipoEnsayoId: d.tipoEnsayoId,
            cantidadEnsayos: d.cantidadEnsayos,
            cantidadVisitas: d.cantidadVisitas,
            precioUnitario: d.precioUnitario,
          })),
        );
      }
    }

    // Replace servicios generales when provided
    if (input.serviciosGenerales !== undefined) {
      await tx
        .delete(cotizacionServicioGeneral)
        .where(eq(cotizacionServicioGeneral.cotizacionId, id));
      if (input.serviciosGenerales.length > 0) {
        await tx.insert(cotizacionServicioGeneral).values(
          input.serviciosGenerales.map((s) => ({
            cotizacionId: id,
            descripcion: s.descripcion,
            cantidad: s.cantidad,
            precioUnitario: s.precioUnitario,
          })),
        );
      }
    }
  });

  logger.info({ id }, 'quotation.service: updateQuotation OK');
  return { id };
}

// submitWebQuotation (unchanged)

export async function submitWebQuotation(
  input: SubmitWebQuotationInput,
): Promise<SubmitWebQuotationResult> {
  logger.info(
    { rutEmpresa: input.rutEmpresa, nombreObra: input.nombreObra },
    'quotation.service: submitWebQuotation start',
  );

  const result = await db.transaction(async (tx) => {
    const [existingCliente] = await tx
      .select()
      .from(cliente)
      .where(eq(cliente.rutEmpresa, input.rutEmpresa))
      .limit(1);

    let clienteId: number;

    if (existingCliente) {
      await tx
        .update(cliente)
        .set({
          giroEmpresa: input.giroEmpresa,
          nombreContacto: input.nombreContacto,
          celularContacto: input.celularContacto,
          email: input.emailContacto,
          direccionEmpresa: input.direccionEmpresa,
          region: input.regionEmpresa,
          comuna: input.comunaEmpresa,
          ciudad: input.ciudadEmpresa,
          updatedAt: new Date(),
        })
        .where(eq(cliente.id, existingCliente.id));
      clienteId = existingCliente.id;
    } else {
      const [newCliente] = await tx
        .insert(cliente)
        .values({
          rutEmpresa: input.rutEmpresa,
          giroEmpresa: input.giroEmpresa,
          nombreContacto: input.nombreContacto,
          celularContacto: input.celularContacto,
          email: input.emailContacto,
          direccionEmpresa: input.direccionEmpresa,
          region: input.regionEmpresa,
          comuna: input.comunaEmpresa,
          ciudad: input.ciudadEmpresa,
        })
        .returning({ id: cliente.id });
      clienteId = newCliente.id;
    }

    const [newObra] = await tx
      .insert(obra)
      .values({
        clienteId: clienteId,
        nombreObra: input.nombreObra,
        nombreMandante: input.nombreMandante,
        nombreContratista: input.nombreContratista,
        ubicacionObra: input.ubicacionObra,
        region: input.regionObra,
        comuna: input.comunaObra,
        ciudad: input.ciudadObra,
        duracionMeses: input.duracionObra,
      })
      .returning({ id: obra.id });

    const obraId = newObra.id;

    await tx.insert(encargadoObra).values({
      obraId: obraId,
      nombreEncargado: input.nombreEncargado,
      correoEncargado: input.correoEncargado,
      telefonoEncargado: input.telefonoEncargado,
    });

    // para agregar los ensayos como observaciones en la cotizacion
    // const observacionesSnapshot = JSON.stringify(input.ensayos);

    const [newCotizacion] = await tx
      .insert(cotizacion)
      .values({
        obraId: obraId,
        origen: 'WEB',
        estado: 'NUEVA',
        observaciones: null,
      })
      .returning({ id: cotizacion.id });

    const cotizacionId = newCotizacion.id;

    // Generar código único usando la secuencia de PostgreSQL (10000-LIA, 10001-LIA, ...)
    const seqResult = await tx.execute<{ nextCode: string }>(
      sql`SELECT nextval('cotizacion_codigo_seq')::text || '-LIA' AS "nextCode"`,
    );
    const nextCode = seqResult.rows[0].nextCode;
    await tx
      .update(cotizacion)
      .set({ codigoCotizacion: nextCode, updatedAt: new Date() })
      .where(eq(cotizacion.id, cotizacionId));

    if (input.ensayos.length > 0) {
      const detallesToInsert: (typeof cotizacionDetalle.$inferInsert)[] = [];

      for (const line of input.ensayos) {
        const areaNorm = line.area.trim().normalize('NFC');
        const subareaNorm = line.subarea.trim().normalize('NFC');
        const ensayoNorm = line.ensayo.trim().normalize('NFC');

        const [matchedArea] = await tx
          .select({ id: areaEnsayo.id })
          .from(areaEnsayo)
          .where(ilike(areaEnsayo.nombreArea, areaNorm))
          .limit(1);
        if (!matchedArea) {
          logger.warn({ areaNorm }, 'quotation.service: area not found — ensayo skipped');
          continue;
        }

        const [matchedSubarea] = await tx
          .select({ id: subareaEnsayo.id })
          .from(subareaEnsayo)
          .where(
            and(
              eq(subareaEnsayo.areaId, matchedArea.id),
              ilike(subareaEnsayo.nombreSubarea, subareaNorm),
            ),
          )
          .limit(1);
        if (!matchedSubarea) {
          logger.warn(
            { areaNorm, subareaNorm },
            'quotation.service: subarea not found — ensayo skipped',
          );
          continue;
        }

        // Fetch all tipos for the subarea and match in memory to completely avoid
        // PostgreSQL collation limitations, trailing spaces, and NFC/NFD mismatches.
        const allTipos = await tx
          .select({ id: tipoEnsayo.id, nombreTipoEnsayo: tipoEnsayo.nombreTipoEnsayo })
          .from(tipoEnsayo)
          .where(eq(tipoEnsayo.subareaId, matchedSubarea.id));

        const normalizeStr = (str: string) => str.trim().normalize('NFC').toLowerCase();
        const targetEnsayo = normalizeStr(line.ensayo);

        const matchedTipo = allTipos.find((t) => normalizeStr(t.nombreTipoEnsayo) === targetEnsayo);

        if (!matchedTipo) {
          logger.warn(
            {
              areaNorm,
              subareaNorm,
              ensayoNorm,
              availableTipos: allTipos.map((t) => t.nombreTipoEnsayo),
            },
            'quotation.service: tipo_ensayo not found — ensayo skipped',
          );
          continue;
        }

        const [activePrecio] = await tx
          .select({ precio: precioEnsayo.precio })
          .from(precioEnsayo)
          .where(
            and(
              eq(precioEnsayo.tipoEnsayoId, matchedTipo.id),
              eq(precioEnsayo.activo, true),
              isNull(precioEnsayo.fechaFin),
            ),
          )
          .limit(1);

        detallesToInsert.push({
          cotizacionId: cotizacionId,
          tipoEnsayoId: matchedTipo.id,
          cantidadEnsayos: line.cantidad,
          cantidadVisitas: line.visitas,
          precioUnitario: activePrecio?.precio ?? '0',
        });
      }

      logger.info(
        { cotizacionId, requested: input.ensayos.length, matched: detallesToInsert.length },
        'quotation.service: ensayo matching summary',
      );

      if (detallesToInsert.length > 0) {
        await tx.insert(cotizacionDetalle).values(detallesToInsert);
      }
    }

    return { cotizacionId, clienteId, obraId };
  });

  logger.info({ cotizacionId: result.cotizacionId }, 'quotation.service: submitWebQuotation OK');
  return result;
}

// ─── Confirmar pago (cliente subió comprobantes) ─────────────────────────────

export interface ComprobanteInput {
  s3Key: string;
  nombreArchivo: string;
  contentType: string;
  sizeBytes: number;
}

/**
 * Guarda los comprobantes subidos por el cliente en la BD y cambia el estado
 * de la cotización a ESPERA_VERIFICACION.
 */
export async function confirmarPago(
  cotizacionId: number,
  comprobantes: ComprobanteInput[],
): Promise<{ id: number; estado: EstadoCotizacion }> {
  logger.info(
    { cotizacionId, count: comprobantes.length },
    'quotation.service: confirmarPago start',
  );

  const [existing] = await db
    .select({ id: cotizacion.id, estado: cotizacion.estado, deletedAt: cotizacion.deletedAt })
    .from(cotizacion)
    .where(eq(cotizacion.id, cotizacionId))
    .limit(1);

  if (!existing || existing.deletedAt) {
    throw new AppError(`Cotización ${cotizacionId} no encontrada.`, 404);
  }

  if (existing.estado !== 'ENVIADA_CLIENTE') {
    throw new AppError(
      `No se pueden adjuntar comprobantes en estado ${existing.estado}. La cotización debe estar en estado ENVIADA_CLIENTE.`,
      422,
    );
  }

  if (comprobantes.length === 0) {
    throw new AppError('Se requiere al menos un comprobante de pago.', 400);
  }

  const [updated] = await db.transaction(async (tx) => {
    // Insertar comprobantes
    await tx.insert(cotizacionComprobante).values(
      comprobantes.map((c) => ({
        cotizacionId,
        s3Key: c.s3Key,
        nombreArchivo: c.nombreArchivo,
        contentType: c.contentType,
        sizeBytes: c.sizeBytes,
      })),
    );

    // Cambiar estado a ESPERA_VERIFICACION
    const [upd] = await tx
      .update(cotizacion)
      .set({ estado: 'ESPERA_VERIFICACION', updatedAt: new Date() })
      .where(eq(cotizacion.id, cotizacionId))
      .returning({ id: cotizacion.id, estado: cotizacion.estado });

    return [upd];
  });

  logger.info({ cotizacionId }, 'quotation.service: confirmarPago OK - estado ESPERA_VERIFICACION');
  return updated;
}

// ─── Obtener comprobantes de una cotización ──────────────────────────────────

export interface ComprobanteRecord {
  id: number;
  cotizacionId: number;
  s3Key: string;
  nombreArchivo: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export async function getComprobantesByCotizacion(
  cotizacionId: number,
): Promise<ComprobanteRecord[]> {
  logger.debug({ cotizacionId }, 'quotation.service: getComprobantesByCotizacion');

  const rows = await db
    .select()
    .from(cotizacionComprobante)
    .where(eq(cotizacionComprobante.cotizacionId, cotizacionId));

  return rows.map((r) => ({
    id: r.id,
    cotizacionId: r.cotizacionId,
    s3Key: r.s3Key,
    nombreArchivo: r.nombreArchivo,
    contentType: r.contentType,
    sizeBytes: r.sizeBytes,
    createdAt: r.createdAt.toISOString(),
  }));
}
