/**
 * quotation.schema.ts
 * Quotation (cotización) and its line items (detalle_ensayo).
 *
 * A cotización is raised against an obra and contains one or more line items,
 * each referencing a tipo_ensayo with a locked-in unit price at the time of
 * quotation creation.
 */
import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  text,
  integer,
  numeric,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth.schema.js';
import { obra } from './client.schema.js';
import { tipoEnsayo } from './catalog.schema.js';
import { estadoCotizacionEnum, origenCotizacionEnum, condicionPagoEnum, tipoAjusteEnum } from './enums.js';
import { cuentaBancaria } from './cuenta_bancaria.schema.js';

/**
 * `tbl_cotizacion` → `cotizacion`
 *
 * Design decisions:
 * - `estado` uses a PG enum (enforced at DB level).
 * - `origen` uses a PG enum.
 * - `creadoPor` is nullable: web-originated quotes may not have an internal user.
 * - `codigo_cotizacion` is nullable until formally assigned (UNIQUE on non-NULL
 *   values — PostgreSQL ignores NULLs in unique indexes, so multiple BORRADOR
 *   rows can coexist without a code).
 * - `deleted_at` implements soft delete. Hard deletes are not allowed on
 *   financial documents. Application queries MUST filter `WHERE deleted_at IS NULL`.
 * - `fecha_solicitud` vs `created_at`: `fecha_solicitud` is the business date
 *   the client requested the quote (may differ from DB creation time for
 *   retroactively entered quotes).
 * - `observaciones` uses TEXT (no length limit) — notes can be long.
 */
