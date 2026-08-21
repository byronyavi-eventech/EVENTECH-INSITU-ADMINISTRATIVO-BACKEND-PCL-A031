/**
 * src/services/equipo.service.ts
 *
 * Domain service for managing laboratory equipment, calibration/verification/maintenance
 * histories, test type associations, and health dashboard indicators.
 *
 * Design decisions:
 * - Employs AppError for domain validation and resource existence errors.
 * - Utilizes db.transaction for operations modifying related records or code generation.
 * - Employs pino logger for structured logging of operational flows.
 *
 * Bloque 3 (alineación arquitectónica, 2026-08-05) — auditado contra el patrón real
 * del Core, sin cambios de comportamiento necesarios:
 * - `createEquipo` es la única operación multi-paso relacionada (secuencia + insert)
 *   y ya corre dentro de `db.transaction`; el resto de las funciones son un único
 *   INSERT/UPDATE de una sola tabla, atómico por definición, sin necesitar wrapper.
 * - Los 3 historiales (calibración/verificación/mantenimiento) son estrictamente
 *   insert-only, nunca upsert — los catálogos de referencia usan `onConflictDoNothing()`
 *   solo en los seeds (`seed_grupos.ts`, `seed_unidades.ts`, `seed_fase1_tipos_equipo.ts`).
 * - `getPgErrorCode()` ya captura el código Postgres real vía `err.code ?? err.cause.code`
 *   (drizzle-orm envuelve el error de pg) — mismo patrón que usa el Core.
 */
import { eq, and, ne, desc, count, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  equipo,
  tipoEquipo,
  empresa,
  sucursal,
  ubicacion,
  grupo,
  historialCalibracion,
  historialVerificacion,
  historialMantenimiento,
  equipoTipoEnsayo,
  tipoEnsayo,
  unidadMedida,
  usuario,
  type NuevoEquipo,
} from '../db/schema/index.js';
import { AppError } from '../utils/app-error.js';
import { logger } from '../utils/logger.js';
import { saveUploadedFile } from '../utils/file-storage.js';
import type {
  CreateEquipoSchemaInput,
  UpdateEquipoSchemaInput,
  ListEquiposQueryInput,
  CreateCalibracionSchemaInput,
  CreateVerificacionSchemaInput,
  CreateMantenimientoSchemaInput,
} from '../validators/equipo.validator.js';

const EMPRESA_ID_DEFAULT = 1;

// ─── Fase 3: cálculo de estados (nada de esto se persiste, salvo dado_de_baja) ──

type EstadoControlCalVer =
  | 'vigente'
  | 'proxima_a_vencer'
  | 'vencida'
  | 'en_calibracion'
  | 'en_verificacion'
  | 'no_aplica'
  | 'sin_registro';
type EstadoMantenimiento =
  | 'operativo'
  | 'en_mantenimiento'
  | 'fuera_de_servicio'
  | 'dado_de_baja'
  | 'no_aplica'
  | 'sin_registro';
type EstadoGeneral = 'activo' | 'inactivo' | 'dado_de_baja';

interface LatestCalVer {
  estadoIngreso: 'aprobado' | 'en_proceso';
  proxima: string;
  fechaAviso: string | null;
}
interface LatestMan {
  estadoIngreso: 'operativo' | 'en_mantenimiento' | 'dado_de_baja' | 'fuera_de_servicio';
}

/**
 * Calcula el estado de Calibración/Verificación. "en_proceso" (estado de ingreso
 * manual) gana sobre cualquier fecha. fechaAviso puede ser null en registros
 * previos a Fase 3 (equipo sin diasAviso configurado en ese momento) — en ese
 * caso se omite el sub-estado "proxima_a_vencer" y solo se distingue vigente/vencida.
 */
function calcCalVerEstado(
  requiere: boolean,
  latest: LatestCalVer | undefined,
  hoy: string,
  enProcesoLabel: 'en_calibracion' | 'en_verificacion',
): EstadoControlCalVer {
  if (!requiere) return 'no_aplica';
  if (!latest) return 'sin_registro';
  if (latest.estadoIngreso === 'en_proceso') return enProcesoLabel;
  if (latest.proxima < hoy) return 'vencida';
  if (latest.fechaAviso != null && latest.fechaAviso <= hoy) return 'proxima_a_vencer';
  return 'vigente';
}

/**
 * Mantenimiento no usa lógica de fechas (decisión 2026-08-04): el estado
 * calculado ES el estado_ingreso del último registro, tal cual.
 */
function calcMantenimientoEstado(
  requiere: boolean,
  latest: LatestMan | undefined,
): EstadoMantenimiento {
  if (!requiere) return 'no_aplica';
  if (!latest) return 'sin_registro';
  return latest.estadoIngreso;
}

/**
 * Estado General del Equipo. dado_de_baja tiene prioridad absoluta (vía baja
 * lógica explícita en equipos.estado, o vía un mantenimiento con estado_ingreso
 * dado_de_baja). "sin_registro" se trata como Inactivo: un control obligatorio
 * sin ningún historial registrado no puede considerarse Activo.
 */
function calcEstadoGeneral(
  estadoStored: string,
  estadoCal: EstadoControlCalVer,
  estadoVer: EstadoControlCalVer,
  estadoMan: EstadoMantenimiento,
): EstadoGeneral {
  if (estadoStored === 'dado_de_baja' || estadoMan === 'dado_de_baja') return 'dado_de_baja';
  const okCal =
    estadoCal === 'vigente' || estadoCal === 'proxima_a_vencer' || estadoCal === 'no_aplica';
  const okVer =
    estadoVer === 'vigente' || estadoVer === 'proxima_a_vencer' || estadoVer === 'no_aplica';
  const okMan = estadoMan === 'operativo' || estadoMan === 'no_aplica';
  return okCal && okVer && okMan ? 'activo' : 'inactivo';
}

/** Trae el último registro de cada historial para un lote de equipos (batch, evita N+1). */
async function getLatestHistorialMaps(ids: number[]) {
  if (ids.length === 0) {
    return {
      cal: new Map<number, LatestCalVer>(),
      ver: new Map<number, LatestCalVer>(),
      man: new Map<number, LatestMan>(),
    };
  }

  const calibraciones = await db
    .select({
      equipoId: historialCalibracion.equipoId,
      proxima: historialCalibracion.proximaCalibracion,
      fechaAviso: historialCalibracion.fechaAviso,
      estadoIngreso: historialCalibracion.estadoIngreso,
    })
    .from(historialCalibracion)
    .where(inArray(historialCalibracion.equipoId, ids))
    .orderBy(desc(historialCalibracion.fechaCalibracion));

  const verificaciones = await db
    .select({
      equipoId: historialVerificacion.equipoId,
      proxima: historialVerificacion.proximaVerificacion,
      fechaAviso: historialVerificacion.fechaAviso,
      estadoIngreso: historialVerificacion.estadoIngreso,
    })
    .from(historialVerificacion)
    .where(inArray(historialVerificacion.equipoId, ids))
    .orderBy(desc(historialVerificacion.fechaVerificacion));

  const mantenimientos = await db
    .select({
      equipoId: historialMantenimiento.equipoId,
      estadoIngreso: historialMantenimiento.estadoIngreso,
    })
    .from(historialMantenimiento)
    .where(inArray(historialMantenimiento.equipoId, ids))
    .orderBy(desc(historialMantenimiento.fechaMantenimiento));

  const cal = new Map<number, LatestCalVer>();
  for (const r of calibraciones) if (!cal.has(r.equipoId)) cal.set(r.equipoId, r);

  const ver = new Map<number, LatestCalVer>();
  for (const r of verificaciones) if (!ver.has(r.equipoId)) ver.set(r.equipoId, r);

  const man = new Map<number, LatestMan>();
  for (const r of mantenimientos) if (!man.has(r.equipoId)) man.set(r.equipoId, r);

  return { cal, ver, man };
}

