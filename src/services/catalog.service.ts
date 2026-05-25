/**
 * catalog.service.ts
 * Business logic for the laboratory test catalogue.
 *
 * Design decisions:
 * - All four upserts (area → subarea → tipo → precio) run inside a single
 *   database transaction. If any step fails the entire operation rolls back,
 *   leaving the DB in a consistent state.
 * - Area and Subarea creation is idempotent: if a record with the same name
 *   already exists it is reused rather than duplicated. This allows callers
 *   to POST "Mecánica de Suelos / Compactación / Ensayo Proctor" without
 *   worrying about whether the parent records already exist.
 * - Tipo Ensayo is NOT idempotent by default: duplicate (subarea, nombre)
 *   is a DB-level unique constraint and will surface as a 409 Conflict.
 * - The active precio is created with fecha_inicio = today and fecha_fin = NULL.
 * - Service functions receive plain data objects — no HTTP types leak in.
 */

import { db } from '../db/index.js';
import {
  areaEnsayo,
  subareaEnsayo,
  tipoEnsayo,
  precioEnsayo,
} from '../db/schema/index.js';
import { eq, and, isNull, count, ilike, SQL } from 'drizzle-orm';
import { AppError } from '../utils/app-error.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Input / Output types  — Write
// ---------------------------------------------------------------------------

export interface CreateEnsayoInput {
  /** Top-level discipline area, e.g. "Mecánica de Suelos" */
  nombreArea: string;
  /** Sub-discipline within the area, e.g. "Compactación" */
  nombreSubarea: string;
  /** Specific test name, e.g. "Ensayo Proctor Modificado ASTM D1557" */
  nombreTipoEnsayo: string;
  /** Optional technical standard code, e.g. "ASTM D1557" */
  codigoNorma?: string;
  /** Unit price in CLP (max 12 digits, 2 decimal places) */
  precio: string;
  /** Price effective date — defaults to today if omitted (ISO 8601: YYYY-MM-DD) */
  fechaInicio?: string;
}

export interface CreateEnsayoResult {
  area: { id: number; nombreArea: string };
  subarea: { id: number; nombreSubarea: string };
  tipoEnsayo: { id: number; nombreTipoEnsayo: string; codigoNorma: string | null };
  precio: { id: number; precio: string; fechaInicio: string };
}

// ---------------------------------------------------------------------------
// Input / Output types  — Read
// ---------------------------------------------------------------------------

export interface ListEnsayosInput {
  /** Filter by area id */
  areaId?: number;
  /** Filter by subarea id */
  subareaId?: number;
  /** Filter by active status (defaults to true) */
  activo?: boolean;
  /** Case-insensitive search on nombreTipoEnsayo */
  q?: string;
  /** Page number (1-based, default 1) */
  page?: number;
  /** Items per page (default 20, max 100) */
  limit?: number;
}

export interface EnsayoListItem {
  id: number;
  nombreTipoEnsayo: string;
  codigoNorma: string | null;
  activo: boolean;
  area: { id: number; nombreArea: string };
  subarea: { id: number; nombreSubarea: string };
  precioActivo: string | null;
  fechaInicioPrecio: string | null;
}

