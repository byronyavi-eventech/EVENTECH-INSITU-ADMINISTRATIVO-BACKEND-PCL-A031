/**
 * relations.ts
 * Drizzle ORM relations — enables type-safe joins via `db.query.*`.
 * Relations are purely a TypeScript layer; they generate no SQL DDL.
 *
 * Naming convention: `<table>Relations` declares outbound and inbound
 * relationships from that table's perspective.
 */
import { relations } from 'drizzle-orm';
import { user, session, account } from './auth.schema.js';
import { userProfile } from './profile.schema.js';
import { rol, usuarioRol } from './rbac.schema.js';
import {
  cliente,
  obra,
  encargadoObra,
} from './client.schema.js';
import {
  areaEnsayo,
  subareaEnsayo,
  tipoEnsayo,
  precioEnsayo,
} from './catalog.schema.js';
import { cotizacion, cotizacionDetalle, cotizacionServicioGeneral } from './quotation.schema.js';

// ---------------------------------------------------------------------------
// Better Auth tables
// ---------------------------------------------------------------------------

export const userRelations = relations(user, ({ one, many }) => ({
  // 1-to-1 profile extension
  profile: one(userProfile, {
    fields: [user.id],
    references: [userProfile.userId],
  }),
  // Auth sessions (Better Auth owns these, but exposed for queries)
  sessions: many(session),
  accounts: many(account),
  // RBAC
  roles: many(usuarioRol),
  // Business: quotes created by this user
  cotizaciones: many(cotizacion),
  // Business: clients linked to this account
  clientes: many(cliente),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export const userProfileRelations = relations(userProfile, ({ one }) => ({
  user: one(user, { fields: [userProfile.userId], references: [user.id] }),
}));

// ---------------------------------------------------------------------------
// RBAC
// ---------------------------------------------------------------------------

export const rolRelations = relations(rol, ({ many }) => ({
  usuarios: many(usuarioRol),
}));

export const usuarioRolRelations = relations(usuarioRol, ({ one }) => ({
  user: one(user, { fields: [usuarioRol.userId], references: [user.id] }),
  rol: one(rol, { fields: [usuarioRol.rolId], references: [rol.id] }),
  asignadoPorUser: one(user, {
    fields: [usuarioRol.asignadoPor],
    references: [user.id],
    relationName: 'asignador',
  }),
}));

// ---------------------------------------------------------------------------
// Client domain
// ---------------------------------------------------------------------------

export const clienteRelations = relations(cliente, ({ one, many }) => ({
  user: one(user, { fields: [cliente.userId], references: [user.id] }),
  obras: many(obra),
}));

export const obraRelations = relations(obra, ({ one, many }) => ({
  cliente: one(cliente, {
    fields: [obra.clienteId],
    references: [cliente.id],
  }),
  encargados: many(encargadoObra),
  cotizaciones: many(cotizacion),
}));

export const encargadoObraRelations = relations(encargadoObra, ({ one }) => ({
  obra: one(obra, { fields: [encargadoObra.obraId], references: [obra.id] }),
}));

// ---------------------------------------------------------------------------
// Catalog domain
// ---------------------------------------------------------------------------

export const areaEnsayoRelations = relations(areaEnsayo, ({ many }) => ({
  subareas: many(subareaEnsayo),
}));

export const subareaEnsayoRelations = relations(
  subareaEnsayo,
  ({ one, many }) => ({
    area: one(areaEnsayo, {
      fields: [subareaEnsayo.areaId],
      references: [areaEnsayo.id],
    }),
    tiposEnsayo: many(tipoEnsayo),
  }),
);

export const tipoEnsayoRelations = relations(tipoEnsayo, ({ one, many }) => ({
  subarea: one(subareaEnsayo, {
    fields: [tipoEnsayo.subareaId],
    references: [subareaEnsayo.id],
  }),
  precios: many(precioEnsayo),
  detallesCotizacion: many(cotizacionDetalle),
}));

export const precioEnsayoRelations = relations(precioEnsayo, ({ one }) => ({
  tipoEnsayo: one(tipoEnsayo, {
    fields: [precioEnsayo.tipoEnsayoId],
    references: [tipoEnsayo.id],
  }),
}));

// ---------------------------------------------------------------------------
// Quotation domain
// ---------------------------------------------------------------------------

export const cotizacionRelations = relations(cotizacion, ({ one, many }) => ({
  obra: one(obra, { fields: [cotizacion.obraId], references: [obra.id] }),
  creadoPorUser: one(user, {
    fields: [cotizacion.creadoPor],
    references: [user.id],
  }),
  detalles: many(cotizacionDetalle),
  serviciosGenerales: many(cotizacionServicioGeneral),
}));

export const cotizacionDetalleRelations = relations(
  cotizacionDetalle,
  ({ one }) => ({
    cotizacion: one(cotizacion, {
      fields: [cotizacionDetalle.cotizacionId],
      references: [cotizacion.id],
    }),
    tipoEnsayo: one(tipoEnsayo, {
      fields: [cotizacionDetalle.tipoEnsayoId],
      references: [tipoEnsayo.id],
    }),
  }),
);

export const cotizacionServicioGeneralRelations = relations(
  cotizacionServicioGeneral,
  ({ one }) => ({
    cotizacion: one(cotizacion, {
      fields: [cotizacionServicioGeneral.cotizacionId],
      references: [cotizacion.id],
    }),
  }),
);
