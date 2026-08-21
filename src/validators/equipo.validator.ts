/**
 * src/validators/equipo.validator.ts
 * Schemas de validación Zod para el módulo de equipos.
 */
import { z } from 'zod';

export const createEquipoSchema = z
  .object({
    tipoEquipoId: z.number({ message: 'tipoEquipoId es requerido' }).int().positive(),
    nombre: z.string({ message: 'nombre es requerido' }).min(1).max(150),
    marca: z.string().max(100).optional(),
    modelo: z.string().max(100).optional(),
    numeroSerie: z.string().max(100).optional(),
    sucursalId: z.number({ message: 'sucursalId es requerido' }).int().positive(),
    ubicacionId: z.number({ message: 'ubicacionId es requerido' }).int().positive(),
    // Fase 2 (2026-08-06): text, no integer — usuario.id apunta a futuro a
    // user.id de Better Auth (nanoid). Ver equipo.schema.ts.
    responsableId: z.string().min(1).optional(),
    fechaAdquisicion: z.string().date().optional(),
    // Fase 4 (2026-08-07): si se envía con valor al crear, equipo.service.ts
    // createEquipo fuerza estado='dado_de_baja' en el mismo insert (regla de
    // negocio — un equipo no puede nacer con fecha de baja y quedar 'activo').
    fechaBaja: z.string().date().optional(),
    // QA demo (2026-08-05): equipos.observaciones existe en DB pero nunca se
    // aceptaba en el validator ni se escribía en el service — se perdía en
    // silencio en cada create/update. Ver equipo.service.ts createEquipo/updateEquipo.
    observaciones: z.string().optional(),
    // Fase 5 (2026-08-07): purgados capacidad/unidadId/resolucion/
    // dimensionTamano/caracteristicaTecnica. Precisión y Rango de Medición
    // quedan cada uno con su propio selector de unidad (FK a unidades_medida).
    precisionEquipo: z.string().max(50).optional(),
    unidadPrecisionId: z.number().int().positive().optional(),
    rangoMedicion: z.string().max(100).optional(),
    unidadRangoId: z.number().int().positive().optional(),
    disponibleOt: z.boolean().optional(),
    usoObra: z.boolean().optional(),
    usoLaboratorio: z.boolean().optional(),
    permiteUsoSimultaneo: z.boolean().optional(),
    requiereReserva: z.boolean().optional(),
    requiereCalibracion: z.boolean().default(false),
    requiereVerificacion: z.boolean().default(false),
    requiereMantenimiento: z.boolean().default(false),
    frecuenciaCalibracionMeses: z.number().int().positive().optional(),
    frecuenciaVerificacionMeses: z.number().int().positive().optional(),
    frecuenciaMantenimientoMeses: z.number().int().positive().optional(),
    // Fase 3: días de aviso antes del vencimiento (en días, no meses).
    diasAvisoCalibracion: z.number().int().positive().optional(),
    diasAvisoVerificacion: z.number().int().positive().optional(),
    diasAvisoMantenimiento: z.number().int().positive().optional(),

    // Registro inicial opcional de Calibración/Verificación/Mantenimiento,
    // insertado en la misma transacción que el equipo (equipo.service.ts
    // createEquipo). Mismos campos que createCalibracionSchema/
    // createVerificacionSchema/createMantenimientoSchema más abajo.
    // Corrección (2026-08-07, confirmado contra captura real del mockup):
    // `estadoIngreso` en Calibración/Verificación SÍ es un selector manual del
    // formulario (aprobado/en_proceso) — no un valor fijo ni un estado
    // calculado. Mantenimiento sigue sin `tipo`/`estadoIngreso` propios (no
    // están en el mockup), default 'preventivo'/'operativo'.
    // UAT post-demo (2026-08-07): laboratorioCalibradorId/procedimientoId (FK)
    // → laboratorioCalibrador/procedimiento (texto libre), pedido de Noelia.
    // Sin confirmar si deben ser obligatorios — quedan optional, ver resumen
    // de la sesión.
    calibracionInicial: z
      .object({
        fechaCalibracion: z.string().date(),
        laboratorioCalibrador: z.string().optional(),
        procedimiento: z.string().optional(),
        nCertificado: z.string().max(100).optional(),
        estadoIngreso: z.enum(['aprobado', 'en_proceso']).default('aprobado'),
      })
      .optional(),
    verificacionInicial: z
      .object({
        fechaVerificacion: z.string().date(),
        responsableId: z.string().min(1).optional(),
        procedimiento: z.string().optional(),
        nRegistro: z.string().max(100).optional(),
        estadoIngreso: z.enum(['aprobado', 'en_proceso']).default('aprobado'),
      })
      .optional(),
    // Corrección (2026-08-07): el mockup real no tiene `tipo` (preventivo/
    // correctivo) como campo separado — sigue sin selector, default
    // 'preventivo'. Sí tiene un único selector "Estado Mantenimiento" con estos
    // 4 valores (mismo enum que createMantenimientoSchema.estadoIngreso, único
    // campo entre los 3 registros iniciales que no comparte vocabulario
    // aprobado/en_proceso con Calibración/Verificación).
    mantenimientoInicial: z
      .object({
        fechaMantenimiento: z.string().date(),
        responsableId: z.string().min(1).optional(),
        estadoIngreso: z
          .enum(['operativo', 'en_mantenimiento', 'fuera_de_servicio', 'dado_de_baja'])
          .default('operativo'),
        descripcion: z.string().optional(),
      })
      .optional(),
  })
  .refine((d) => !d.requiereCalibracion || d.frecuenciaCalibracionMeses !== undefined, {
    message: 'frecuenciaCalibracionMeses es obligatorio cuando requiereCalibracion es true',
    path: ['frecuenciaCalibracionMeses'],
  })
  .refine((d) => !d.requiereVerificacion || d.frecuenciaVerificacionMeses !== undefined, {
    message: 'frecuenciaVerificacionMeses es obligatorio cuando requiereVerificacion es true',
    path: ['frecuenciaVerificacionMeses'],
  })
  .refine((d) => !d.requiereMantenimiento || d.frecuenciaMantenimientoMeses !== undefined, {
    message: 'frecuenciaMantenimientoMeses es obligatorio cuando requiereMantenimiento es true',
    path: ['frecuenciaMantenimientoMeses'],
  })
  .refine((d) => !d.requiereCalibracion || d.diasAvisoCalibracion !== undefined, {
    message: 'diasAvisoCalibracion es obligatorio cuando requiereCalibracion es true',
    path: ['diasAvisoCalibracion'],
  })
  .refine((d) => !d.requiereVerificacion || d.diasAvisoVerificacion !== undefined, {
    message: 'diasAvisoVerificacion es obligatorio cuando requiereVerificacion es true',
    path: ['diasAvisoVerificacion'],
  })
  .refine((d) => !d.requiereMantenimiento || d.diasAvisoMantenimiento !== undefined, {
    message: 'diasAvisoMantenimiento es obligatorio cuando requiereMantenimiento es true',
    path: ['diasAvisoMantenimiento'],
  });