export interface ListEnsayosResult {
  data: EnsayoListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface EnsayoDetail {
  id: number;
  nombreTipoEnsayo: string;
  codigoNorma: string | null;
  activo: boolean;
  area: { id: number; nombreArea: string };
  subarea: { id: number; nombreSubarea: string };
  precios: Array<{
    id: number;
    precio: string;
    fechaInicio: string;
    fechaFin: string | null;
    activo: boolean;
  }>;
}

export interface AreaTreeItem {
  id: number;
  nombreArea: string;
  activo: boolean;
  subareas: Array<{
    id: number;
    nombreSubarea: string;
    activo: boolean;
    tipos: Array<{
      id: number;
      nombreTipoEnsayo: string;
      codigoNorma: string | null;
      activo: boolean;
      precioActivo: string | null;
    }>;
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns today as YYYY-MM-DD in the server's local timezone. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Service — Write
// ---------------------------------------------------------------------------

/**
 * Creates a complete laboratory test entry atomically.
 *
 * - Area and Subarea: upsert by name (reuse existing records).
 * - TipoEnsayo: insert only — duplicates within the same subarea
 *   are rejected at the DB level (unique constraint) and surfaced as 409.
 * - PrecioEnsayo: insert a new active price record.
 */
export async function createEnsayo(input: CreateEnsayoInput): Promise<CreateEnsayoResult> {
  const {
    nombreArea,
    nombreSubarea,
    nombreTipoEnsayo,
    codigoNorma,
    precio,
    fechaInicio = todayIso(),
  } = input;

  logger.info({ nombreArea, nombreSubarea, nombreTipoEnsayo }, 'catalog.service: createEnsayo');

  const result = await db.transaction(async (tx) => {
    // ------------------------------------------------------------------
    // 1. Upsert Area
    // ------------------------------------------------------------------
    let [area] = await tx
      .select()
      .from(areaEnsayo)
      .where(eq(areaEnsayo.nombreArea, nombreArea))
      .limit(1);

    if (!area) {
      [area] = await tx
        .insert(areaEnsayo)
        .values({ nombreArea })
        .returning();
      logger.debug({ areaId: area.id }, 'catalog.service: new area created');
    } else {
      logger.debug({ areaId: area.id }, 'catalog.service: existing area reused');
    }

    // ------------------------------------------------------------------
    // 2. Upsert Subarea
    // ------------------------------------------------------------------
    let [subarea] = await tx
      .select()
      .from(subareaEnsayo)
      .where(
        and(
          eq(subareaEnsayo.areaId, area.id),
          eq(subareaEnsayo.nombreSubarea, nombreSubarea),
        ),
      )
      .limit(1);

    if (!subarea) {
      [subarea] = await tx
        .insert(subareaEnsayo)
        .values({ areaId: area.id, nombreSubarea })
        .returning();
      logger.debug({ subareaId: subarea.id }, 'catalog.service: new subarea created');
    } else {
      logger.debug({ subareaId: subarea.id }, 'catalog.service: existing subarea reused');
    }

    // ------------------------------------------------------------------
    // 3. Insert TipoEnsayo
    // Duplicate (subareaId, nombreTipoEnsayo) is caught by the DB unique
    // constraint. We wrap the insert so the error surfaces as a clean 409.
    // ------------------------------------------------------------------
    let tipo: typeof tipoEnsayo.$inferSelect;
    try {
      [tipo] = await tx
        .insert(tipoEnsayo)
        .values({ subareaId: subarea.id, nombreTipoEnsayo, codigoNorma })
        .returning();
    } catch (err: unknown) {
      // PostgreSQL unique-violation code: 23505
      if (
        err instanceof Error &&
        'code' in err &&
        (err as NodeJS.ErrnoException).code === '23505'
      ) {
        throw new AppError(
          `El tipo de ensayo "${nombreTipoEnsayo}" ya existe en la subárea "${nombreSubarea}". ` +
            'Si deseas actualizar su precio, usa el endpoint de precios.',
          409,
        );
      }
      throw err; // unexpected — bubble up to global error handler
    }

    // ------------------------------------------------------------------
    // 4. Insert active PrecioEnsayo
    // ------------------------------------------------------------------
    const [precio_] = await tx
      .insert(precioEnsayo)
      .values({
        tipoEnsayoId: tipo.id,
        precio,
        fechaInicio,
        fechaFin: null,
        activo: true,
      })
      .returning();

    return {
      area: { id: area.id, nombreArea: area.nombreArea },
      subarea: { id: subarea.id, nombreSubarea: subarea.nombreSubarea },
      tipoEnsayo: {
        id: tipo.id,
        nombreTipoEnsayo: tipo.nombreTipoEnsayo,
        codigoNorma: tipo.codigoNorma ?? null,
      },
      precio: {
        id: precio_.id,
        precio: precio_.precio,
        fechaInicio: precio_.fechaInicio,
      },
    } satisfies CreateEnsayoResult;
  });

  logger.info({ tipoEnsayoId: result.tipoEnsayo.id }, 'catalog.service: ensayo created OK');
  return result;
}

// ---------------------------------------------------------------------------
// Service — Read
// ---------------------------------------------------------------------------

/**
 * Returns the full catalog tree: areas → subareas → tipos with active price.
 * Optimised for rendering a catalogue picker in the frontend (e.g., quotation form).
 * Only active records at every level are included by default.
 */
export async function getCatalogTree(): Promise<AreaTreeItem[]> {
  logger.debug('catalog.service: getCatalogTree');

  // One query with nested `with` — Drizzle emits the minimal set of SELECTs.
  const areas = await db.query.areaEnsayo.findMany({
    where: eq(areaEnsayo.activo, true),
    orderBy: (a, { asc }) => [asc(a.nombreArea)],
    with: {
      subareas: {
        where: eq(subareaEnsayo.activo, true),
        orderBy: (s, { asc }) => [asc(s.nombreSubarea)],
        with: {
          tiposEnsayo: {
            where: eq(tipoEnsayo.activo, true),
            orderBy: (t, { asc }) => [asc(t.nombreTipoEnsayo)],
            with: {
              // Only bring the active open-ended price.
              precios: {
                where: and(
                  eq(precioEnsayo.activo, true),
                  isNull(precioEnsayo.fechaFin),
                ),
                limit: 1,
              },
            },
          },
        },
      },
    },
  });

  return areas.map((area) => ({
    id: area.id,
    nombreArea: area.nombreArea,
    activo: area.activo,
    subareas: area.subareas.map((sub) => ({
      id: sub.id,
      nombreSubarea: sub.nombreSubarea,
      activo: sub.activo,
      tipos: sub.tiposEnsayo.map((tipo) => ({
        id: tipo.id,
        nombreTipoEnsayo: tipo.nombreTipoEnsayo,
        codigoNorma: tipo.codigoNorma ?? null,
        activo: tipo.activo,
        precioActivo: tipo.precios[0]?.precio ?? null,
      })),
    })),
  }));
}

/**
 * Returns a paginated flat list of tipo_ensayo rows, each enriched with
 * its parent area/subarea names and the currently active unit price.
 * Supports optional filters and a keyword search on the test name.
 */
export async function listEnsayos(input: ListEnsayosInput): Promise<ListEnsayosResult> {
  const { areaId, subareaId, activo = true, q, page = 1, limit = 20 } = input;

  logger.debug({ areaId, subareaId, activo, q, page, limit }, 'catalog.service: listEnsayos');

  // Build WHERE conditions dynamically.
  const conditions: SQL[] = [eq(tipoEnsayo.activo, activo)];
  if (subareaId !== undefined) conditions.push(eq(tipoEnsayo.subareaId, subareaId));
  if (areaId !== undefined)    conditions.push(eq(subareaEnsayo.areaId, areaId));
  if (q)                       conditions.push(ilike(tipoEnsayo.nombreTipoEnsayo, `%${q}%`));

  const where = and(...conditions);
  const offset = (page - 1) * limit;

  // Execute data query and count query in parallel.
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id:               tipoEnsayo.id,
        nombreTipoEnsayo: tipoEnsayo.nombreTipoEnsayo,
        codigoNorma:      tipoEnsayo.codigoNorma,
        activo:           tipoEnsayo.activo,
        areaId:           areaEnsayo.id,
        nombreArea:       areaEnsayo.nombreArea,
        subareaId:        subareaEnsayo.id,
        nombreSubarea:    subareaEnsayo.nombreSubarea,
        precioActivo:     precioEnsayo.precio,
        fechaInicioPrecio: precioEnsayo.fechaInicio,
      })
      .from(tipoEnsayo)
      .innerJoin(subareaEnsayo, eq(tipoEnsayo.subareaId, subareaEnsayo.id))
      .innerJoin(areaEnsayo,    eq(subareaEnsayo.areaId, areaEnsayo.id))
      // LEFT JOIN so we still return the row even if no active price exists yet.
      .leftJoin(
        precioEnsayo,
        and(
          eq(precioEnsayo.tipoEnsayoId, tipoEnsayo.id),
          eq(precioEnsayo.activo, true),
          isNull(precioEnsayo.fechaFin),
        ),
      )
      .where(where)
      .orderBy(areaEnsayo.nombreArea, subareaEnsayo.nombreSubarea, tipoEnsayo.nombreTipoEnsayo)
      .limit(limit)
      .offset(offset),