// ─── QA Audit (2026-08-04): validación de existencia de FK ──────────────────
// tipoEquipoId ya se validaba explícitamente (404 legible) antes de insertar;
// el resto de las FKs (sucursalId, ubicacionId, unidadPrecisionId,
// unidadRangoId, responsableId, tipoEnsayoId) dependían de que
// Postgres rechazara el insert por violación de FK — un error no controlado
// que el error.middleware reenviaba con la query SQL completa al cliente
// (información sensible) antes de este fix. Estas funciones cierran esa
// asimetría con el mismo patrón que ya usaba tipoEquipoId.
// assertLaboratorioExists/assertProcedimientoExists se eliminaron en el UAT
// post-demo (2026-08-07): laboratorioCalibrador/procedimiento pasaron a
// texto libre, ya no hay FK que validar contra su catálogo.
async function assertSucursalExists(id: number): Promise<void> {
  const [row] = await db
    .select({ id: sucursal.id })
    .from(sucursal)
    .where(eq(sucursal.id, id))
    .limit(1);
  if (!row) throw new AppError(`Sucursal con id ${id} no encontrada.`, 404);
}
async function assertUbicacionExists(id: number): Promise<void> {
  const [row] = await db
    .select({ id: ubicacion.id })
    .from(ubicacion)
    .where(eq(ubicacion.id, id))
    .limit(1);
  if (!row) throw new AppError(`Ubicación con id ${id} no encontrada.`, 404);
}
async function assertUnidadExists(id: number): Promise<void> {
  const [row] = await db
    .select({ id: unidadMedida.id })
    .from(unidadMedida)
    .where(eq(unidadMedida.id, id))
    .limit(1);
  if (!row) throw new AppError(`Unidad de medida con id ${id} no encontrada.`, 404);
}
// Fase 2 (2026-08-06): id es text (usuario.id ya no es serial — ver
// equipo.schema.ts).
async function assertUsuarioExists(id: string): Promise<void> {
  const [row] = await db
    .select({ id: usuario.id })
    .from(usuario)
    .where(eq(usuario.id, id))
    .limit(1);
  if (!row)
    throw new AppError(`Usuario (responsable/registrador) con id ${id} no encontrado.`, 404);
}
async function assertTipoEnsayoExists(id: number): Promise<void> {
  const [row] = await db
    .select({ id: tipoEnsayo.id })
    .from(tipoEnsayo)
    .where(eq(tipoEnsayo.id, id))
    .limit(1);
  if (!row) throw new AppError(`Tipo de ensayo con id ${id} no encontrado.`, 404);
}

/**
 * QA Audit (2026-08-04) — bug encontrado durante la auditoría (preexistente,
 * no introducido en esta sesión): drizzle-orm 0.45 envuelve los errores de
 * pg en un DrizzleQueryError; el código SQLSTATE real (ej. '23505') queda en
 * `err.cause.code`, no en `err.code`. Los catch de `err.code === '23505'` en
 * createCalibracion/createVerificacion nunca funcionaron — no había ningún
 * test que registrara un duplicado real para detectarlo. Confirmado
 * empíricamente contra la DB antes de corregir.
 */
function getPgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code ?? e?.cause?.code;
}

export type CreateEquipoInput = CreateEquipoSchemaInput;
export type UpdateEquipoInput = UpdateEquipoSchemaInput;
export type ListEquiposInput = ListEquiposQueryInput;
export type CreateCalibracionInput = CreateCalibracionSchemaInput;
export type CreateVerificacionInput = CreateVerificacionSchemaInput;
export type CreateMantenimientoInput = CreateMantenimientoSchemaInput;

/**
 * Calcula fecha próxima (fechaBase + frecuenciaMeses) y fecha de aviso
 * (proxima - diasAviso, si aplica) — mismo cálculo que createCalibracion/
 * createVerificacion/createMantenimiento, factorizado para reusarlo en el
 * registro inicial de createEquipo (Fase 2, 2026-08-07) sin duplicar la
 * lógica de fechas 3 veces más.
 */
function computeProximaYAviso(
  fechaBase: string,
  frecuenciaMeses: number,
  diasAviso: number | null | undefined,
) {
  const proxima = new Date(fechaBase);
  proxima.setMonth(proxima.getMonth() + frecuenciaMeses);
  const proximaStr = proxima.toISOString().split('T')[0]!;

  let fechaAvisoStr: string | null = null;
  if (diasAviso != null) {
    const fechaAviso = new Date(proxima);
    fechaAviso.setDate(fechaAviso.getDate() - diasAviso);
    fechaAvisoStr = fechaAviso.toISOString().split('T')[0]!;
  }

  return { proximaStr, fechaAvisoStr };
}

/**
 * Fase 4 (2026-08-07) + Fix #11 (2026-08-08): fechaBaja con valor fuerza
 * consistencia con estado='dado_de_baja' — no se confía en que el frontend
 * lo mande coherente. Compartida entre createEquipo y updateEquipo (antes
 * esta regla solo vivía en createEquipo; PUT con fechaBaja dejaba el
 * equipo 'activo' igual — bug real encontrado en QA E2E de la limpieza
 * pre-GitHub, 2026-08-08).
 *
 * `soloSiPresente` (usado en updateEquipo): si fechaBaja no viene en el
 * payload, no devuelve nada — evita reactivar en silencio un equipo que ya
 * estaba dado_de_baja por otra vía (ej. DELETE /api/equipos/:id) al editar
 * un campo no relacionado. createEquipo no la usa: un equipo siempre nace
 * con un estado explícito (activo o dado_de_baja), nunca "sin decidir".
 */
function camposFechaBaja(
  fechaBaja: string | null | undefined,
  soloSiPresente = false,
): { fechaBaja?: string | null; estado?: 'activo' | 'dado_de_baja' } {
  if (fechaBaja) return { fechaBaja, estado: 'dado_de_baja' };
  if (soloSiPresente) return {};
  return { fechaBaja: null, estado: 'activo' };
}

/**
 * Creates a new equipment record with an auto-generated code (PREFIX-NNN).
 *
 * @throws AppError 400 if frequency fields are missing for required controls.
 * @throws AppError 404 if tipoEquipo is not found.
 */