export const cotizacion = pgTable(
  'cotizacion',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    obraId: bigserial('obra_id', { mode: 'number' })
      .notNull()
      .references(() => obra.id, { onDelete: 'restrict' }),

    codigoCotizacion: varchar('codigo_cotizacion', { length: 30 }).unique(),
    origen: origenCotizacionEnum('origen').notNull(),
    estado: estadoCotizacionEnum('estado').notNull().default('NUEVA'),
    observaciones: text('observaciones'),

    // Days the client has to respond after receiving the token email (default 15).
    diasVigenciaToken: integer('dias_vigencia_token').notNull().default(15),

    // Cantidad de visitas a terreno para TODA la cotización (1-5). Fuente única
    // de verdad para el flujo de Programación de Ensayos — NO existe cantidad
    // de visitas por ensayo individual (ver comentario en cotizacionDetalle.
    // cantidadVisitas más abajo). Rango 1-5 validado en zod, no en DB (este
    // codebase no usa check() constraints — ver duracion_meses en obra).
    visitasTotales: integer('visitas_totales').notNull().default(1),

    // Firma (base64, sin prefijo data URI) capturada en el Mantenedor de Firmas
    // al aceptar la cotización. Nullable — no todas las cotizaciones están firmadas.
    firmaBase64: text('firma_base64'),

    // Razón de rechazo registrada por el cliente al hacer click en RECHAZAR
    // (capturada en la landing page antes de confirmar). Nullable.
    motivoRechazo: varchar('motivo_rechazo', { length: 100 }),
    comentarioRechazo: text('comentario_rechazo'),

    // Internal user who created/entered the quote. NULL for web self-service.
    creadoPor: text('creado_por').references(() => user.id, {
      onDelete: 'set null',
    }),

    // Business date the client requested the quote (audit / SLA tracking).
    fechaSolicitud: timestamp('fecha_solicitud', { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Timestamp when the last client-response token was issued (ENVIADA_CLIENTE).
    tokenEnviadoAt: timestamp('token_enviado_at', { withTimezone: true }),

    // Timestamp when the client responded (RECHAZADA_CLIENTE or ESPERA_VERIFICACION).
    respuestaClienteAt: timestamp('respuesta_cliente_at', { withTimezone: true }),

    // ── Notas Comerciales ─────────────────────────────────────────────────
    // Condición de pago acordada con el cliente.
    condicionPago: condicionPagoEnum('condicion_pago').notNull().default('PAGO_100'),

    // Cuenta bancaria principal seleccionada para recibir el pago.
    cuentaPrincipalId: bigint('cuenta_principal_id', { mode: 'number' })
      .references(() => cuentaBancaria.id, { onDelete: 'set null' }),

    // Cuenta bancaria secundaria (backup).
    cuentaSecundariaId: bigint('cuenta_secundaria_id', { mode: 'number' })
      .references(() => cuentaBancaria.id, { onDelete: 'set null' }),

    // Tipo de ajuste sobre el total: sin ajuste, descuento o incremento.
    tipoAjuste: tipoAjusteEnum('tipo_ajuste').notNull().default('SIN_AJUSTE'),

    // Porcentaje del ajuste (0.00 - 100.00). Null si tipoAjuste = SIN_AJUSTE.
    porcentajeAjuste: numeric('porcentaje_ajuste', { precision: 5, scale: 2 }),
    // ─────────────────────────────────────────────────────────────────────────

    // Soft delete — financial documents are never hard-deleted.
    deletedAt: timestamp('deleted_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('cotizacion_obra_id_idx').on(t.obraId),
    index('cotizacion_estado_idx').on(t.estado),
    index('cotizacion_creado_por_idx').on(t.creadoPor),
    // Partial index for active (non-deleted) quotations — the most common query.
    index('cotizacion_active_idx').on(t.obraId).where(
      sql`${t.deletedAt} IS NULL`
    ),
    index('cotizacion_fecha_solicitud_idx').on(t.fechaSolicitud),
  ],
);

/**
 * `tbl_cotizacion_detalle_ensayo` → `cotizacion_detalle`
 *
 * Line items within a quotation.
 *
 * Design decisions:
 * - `precio_unitario` is stored here (snapshotted from precio_ensayo at creation
 *   time). This is intentional: changing the catalogue price must NOT retroactively
 *   modify existing quotations.
 * - `subtotal` is NOT a generated column. The formula was incorrect in the original
 *   schema (omitted `cantidad_visitas`). The correct formula varies by business rule
 *   (is it ensayos × visitas × precio, or just ensayos × precio?). Compute in the
 *   service layer and store if needed for reporting.
 * - Composite unique on (cotizacion_id, tipo_ensayo_id) prevents duplicating the
 *   same test type in the same quotation. If the business allows the same test
 *   multiple times (different phases), remove this constraint.
 */
export const cotizacionDetalle = pgTable(
  'cotizacion_detalle',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    cotizacionId: bigint('cotizacion_id', { mode: 'number' })
      .notNull()
      .references(() => cotizacion.id, { onDelete: 'cascade' }),
    tipoEnsayoId: bigint('tipo_ensayo_id', { mode: 'number' })
      .notNull()
      .references(() => tipoEnsayo.id, { onDelete: 'restrict' }),

    cantidadEnsayos: integer('cantidad_ensayos').notNull(),

    // DEPRECATED para efectos de scheduling (Fase 1, flujo de Programación de
    // Ensayos, 2026-08): la cantidad de visitas de la cotización ahora vive
    // exclusivamente en cotizacion.visitasTotales. Esta columna se mantiene
    // NOT NULL sin cambios porque sigue siendo insumo del cálculo de precio
    // (precioUnitario × cantidadEnsayos × cantidadVisitas) en email.service.ts,
    // cotizacion-document.tsx (PDF) y quotation.service.ts — no tocar sin
    // revisar esos 3 consumidores. NO usar este campo para determinar a
    // cuántas/cuáles visitas pertenece un ensayo: para eso ver visita_ensayo
    // en visita.schema.ts.
    cantidadVisitas: integer('cantidad_visitas').notNull(),

    // Price locked at quote creation time — never read from precio_ensayo retroactively.
    precioUnitario: numeric('precio_unitario', {
      precision: 12,
      scale: 2,
    }).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('cotizacion_detalle_cotizacion_id_idx').on(t.cotizacionId),
    index('cotizacion_detalle_tipo_ensayo_id_idx').on(t.tipoEnsayoId),
    // Assumption: one test type appears only once per quotation.
    // Remove this unique if the business requires duplicates (e.g., phased work).
    unique('cotizacion_detalle_cotizacion_tipo_unique').on(
      t.cotizacionId,
      t.tipoEnsayoId,
    ),
  ],
);

/**
 * `tbl_cotizacion_servicio_general` → `cotizacion_servicio_general`
 *
 * General/additional service line items within a quotation.
 * Unlike ensayos, these are free-form descriptions with a locked-in price
 * and a quantity (e.g. "Copia de informe", "Valor hora adicional en terreno").
 */
export const cotizacionServicioGeneral = pgTable(
  'cotizacion_servicio_general',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    cotizacionId: bigint('cotizacion_id', { mode: 'number' })
      .notNull()
      .references(() => cotizacion.id, { onDelete: 'cascade' }),

    descripcion: varchar('descripcion', { length: 255 }).notNull(),
    cantidad: integer('cantidad').notNull().default(1),

    // Price locked at the time of addition — matches the business convention
    // used in cotizacion_detalle.
    precioUnitario: numeric('precio_unitario', {
      precision: 12,
      scale: 2,
    }).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('cotizacion_servicio_general_cotizacion_id_idx').on(t.cotizacionId),
  ],
);

export type Cotizacion = typeof cotizacion.$inferSelect;
export type NewCotizacion = typeof cotizacion.$inferInsert;
export type CotizacionDetalle = typeof cotizacionDetalle.$inferSelect;
export type NewCotizacionDetalle = typeof cotizacionDetalle.$inferInsert;
export type CotizacionServicioGeneral = typeof cotizacionServicioGeneral.$inferSelect;
export type NewCotizacionServicioGeneral = typeof cotizacionServicioGeneral.$inferInsert;
