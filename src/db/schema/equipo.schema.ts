/**
 * src/db/schema/equipo.schema.ts
 * Schema del dominio de gestión de equipos (Mantenedores/Laboratorio).
 * Nombres de tabla en PLURAL para compatibilidad con init.sql existente.
 */
import {
  pgTable,
  bigserial,
  serial,
  varchar,
  text,
  integer,
  boolean,
  date,
  timestamp,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import {
  estadoEquipoEnum,
  estadoIngresoCalVerEnum,
  estadoIngresoMantenimientoEnum,
  tipoMantenimientoEnum,
} from './enums.js';
import { tipoEnsayo } from './catalog.schema.js';
import { user } from './auth.schema.js';

// ─── Catálogos ────────────────────────────────────────────────

/**
 * Catálogo de empresas (nivel superior de la jerarquía
 * empresa → sucursal → ubicación). Soft-delete vía `activo`
 * (Bloque 2 alineación arquitectónica, 2026-08-05) — antes solo
 * permitía hard-delete implícito, inconsistente con `grupos`.
 */
export const empresa = pgTable(
  'empresas',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    nombre: varchar('nombre', { length: 150 }).notNull(),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('empresas_nombre_unique').on(t.nombre)],
);

/** Sucursales de una empresa. Único por (empresaId, nombre) — mismo nombre puede repetirse entre empresas distintas. */
export const sucursal = pgTable(
  'sucursales',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    empresaId: bigserial('empresa_id', { mode: 'number' })
      .notNull()
      .references(() => empresa.id, { onDelete: 'restrict' }),
    nombre: varchar('nombre', { length: 150 }).notNull(),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('sucursales_empresa_id_nombre_unique').on(t.empresaId, t.nombre),
    index('sucursales_empresa_id_idx').on(t.empresaId),
  ],
);

/** Ubicaciones físicas dentro de una sucursal (ej. Bodega, Laboratorio, Terreno). */
export const ubicacion = pgTable(
  'ubicaciones',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    sucursalId: bigserial('sucursal_id', { mode: 'number' })
      .notNull()
      .references(() => sucursal.id, { onDelete: 'restrict' }),
    nombre: varchar('nombre', { length: 100 }).notNull(),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('ubicaciones_sucursal_id_nombre_unique').on(t.sucursalId, t.nombre),
    index('ubicaciones_sucursal_id_idx').on(t.sucursalId),
  ],
);

/**
 * Agrupación superior a Tipo de Equipo (Fix #4, Fase 1 — cerrada 2026-08-04).
 * 26 grupos reales extraídos de levantamiento_servicios.md. Ver seed_fase1_tipos_equipo.ts
 * para el detalle de resolución de tipos duplicados cross-grupo.
 */
export const grupo = pgTable('grupos', {
  id: serial('id').primaryKey(),
  nombre: varchar('nombre', { length: 100 }).notNull().unique(),
  activo: boolean('activo').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Tipos de equipo, cada uno con un grupo asignado (Fase 1, `grupoId` NOT NULL desde el cierre). */
export const tipoEquipo = pgTable(
  'tipos_equipo',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    nombre: varchar('nombre', { length: 100 }).notNull(),
    // Nullable desde Fase 1B: el código ya no se arma con prefijo (BAL-001) sino
    // con un correlativo numérico global (equipos_codigo_seq). Se conserva la
    // columna para no perder el dato de los tipos que ya lo tenían.
    prefijoCodigo: varchar('prefijo_codigo', { length: 10 }),
    // NOT NULL desde el cierre de Fase 1 (2026-08-04) — todos los tipos existentes
    // y nuevos quedaron con grupo asignado vía seed_fase1_tipos_equipo.ts.
    grupoId: integer('grupo_id')
      .notNull()
      .references(() => grupo.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('tipos_equipo_nombre_unique').on(t.nombre),
    unique('tipos_equipo_prefijo_codigo_unique').on(t.prefijoCodigo),
    index('tipos_equipo_grupo_id_idx').on(t.grupoId),
  ],
);

/** Laboratorios externos que emiten certificados de calibración. */
export const laboratorioCalibrador = pgTable(
  'laboratorios_calibradores',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    nombre: varchar('nombre', { length: 150 }).notNull(),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('laboratorios_calibradores_nombre_unique').on(t.nombre)],
);

/** Procedimientos de calibración/verificación (ej. normas o instructivos internos referenciados por código). */
export const procedimientoEquipo = pgTable(
  'procedimientos',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    codigo: varchar('codigo', { length: 50 }).notNull(),
    descripcion: varchar('descripcion', { length: 255 }),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('procedimientos_codigo_unique').on(t.codigo)],
);