    db
      .select({ total: count() })
      .from(tipoEnsayo)
      .innerJoin(subareaEnsayo, eq(tipoEnsayo.subareaId, subareaEnsayo.id))
      .innerJoin(areaEnsayo,    eq(subareaEnsayo.areaId, areaEnsayo.id))
      .where(where),
  ]);

  const data: EnsayoListItem[] = rows.map((r) => ({
    id: r.id,
    nombreTipoEnsayo: r.nombreTipoEnsayo,
    codigoNorma: r.codigoNorma ?? null,
    activo: r.activo,
    area:    { id: r.areaId,    nombreArea:    r.nombreArea },
    subarea: { id: r.subareaId, nombreSubarea: r.nombreSubarea },
    precioActivo:     r.precioActivo     ?? null,
    fechaInicioPrecio: r.fechaInicioPrecio ?? null,
  }));

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

/**
 * Returns the full detail of a single tipo_ensayo:
 * parent area + subarea, plus its complete price history ordered newest first.
 */
export async function getEnsayoById(id: number): Promise<EnsayoDetail> {
  logger.debug({ id }, 'catalog.service: getEnsayoById');

  const tipo = await db.query.tipoEnsayo.findFirst({
    where: eq(tipoEnsayo.id, id),
    with: {
      subarea: {
        with: { area: true },
      },
      precios: {
        orderBy: (p, { desc }) => [desc(p.fechaInicio)],
      },
    },
  });

  if (!tipo) {
    throw new AppError(`Tipo de ensayo con id ${id} no encontrado.`, 404);
  }

  return {
    id: tipo.id,
    nombreTipoEnsayo: tipo.nombreTipoEnsayo,
    codigoNorma: tipo.codigoNorma ?? null,
    activo: tipo.activo,
    area: {
      id: tipo.subarea.area.id,
      nombreArea: tipo.subarea.area.nombreArea,
    },
    subarea: {
      id: tipo.subarea.id,
      nombreSubarea: tipo.subarea.nombreSubarea,
    },
    precios: tipo.precios.map((p) => ({
      id: p.id,
      precio: p.precio,
      fechaInicio: p.fechaInicio,
      fechaFin: p.fechaFin ?? null,
      activo: p.activo,
    })),
  };
}

