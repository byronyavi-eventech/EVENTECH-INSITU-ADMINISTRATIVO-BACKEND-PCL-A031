/**
 * visita.schema.ts
 * Visitas a terreno y Órdenes de Trabajo (OT) — flujo de Programación de Ensayos.
 *
 * Una `cotizacion` (una vez PAGO_VERIFICADO) define cuántas visitas a terreno
 * necesita en total (`cotizacion.visitasTotales`, 1-5). El cliente, desde el
 * portal `/programar-ensayos/:token`, asigna cada ensayo contratado
 * (`cotizacion_detalle`) a una visita concreta con fecha/hora, y al confirmar
 * (estado PROGRAMADO) el sistema genera una Orden de Trabajo por cada visita.
 *
 * Cardinalidad (confirmada por Noelia): 1 visita = 1 OT única. N visitas →
 * N OTs distintas, cada una agrupando exclusivamente los ensayos asignados a
 * esa visita vía `visita_ensayo`.
 *
 * Todas las filas de `visita` y `orden_trabajo` se crean juntas, atómicamente,
 * al confirmar la programación (Fase 4) — nunca antes. Por eso no hay campos
 * nullable transitorios: para cuando existe la fila, ya se conoce todo.
 */
import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  integer,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { cotizacion, cotizacionDetalle } from './quotation.schema.js';

/**
 * `visita`
 *
 * Una visita a terreno programada dentro de una cotización.
 * `numeroVisita` es el orden dentro de la cotización (1..cotizacion.visitasTotales),
 * usado también para nombrar la OT correspondiente (ver ordenTrabajo.codigoOt).
 */
export const visita = pgTable(
  'visita',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    cotizacionId: bigint('cotizacion_id', { mode: 'number' })
      .notNull()
      .references(() => cotizacion.id, { onDelete: 'cascade' }),

    numeroVisita: integer('numero_visita').notNull(),

    fechaHoraProgramada: timestamp('fecha_hora_programada', {
      withTimezone: true,
    }).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('visita_cotizacion_id_idx').on(t.cotizacionId),
    // Un mismo número de visita no puede repetirse dentro de la misma cotización.
    unique('visita_cotizacion_numero_unique').on(t.cotizacionId, t.numeroVisita),
  ],
);

/**
 * `orden_trabajo`
 *
 * Documento operativo generado 1:1 desde una visita al confirmar la
 * programación. `visitaId` es UNIQUE — esa unicidad es lo que impone la
 * cardinalidad 1 visita = 1 OT a nivel de base de datos.
 * `cotizacionId` está denormalizado (podría derivarse via visita.cotizacionId)
 * a pedido explícito del negocio, para no requerir join en queries frecuentes.
 */
export const ordenTrabajo = pgTable(
  'orden_trabajo',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    cotizacionId: bigint('cotizacion_id', { mode: 'number' })
      .notNull()
      .references(() => cotizacion.id, { onDelete: 'restrict' }),
    visitaId: bigint('visita_id', { mode: 'number' })
      .notNull()
      .unique()
      .references(() => visita.id, { onDelete: 'restrict' }),

    // Formato: OT-{codigoCotizacion}-{numeroVisita}, ej. "OT-1234-LIA-1".
    // Generado en Fase 4 (lógica de negocio), esta columna solo lo persiste.
    codigoOt: varchar('codigo_ot', { length: 40 }).notNull().unique(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('orden_trabajo_cotizacion_id_idx').on(t.cotizacionId),
  ],
);

/**
 * `visita_ensayo`
 *
 * Tabla intermedia: asigna cada línea de ensayo contratado (cotizacion_detalle)
 * a exactamente una visita. El UNIQUE de una sola columna en
 * `cotizacionDetalleId` (no compuesto) es lo que fuerza esa exclusividad —
 * una visita puede tener muchas líneas, pero cada línea pertenece como máximo
 * a una visita. Así cada OT deriva sus ensayos con `WHERE visita_id = X`.
 *
 * Modelada como tabla puente (en vez de una FK visita_id directa en
 * cotizacion_detalle) para evitar import circular entre este archivo y
 * quotation.schema.ts: acá importamos cotizacionDetalle, nunca al revés.
 */
export const visitaEnsayo = pgTable(
  'visita_ensayo',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    visitaId: bigint('visita_id', { mode: 'number' })
      .notNull()
      .references(() => visita.id, { onDelete: 'cascade' }),
    cotizacionDetalleId: bigint('cotizacion_detalle_id', { mode: 'number' })
      .notNull()
      .unique()
      .references(() => cotizacionDetalle.id, { onDelete: 'cascade' }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('visita_ensayo_visita_id_idx').on(t.visitaId),
  ],
);

export type Visita = typeof visita.$inferSelect;
export type NewVisita = typeof visita.$inferInsert;
export type OrdenTrabajo = typeof ordenTrabajo.$inferSelect;
export type NewOrdenTrabajo = typeof ordenTrabajo.$inferInsert;
export type VisitaEnsayo = typeof visitaEnsayo.$inferSelect;
export type NewVisitaEnsayo = typeof visitaEnsayo.$inferInsert;