// ─── Tabla maestra: equipos ────────────────────────────────────
// Fase 6 (2026-08-22): la tabla local `usuarios` (arriba, ahora eliminada)
// se sacó del medio — era un segundo catálogo de personas en paralelo al
// `user` real de Better Auth, y causaba 404 al guardar equipos porque el
// id de sesión real (nanoid de Better Auth) nunca existía en esa tabla
// local. Las 4 FKs de responsable/registrador de este archivo ahora
// apuntan directo a `user.id` (Better Auth) — ver comentario Fase 2
// original que ya documentaba esta intención (`user.id` como "identificador
// canónico de usuario en Eventech") pero nunca se ejecutó.

/**
 * Tabla maestra de equipos de laboratorio. `estado` deja de ser editable
 * directamente desde Fase 3 (Fix #7) — Activo/Inactivo se calculan siempre al
 * vuelo (ver `calcEstadoGeneral` en equipo.service.ts); solo `dado_de_baja` es
 * un valor real persistido (vía `DELETE /api/equipos/:id`).
 */
export const equipo = pgTable(
  'equipos',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    codigo: varchar('codigo', { length: 50 }),

    tipoEquipoId: bigserial('tipo_equipo_id', { mode: 'number' })
      .notNull()
      .references(() => tipoEquipo.id, { onDelete: 'restrict' }),
    nombre: varchar('nombre', { length: 150 }).notNull(),
    marca: varchar('marca', { length: 100 }),
    modelo: varchar('modelo', { length: 100 }),
    numeroSerie: varchar('numero_serie', { length: 100 }),

    empresaId: bigserial('empresa_id', { mode: 'number' })
      .notNull()
      .references(() => empresa.id, { onDelete: 'restrict' }),
    sucursalId: bigserial('sucursal_id', { mode: 'number' })
      .notNull()
      .references(() => sucursal.id, { onDelete: 'restrict' }),
    ubicacionId: bigserial('ubicacion_id', { mode: 'number' })
      .notNull()
      .references(() => ubicacion.id, { onDelete: 'restrict' }),

    estado: estadoEquipoEnum('estado').notNull().default('activo'),

    // TEXT desde Fase 2 (2026-08-06) — Fase 6 (2026-08-22): FK repunteada a
    // `user.id` (Better Auth) en vez de la tabla local `usuarios` (eliminada).
    responsableId: text('responsable_id').references(() => user.id, { onDelete: 'set null' }),

    fechaAdquisicion: date('fecha_adquisicion'),
    fechaBaja: date('fecha_baja'),
    motivoBaja: text('motivo_baja'),
    observaciones: text('observaciones'),

    // Características técnicas — Fase 5 (2026-08-07): purgados capacidad,
    // unidad_id (genérico), resolucion, dimension_tamano, caracteristica_tecnica.
    // Quedan únicamente Precisión y Rango de Medición, cada uno con su propio
    // selector de unidad (antes compartían el único unidad_id genérico ligado
    // a capacidad).
    precisionEquipo: varchar('precision_equipo', { length: 50 }),
    unidadPrecisionId: integer('unidad_precision_id').references(() => unidadMedida.id, {
      onDelete: 'restrict',
    }),
    rangoMedicion: varchar('rango_medicion', { length: 100 }),
    unidadRangoId: integer('unidad_rango_id').references(() => unidadMedida.id, {
      onDelete: 'restrict',
    }),

    // Configuración OT
    disponibleOt: boolean('disponible_ot').notNull().default(true),
    usoObra: boolean('uso_obra').notNull().default(false),
    usoLaboratorio: boolean('uso_laboratorio').notNull().default(false),
    permiteUsoSimultaneo: boolean('permite_uso_simultaneo').notNull().default(false),
    requiereReserva: boolean('requiere_reserva').notNull().default(false),

    // Flags de control
    requiereCalibracion: boolean('requiere_calibracion').notNull().default(false),
    requiereVerificacion: boolean('requiere_verificacion').notNull().default(false),
    requiereMantenimiento: boolean('requiere_mantenimiento').notNull().default(false),

    // Frecuencias
    frecuenciaCalibracionMeses: integer('frecuencia_calibracion_meses'),
    frecuenciaVerificacionMeses: integer('frecuencia_verificacion_meses'),
    frecuenciaMantenimientoMeses: integer('frecuencia_mantenimiento_meses'),

    // Fase 3: días de aviso antes del vencimiento (en DÍAS, no meses). Obligatorio
    // a nivel de aplicación (Zod) cuando el requiereX correspondiente es true —
    // reemplaza el umbral fijo de 30 días. fecha_aviso = proxima_fecha - dias_aviso,
    // se calcula y persiste en cada historial al registrarlo (ver equipo.service.ts).
    diasAvisoCalibracion: integer('dias_aviso_calibracion'),
    diasAvisoVerificacion: integer('dias_aviso_verificacion'),
    diasAvisoMantenimiento: integer('dias_aviso_mantenimiento'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('equipos_codigo_unique').on(t.codigo),
    index('equipos_tipo_equipo_id_idx').on(t.tipoEquipoId),
    index('equipos_sucursal_id_idx').on(t.sucursalId),
    index('equipos_ubicacion_id_idx').on(t.ubicacionId),
    index('equipos_estado_idx').on(t.estado),
    index('equipos_responsable_id_idx').on(t.responsableId),
    index('equipos_unidad_precision_id_idx').on(t.unidadPrecisionId),
    index('equipos_unidad_rango_id_idx').on(t.unidadRangoId),
  ],
);