// ---------------------------------------------------------------------------
// Input / Output types  — Update / Delete
// ---------------------------------------------------------------------------

export interface UpdateEnsayoInput {
  /** New test name. Omit to leave unchanged. */
  nombreTipoEnsayo?: string;
  /** New standard code. Pass null to clear it; omit to leave unchanged. */
  codigoNorma?: string | null;
  /**
   * New unit price (numeric string, e.g. "95000.00").
   * When provided the current active price is closed today and a new active
   * price is opened — preserving the full price history.
   */
  precio?: string;
  /** Effective start date for the new price (ISO 8601 YYYY-MM-DD, defaults to today). */
  fechaInicio?: string;
}

export interface UpdateEnsayoResult {
  tipoEnsayo: {
    id: number;
    nombreTipoEnsayo: string;
    codigoNorma: string | null;
    activo: boolean;
  };
  nuevoPrecio?: {
    id: number;
    precio: string;
    fechaInicio: string;
  };
}

// ---------------------------------------------------------------------------
// Service — Update
// ---------------------------------------------------------------------------

/**
 * Partially updates a tipo_ensayo and, optionally, rotates its active price.
 *
 * Price rotation strategy (preserves full history):
 *   1. Close the current active price → fecha_fin = today, activo = FALSE.
 *   2. Insert a new active price     → fecha_inicio = requested date, activo = TRUE.
 *
 * Both DB operations execute inside a single transaction so they either
 * both succeed or both roll back.
 *
 * Throws 404 when the record does not exist.
 * Throws 409 when the new name conflicts with an existing one in the same subarea.
 */
