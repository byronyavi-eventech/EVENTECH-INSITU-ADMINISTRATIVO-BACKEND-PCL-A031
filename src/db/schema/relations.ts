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
import { cliente, obra, encargadoObra } from './client.schema.js';
import { areaEnsayo, subareaEnsayo, tipoEnsayo, precioEnsayo } from './catalog.schema.js';
import { cotizacion, cotizacionDetalle, cotizacionServicioGeneral } from './quotation.schema.js';
import { cuentaBancaria } from './cuenta_bancaria.schema.js';
import { visita, ordenTrabajo, visitaEnsayo } from './visita.schema.js';
import {
  empresa,
  sucursal,
  ubicacion,
  grupo,
  tipoEquipo,
  equipo,
  equipoTipoEnsayo,
  historialCalibracion,
  historialVerificacion,
  historialMantenimiento,
} from './equipo.schema.js';

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

export const subareaEnsayoRelations = relations(subareaEnsayo, ({ one, many }) => ({
  area: one(areaEnsayo, {
    fields: [subareaEnsayo.areaId],
    references: [areaEnsayo.id],
  }),
  tiposEnsayo: many(tipoEnsayo),
}));

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
  cuentaPrincipal: one(cuentaBancaria, {
    fields: [cotizacion.cuentaPrincipalId],
    references: [cuentaBancaria.id],
    relationName: 'cuentaPrincipal',
  }),
  cuentaSecundaria: one(cuentaBancaria, {
    fields: [cotizacion.cuentaSecundariaId],
    references: [cuentaBancaria.id],
    relationName: 'cuentaSecundaria',
  }),
  detalles: many(cotizacionDetalle),
  serviciosGenerales: many(cotizacionServicioGeneral),
  visitas: many(visita),
  ordenesTrabajo: many(ordenTrabajo),
}));

export const cuentaBancariaRelations = relations(cuentaBancaria, ({ many }) => ({
  cotizacionesPrincipal: many(cotizacion, { relationName: 'cuentaPrincipal' }),
  cotizacionesSecundaria: many(cotizacion, { relationName: 'cuentaSecundaria' }),
}));

export const cotizacionDetalleRelations = relations(cotizacionDetalle, ({ one }) => ({
  cotizacion: one(cotizacion, {
    fields: [cotizacionDetalle.cotizacionId],
    references: [cotizacion.id],
  }),
  tipoEnsayo: one(tipoEnsayo, {
    fields: [cotizacionDetalle.tipoEnsayoId],
    references: [tipoEnsayo.id],
  }),
  visitaAsignada: one(visitaEnsayo, {
    fields: [cotizacionDetalle.id],
    references: [visitaEnsayo.cotizacionDetalleId],
  }),
}));

// ---------------------------------------------------------------------------
// Visitas y Órdenes de Trabajo (Programación de Ensayos)
// ---------------------------------------------------------------------------

export const visitaRelations = relations(visita, ({ one, many }) => ({
  cotizacion: one(cotizacion, {
    fields: [visita.cotizacionId],
    references: [cotizacion.id],
  }),
  ordenTrabajo: one(ordenTrabajo, {
    fields: [visita.id],
    references: [ordenTrabajo.visitaId],
  }),
  ensayosAsignados: many(visitaEnsayo),
}));

export const ordenTrabajoRelations = relations(ordenTrabajo, ({ one }) => ({
  cotizacion: one(cotizacion, {
    fields: [ordenTrabajo.cotizacionId],
    references: [cotizacion.id],
  }),
  visita: one(visita, {
    fields: [ordenTrabajo.visitaId],
    references: [visita.id],
  }),
}));

export const visitaEnsayoRelations = relations(visitaEnsayo, ({ one }) => ({
  visita: one(visita, {
    fields: [visitaEnsayo.visitaId],
    references: [visita.id],
  }),
  cotizacionDetalle: one(cotizacionDetalle, {
    fields: [visitaEnsayo.cotizacionDetalleId],
    references: [cotizacionDetalle.id],
  }),
}));

export const cotizacionServicioGeneralRelations = relations(
  cotizacionServicioGeneral,
  ({ one }) => ({
    cotizacion: one(cotizacion, {
      fields: [cotizacionServicioGeneral.cotizacionId],
      references: [cotizacion.id],
    }),
  }),
);

// ---------------------------------------------------------------------------
// Equipos (Mantenedores/Laboratorio)
// ---------------------------------------------------------------------------

export const empresaRelations = relations(empresa, ({ many }) => ({
  sucursales: many(sucursal),
  equipos: many(equipo),
}));

export const sucursalRelations = relations(sucursal, ({ one, many }) => ({
  empresa: one(empresa, { fields: [sucursal.empresaId], references: [empresa.id] }),
  ubicaciones: many(ubicacion),
  equipos: many(equipo),
}));

export const ubicacionRelations = relations(ubicacion, ({ one, many }) => ({
  sucursal: one(sucursal, { fields: [ubicacion.sucursalId], references: [sucursal.id] }),
  equipos: many(equipo),
}));

export const grupoRelations = relations(grupo, ({ many }) => ({
  tiposEquipo: many(tipoEquipo),
}));

export const tipoEquipoRelations = relations(tipoEquipo, ({ one, many }) => ({
  grupo: one(grupo, { fields: [tipoEquipo.grupoId], references: [grupo.id] }),
  equipos: many(equipo),
}));

export const equipoRelations = relations(equipo, ({ one, many }) => ({
  tipoEquipo: one(tipoEquipo, { fields: [equipo.tipoEquipoId], references: [tipoEquipo.id] }),
  empresa: one(empresa, { fields: [equipo.empresaId], references: [empresa.id] }),
  sucursal: one(sucursal, { fields: [equipo.sucursalId], references: [sucursal.id] }),
  ubicacion: one(ubicacion, { fields: [equipo.ubicacionId], references: [ubicacion.id] }),
  calibraciones: many(historialCalibracion),
  verificaciones: many(historialVerificacion),
  mantenimientos: many(historialMantenimiento),
  tiposEnsayo: many(equipoTipoEnsayo),
}));

export const equipoTipoEnsayoRelations = relations(equipoTipoEnsayo, ({ one }) => ({
  equipo: one(equipo, { fields: [equipoTipoEnsayo.equipoId], references: [equipo.id] }),
}));

export const historialCalibracionRelations = relations(historialCalibracion, ({ one }) => ({
  equipo: one(equipo, { fields: [historialCalibracion.equipoId], references: [equipo.id] }),
}));

export const historialVerificacionRelations = relations(historialVerificacion, ({ one }) => ({
  equipo: one(equipo, { fields: [historialVerificacion.equipoId], references: [equipo.id] }),
}));

export const historialMantenimientoRelations = relations(historialMantenimiento, ({ one }) => ({
  equipo: one(equipo, { fields: [historialMantenimiento.equipoId], references: [equipo.id] }),
}));
