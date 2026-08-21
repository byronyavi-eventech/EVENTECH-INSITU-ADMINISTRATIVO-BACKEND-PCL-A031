/**
 * src/controllers/catalogos.controller.ts
 * Handlers para los endpoints de catálogos con rutas en español
 * mapeadas 1:1 con las filas del Excel del QA.
 */
import type { Request, Response } from 'express';
import { db } from '../db/index.js';
import {
  empresa,
  sucursal,
  ubicacion,
  grupo,
  tipoEquipo,
  laboratorioCalibrador,
  procedimientoEquipo,
  unidadMedida,
  usuario,
} from '../db/schema/index.js';
import { asc, eq } from 'drizzle-orm';
import { parseNumericParam } from '../utils/parse-numeric-param.js';
import { wrap } from '../utils/controller-helpers.js';

// ─── Información General ──────────────────────────────────────

/** GET /api/catalogos/tipos-equipo?grupoId={id} */
export const listTiposEquipoHandler = wrap(async (req, res) => {
  const grupoId = req.query['grupoId'];
  const rows = grupoId
    ? await db
        .select()
        .from(tipoEquipo)
        .where(eq(tipoEquipo.grupoId, parseNumericParam(grupoId as string, 'grupoId')))
        .orderBy(asc(tipoEquipo.nombre))
    : await db.select().from(tipoEquipo).orderBy(asc(tipoEquipo.nombre));
  res.status(200).json({ status: 'success', data: rows });
});

/** GET /api/catalogos/grupos */
export const listGruposHandler = wrap(async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(grupo)
    .where(eq(grupo.activo, true))
    .orderBy(asc(grupo.nombre));
  res.status(200).json({ status: 'success', data: rows });
});

/** GET /api/catalogos/empresas */
export const listEmpresasHandler = wrap(async (_req: Request, res: Response) => {
  const rows = await db.select().from(empresa).orderBy(asc(empresa.nombre));
  res.status(200).json({ status: 'success', data: rows });
});

/** GET /api/catalogos/sucursales?empresaId={id} */
export const listSucursalesHandler = wrap(async (req, res) => {
  const empresaId = req.query['empresaId'];
  const rows = empresaId
    ? await db
        .select()
        .from(sucursal)
        .where(eq(sucursal.empresaId, parseNumericParam(empresaId as string, 'empresaId')))
        .orderBy(asc(sucursal.nombre))
    : await db.select().from(sucursal).orderBy(asc(sucursal.nombre));
  res.status(200).json({ status: 'success', data: rows });
});

/** GET /api/catalogos/ubicaciones?sucursalId={id} */
export const listUbicacionesHandler = wrap(async (req, res) => {
  const sucursalId = req.query['sucursalId'];
  const rows = sucursalId
    ? await db
        .select()
        .from(ubicacion)
        .where(eq(ubicacion.sucursalId, parseNumericParam(sucursalId as string, 'sucursalId')))
        .orderBy(asc(ubicacion.nombre))
    : await db.select().from(ubicacion).orderBy(asc(ubicacion.nombre));
  res.status(200).json({ status: 'success', data: rows });
});

/** GET /api/catalogos/estados-equipo — lista estática (Fase 3: activo/inactivo calculados, dado_de_baja manual) */
export function listEstadosEquipoHandler(_req: Request, res: Response): void {
  const estados = ['activo', 'inactivo', 'dado_de_baja'];
  res.status(200).json({
    status: 'success',
    data: estados.map((v) => ({ value: v, label: v })),
  });
}

// ─── Características Técnicas ─────────────────────────────────

/** GET /api/catalogos/unidades */
export const listUnidadesHandler = wrap(async (_req: Request, res: Response) => {
  // QA Audit (2026-08-04): antes usaba SQL crudo (defensivo de cuando la
  // tabla podía no existir, Fix #1 pre-migración) y devolvía "id" como
  // string (tipo crudo del driver pg para bigint) — inconsistente con
  // todos los demás catálogos de este archivo, que devuelven "id" numérico
  // vía Drizzle. La tabla existe de forma estable desde Fix #1.
  const rows = await db.select().from(unidadMedida).orderBy(asc(unidadMedida.nombre));
  res.status(200).json({ status: 'success', data: rows });
});

// ─── Calibración / Verificación / Mantenimiento ───────────────

/** GET /api/catalogos/estados-control — lista estática compartida */
export function listEstadosControlHandler(_req: Request, res: Response): void {
  const estados = ['vigente', 'vencida', 'proxima_a_vencer', 'no_aplica', 'sin_registro'];
  res.status(200).json({
    status: 'success',
    data: estados.map((v) => ({ value: v, label: v })),
  });
}

// ─── Catálogos auxiliares ─────────────────────────────────────

/** GET /api/catalogos/laboratorios-calibradores */
export const listLaboratoriosHandler = wrap(async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(laboratorioCalibrador)
    .orderBy(asc(laboratorioCalibrador.nombre));
  res.status(200).json({ status: 'success', data: rows });
});

/** GET /api/catalogos/procedimientos */
export const listProcedimientosHandler = wrap(async (_req: Request, res: Response) => {
  const rows = await db.select().from(procedimientoEquipo).orderBy(asc(procedimientoEquipo.codigo));
  res.status(200).json({ status: 'success', data: rows });
});

/** GET /api/catalogos/usuarios — responsables/registradores (Paso 0, ver equipo.validator.ts). */
export const listUsuariosHandler = wrap(async (_req: Request, res: Response) => {
  const rows = await db
    .select({ id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol })
    .from(usuario)
    .where(eq(usuario.activo, true))
    .orderBy(asc(usuario.nombre));
  res.status(200).json({ status: 'success', data: rows });
});
