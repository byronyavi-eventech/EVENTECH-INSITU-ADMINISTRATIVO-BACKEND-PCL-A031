/**
 * client.schema.ts
 * Client, project (obra), and site supervisor (encargado_obra) tables.
 *
 * A `cliente` represents a company that requests laboratory services.
 * An `obra` is a specific construction project belonging to a client.
 * An `encargado_obra` is the on-site contact for a specific project.
 */
import {
  pgTable,
  bigserial,
  varchar,
  text,
  integer,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { user } from './auth.schema.js';

/**
 * `tbl_cliente` → `cliente`
 *
 * Design decisions:
 * - `userId` is NULLABLE because anonymous web quotes are valid
 *   (origen_cotizacion = 'WEB'). When a client later creates an account,
 *   this FK can be set by the application.
 * - `email` is the contact person's email, NOT the login email.
 *   When userId is set, login is managed by Better Auth; this email
 *   remains as the billing/contact address.
 * - `rut_empresa` is unique but nullable — some clients are individuals
 *   without a company RUT.
 */
export const cliente = pgTable(
  'cliente',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    // Link to Better Auth user (optional — anonymous clients exist)
    userId: text('user_id').references(() => user.id, {
      onDelete: 'set null',
    }),

    rutEmpresa: varchar('rut_empresa', { length: 12 }).unique(),
    giroEmpresa: varchar('giro_empresa', { length: 100 }).notNull(),

    // Primary contact person for this client account
    nombreContacto: varchar('nombre_contacto', { length: 100 }).notNull(),
    apellidosContacto: varchar('apellidos_contacto', { length: 150 }).notNull(),
    celularContacto: varchar('celular_contacto', { length: 20 }).notNull(),
    // Contact email — may differ from the Better Auth login email
    email: varchar('email', { length: 150 }).notNull(),

    // Registered company address
    direccionEmpresa: varchar('direccion_empresa', { length: 250 }).notNull(),
    region: varchar('region', { length: 100 }).notNull(),
    comuna: varchar('comuna', { length: 100 }).notNull(),
    ciudad: varchar('ciudad', { length: 100 }).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('cliente_user_id_idx').on(t.userId),
    index('cliente_email_idx').on(t.email),
    index('cliente_rut_empresa_idx').on(t.rutEmpresa),
  ],
);

/**
 * `tbl_obra` → `obra`
 *
 * A construction project belonging to a client. Multiple cotizaciones
 * can be raised against the same obra over its lifetime.
 *
 * `duracion_meses` must be > 0 (enforced by DB check constraint).
 * Address fields are repeated here intentionally — the obra address
 * differs from the client address.
 */
export const obra = pgTable(
  'obra',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    clienteId: bigserial('cliente_id', { mode: 'number' })
      .notNull()
      .references(() => cliente.id, { onDelete: 'restrict' }),

    nombreObra: varchar('nombre_obra', { length: 200 }).notNull(),
    nombreMandante: varchar('nombre_mandante', { length: 200 }).notNull(),
    nombreContratista: varchar('nombre_contratista', { length: 200 }).notNull(),
    ubicacionObra: varchar('ubicacion_obra', { length: 300 }).notNull(),

    region: varchar('region', { length: 100 }).notNull(),
    comuna: varchar('comuna', { length: 100 }).notNull(),
    ciudad: varchar('ciudad', { length: 100 }).notNull(),
    duracionMeses: integer('duracion_meses').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('obra_cliente_id_idx').on(t.clienteId),
    index('obra_ciudad_idx').on(t.ciudad),
  ],
);

/**
 * `tbl_encargado_obra` → `encargado_obra`
 *
 * On-site supervisor or point of contact for a specific obra.
 * One obra can have multiple encargados (e.g., different phases).
 *
 * Unique constraint on (obra_id, correo_encargado) prevents the same person
 * from being registered twice for the same project.
 */
export const encargadoObra = pgTable(
  'encargado_obra',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    obraId: bigserial('obra_id', { mode: 'number' })
      .notNull()
      .references(() => obra.id, { onDelete: 'cascade' }),

    nombreEncargado: varchar('nombre_encargado', { length: 150 }).notNull(),
    correoEncargado: varchar('correo_encargado', { length: 150 }).notNull(),
    telefonoEncargado: varchar('telefono_encargado', { length: 20 }).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('encargado_obra_obra_id_idx').on(t.obraId),
    // Prevent the same person being registered twice for the same obra.
    unique('encargado_obra_obra_correo_unique').on(
      t.obraId,
      t.correoEncargado,
    ),
  ],
);

export type Cliente = typeof cliente.$inferSelect;
export type NewCliente = typeof cliente.$inferInsert;
export type Obra = typeof obra.$inferSelect;
export type NewObra = typeof obra.$inferInsert;
export type EncargadoObra = typeof encargadoObra.$inferSelect;
export type NewEncargadoObra = typeof encargadoObra.$inferInsert;