export type CreateEquipoSchemaInput = z.infer<typeof createEquipoSchema>;

export const updateEquipoSchema = createEquipoSchema;
export type UpdateEquipoSchemaInput = z.infer<typeof updateEquipoSchema>;

export const deactivateEquipoSchema = z.object({
  motivo: z.string().min(1).max(500).optional().default('Baja desde API'),
});
export type DeactivateEquipoSchemaInput = z.infer<typeof deactivateEquipoSchema>;

export const listEquiposQuerySchema = z.object({
  tipoEquipoId: z.coerce.number().int().positive().optional(),
  sucursalId: z.coerce.number().int().positive().optional(),
  ubicacionId: z.coerce.number().int().positive().optional(),
  // Fase 3: activo/inactivo/dado_de_baja son los únicos valores calculados posibles.
  estado: z.enum(['activo', 'inactivo', 'dado_de_baja']).optional(),
  // Filtro combinado de estados por categoría (2026-08-07) — mismo vocabulario
  // que calcCalVerEstado/calcMantenimientoEstado en equipo.service.ts. Se
  // excluye 'sin_registro' (estado interno, no aparece en el dropdown) y, para
  // Mantenimiento, 'dado_de_baja' (ese caso ya lo cubre el filtro `estado`
  // general por regla de negocio — no se duplica acá).
  estadoCalibracion: z
    .enum(['vigente', 'proxima_a_vencer', 'vencida', 'en_calibracion', 'no_aplica'])
    .optional(),
  estadoVerificacion: z
    .enum(['vigente', 'proxima_a_vencer', 'vencida', 'en_verificacion', 'no_aplica'])
    .optional(),
  estadoMantenimiento: z
    .enum(['operativo', 'en_mantenimiento', 'fuera_de_servicio', 'no_aplica'])
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListEquiposQueryInput = z.infer<typeof listEquiposQuerySchema>;

// UAT post-demo (2026-08-07): laboratorioCalibradorId/procedimientoId (FK)
// → laboratorioCalibrador/procedimiento (texto libre), pedido de Noelia.
// Sin confirmar si deben ser obligatorios — quedan optional, ver resumen
// de la sesión.
export const createCalibracionSchema = z.object({
  fechaCalibracion: z.string({ message: 'fechaCalibracion es requerida' }).date(),
  laboratorioCalibrador: z.string().optional(),
  procedimiento: z.string().optional(),
  nCertificado: z.string().max(100).optional(),
  estadoIngreso: z.enum(['aprobado', 'en_proceso']).default('aprobado'),
  // Fase 2 (2026-08-06): text, no integer — ver createEquipoSchema.responsableId.
  registradoPorId: z.string().min(1).optional(),
  observaciones: z.string().optional(),
});
export type CreateCalibracionSchemaInput = z.infer<typeof createCalibracionSchema>;

export const createVerificacionSchema = z.object({
  fechaVerificacion: z.string({ message: 'fechaVerificacion es requerida' }).date(),
  responsableId: z.string().min(1).optional(),
  metodo: z.string().max(150).optional(),
  procedimiento: z.string().optional(),
  nRegistro: z.string().max(100).optional(),
  estadoIngreso: z.enum(['aprobado', 'en_proceso']).default('aprobado'),
});
export type CreateVerificacionSchemaInput = z.infer<typeof createVerificacionSchema>;

export const createMantenimientoSchema = z.object({
  fechaMantenimiento: z.string({ message: 'fechaMantenimiento es requerida' }).date(),
  tipo: z.enum(['preventivo', 'correctivo']).default('preventivo'),
  estadoIngreso: z
    .enum(['operativo', 'en_mantenimiento', 'dado_de_baja', 'fuera_de_servicio'])
    .default('operativo'),
  responsableId: z.string().min(1).optional(),
  descripcion: z.string().optional(),
});
export type CreateMantenimientoSchemaInput = z.infer<typeof createMantenimientoSchema>;

export const associateTipoEnsayoSchema = z.object({
  tipoEnsayoId: z.number({ message: 'tipoEnsayoId es requerido' }).int().positive(),
});
export type AssociateTipoEnsayoSchemaInput = z.infer<typeof associateTipoEnsayoSchema>;