export async function createEquipo(input: CreateEquipoInput, fallbackUserId?: string) {
  logger.info(
    { nombre: input.nombre, tipoEquipoId: input.tipoEquipoId },
    'equipo.service: createEquipo',
  );

  if (input.requiereCalibracion && input.frecuenciaCalibracionMeses === undefined) {
    throw new AppError(
      'frecuenciaCalibracionMeses es obligatorio cuando requiereCalibracion es true.',
      400,
    );
  }
  if (input.requiereVerificacion && input.frecuenciaVerificacionMeses === undefined) {
    throw new AppError(
      'frecuenciaVerificacionMeses es obligatorio cuando requiereVerificacion es true.',
      400,
    );
  }
  if (input.requiereMantenimiento && input.frecuenciaMantenimientoMeses === undefined) {
    throw new AppError(
      'frecuenciaMantenimientoMeses es obligatorio cuando requiereMantenimiento es true.',
      400,
    );
  }
  if (input.requiereCalibracion && input.diasAvisoCalibracion === undefined) {
    throw new AppError(
      'diasAvisoCalibracion es obligatorio cuando requiereCalibracion es true.',
      400,
    );
  }
  if (input.requiereVerificacion && input.diasAvisoVerificacion === undefined) {
    throw new AppError(
      'diasAvisoVerificacion es obligatorio cuando requiereVerificacion es true.',
      400,
    );
  }
  if (input.requiereMantenimiento && input.diasAvisoMantenimiento === undefined) {
    throw new AppError(
      'diasAvisoMantenimiento es obligatorio cuando requiereMantenimiento es true.',
      400,
    );
  }

  // Fase 2 (2026-08-07): registro inicial opcional de Calibración/Verificación/
  // Mantenimiento — solo tiene sentido si el equipo requiere ese control (el
  // formulario ya oculta la sección cuando requiereX está apagado; esto es el
  // resguardo defensivo del lado del servidor, mismo criterio que el resto de
  // los checks de esta función).
  if (input.calibracionInicial && !input.requiereCalibracion) {
    throw new AppError(
      'No se puede registrar una calibración inicial si el equipo no requiere calibración.',
      400,
    );
  }
  if (input.verificacionInicial && !input.requiereVerificacion) {
    throw new AppError(
      'No se puede registrar una verificación inicial si el equipo no requiere verificación.',
      400,
    );
  }
  if (input.mantenimientoInicial && !input.requiereMantenimiento) {
    throw new AppError(
      'No se puede registrar un mantenimiento inicial si el equipo no requiere mantenimiento.',
      400,
    );
  }

  await assertSucursalExists(input.sucursalId);
  await assertUbicacionExists(input.ubicacionId);
  // Fase 5 (2026-08-07): unidadId genérico eliminado — Precisión y Rango de
  // Medición ahora tienen cada uno su propio selector de unidad.
  if (input.unidadPrecisionId != null) await assertUnidadExists(input.unidadPrecisionId);
  if (input.unidadRangoId != null) await assertUnidadExists(input.unidadRangoId);
  if (input.responsableId != null) await assertUsuarioExists(input.responsableId);

  const registradoPorCalibracionId = input.calibracionInicial ? (fallbackUserId ?? '1') : undefined;
  const responsableVerificacionId = input.verificacionInicial
    ? input.verificacionInicial.responsableId || fallbackUserId || '1'
    : undefined;
  const responsableMantenimientoId = input.mantenimientoInicial
    ? input.mantenimientoInicial.responsableId || fallbackUserId || '1'
    : undefined;
  if (registradoPorCalibracionId) await assertUsuarioExists(registradoPorCalibracionId);
  if (responsableVerificacionId) await assertUsuarioExists(responsableVerificacionId);
  if (responsableMantenimientoId) await assertUsuarioExists(responsableMantenimientoId);

  const result = await db.transaction(async (tx) => {
    const [tipo] = await tx
      .select()
      .from(tipoEquipo)
      .where(eq(tipoEquipo.id, input.tipoEquipoId))
      .limit(1);
    if (!tipo) {
      throw new AppError(`Tipo de equipo con id ${input.tipoEquipoId} no encontrado.`, 404);
    }

    // Fase 1B: correlativo numérico global (0001, 0002, ...) vía secuencia Postgres,
    // reemplaza el antiguo PREFIJO-NNN por tipo de equipo. La secuencia evita
    // condiciones de carrera que un COUNT(*)+1 no evita bajo concurrencia.
    const seqResult = await tx.execute(sql`SELECT nextval('equipos_codigo_seq') AS nextval`);
    const nextval = seqResult.rows[0]?.['nextval'] as string | number;
    const codigo = String(nextval).padStart(4, '0');

    const [created] = await tx
      .insert(equipo)
      .values({
        codigo,
        tipoEquipoId: input.tipoEquipoId,
        nombre: input.nombre,
        marca: input.marca ?? null,
        modelo: input.modelo ?? null,
        numeroSerie: input.numeroSerie ?? null,
        empresaId: EMPRESA_ID_DEFAULT,
        sucursalId: input.sucursalId,
        ubicacionId: input.ubicacionId,
        responsableId: input.responsableId ?? null,
        fechaAdquisicion: input.fechaAdquisicion ?? null,
        // Ver camposFechaBaja() arriba — consistencia forzada en el mismo
        // insert, no un update posterior. Activo/Inactivo real se recalculan
        // igual al vuelo (Fase 3), pero 'dado_de_baja' sí es un valor
        // persistido real.
        ...camposFechaBaja(input.fechaBaja),
        observaciones: input.observaciones ?? null,
        // Fase 5 (2026-08-07): purga de capacidad/unidadId/resolucion/
        // dimensionTamano/caracteristicaTecnica — quedan solo Precisión y Rango
        // de Medición, cada uno con su propio selector de unidad.
        precisionEquipo: input.precisionEquipo ?? null,
        unidadPrecisionId: input.unidadPrecisionId ?? null,
        rangoMedicion: input.rangoMedicion ?? null,
        unidadRangoId: input.unidadRangoId ?? null,
        disponibleOt: input.disponibleOt ?? true,
        usoObra: input.usoObra ?? false,
        usoLaboratorio: input.usoLaboratorio ?? false,
        permiteUsoSimultaneo: input.permiteUsoSimultaneo ?? false,
        requiereReserva: input.requiereReserva ?? false,
        requiereCalibracion: input.requiereCalibracion,
        requiereVerificacion: input.requiereVerificacion,
        requiereMantenimiento: input.requiereMantenimiento,
        frecuenciaCalibracionMeses: input.frecuenciaCalibracionMeses ?? null,
        frecuenciaVerificacionMeses: input.frecuenciaVerificacionMeses ?? null,
        frecuenciaMantenimientoMeses: input.frecuenciaMantenimientoMeses ?? null,
        diasAvisoCalibracion: input.diasAvisoCalibracion ?? null,
        diasAvisoVerificacion: input.diasAvisoVerificacion ?? null,
        diasAvisoMantenimiento: input.diasAvisoMantenimiento ?? null,
      } satisfies NuevoEquipo)
      .returning();

    let calibracionInicialId: number | undefined;
    if (input.calibracionInicial && input.frecuenciaCalibracionMeses != null) {
      const { proximaStr, fechaAvisoStr } = computeProximaYAviso(
        input.calibracionInicial.fechaCalibracion,
        input.frecuenciaCalibracionMeses,
        input.diasAvisoCalibracion,
      );
      try {
        const [rec] = await tx
          .insert(historialCalibracion)
          .values({
            equipoId: created.id,
            fechaCalibracion: input.calibracionInicial.fechaCalibracion,
            proximaCalibracion: proximaStr,
            fechaAviso: fechaAvisoStr,
            // UAT post-demo (2026-08-07): texto libre, ya no FK — ver equipo.validator.ts.
            laboratorioCalibrador: input.calibracionInicial.laboratorioCalibrador ?? null,
            procedimiento: input.calibracionInicial.procedimiento ?? null,
            nCertificado: input.calibracionInicial.nCertificado ?? null,
            // Corrección (2026-08-07): estadoIngreso es un selector manual del
            // form (aprobado/en_proceso), no un valor fijo.
            estadoIngreso: input.calibracionInicial.estadoIngreso,
            registradoPorId: registradoPorCalibracionId!,
          })
          .returning();
        calibracionInicialId = rec!.id;
      } catch (err: any) {
        if (getPgErrorCode(err) === '23505') {
          throw new AppError('El número de certificado de calibración ya existe.', 409);
        }
        throw err;
      }
    }

    let verificacionInicialId: number | undefined;
    if (input.verificacionInicial && input.frecuenciaVerificacionMeses != null) {
      const { proximaStr, fechaAvisoStr } = computeProximaYAviso(
        input.verificacionInicial.fechaVerificacion,
        input.frecuenciaVerificacionMeses,
        input.diasAvisoVerificacion,
      );
      try {
        const [rec] = await tx
          .insert(historialVerificacion)
          .values({
            equipoId: created.id,
            fechaVerificacion: input.verificacionInicial.fechaVerificacion,
            proximaVerificacion: proximaStr,
            fechaAviso: fechaAvisoStr,
            responsableId: responsableVerificacionId!,
            // UAT post-demo (2026-08-07): texto libre, ya no FK.
            procedimiento: input.verificacionInicial.procedimiento ?? null,
            nRegistro: input.verificacionInicial.nRegistro ?? null,
            // Corrección (2026-08-07): mismo criterio que calibracionInicial arriba.
            estadoIngreso: input.verificacionInicial.estadoIngreso,
          })
          .returning();
        verificacionInicialId = rec!.id;
      } catch (err: any) {
        if (getPgErrorCode(err) === '23505') {
          throw new AppError('El número de registro de verificación ya existe.', 409);
        }
        throw err;
      }
    }

    let mantenimientoInicialId: number | undefined;
    if (input.mantenimientoInicial && input.frecuenciaMantenimientoMeses != null) {
      const { proximaStr, fechaAvisoStr } = computeProximaYAviso(
        input.mantenimientoInicial.fechaMantenimiento,
        input.frecuenciaMantenimientoMeses,
        input.diasAvisoMantenimiento,
      );
      const [rec] = await tx
        .insert(historialMantenimiento)
        .values({
          equipoId: created.id,
          fechaMantenimiento: input.mantenimientoInicial.fechaMantenimiento,
          proximoMantenimiento: proximaStr,
          fechaAviso: fechaAvisoStr,
          tipo: 'preventivo',
          // Corrección (2026-08-07): selector manual del form, mismo criterio
          // que calibracionInicial/verificacionInicial.
          estadoIngreso: input.mantenimientoInicial.estadoIngreso,
          responsableId: responsableMantenimientoId!,
          observaciones: input.mantenimientoInicial.descripcion ?? null,
        })
        .returning();
      mantenimientoInicialId = rec!.id;
    }

    return { ...created, calibracionInicialId, verificacionInicialId, mantenimientoInicialId };
  });

  logger.info({ equipoId: result.id, codigo: result.codigo }, 'equipo.service: equipo created OK');
  return result;
}

