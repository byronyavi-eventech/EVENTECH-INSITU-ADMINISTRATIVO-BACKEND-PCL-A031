/**
 * comprobante.schema.ts
 *
 * Tabla para almacenar las referencias (S3 keys) de los comprobantes de pago
 * subidos por el cliente. Los archivos viven en S3; aquí solo guardamos metadata
 * y la key para poder generar presigned GET URLs desde el admin.
 */
import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { cotizacion } from './quotation.schema.js';

export const cotizacionComprobante = pgTable(
  'cotizacion_comprobante',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),

    // FK a la cotización a la que pertenece el comprobante.
    cotizacionId: bigint('cotizacion_id', { mode: 'number' })
      .notNull()
      .references(() => cotizacion.id, { onDelete: 'cascade' }),

    // Key del objeto en S3 (ej: "comprobantes/40/uuid-filename.pdf").
    s3Key: varchar('s3_key', { length: 512 }).notNull(),

    // Nombre original del archivo tal como fue subido por el cliente.
    nombreArchivo: varchar('nombre_archivo', { length: 255 }).notNull(),

    // MIME type del archivo (application/pdf, image/jpeg, image/png).
    contentType: varchar('content_type', { length: 100 }).notNull(),

    // Tamaño del archivo en bytes.
    sizeBytes: integer('size_bytes').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('comprobante_cotizacion_id_idx').on(t.cotizacionId)],
);

export type CotizacionComprobante = typeof cotizacionComprobante.$inferSelect;
export type NewCotizacionComprobante = typeof cotizacionComprobante.$inferInsert;
