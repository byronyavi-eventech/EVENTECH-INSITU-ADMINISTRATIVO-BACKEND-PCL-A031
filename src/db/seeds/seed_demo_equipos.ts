/**
 * src/seeds/seed_demo_equipos.ts
 * Siembra 8 equipos de demo + sus historiales (Calibración/Verificación/
 * Mantenimiento) con estados variados (vencida/proxima_a_vencer/vigente).
 *
 * Limpieza pre-GitHub (2026-08-07): este script ANTES se llamaba
 * `seed_equipos.ts` y también CREABA el catálogo base (empresa/sucursal/
 * ubicaciones/grupos/tipos_equipo/laboratorio/procedimientos) — ahora
 * redundante, porque ese catálogo ya lo siembra `init.sql` (bootstrap
 * automático de Postgres) + `seed_grupos.ts`/`seed_fase1_tipos_equipo.ts`
 * (Fix #4). Insertarlo de nuevo aquí sin `onConflictDoNothing` en
 * `tipos_equipo` además chocaba con los nombres YA renombrados por Fix #4
 * (ej. intentaba re-crear 'Balanza' cuando el catálogo real ya es
 * 'Balanzas Analíticas'), generando tipos_equipo duplicados/fantasma.
 *
 * Este script ahora SOLO crea datos transaccionales de demo — asume que el
 * catálogo (empresa 'Laboratorio INSITU', sucursal 'Arica', ubicaciones
 * Laboratorio/Bodega/Terreno, los 8 tipos_equipo legacy, laboratorio
 * 'CESMEC', procedimientos 'PT-001'/'LI-IT-MS-01') ya existe, y falla con un
 * error claro si no lo encuentra — nunca ejecutar antes de
 * `docker-compose up` (que corre `init.sql`) + `npm run seed:grupos` +
 * `npm run seed:fase1-tipos`.
 *
 * Ejecución MANUAL únicamente (`npm run seed:demo`) — nunca automática, ver
 * package.json y CLAUDE.md sección "Datos de demo".
 */
import 'dotenv/config';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../index.js';
import {
  empresa,
  sucursal,
  ubicacion,
  tipoEquipo,
  laboratorioCalibrador,
  procedimientoEquipo,
  equipo,
  historialCalibracion,
  historialVerificacion,
  historialMantenimiento,
  user,
} from '../schema/index.js';
import { logger } from '../../utils/logger.js';
import { SISTEMA_USER_ID } from '../../services/equipo.service.js';

// Fase 6 (2026-08-22): antes sembraba un placeholder en la tabla local
// `usuarios` (eliminada) — ahora siembra un usuario real de Better Auth
// (`user`), mismo id fijo que usa el fallback de getUserId()
// (equipo.controller.ts) y de los demás seeds, para no depender de que
// exista la cuenta personal de nadie.
const STUB_USER_ID = SISTEMA_USER_ID;

const DIAS_AVISO_DEMO = 30;

const MANTENIMIENTO_ESTADO_DEMO = {
  vencida: 'fuera_de_servicio',
  proxima_a_vencer: 'en_mantenimiento',
  vigente: 'operativo',
} as const;

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0]!;
}

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0]!;
}

/** Busca una fila de catálogo por nombre; falla con mensaje claro si no existe. */
async function requireByName<T extends { nombre: string }>(
  rows: T[],
  nombre: string,
  tabla: string,
): Promise<T> {
  const row = rows.find((r) => r.nombre === nombre);
  if (!row) {
    throw new Error(
      `Catálogo incompleto: no se encontró "${nombre}" en ${tabla}. ` +
        `¿Corriste init.sql + npm run seed:grupos + npm run seed:fase1-tipos antes de este script?`,
    );
  }
  return row;
}