// ─── N:M equipos ↔ tipos ensayo ────────────────────────────────

/** Asociación N:M entre equipo y tipo de ensayo (configuración OT). */
export const equipoTipoEnsayo = pgTable(
  'equipo_tipos_ensayo',
  {
    equipoId: bigserial('equipo_id', { mode: 'number' })
      .notNull()
      .references(() => equipo.id, { onDelete: 'cascade' }),
    tipoEnsayoId: bigserial('tipo_ensayo_id', { mode: 'number' })
      .notNull()
      .references(() => tipoEnsayo.id, { onDelete: 'restrict' }),
  },
  (t) => [unique().on(t.equipoId, t.tipoEnsayoId)],
);

// ─── Historiales (append-only) ─────────────────────────────────

/**
 * Historial de calibraciones — append-only, nunca se actualiza ni borra un
 * registro existente (ver Bloque 3 del plan de alineación: insert-only, nunca
 * upsert). `estadoIngreso` reemplaza el antiguo `resultado` (Fix #7, Fase 3).
 */
export const historialCalibracion = pgTable(
  'historial_calibraciones',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    equipoId: bigserial('equipo_id', { mode: 'number' })
      .notNull()
      .references(() => equipo.id, { onDelete: 'cascade' }),
    fechaCalibracion: date('fecha_calibracion').notNull(),
    proximaCalibracion: date('proxima_calibracion').notNull(),
    // UAT post-demo (2026-08-07): laboratorioCalibradorId/procedimientoId
    // (FK) → texto libre, pedido de Noelia. No se perdió ningún valor ya
    // cargado, resuelto contra el catálogo antes de eliminar la FK (ver
    // historial paso a paso archivado en drizzle-mantenedores/, migraciones
    // 0010/0011 originales de Mantenedores).
    laboratorioCalibrador: text('laboratorio_calibrador'),
    procedimiento: text('procedimiento'),
    nCertificado: varchar('n_certificado', { length: 100 }),
    documentoUrl: varchar('documento_url', { length: 500 }),
    // Fase 3: reemplaza resultado (conforme/no_conforme/observado). Es el "estado
    // de ingreso" manual — el estado calculado (vigente/vencida/...) no se persiste.
    estadoIngreso: estadoIngresoCalVerEnum('estado_ingreso').notNull().default('aprobado'),
    // Calculado = proximaCalibracion - equipo.diasAvisoCalibracion. Nullable porque
    // los registros previos a Fase 3 no tienen diasAvisoCalibracion configurado.
    fechaAviso: date('fecha_aviso'),
    // Fase 6 (2026-08-22): FK repunteada a `user.id` (Better Auth), ver nota arriba.
    registradoPorId: text('registrado_por_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    observaciones: text('observaciones'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('historial_calibraciones_n_certificado_unique').on(t.nCertificado),
    index('historial_calibraciones_equipo_id_idx').on(t.equipoId),
    index('historial_calibraciones_proxima_calibracion_idx').on(t.proximaCalibracion),
  ],
);