export async function updateEnsayo(
  id: number,
  input: UpdateEnsayoInput,
): Promise<UpdateEnsayoResult> {
  logger.info({ id, ...input }, 'catalog.service: updateEnsayo');

  const result = await db.transaction(async (tx) => {
    // ------------------------------------------------------------------
    // 1. Load the current record — fail fast if it does not exist.
    // ------------------------------------------------------------------
    const [existing] = await tx
      .select()
      .from(tipoEnsayo)
      .where(eq(tipoEnsayo.id, id))
      .limit(1);

    if (!existing) {
      throw new AppError(`Tipo de ensayo con id ${id} no encontrado.`, 404);
    }

    // ------------------------------------------------------------------
    // 2. Build the patch for tipo_ensayo (only fields provided by caller).
    // ------------------------------------------------------------------
    const patch: Partial<typeof tipoEnsayo.$inferInsert> = {};

    if (input.nombreTipoEnsayo !== undefined) patch.nombreTipoEnsayo = input.nombreTipoEnsayo;
    if (input.codigoNorma      !== undefined) patch.codigoNorma      = input.codigoNorma ?? undefined;

    let updatedTipo = existing;

    if (Object.keys(patch).length > 0) {
      patch.updatedAt = new Date();
      try {
        [updatedTipo] = await tx
          .update(tipoEnsayo)
          .set(patch)
          .where(eq(tipoEnsayo.id, id))
          .returning();
      } catch (err: unknown) {
        // PostgreSQL unique-violation (23505) → duplicate name within same subarea.
        if (
          err instanceof Error &&
          'code' in err &&
          (err as NodeJS.ErrnoException).code === '23505'
        ) {
          throw new AppError(
            `El nombre "${input.nombreTipoEnsayo}" ya existe en la misma subárea.`,
            409,
          );
        }
        throw err;
      }
    }

    // ------------------------------------------------------------------
    // 3. Rotate active price when a new one is requested.
    // ------------------------------------------------------------------
    let nuevoPrecio: UpdateEnsayoResult['nuevoPrecio'];

    if (input.precio !== undefined) {
      const today       = todayIso();
      const fechaInicio = input.fechaInicio ?? today;

      // Close any open-ended active price for this test.
      await tx
        .update(precioEnsayo)
        .set({ fechaFin: today, activo: false, updatedAt: new Date() })
        .where(
          and(
            eq(precioEnsayo.tipoEnsayoId, id),
            eq(precioEnsayo.activo, true),
            isNull(precioEnsayo.fechaFin),
          ),
        );

      // Open the new active price.
      const [inserted] = await tx
        .insert(precioEnsayo)
        .values({
          tipoEnsayoId: id,
          precio:       input.precio,
          fechaInicio,
          fechaFin:     null,
          activo:       true,
        })
        .returning();

      nuevoPrecio = {
        id:          inserted.id,
        precio:      inserted.precio,
        fechaInicio: inserted.fechaInicio,
      };

      logger.debug(
        { tipoEnsayoId: id, precioId: inserted.id },
        'catalog.service: price rotated',
      );
    }

    return { updatedTipo, nuevoPrecio };
  });

  logger.info({ id }, 'catalog.service: ensayo updated OK');

  return {
    tipoEnsayo: {
      id:               result.updatedTipo.id,
      nombreTipoEnsayo: result.updatedTipo.nombreTipoEnsayo,
      codigoNorma:      result.updatedTipo.codigoNorma ?? null,
      activo:           result.updatedTipo.activo,
    },
    nuevoPrecio: result.nuevoPrecio,
  };
}

// ---------------------------------------------------------------------------
// Service — Soft-delete
// ---------------------------------------------------------------------------

/**
 * Soft-deletes a tipo_ensayo by setting `activo = false`.
 *
 * Hard-delete is intentionally avoided because:
 *   a) precio_ensayo references tipo_ensayo with ON DELETE RESTRICT.
 *   b) Preserving history is a core business requirement (audit trail,
 *      existing quotation lines must remain traceable).
 *
 * The deactivated test will no longer appear in the default list/tree
 * views (both filter on `activo = true` by default).
 *
 * Throws 404 when the record does not exist.
 * Throws 409 when the record is already inactive.
 */
export async function deactivateEnsayo(id: number): Promise<{ id: number; activo: false }> {
  logger.info({ id }, 'catalog.service: deactivateEnsayo');

  const [existing] = await db
    .select({ id: tipoEnsayo.id, activo: tipoEnsayo.activo })
    .from(tipoEnsayo)
    .where(eq(tipoEnsayo.id, id))
    .limit(1);

  if (!existing) {
    throw new AppError(`Tipo de ensayo con id ${id} no encontrado.`, 404);
  }

  if (!existing.activo) {
    throw new AppError(`El tipo de ensayo con id ${id} ya está inactivo.`, 409);
  }

  await db
    .update(tipoEnsayo)
    .set({ activo: false, updatedAt: new Date() })
    .where(eq(tipoEnsayo.id, id));

  logger.info({ id }, 'catalog.service: ensayo deactivated OK');
  return { id, activo: false };
}