async function main() {
  logger.info('🌱 Iniciando seed de equipos de demo (asume catálogo ya sembrado)...');

  // Usuario sistema — no sobreescribe si ya existe (onConflictDoNothing),
  // solo garantiza que exista algo válido para las FKs de responsable.
  await db
    .insert(user)
    .values({
      id: STUB_USER_ID,
      name: 'Usuario Sistema (Seed)',
      email: 'sistema@eventech.local',
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing();

  const [emp] = await db.select().from(empresa).where(eq(empresa.nombre, 'Laboratorio INSITU'));
  if (!emp)
    throw new Error(
      'Catálogo incompleto: no se encontró la empresa "Laboratorio INSITU". ¿Corriste init.sql?',
    );

  const [suc] = await db
    .select()
    .from(sucursal)
    .where(and(eq(sucursal.empresaId, emp.id), eq(sucursal.nombre, 'Arica')));
  if (!suc)
    throw new Error('Catálogo incompleto: no se encontró la sucursal "Arica". ¿Corriste init.sql?');

  const ubicaciones = await db.select().from(ubicacion).where(eq(ubicacion.sucursalId, suc.id));
  const ubLab = await requireByName(ubicaciones, 'Laboratorio', 'ubicaciones');
  const ubBodega = await requireByName(ubicaciones, 'Bodega', 'ubicaciones');
  const ubTerreno = await requireByName(ubicaciones, 'Terreno', 'ubicaciones');

  // Nombres reales post Fix #4 (2026-08-04) — NO los nombres legacy
  // pre-renombre ('Balanza', 'Horno', etc., que ya no existen como tales).
  const tiposDb = await db.select().from(tipoEquipo);
  const NOMBRES_TIPOS = [
    'Balanzas Analíticas',
    'Hornos',
    'Tamices',
    'Cono Abrams',
    'Densímetros',
    'Molde CBR',
    'Prensa Compresión',
    'Airímetro',
  ];
  const tMap = Object.fromEntries(
    await Promise.all(
      NOMBRES_TIPOS.map(async (n) => [n, await requireByName(tiposDb, n, 'tipos_equipo')] as const),
    ),
  );

  const [lab] = await db
    .select()
    .from(laboratorioCalibrador)
    .where(eq(laboratorioCalibrador.nombre, 'CESMEC'));
  if (!lab)
    throw new Error(
      'Catálogo incompleto: no se encontró el laboratorio "CESMEC". ¿Corriste init.sql?',
    );

  const procs = await db.select().from(procedimientoEquipo);
  const proc001 = procs.find((p) => p.codigo === 'PT-001');
  if (!proc001)
    throw new Error(
      'Catálogo incompleto: no se encontró el procedimiento "PT-001". ¿Corriste init.sql?',
    );

  type EstadoControl = 'vencida' | 'proxima_a_vencer' | 'vigente';
  const defs: Array<{
    tipo: string;
    nombre: string;
    marca: string;
    modelo: string;
    serie: string;
    ubicacionId: number;
    cal: EstadoControl;
    ver: EstadoControl;
    man: EstadoControl;
    frecCal: number;
    frecVer: number;
    frecMan: number;
  }> = [
    {
      tipo: 'Balanzas Analíticas',
      nombre: 'Balanza analítica de precisión',
      marca: 'Mettler Toledo',
      modelo: 'ME204',
      serie: 'B2024001',
      ubicacionId: ubLab.id,
      cal: 'vencida',
      ver: 'vigente',
      man: 'proxima_a_vencer',
      frecCal: 12,
      frecVer: 6,
      frecMan: 6,
    },
    {
      tipo: 'Hornos',
      nombre: 'Horno de secado de muestras',
      marca: 'Binder',
      modelo: 'FD-115',
      serie: 'H2024002',
      ubicacionId: ubLab.id,
      cal: 'proxima_a_vencer',
      ver: 'vencida',
      man: 'vigente',
      frecCal: 12,
      frecVer: 6,
      frecMan: 12,
    },
    {
      tipo: 'Tamices',
      nombre: 'Set de tamices granulométricos ASTM',
      marca: 'Gilson',
      modelo: 'TS-1A',
      serie: 'T2024003',
      ubicacionId: ubLab.id,
      cal: 'vigente',
      ver: 'proxima_a_vencer',
      man: 'vencida',
      frecCal: 12,
      frecVer: 3,
      frecMan: 6,
    },
    {
      tipo: 'Cono Abrams',
      nombre: 'Cono de Abrams para consistencia hormigón',
      marca: 'Humboldt',
      modelo: 'H-2922',
      serie: 'CA2024004',
      ubicacionId: ubTerreno.id,
      cal: 'vencida',
      ver: 'vencida',
      man: 'vigente',
      frecCal: 12,
      frecVer: 6,
      frecMan: 12,
    },
    {
      tipo: 'Densímetros',
      nombre: 'Densímetro nuclear Troxler',
      marca: 'Troxler',
      modelo: '3440',
      serie: 'DN2024005',
      ubicacionId: ubTerreno.id,
      cal: 'proxima_a_vencer',
      ver: 'vigente',
      man: 'proxima_a_vencer',
      frecCal: 12,
      frecVer: 6,
      frecMan: 6,
    },
    {
      tipo: 'Molde CBR',
      nombre: 'Molde CBR para ensayo de suelos',
      marca: 'Controls',
      modelo: '50-C0200',
      serie: 'CBR2024006',
      ubicacionId: ubBodega.id,
      cal: 'vigente',
      ver: 'vigente',
      man: 'vigente',
      frecCal: 24,
      frecVer: 12,
      frecMan: 12,
    },
    {
      tipo: 'Prensa Compresión',
      nombre: 'Prensa de compresión 2000 kN',
      marca: 'Controls',
      modelo: '50-C6000',
      serie: 'PRE2024007',
      ubicacionId: ubLab.id,
      cal: 'vencida',
      ver: 'proxima_a_vencer',
      man: 'vencida',
      frecCal: 12,
      frecVer: 6,
      frecMan: 6,
    },
    {
      tipo: 'Airímetro',
      nombre: 'Airímetro para contenido de aire en hormigón',
      marca: 'Humboldt',
      modelo: 'H-2780',
      serie: 'AIR2024008',
      ubicacionId: ubTerreno.id,
      cal: 'vigente',
      ver: 'vencida',
      man: 'vigente',
      frecCal: 12,
      frecVer: 6,
      frecMan: 6,
    },
  ];

  const offsetMap: Record<EstadoControl, number> = {
    vencida: -15,
    proxima_a_vencer: 15,
    vigente: 90,
  };

  for (let i = 0; i < defs.length; i++) {
    const def = defs[i]!;
    const tipo = tMap[def.tipo]!;
    // Mismo correlativo global que usa equipo.service.ts createEquipo (Fase
    // 1B) — nunca un literal hardcodeado, para no colisionar con códigos que
    // la API asigne después de correr este seed.
    const seqResult = await db.execute(sql`SELECT nextval('equipos_codigo_seq') AS nextval`);
    const codigo = String(seqResult.rows[0]?.nextval).padStart(4, '0');

    const [eq] = await db
      .insert(equipo)
      .values({
        codigo,
        tipoEquipoId: tipo.id,
        nombre: def.nombre,
        marca: def.marca,
        modelo: def.modelo,
        numeroSerie: def.serie,
        empresaId: emp.id,
        sucursalId: suc.id,
        ubicacionId: def.ubicacionId,
        responsableId: STUB_USER_ID,
        fechaAdquisicion: dateOffset(-365),
        usoLaboratorio: true,
        disponibleOt: true,
        requiereCalibracion: true,
        frecuenciaCalibracionMeses: def.frecCal,
        diasAvisoCalibracion: DIAS_AVISO_DEMO,
        requiereVerificacion: true,
        frecuenciaVerificacionMeses: def.frecVer,
        diasAvisoVerificacion: DIAS_AVISO_DEMO,
        requiereMantenimiento: true,
        frecuenciaMantenimientoMeses: def.frecMan,
        diasAvisoMantenimiento: DIAS_AVISO_DEMO,
      })
      .returning();

    logger.info({ codigo: eq!.codigo, nombre: eq!.nombre }, '✓ Equipo insertado');

    const proxCal = dateOffset(offsetMap[def.cal]);
    const fechaCal = addMonths(proxCal, -def.frecCal);
    await db.insert(historialCalibracion).values({
      equipoId: eq!.id,
      fechaCalibracion: fechaCal,
      proximaCalibracion: proxCal,
      fechaAviso: dateOffset(offsetMap[def.cal] - DIAS_AVISO_DEMO),
      laboratorioCalibrador: lab.nombre,
      procedimiento: proc001.codigo,
      nCertificado: `CERT-${codigo}-CAL`,
      estadoIngreso: 'aprobado',
      registradoPorId: STUB_USER_ID,
      observaciones: `Estado esperado: ${def.cal}`,
    });

    const proxVer = dateOffset(offsetMap[def.ver]);
    const fechaVer = addMonths(proxVer, -def.frecVer);
    await db.insert(historialVerificacion).values({
      equipoId: eq!.id,
      fechaVerificacion: fechaVer,
      proximaVerificacion: proxVer,
      fechaAviso: dateOffset(offsetMap[def.ver] - DIAS_AVISO_DEMO),
      responsableId: STUB_USER_ID,
      nRegistro: `REG-${codigo}-VER`,
      estadoIngreso: 'aprobado',
      metodo: `Verificacion esperada: ${def.ver}`,
      procedimiento: null,
    });

    const proxMan = dateOffset(offsetMap[def.man]);
    const fechaMan = addMonths(proxMan, -def.frecMan);
    await db.insert(historialMantenimiento).values({
      equipoId: eq!.id,
      fechaMantenimiento: fechaMan,
      proximoMantenimiento: proxMan,
      fechaAviso: dateOffset(offsetMap[def.man] - DIAS_AVISO_DEMO),
      tipo: 'preventivo',
      estadoIngreso: MANTENIMIENTO_ESTADO_DEMO[def.man],
      responsableId: STUB_USER_ID,
      observaciones: `Mantenimiento esperado: ${def.man}`,
    });
  }

  logger.info('✅ Seed de demo completado. 8 equipos + 24 historiales insertados.');
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, '❌ Error en seed de demo');
  process.exit(1);
});
