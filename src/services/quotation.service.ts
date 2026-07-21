import { db } from '../db/index.js';
import {
  cliente,
  obra,
  encargadoObra,
  cotizacion,
  cotizacionDetalle,
  cotizacionServicioGeneral,
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
  apellidosContacto: string;
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
  cliente: {
    id: number;
    rutEmpresa: string | null;
    giroEmpresa: string;
    nombreContacto: string;
    apellidosContacto: string;
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
      // cliente fields
      clienteId: cliente.id,
      rutEmpresa: cliente.rutEmpresa,
      giroEmpresa: cliente.giroEmpresa,
      nombreContacto: cliente.nombreContacto,
      apellidosContacto: cliente.apellidosContacto,
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
              ilike(cliente.apellidosContacto, `%${q}%`),
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
              ilike(cliente.apellidosContacto, `%${q}%`),
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
    return {
      id: r.id,
      codigoCotizacion: r.codigoCotizacion,
      estado: r.estado,
      origen: r.origen,
      fechaSolicitud: r.fechaSolicitud.toISOString(),
      createdAt: r.createdAt.toISOString(),
      observaciones: r.observaciones,
      cliente: {
        id: r.clienteId,
        rutEmpresa: r.rutEmpresa,
        giroEmpresa: r.giroEmpresa,
        nombreContacto: r.nombreContacto,
        apellidosContacto: r.apellidosContacto,
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

export async function getCotizacionById(id: number): Promise<QuotationListItem> {
  const [row] = await db
    .select({
      id: cotizacion.id,
      codigoCotizacion: cotizacion.codigoCotizacion,
      estado: cotizacion.estado,
      origen: cotizacion.origen,
      fechaSolicitud: cotizacion.fechaSolicitud,
      createdAt: cotizacion.createdAt,
      observaciones: cotizacion.observaciones,
      clienteId: cliente.id,
      rutEmpresa: cliente.rutEmpresa,
      giroEmpresa: cliente.giroEmpresa,
      nombreContacto: cliente.nombreContacto,
      apellidosContacto: cliente.apellidosContacto,
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

  return {
    id: row.id,
    codigoCotizacion: row.codigoCotizacion,
    estado: row.estado,
    origen: row.origen,
    fechaSolicitud: row.fechaSolicitud.toISOString(),
    createdAt: row.createdAt.toISOString(),
    observaciones: row.observaciones,
    cliente: {
      id: row.clienteId,
      rutEmpresa: row.rutEmpresa,
      giroEmpresa: row.giroEmpresa,
      nombreContacto: row.nombreContacto,
      apellidosContacto: row.apellidosContacto,
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
): Promise<{ id: number; estado: EstadoCotizacion }> {
  logger.info({ id, nuevoEstado }, 'quotation.service: updateEstado');

  const [existing] = await db
    .select({ id: cotizacion.id, estado: cotizacion.estado, deletedAt: cotizacion.deletedAt })
    .from(cotizacion)
    .where(eq(cotizacion.id, id))
    .limit(1);

  if (!existing || existing.deletedAt) throw new AppError(`Cotización ${id} no encontrada.`, 404);

  // Basic state-machine guardrails
  const allowed: Record<string, EstadoCotizacion[]> = {
    BORRADOR: ['ENVIADA', 'RECHAZADA', 'ANULADA'],
    ENVIADA: ['ACEPTADA', 'RECHAZADA', 'ANULADA'],
    ACEPTADA: ['ANULADA'],
    RECHAZADA: ['BORRADOR'],
    VENCIDA: ['ANULADA'],
    ANULADA: [],
  };

  if (!allowed[existing.estado]?.includes(nuevoEstado)) {
    throw new AppError(`Transición inválida: ${existing.estado} → ${nuevoEstado}.`, 422);
  }

  const [updated] = await db
    .update(cotizacion)
    .set({ estado: nuevoEstado, updatedAt: new Date() })
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
  apellidosContacto?: string;
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

    if (!cot) throw new AppError(`Cotización ${id} no encontrada.`, 404);
    if (!['BORRADOR', 'RECHAZADA', 'ENVIADA'].includes(cot.estado)) {
      throw new AppError(
        'Solo se pueden editar cotizaciones en estado BORRADOR, RECHAZADA o ENVIADA.',
        422,
      );
    }

    // Update observaciones on the cotización itself
    if (input.observaciones !== undefined) {
      await tx
        .update(cotizacion)
        .set({ observaciones: input.observaciones, updatedAt: new Date() })
        .where(eq(cotizacion.id, id));
    }

    // Update cliente
    const clientePatch: Partial<typeof cliente.$inferInsert> = {};
    if (input.giroEmpresa !== undefined) clientePatch.giroEmpresa = input.giroEmpresa;
    if (input.nombreContacto !== undefined) clientePatch.nombreContacto = input.nombreContacto;
    if (input.apellidosContacto !== undefined)
      clientePatch.apellidosContacto = input.apellidosContacto;
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
          apellidosContacto: input.apellidosContacto,
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
          apellidosContacto: input.apellidosContacto,
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
        estado: 'BORRADOR',
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
        if (!matchedArea) continue;

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
        if (!matchedSubarea) continue;

        const [matchedTipo] = await tx
          .select({ id: tipoEnsayo.id })
          .from(tipoEnsayo)
          .where(
            and(
              eq(tipoEnsayo.subareaId, matchedSubarea.id),
              ilike(tipoEnsayo.nombreTipoEnsayo, ensayoNorm),
            ),
          )
          .limit(1);
        if (!matchedTipo) continue;

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

      if (detallesToInsert.length > 0) {
        await tx.insert(cotizacionDetalle).values(detallesToInsert);
      }
    }

    return { cotizacionId, clienteId, obraId };
  });

  logger.info({ cotizacionId: result.cotizacionId }, 'quotation.service: submitWebQuotation OK');
  return result;
}
