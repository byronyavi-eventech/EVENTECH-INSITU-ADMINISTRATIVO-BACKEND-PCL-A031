/**
 * rbac.schema.ts
 * Role-Based Access Control layer.
 * Better Auth has no built-in role system, so we implement our own.
 *
 * Design decision: roles are assigned to Better Auth users via user.id.
 * The application middleware is responsible for fetching and caching role
 * assignments per request.
 */
import {
  pgTable,
  bigserial,
  varchar,
  boolean,
  text,
  timestamp,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { user } from './auth.schema.js';

/**
 * Application roles catalogue.
 * `nombre_rol` is unique — use a stable identifier like 'ADMIN', 'INGENIERO', 'CLIENTE'.
 * `activo` allows soft-disabling a role without cascade deleting assignments.
 *
 * NOTE: When a role is deactivated, the application must check `rol.activo`
 * at runtime. Existing `usuario_rol` rows are NOT automatically invalidated.
 */
export const rol = pgTable(
  'rol',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    nombreRol: varchar('nombre_rol', { length: 50 }).notNull().unique(),
    descripcion: varchar('descripcion', { length: 250 }),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('rol_activo_idx').on(t.activo)],
);

/**
 * Junction table: user ↔ rol (many-to-many).
 * Composite PK prevents duplicate assignments.
 * `fecha_asignacion` provides an audit trail.
 *
 * `asignado_por` records which admin user granted the role.
 * Nullable because seed/bootstrap roles may be assigned outside a user session.
 */
export const usuarioRol = pgTable(
  'usuario_rol',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    rolId: bigserial('rol_id', { mode: 'number' })
      .notNull()
      .references(() => rol.id, { onDelete: 'restrict' }),
    asignadoPor: text('asignado_por').references(() => user.id, {
      onDelete: 'set null',
    }),
    fechaAsignacion: timestamp('fecha_asignacion', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Composite PK prevents duplicate user-role assignments.
    primaryKey({ columns: [t.userId, t.rolId] }),
    index('usuario_rol_user_id_idx').on(t.userId),
    index('usuario_rol_rol_id_idx').on(t.rolId),
  ],
);

export type Rol = typeof rol.$inferSelect;
export type NewRol = typeof rol.$inferInsert;
export type UsuarioRol = typeof usuarioRol.$inferSelect;