/** Historial de verificaciones — mismo patrón append-only que historialCalibracion. */
export const historialVerificacion = pgTable(
  'historial_verificaciones',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    equipoId: bigserial('equipo_id', { mode: 'number' })
      .notNull()
      .references(() => equipo.id, { onDelete: 'cascade' }),
    fechaVerificacion: date('fecha_verificacion').notNull(),
    proximaVerificacion: date('proxima_verificacion').notNull(),
    // Fase 6 (2026-08-22): FK repunteada a `user.id` (Better Auth), ver nota arriba.
    responsableId: text('responsable_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    metodo: varchar('metodo', { length: 150 }),
    // UAT post-demo (2026-08-07): mismo criterio que historialCalibracion.procedimiento arriba.
    procedimiento: text('procedimiento'),
    nRegistro: varchar('n_registro', { length: 100 }),
    documentoUrl: varchar('documento_url', { length: 500 }),
    // Fase 3 (fusión, hallazgo 3): la columna ya existía en la base real desde
    // init.sql — quedó afuera de este schema.ts por un olvido al escribirlo,
    // sin que nadie la borrara de Postgres. Lectura/escritura completa desde
    // la app queda pendiente de decisión (falta el campo en el validador Zod
    // y su mapeo en el service — ver INTEGRACION-NATIVA-RESUMEN.md).
    observaciones: text('observaciones'),
    estadoIngreso: estadoIngresoCalVerEnum('estado_ingreso').notNull().default('aprobado'),
    fechaAviso: date('fecha_aviso'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('historial_verificaciones_n_registro_unique').on(t.nRegistro),
    index('historial_verificaciones_equipo_id_idx').on(t.equipoId),
    index('historial_verificaciones_proxima_verificacion_idx').on(t.proximaVerificacion),
  ],
);

/**
 * Historial de mantenimientos — mismo patrón append-only. A diferencia de
 * Calibración/Verificación, `estadoIngreso` ES el estado calculado de
 * Mantenimiento directamente (sin lógica de fechas, decisión 2026-08-04).
 */
export const historialMantenimiento = pgTable(
  'historial_mantenimientos',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    equipoId: bigserial('equipo_id', { mode: 'number' })
      .notNull()
      .references(() => equipo.id, { onDelete: 'cascade' }),
    fechaMantenimiento: date('fecha_mantenimiento').notNull(),
    proximoMantenimiento: date('proximo_mantenimiento'),
    tipo: tipoMantenimientoEnum('tipo').notNull().default('preventivo'),
    // Fase 3: nuevo — a diferencia de Calibración/Verificación, este ES el estado
    // calculado de Mantenimiento (no hay lógica de fechas, ver equipo.service.ts).
    estadoIngreso: estadoIngresoMantenimientoEnum('estado_ingreso').notNull().default('operativo'),
    // Informativo por ahora (no participa del cálculo de estado de Mantenimiento,
    // decisión 2026-08-04) — calculado = proximoMantenimiento - equipo.diasAvisoMantenimiento.
    fechaAviso: date('fecha_aviso'),
    // Fase 6 (2026-08-22): FK repunteada a `user.id` (Better Auth), ver nota arriba.
    responsableId: text('responsable_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    documentoUrl: varchar('documento_url', { length: 500 }),
    observaciones: text('observaciones'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('historial_mantenimientos_equipo_id_idx').on(t.equipoId),
    index('historial_mantenimientos_proximo_mantenimiento_idx').on(t.proximoMantenimiento),
  ],
);

// ─── Unidades de medida ────────────────────────────────────────

/** Catálogo de unidades de medida (Fix #1) — soft-delete vía `activo` agregado en Bloque 2. */
export const unidadMedida = pgTable(
  'unidades_medida',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    nombre: varchar('nombre', { length: 50 }).notNull(),
    simbolo: varchar('simbolo', { length: 10 }).notNull(),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('unidades_medida_nombre_unique').on(t.nombre)],
);

// ─── Tipos inferidos ───────────────────────────────────────────

export type Empresa = typeof empresa.$inferSelect;
export type NuevaEmpresa = typeof empresa.$inferInsert;
export type Sucursal = typeof sucursal.$inferSelect;
export type Ubicacion = typeof ubicacion.$inferSelect;
export type Grupo = typeof grupo.$inferSelect;
export type NuevoGrupo = typeof grupo.$inferInsert;
export type TipoEquipo = typeof tipoEquipo.$inferSelect;
export type LaboratorioCalibrador = typeof laboratorioCalibrador.$inferSelect;
export type ProcedimientoEquipo = typeof procedimientoEquipo.$inferSelect;
export type Equipo = typeof equipo.$inferSelect;
export type NuevoEquipo = typeof equipo.$inferInsert;
export type HistorialCalibracion = typeof historialCalibracion.$inferSelect;
export type NuevaCalibracion = typeof historialCalibracion.$inferInsert;
export type HistorialVerificacion = typeof historialVerificacion.$inferSelect;
export type NuevaVerificacion = typeof historialVerificacion.$inferInsert;
export type HistorialMantenimiento = typeof historialMantenimiento.$inferSelect;
export type NuevoMantenimiento = typeof historialMantenimiento.$inferInsert;
export type UnidadMedida = typeof unidadMedida.$inferSelect;
export type NewUnidadMedida = typeof unidadMedida.$inferInsert;