/**
 * Lists equipment records with pagination and filters.
 */
export async function listEquipos(input: ListEquiposInput) {
  logger.info({ filters: input }, 'equipo.service: listEquipos');

  const {
    page,
    limit,
    tipoEquipoId,
    sucursalId,
    ubicacionId,
    estado,
    estadoCalibracion: estadoCalibracionFiltro,
    estadoVerificacion: estadoVerificacionFiltro,
    estadoMantenimiento: estadoMantenimientoFiltro,
  } = input;

  // Fase 3: activo/inactivo son calculados, ya no se puede filtrar por la
  // columna cruda en SQL. Se trae el universo filtrado por los demás criterios,
  // se calcula el estado general por equipo, y recién ahí se filtra/pagina.
  const conditions = [];
  if (tipoEquipoId) conditions.push(eq(equipo.tipoEquipoId, tipoEquipoId));
  if (sucursalId) conditions.push(eq(equipo.sucursalId, sucursalId));
  if (ubicacionId) conditions.push(eq(equipo.ubicacionId, ubicacionId));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: equipo.id,
      codigo: equipo.codigo,
      nombre: equipo.nombre,
      marca: equipo.marca,
      modelo: equipo.modelo,
      estado: equipo.estado,
      fechaAdquisicion: equipo.fechaAdquisicion,
      requiereCalibracion: equipo.requiereCalibracion,
      requiereVerificacion: equipo.requiereVerificacion,
      requiereMantenimiento: equipo.requiereMantenimiento,
      tipoEquipoId: equipo.tipoEquipoId,
      tipoEquipoNombre: tipoEquipo.nombre,
      // grupoId no es columna de `equipos` (se deriva vía tipoEquipo.grupoId, ya
      // joineado abajo) — agregado para el filtro de Grupo del listado (pedido
      // de cliente, 2026-08-06). Antes esta proyección liviana no lo traía,
      // a diferencia de getEquipoById que sí lo resuelve (Fix #8).
      grupoId: tipoEquipo.grupoId,
      sucursalId: equipo.sucursalId,
      sucursalNombre: sucursal.nombre,
      ubicacionId: equipo.ubicacionId,
      ubicacionNombre: ubicacion.nombre,
    })
    .from(equipo)
    .innerJoin(tipoEquipo, eq(tipoEquipo.id, equipo.tipoEquipoId))
    .innerJoin(sucursal, eq(sucursal.id, equipo.sucursalId))
    .innerJoin(ubicacion, eq(ubicacion.id, equipo.ubicacionId))
    .where(where)
    .orderBy(desc(equipo.id));

  const hoy = new Date().toISOString().split('T')[0]!;
  const { cal, ver, man } = await getLatestHistorialMaps(rows.map((r) => r.id));

  let withEstado = rows.map((r) => {
    const estadoCalibracion = calcCalVerEstado(
      r.requiereCalibracion,
      cal.get(r.id),
      hoy,
      'en_calibracion',
    );
    const estadoVerificacion = calcCalVerEstado(
      r.requiereVerificacion,
      ver.get(r.id),
      hoy,
      'en_verificacion',
    );
    const estadoMantenimiento = calcMantenimientoEstado(r.requiereMantenimiento, man.get(r.id));
    return {
      ...r,
      estado: calcEstadoGeneral(
        r.estado,
        estadoCalibracion,
        estadoVerificacion,
        estadoMantenimiento,
      ),
      // Filtro combinado de estados por categoría (2026-08-07) — antes solo se
      // calculaban acá adentro para derivar el Estado General y se descartaban;
      // ahora se exponen también en la fila para el filtro de listado y para
      // que el frontend no tenga que pedir el detalle de cada equipo aparte.
      estadoCalibracion,
      estadoVerificacion,
      estadoMantenimiento,
    };
  });

  if (estado) {
    withEstado = withEstado.filter((r) => r.estado === estado);
  }
  if (estadoCalibracionFiltro) {
    withEstado = withEstado.filter((r) => r.estadoCalibracion === estadoCalibracionFiltro);
  }
  if (estadoVerificacionFiltro) {
    withEstado = withEstado.filter((r) => r.estadoVerificacion === estadoVerificacionFiltro);
  }
  if (estadoMantenimientoFiltro) {
    withEstado = withEstado.filter((r) => r.estadoMantenimiento === estadoMantenimientoFiltro);
  }

  const total = withEstado.length;
  const offset = (page - 1) * limit;
  const data = withEstado.slice(offset, offset + limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Retrieves a single equipment record by ID with resolved catalog names and latest histories.
 * @throws AppError 404 if equipment does not exist.
 */
export async function getEquipoById(id: number) {
  logger.info({ id }, 'equipo.service: getEquipoById');

  const [e] = await db.select().from(equipo).where(eq(equipo.id, id)).limit(1);
  if (!e) {
    throw new AppError(`Equipo con id ${id} no encontrado.`, 404);
  }

  const [te] = await db.select().from(tipoEquipo).where(eq(tipoEquipo.id, e.tipoEquipoId)).limit(1);
  const [emp] = await db.select().from(empresa).where(eq(empresa.id, e.empresaId)).limit(1);
  const [suc] = await db.select().from(sucursal).where(eq(sucursal.id, e.sucursalId)).limit(1);
  const [ub] = await db.select().from(ubicacion).where(eq(ubicacion.id, e.ubicacionId)).limit(1);
  // grupoId no es columna de `equipos` — se deriva vía tipoEquipo.grupoId (Fix #4).
  // El frontend lo necesita para precargar el selector de Grupo en Editar Equipo.
  const [grp] = te?.grupoId
    ? await db.select().from(grupo).where(eq(grupo.id, te.grupoId)).limit(1)
    : [undefined];

  const [ultimaCal] = await db
    .select()
    .from(historialCalibracion)
    .where(eq(historialCalibracion.equipoId, id))
    .orderBy(desc(historialCalibracion.fechaCalibracion))
    .limit(1);

  const [ultimaVer] = await db
    .select()
    .from(historialVerificacion)
    .where(eq(historialVerificacion.equipoId, id))
    .orderBy(desc(historialVerificacion.fechaVerificacion))
    .limit(1);

  const [ultimoMan] = await db
    .select()
    .from(historialMantenimiento)
    .where(eq(historialMantenimiento.equipoId, id))
    .orderBy(desc(historialMantenimiento.fechaMantenimiento))
    .limit(1);

  const hoy = new Date().toISOString().split('T')[0]!;
  const estadoCalibracion = calcCalVerEstado(
    e.requiereCalibracion,
    ultimaCal
      ? {
          estadoIngreso: ultimaCal.estadoIngreso,
          proxima: ultimaCal.proximaCalibracion,
          fechaAviso: ultimaCal.fechaAviso,
        }
      : undefined,
    hoy,
    'en_calibracion',
  );
  const estadoVerificacion = calcCalVerEstado(
    e.requiereVerificacion,
    ultimaVer
      ? {
          estadoIngreso: ultimaVer.estadoIngreso,
          proxima: ultimaVer.proximaVerificacion,
          fechaAviso: ultimaVer.fechaAviso,
        }
      : undefined,
    hoy,
    'en_verificacion',
  );
  const estadoMantenimiento = calcMantenimientoEstado(
    e.requiereMantenimiento,
    ultimoMan ? { estadoIngreso: ultimoMan.estadoIngreso } : undefined,
  );

  return {
    ...e,
    // Fase 3: activo/inactivo/dado_de_baja calculado — reemplaza el valor crudo de la columna.
    estado: calcEstadoGeneral(e.estado, estadoCalibracion, estadoVerificacion, estadoMantenimiento),
    estadoCalibracion,
    estadoVerificacion,
    estadoMantenimiento,
    grupoId: te?.grupoId,
    grupoNombre: grp?.nombre,
    tipoEquipoNombre: te?.nombre,
    empresaNombre: emp?.nombre,
    sucursalNombre: suc?.nombre,
    ubicacionNombre: ub?.nombre,
    ultimaCalibracion: ultimaCal ?? null,
    ultimaVerificacion: ultimaVer ?? null,
    ultimoMantenimiento: ultimoMan ?? null,
  };
}

/**
 * Updates an existing equipment record.
 * @throws AppError 404 if equipment does not exist.
 */
export async function updateEquipo(id: number, input: UpdateEquipoInput) {
  logger.info({ id }, 'equipo.service: updateEquipo');

  await getEquipoById(id);

  if (input.requiereCalibracion && input.frecuenciaCalibracionMeses === undefined) {
    throw new AppError(
      'frecuenciaCalibracionMeses es obligatorio cuando requiereCalibracion es true.',
      400,
    );
  }
  if (input.requiereVerificacion && input.frecuenciaVerificacionMeses === undefined) {
    throw new AppError(
      'frecuenciaVerificacionMeses es obligatorio cuando requiereVerificacion es true.',
      400,
    );
  }
  if (input.requiereMantenimiento && input.frecuenciaMantenimientoMeses === undefined) {
    throw new AppError(
      'frecuenciaMantenimientoMeses es obligatorio cuando requiereMantenimiento es true.',
      400,
    );
  }
  if (input.requiereCalibracion && input.diasAvisoCalibracion === undefined) {
    throw new AppError(
      'diasAvisoCalibracion es obligatorio cuando requiereCalibracion es true.',
      400,
    );
  }
  if (input.requiereVerificacion && input.diasAvisoVerificacion === undefined) {
    throw new AppError(
      'diasAvisoVerificacion es obligatorio cuando requiereVerificacion es true.',
      400,
    );
  }
  if (input.requiereMantenimiento && input.diasAvisoMantenimiento === undefined) {
    throw new AppError(
      'diasAvisoMantenimiento es obligatorio cuando requiereMantenimiento es true.',
      400,
    );
  }

  // QA Audit: createEquipo ya validaba tipoEquipoId antes de insertar; a
  // updateEquipo le faltaba el mismo chequeo antes de actualizar.
  const [tipo] = await db
    .select({ id: tipoEquipo.id })
    .from(tipoEquipo)
    .where(eq(tipoEquipo.id, input.tipoEquipoId))
    .limit(1);
  if (!tipo) throw new AppError(`Tipo de equipo con id ${input.tipoEquipoId} no encontrado.`, 404);
  await assertSucursalExists(input.sucursalId);
  await assertUbicacionExists(input.ubicacionId);
  if (input.unidadPrecisionId != null) await assertUnidadExists(input.unidadPrecisionId);
  if (input.unidadRangoId != null) await assertUnidadExists(input.unidadRangoId);
  if (input.responsableId != null) await assertUsuarioExists(input.responsableId);

  const [updated] = await db
    .update(equipo)
    .set({
      tipoEquipoId: input.tipoEquipoId,
      nombre: input.nombre,
      marca: input.marca ?? null,
      modelo: input.modelo ?? null,
      numeroSerie: input.numeroSerie ?? null,
      sucursalId: input.sucursalId,
      ubicacionId: input.ubicacionId,
      responsableId: input.responsableId ?? null,
      fechaAdquisicion: input.fechaAdquisicion ?? null,
      // Fix #11 (2026-08-08): ver camposFechaBaja() — antes updateEquipo no
      // tocaba fechaBaja/estado en absoluto, así que PUT con fechaBaja no
      // forzaba dado_de_baja (bug real, QA E2E). soloSiPresente=true: si el
      // payload no trae fechaBaja, no se toca el estado — evita reactivar
      // en silencio un equipo ya dado de baja por otra vía al editar un
      // campo no relacionado.
      ...camposFechaBaja(input.fechaBaja, true),
      observaciones: input.observaciones ?? null,
      // Fase 5 (2026-08-07): purga de capacidad/unidadId/resolucion/
      // dimensionTamano/caracteristicaTecnica — quedan solo Precisión y Rango
      // de Medición, cada uno con su propio selector de unidad.
      precisionEquipo: input.precisionEquipo ?? null,
      unidadPrecisionId: input.unidadPrecisionId ?? null,
      rangoMedicion: input.rangoMedicion ?? null,
      unidadRangoId: input.unidadRangoId ?? null,
      disponibleOt: input.disponibleOt ?? true,
      usoObra: input.usoObra ?? false,
      usoLaboratorio: input.usoLaboratorio ?? false,
      permiteUsoSimultaneo: input.permiteUsoSimultaneo ?? false,
      requiereReserva: input.requiereReserva ?? false,
      requiereCalibracion: input.requiereCalibracion,
      requiereVerificacion: input.requiereVerificacion,
      requiereMantenimiento: input.requiereMantenimiento,
      frecuenciaCalibracionMeses: input.frecuenciaCalibracionMeses ?? null,
      frecuenciaVerificacionMeses: input.frecuenciaVerificacionMeses ?? null,
      frecuenciaMantenimientoMeses: input.frecuenciaMantenimientoMeses ?? null,
      diasAvisoCalibracion: input.diasAvisoCalibracion ?? null,
      diasAvisoVerificacion: input.diasAvisoVerificacion ?? null,
      diasAvisoMantenimiento: input.diasAvisoMantenimiento ?? null,
      updatedAt: new Date(),
    })
    .where(eq(equipo.id, id))
    .returning();

  logger.info({ equipoId: id }, 'equipo.service: equipo updated OK');
  return updated;
}

/**
 * Performs a logical deletion (baja lógica) of an equipment record.
 * @throws AppError 404 if equipment does not exist.
 */
export async function deactivateEquipo(id: number, motivo: string) {
  logger.info({ id, motivo }, 'equipo.service: deactivateEquipo');

  await getEquipoById(id);

  const hoy = new Date().toISOString().split('T')[0];
  const [updated] = await db
    .update(equipo)
    .set({ estado: 'dado_de_baja', fechaBaja: hoy, motivoBaja: motivo, updatedAt: new Date() })
    .where(eq(equipo.id, id))
    .returning();

  return updated;
}

/**
 * Registers a calibration record for an equipment.
 * @throws AppError 400 if equipment does not require calibration or frequency is missing.
 */
export async function createCalibracion(
  equipoId: number,
  input: CreateCalibracionInput,
  fallbackUserId?: string,
) {
  logger.info({ equipoId }, 'equipo.service: createCalibracion');

  const e = await getEquipoById(equipoId);
  if (!e.requiereCalibracion) {
    throw new AppError('Este equipo no requiere calibración.', 400);
  }
  if (!e.frecuenciaCalibracionMeses) {
    throw new AppError('El equipo no tiene frecuencia de calibración configurada.', 400);
  }

  // Fase 2 (2026-08-06): registradoPorId/responsableId son text (nanoid de
  // Better Auth a futuro) — ya no se castea con Number().
  const registradoPorId = input.registradoPorId || fallbackUserId || '1';

  await assertUsuarioExists(registradoPorId);

  const proxima = new Date(input.fechaCalibracion);
  proxima.setMonth(proxima.getMonth() + e.frecuenciaCalibracionMeses);
  const proximaStr = proxima.toISOString().split('T')[0]!;

  let fechaAvisoStr: string | null = null;
  if (e.diasAvisoCalibracion != null) {
    const fechaAviso = new Date(proxima);
    fechaAviso.setDate(fechaAviso.getDate() - e.diasAvisoCalibracion);
    fechaAvisoStr = fechaAviso.toISOString().split('T')[0]!;
  }

  try {
    const [record] = await db
      .insert(historialCalibracion)
      .values({
        equipoId,
        fechaCalibracion: input.fechaCalibracion,
        proximaCalibracion: proximaStr,
        fechaAviso: fechaAvisoStr,
        // UAT post-demo (2026-08-07): texto libre, ya no FK.
        laboratorioCalibrador: input.laboratorioCalibrador ?? null,
        procedimiento: input.procedimiento ?? null,
        nCertificado: input.nCertificado ?? null,
        estadoIngreso: input.estadoIngreso,
        registradoPorId,
        observaciones: input.observaciones ?? null,
      })
      .returning();

    return record;
  } catch (err: any) {
    if (getPgErrorCode(err) === '23505') {
      throw new AppError('El número de certificado de calibración ya existe.', 409);
    }
    throw err;
  }
}

/**
 * Lists calibration records for an equipment.
 */
export async function listCalibraciones(equipoId: number) {
  logger.info({ equipoId }, 'equipo.service: listCalibraciones');
  await getEquipoById(equipoId);

  return db
    .select()
    .from(historialCalibracion)
    .where(eq(historialCalibracion.equipoId, equipoId))
    .orderBy(desc(historialCalibracion.fechaCalibracion));
}

/**
 * Attaches a certificate file to an existing calibration record.
 * @throws AppError 404 if the calibration record does not exist or belongs to another equipo.
 */
export async function attachCertificadoCalibracion(
  equipoId: number,
  calibracionId: number,
  file: Express.Multer.File,
) {
  logger.info({ equipoId, calibracionId }, 'equipo.service: attachCertificadoCalibracion');
  await getEquipoById(equipoId);

  const [existing] = await db
    .select()
    .from(historialCalibracion)
    .where(
      and(eq(historialCalibracion.id, calibracionId), eq(historialCalibracion.equipoId, equipoId)),
    )
    .limit(1);
  if (!existing) {
    throw new AppError(
      `Calibración con id ${calibracionId} no encontrada para el equipo ${equipoId}.`,
      404,
    );
  }

  const documentoUrl = await saveUploadedFile('calibraciones', file.originalname, file.buffer);

  const [updated] = await db
    .update(historialCalibracion)
    .set({ documentoUrl })
    .where(eq(historialCalibracion.id, calibracionId))
    .returning();

  return updated;
}

/**
 * Registers a verification record for an equipment.
 */
export async function createVerificacion(
  equipoId: number,
  input: CreateVerificacionInput,
  fallbackUserId?: string,
) {
  logger.info({ equipoId }, 'equipo.service: createVerificacion');

  const e = await getEquipoById(equipoId);
  if (!e.requiereVerificacion) {
    throw new AppError('Este equipo no requiere verificación.', 400);
  }
  if (!e.frecuenciaVerificacionMeses) {
    throw new AppError('El equipo no tiene frecuencia de verificación configurada.', 400);
  }

  const responsableId = input.responsableId || fallbackUserId || '1';

  await assertUsuarioExists(responsableId);

  const proxima = new Date(input.fechaVerificacion);
  proxima.setMonth(proxima.getMonth() + e.frecuenciaVerificacionMeses);

  let fechaAvisoStr: string | null = null;
  if (e.diasAvisoVerificacion != null) {
    const fechaAviso = new Date(proxima);
    fechaAviso.setDate(fechaAviso.getDate() - e.diasAvisoVerificacion);
    fechaAvisoStr = fechaAviso.toISOString().split('T')[0]!;
  }

  try {
    const [record] = await db
      .insert(historialVerificacion)
      .values({
        equipoId,
        fechaVerificacion: input.fechaVerificacion,
        proximaVerificacion: proxima.toISOString().split('T')[0]!,
        fechaAviso: fechaAvisoStr,
        responsableId,
        metodo: input.metodo ?? null,
        // UAT post-demo (2026-08-07): texto libre, ya no FK.
        procedimiento: input.procedimiento ?? null,
        nRegistro: input.nRegistro ?? null,
        estadoIngreso: input.estadoIngreso,
      })
      .returning();

    return record;
  } catch (err: any) {
    if (getPgErrorCode(err) === '23505') {
      throw new AppError('El número de registro de verificación ya existe.', 409);
    }
    throw err;
  }
}

/**
 * Lists verification records for an equipment.
 */
export async function listVerificaciones(equipoId: number) {
  logger.info({ equipoId }, 'equipo.service: listVerificaciones');
  await getEquipoById(equipoId);

  return db
    .select()
    .from(historialVerificacion)
    .where(eq(historialVerificacion.equipoId, equipoId))
    .orderBy(desc(historialVerificacion.fechaVerificacion));
}

/**
 * Attaches a record file to an existing verification record.
 * @throws AppError 404 if the verification record does not exist or belongs to another equipo.
 */
export async function attachRegistroVerificacion(
  equipoId: number,
  verificacionId: number,
  file: Express.Multer.File,
) {
  logger.info({ equipoId, verificacionId }, 'equipo.service: attachRegistroVerificacion');
  await getEquipoById(equipoId);

  const [existing] = await db
    .select()
    .from(historialVerificacion)
    .where(
      and(
        eq(historialVerificacion.id, verificacionId),
        eq(historialVerificacion.equipoId, equipoId),
      ),
    )
    .limit(1);
  if (!existing) {
    throw new AppError(
      `Verificación con id ${verificacionId} no encontrada para el equipo ${equipoId}.`,
      404,
    );
  }

  const documentoUrl = await saveUploadedFile('verificaciones', file.originalname, file.buffer);

  const [updated] = await db
    .update(historialVerificacion)
    .set({ documentoUrl })
    .where(eq(historialVerificacion.id, verificacionId))
    .returning();

  return updated;
}

/**
 * Registers a maintenance record for an equipment.
 */
export async function createMantenimiento(
  equipoId: number,
  input: CreateMantenimientoInput,
  fallbackUserId?: string,
) {
  logger.info({ equipoId }, 'equipo.service: createMantenimiento');

  const e = await getEquipoById(equipoId);
  if (!e.requiereMantenimiento) {
    throw new AppError('Este equipo no requiere mantenimiento.', 400);
  }
  if (!e.frecuenciaMantenimientoMeses) {
    throw new AppError('El equipo no tiene frecuencia de mantenimiento configurada.', 400);
  }

  const responsableId = input.responsableId || fallbackUserId || '1';

  await assertUsuarioExists(responsableId);

  const proximo = new Date(input.fechaMantenimiento);
  proximo.setMonth(proximo.getMonth() + e.frecuenciaMantenimientoMeses);

  // Informativo únicamente (decisión 2026-08-04): el estado de Mantenimiento no
  // se calcula por fecha, así que fechaAviso no participa del semáforo.
  let fechaAvisoStr: string | null = null;
  if (e.diasAvisoMantenimiento != null) {
    const fechaAviso = new Date(proximo);
    fechaAviso.setDate(fechaAviso.getDate() - e.diasAvisoMantenimiento);
    fechaAvisoStr = fechaAviso.toISOString().split('T')[0]!;
  }

  const [record] = await db
    .insert(historialMantenimiento)
    .values({
      equipoId,
      fechaMantenimiento: input.fechaMantenimiento,
      proximoMantenimiento: proximo.toISOString().split('T')[0]!,
      fechaAviso: fechaAvisoStr,
      tipo: input.tipo,
      estadoIngreso: input.estadoIngreso,
      responsableId,
      observaciones: input.descripcion ?? null,
    })
    .returning();

  return record;
}

/**
 * Lists maintenance records for an equipment.
 */
export async function listMantenimientos(equipoId: number) {
  logger.info({ equipoId }, 'equipo.service: listMantenimientos');
  await getEquipoById(equipoId);

  return db
    .select()
    .from(historialMantenimiento)
    .where(eq(historialMantenimiento.equipoId, equipoId))
    .orderBy(desc(historialMantenimiento.fechaMantenimiento));
}

/**
 * Attaches a document file to an existing maintenance record.
 * @throws AppError 404 if the maintenance record does not exist or belongs to another equipo.
 */
export async function attachDocumentoMantenimiento(
  equipoId: number,
  mantenimientoId: number,
  file: Express.Multer.File,
) {
  logger.info({ equipoId, mantenimientoId }, 'equipo.service: attachDocumentoMantenimiento');
  await getEquipoById(equipoId);

  const [existing] = await db
    .select()
    .from(historialMantenimiento)
    .where(
      and(
        eq(historialMantenimiento.id, mantenimientoId),
        eq(historialMantenimiento.equipoId, equipoId),
      ),
    )
    .limit(1);
  if (!existing) {
    throw new AppError(
      `Mantenimiento con id ${mantenimientoId} no encontrado para el equipo ${equipoId}.`,
      404,
    );
  }

  const documentoUrl = await saveUploadedFile('mantenimientos', file.originalname, file.buffer);

  const [updated] = await db
    .update(historialMantenimiento)
    .set({ documentoUrl })
    .where(eq(historialMantenimiento.id, mantenimientoId))
    .returning();

  return updated;
}

/**
 * Associates a test type with an equipment.
 */
export async function associateTipoEnsayo(equipoId: number, tipoEnsayoId: number) {
  logger.info({ equipoId, tipoEnsayoId }, 'equipo.service: associateTipoEnsayo');
  await getEquipoById(equipoId);
  await assertTipoEnsayoExists(tipoEnsayoId);

  try {
    const [record] = await db
      .insert(equipoTipoEnsayo)
      .values({ equipoId, tipoEnsayoId })
      .returning();
    return record;
  } catch (err: any) {
    // QA Audit: faltaba este catch (sí existía en createCalibracion/createVerificacion
    // para su propio constraint unique) — sin él, re-asociar el mismo tipoEnsayoId
    // producía un 500 con la query SQL completa expuesta en la respuesta.
    if (getPgErrorCode(err) === '23505') {
      throw new AppError(`El tipo de ensayo ${tipoEnsayoId} ya está asociado a este equipo.`, 409);
    }
    throw err;
  }
}

/**
 * Lists test types associated with an equipment.
 */
export async function listTiposEnsayo(equipoId: number) {
  logger.info({ equipoId }, 'equipo.service: listTiposEnsayo');
  await getEquipoById(equipoId);

  return db
    .select({
      equipoId: equipoTipoEnsayo.equipoId,
      tipoEnsayoId: equipoTipoEnsayo.tipoEnsayoId,
      nombreTipoEnsayo: tipoEnsayo.nombreTipoEnsayo,
      codigoNorma: tipoEnsayo.codigoNorma,
    })
    .from(equipoTipoEnsayo)
    .innerJoin(tipoEnsayo, eq(tipoEnsayo.id, equipoTipoEnsayo.tipoEnsayoId))
    .where(eq(equipoTipoEnsayo.equipoId, equipoId));
}

/**
 * Dissociates a test type from an equipment.
 */
export async function dissociateTipoEnsayo(equipoId: number, tipoEnsayoId: number) {
  logger.info({ equipoId, tipoEnsayoId }, 'equipo.service: dissociateTipoEnsayo');
  await getEquipoById(equipoId);

  await db
    .delete(equipoTipoEnsayo)
    .where(
      and(eq(equipoTipoEnsayo.equipoId, equipoId), eq(equipoTipoEnsayo.tipoEnsayoId, tipoEnsayoId)),
    );
}

/**
 * Gets dashboard summary metrics.
 */
export async function getDashboardSummary() {
  logger.info('equipo.service: getDashboardSummary');

  // Fase 3: activo/inactivo son calculados — no se puede agrupar por la columna
  // cruda (que en la práctica solo vale 'activo' o 'dado_de_baja').
  const controles = await getControlStatus();
  const activos = Array.isArray(controles) ? controles : [];
  const porEstadoMap = new Map<string, number>();
  for (const c of activos)
    porEstadoMap.set(c.estadoGeneral, (porEstadoMap.get(c.estadoGeneral) ?? 0) + 1);

  const [{ dadoDeBaja }] = await db
    .select({ dadoDeBaja: count() })
    .from(equipo)
    .where(eq(equipo.estado, 'dado_de_baja'));
  if (Number(dadoDeBaja) > 0) porEstadoMap.set('dado_de_baja', Number(dadoDeBaja));

  const porEstado = Array.from(porEstadoMap.entries()).map(([estado, total]) => ({
    estado,
    total,
  }));

  const porTipo = await db
    .select({ tipoNombre: tipoEquipo.nombre, total: count() })
    .from(equipo)
    .innerJoin(tipoEquipo, eq(tipoEquipo.id, equipo.tipoEquipoId))
    .groupBy(tipoEquipo.nombre);

  const porSucursal = await db
    .select({ sucursalNombre: sucursal.nombre, total: count() })
    .from(equipo)
    .innerJoin(sucursal, eq(sucursal.id, equipo.sucursalId))
    .groupBy(sucursal.nombre);

  return { porEstado, porTipo, porSucursal };
}

/**
 * Calculates control status (calibrations/verifications/maintenances) and the
 * derived Estado General for equipment not yet dado_de_baja.
 */
export async function getControlStatus(equipoId?: number) {
  logger.info({ equipoId }, 'equipo.service: getControlStatus');

  const hoy = new Date().toISOString().split('T')[0]!;

  const whereCondition = equipoId
    ? and(eq(equipo.id, equipoId), ne(equipo.estado, 'dado_de_baja'))
    : ne(equipo.estado, 'dado_de_baja');

  const equipos = await db
    .select({
      id: equipo.id,
      codigo: equipo.codigo,
      nombre: equipo.nombre,
      estado: equipo.estado,
      requiereCalibracion: equipo.requiereCalibracion,
      requiereVerificacion: equipo.requiereVerificacion,
      requiereMantenimiento: equipo.requiereMantenimiento,
    })
    .from(equipo)
    .where(whereCondition);

  const ids = equipos.map((e) => e.id);
  if (ids.length === 0) return equipoId ? null : [];

  const { cal, ver, man } = await getLatestHistorialMaps(ids);

  const result = equipos.map((e) => {
    const estadoCalibracion = calcCalVerEstado(
      e.requiereCalibracion,
      cal.get(e.id),
      hoy,
      'en_calibracion',
    );
    const estadoVerificacion = calcCalVerEstado(
      e.requiereVerificacion,
      ver.get(e.id),
      hoy,
      'en_verificacion',
    );
    const estadoMantenimiento = calcMantenimientoEstado(e.requiereMantenimiento, man.get(e.id));
    return {
      equipoId: e.id,
      codigo: e.codigo,
      nombre: e.nombre,
      estadoGeneral: calcEstadoGeneral(
        e.estado,
        estadoCalibracion,
        estadoVerificacion,
        estadoMantenimiento,
      ),
      estadoCalibracion,
      proximaCalibracion: cal.get(e.id)?.proxima ?? null,
      estadoVerificacion,
      proximaVerificacion: ver.get(e.id)?.proxima ?? null,
      estadoMantenimiento,
    };
  });

  return equipoId ? (result[0] ?? null) : result;
}

/**
 * Returns equipment whose Estado General computes to "inactivo" (al menos un
 * control vencido, en curso, o mantenimiento en un estado que no es operativo).
 */
export async function getCriticalEquipos() {
  logger.info('equipo.service: getCriticalEquipos');

  const controles = await getControlStatus();
  const list = Array.isArray(controles) ? controles : controles ? [controles] : [];
  return list.filter((e) => e.estadoGeneral === 'inactivo');
}

// ─── Ficha de Control de Equipo (FT-6.4.3/1, PDF) ──────────────────────────

export interface FichaControlHistorialRow {
  ultima: string;
  proxima: string;
  resultado: 'aprobado' | 'en_proceso';
  responsable: string;
}

export interface FichaControlData {
  codigo: string;
  nombre: string;
  marca: string | null;
  modelo: string | null;
  numeroSerie: string | null;
  rangoMedicion: string | null;
  unidadRangoSimbolo: string | null;
  precisionEquipo: string | null;
  unidadPrecisionSimbolo: string | null;
  ubicacionNombre: string | null;
  frecuenciaCalibracionMeses: number | null;
  frecuenciaVerificacionMeses: number | null;
  // "Lugar" y "Procedimiento" de Calibración/Verificación no son config del
  // equipo (no hay columna para ellos en `equipos`) — se resuelven del
  // historial más reciente de cada categoría. Ver nota en equipo.controller.ts
  // getFichaControlHandler sobre por qué (a confirmar contra la plantilla real).
  // Corrección PDF (2026-08-08): lugarVerificacion NUNCA debe resolver al
  // nombre del responsable — `historial_verificaciones` no tiene ningún
  // campo de lugar/ubicación propio (verificado contra el schema real, ver
  // getFichaControlData más abajo). Queda en `null` (se imprime "—" en el
  // PDF) hasta que se agregue un campo real si el cliente lo pide.
  lugarCalibracion: string | null;
  procedimientoCalibracion: string | null;
  lugarVerificacion: string | null;
  procedimientoVerificacion: string | null;
  historial: FichaControlHistorialRow[];
}

/**
 * Reúne los datos de la Ficha de Control de Equipo (FT-6.4.3/1). "Lugar" y
 * "Procedimiento" de Calibración/Verificación se resuelven del registro de
 * historial más reciente de cada categoría (no existe un campo de config a
 * nivel de equipo para ellos) — mismo criterio que `getEquipoById` usa para
 * `ultimaCalibracion`/`ultimaVerificacion`.
 */
export async function getFichaControlData(id: number): Promise<FichaControlData> {
  logger.info({ id }, 'equipo.service: getFichaControlData');

  const [e] = await db.select().from(equipo).where(eq(equipo.id, id)).limit(1);
  if (!e) {
    throw new AppError(`Equipo con id ${id} no encontrado.`, 404);
  }

  const [ub] = await db.select().from(ubicacion).where(eq(ubicacion.id, e.ubicacionId)).limit(1);
  const [unidadPrecision] =
    e.unidadPrecisionId != null
      ? await db
          .select()
          .from(unidadMedida)
          .where(eq(unidadMedida.id, e.unidadPrecisionId))
          .limit(1)
      : [undefined];
  const [unidadRango] =
    e.unidadRangoId != null
      ? await db.select().from(unidadMedida).where(eq(unidadMedida.id, e.unidadRangoId)).limit(1)
      : [undefined];

  const calibraciones = await db
    .select()
    .from(historialCalibracion)
    .where(eq(historialCalibracion.equipoId, id))
    .orderBy(desc(historialCalibracion.fechaCalibracion));

  const verificaciones = await db
    .select()
    .from(historialVerificacion)
    .where(eq(historialVerificacion.equipoId, id))
    .orderBy(desc(historialVerificacion.fechaVerificacion));

  // UAT post-demo (2026-08-07): laboratorioCalibrador/procedimiento ya vienen
  // como texto libre directo en el historial (ver equipo.schema.ts) — ya no
  // hace falta resolverlos contra catálogo.
  const userIds = [
    ...new Set([
      ...calibraciones.map((c) => c.registradoPorId),
      ...verificaciones.map((v) => v.responsableId),
    ]),
  ];
  const users = userIds.length
    ? await db.select().from(usuario).where(inArray(usuario.id, userIds))
    : [];
  const userMap = new Map(users.map((u) => [u.id, u.nombre]));

  const latestCal = calibraciones[0];
  const latestVer = verificaciones[0];

  const historial: FichaControlHistorialRow[] = [
    ...calibraciones.map((c) => ({
      ultima: c.fechaCalibracion,
      proxima: c.proximaCalibracion,
      resultado: c.estadoIngreso,
      responsable: userMap.get(c.registradoPorId) ?? c.registradoPorId,
    })),
    ...verificaciones.map((v) => ({
      ultima: v.fechaVerificacion,
      proxima: v.proximaVerificacion,
      resultado: v.estadoIngreso,
      responsable: userMap.get(v.responsableId) ?? v.responsableId,
    })),
  ].sort((a, b) => (a.ultima < b.ultima ? 1 : a.ultima > b.ultima ? -1 : 0));

  return {
    codigo: e.codigo ?? String(e.id),
    nombre: e.nombre,
    marca: e.marca,
    modelo: e.modelo,
    numeroSerie: e.numeroSerie,
    rangoMedicion: e.rangoMedicion,
    unidadRangoSimbolo: unidadRango?.simbolo ?? null,
    precisionEquipo: e.precisionEquipo,
    unidadPrecisionSimbolo: unidadPrecision?.simbolo ?? null,
    ubicacionNombre: ub?.nombre ?? null,
    frecuenciaCalibracionMeses: e.frecuenciaCalibracionMeses,
    frecuenciaVerificacionMeses: e.frecuenciaVerificacionMeses,
    lugarCalibracion: latestCal?.laboratorioCalibrador ?? null,
    procedimientoCalibracion: latestCal?.procedimiento ?? null,
    // Corrección (2026-08-08): antes imprimía userMap.get(responsableId) —
    // el nombre del RESPONSABLE de la verificación, no un lugar. No existe
    // ningún campo de lugar/ubicación para verificación en el schema real
    // (historial_verificaciones no lo tiene) — se deja en null (el PDF
    // imprime "—") en vez de inventar un valor. Ver nota en FichaControlData.
    lugarVerificacion: null,
    procedimientoVerificacion: latestVer?.procedimiento ?? null,
    historial,
  };
}
