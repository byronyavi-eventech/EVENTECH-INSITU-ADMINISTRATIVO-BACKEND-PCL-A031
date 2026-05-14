/**
 * catalog.schema.ts
 * Laboratory test catalogue: areas, subareas, test types, and price history.
 *
 * Design:
 *   area_ensayo → subarea_ensayo → tipo_ensayo → precio_ensayo
 *
 * Price history is modelled as a time-series: each price has a start date and
 * an optional end date. The ACTIVE price is the one with `activo = TRUE` and
 * `fecha_fin IS NULL`. A partial unique index enforces at most one active price
 * per test type at any time.
 */
import {
  pgTable,
  bigserial,
  varchar,
  boolean,
  numeric,
  date,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';

/**
 * Top-level discipline area (e.g., "Mecánica de Suelos", "Asfaltos").
 */
export const areaEnsayo = pgTable(
  'area_ensayo',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    nombreArea: varchar('nombre_area', { length: 150 }).notNull().unique(),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('area_ensayo_activo_idx').on(t.activo)],
);

/**
 * Sub-discipline within an area (e.g., "Compactación" within "Mecánica de Suelos").
 * Unique on (area_id, nombre_subarea) — prevents duplicate names within the same area.
 */
export const subareaEnsayo = pgTable(
  'subarea_ensayo',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    areaId: bigserial('area_id', { mode: 'number' })
      .notNull()
      .references(() => areaEnsayo.id, { onDelete: 'restrict' }),
    nombreSubarea: varchar('nombre_subarea', { length: 150 }).notNull(),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('subarea_ensayo_area_id_idx').on(t.areaId),
    index('subarea_ensayo_activo_idx').on(t.activo),
    // Prevent duplicate subarea names within the same area.
    unique('subarea_ensayo_area_nombre_unique').on(t.areaId, t.nombreSubarea),
  ],
);

/**
 * Individual laboratory test type (e.g., "Ensayo Proctor Modificado ASTM D1557").
 * `codigo_norma` is the applicable technical standard (optional).
 * Unique on (subarea_id, nombre_tipo_ensayo) — prevents duplicates within a subarea.
 */
export const tipoEnsayo = pgTable(
  'tipo_ensayo',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    subareaId: bigserial('subarea_id', { mode: 'number' })
      .notNull()
      .references(() => subareaEnsayo.id, { onDelete: 'restrict' }),
    nombreTipoEnsayo: varchar('nombre_tipo_ensayo', { length: 250 }).notNull(),
    codigoNorma: varchar('codigo_norma', { length: 100 }),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('tipo_ensayo_subarea_id_idx').on(t.subareaId),
    index('tipo_ensayo_activo_idx').on(t.activo),
    // Prevent duplicate test names within the same subarea.
    unique('tipo_ensayo_subarea_nombre_unique').on(
      t.subareaId,
      t.nombreTipoEnsayo,
    ),
  ],
);

/**
 * Price history for a test type.
 * A price record is ACTIVE when `activo = TRUE` and `fecha_fin IS NULL`.
 *
 * To change the price:
 *   1. UPDATE current active record → set fecha_fin = today, activo = FALSE
 *   2. INSERT new record → fecha_inicio = tomorrow, fecha_fin = NULL, activo = TRUE
 *
 * The partial unique index below (defined in a raw migration) enforces that
 * only ONE open-ended active price exists per test type:
 *   CREATE UNIQUE INDEX precio_ensayo_active_unique
 *     ON precio_ensayo (tipo_ensayo_id)
 *     WHERE activo = TRUE AND fecha_fin IS NULL;
 *
 * Drizzle does not yet support filtered unique indexes declaratively,
 * so this constraint must be added via a custom migration SQL file.
 *
 * `precio` uses NUMERIC(12,2) — sufficient for CLP amounts (up to 9,999,999,999.99).
 */
export const precioEnsayo = pgTable(
  'precio_ensayo',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tipoEnsayoId: bigserial('tipo_ensayo_id', { mode: 'number' })
      .notNull()
      .references(() => tipoEnsayo.id, { onDelete: 'restrict' }),

    precio: numeric('precio', { precision: 12, scale: 2 }).notNull(),
    fechaInicio: date('fecha_inicio').notNull(),
    fechaFin: date('fecha_fin'), // NULL = currently active
    activo: boolean('activo').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('precio_ensayo_tipo_ensayo_id_idx').on(t.tipoEnsayoId),
    index('precio_ensayo_activo_idx').on(t.activo),
    index('precio_ensayo_fechas_idx').on(t.fechaInicio, t.fechaFin),
  ],
);

export type AreaEnsayo = typeof areaEnsayo.$inferSelect;
export type NewAreaEnsayo = typeof areaEnsayo.$inferInsert;
export type SubareaEnsayo = typeof subareaEnsayo.$inferSelect;
export type NewSubareaEnsayo = typeof subareaEnsayo.$inferInsert;
export type TipoEnsayo = typeof tipoEnsayo.$inferSelect;
export type NewTipoEnsayo = typeof tipoEnsayo.$inferInsert;
export type PrecioEnsayo = typeof precioEnsayo.$inferSelect;
export type NewPrecioEnsayo = typeof precioEnsayo.$inferInsert;
