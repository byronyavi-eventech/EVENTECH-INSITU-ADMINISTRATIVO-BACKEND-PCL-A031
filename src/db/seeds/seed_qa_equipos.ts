/**
 * src/db/seeds/seed_qa_equipos.ts
 * Siembra los 7 equipos de prueba QA-01..QA-07 — MAPEO-DATOS-PRUEBA.md, sección 9.
 *
 * Idempotente por numero_serie: si un equipo QA-SN-00X ya existe, se salta
 * (no duplica ni sus historiales).
 *
 * Discrepancia encontrada y resuelta (reportada al usuario antes de sembrar):
 * el mapeo asume 8 tipos_equipo "legacy renombrados" (Balanzas Analíticas,
 * Hornos, Tamices, Molde CBR, Prensa Compresión, Densímetros...) que en
 * realidad NO existen así en la DB QA real (mismo tipo de drift ya
 * documentado en Capa 1 para "Balanzas Analíticas" vs "Balanzas
 * Electrónicas", pero más extendido). Resolución:
 *   - Balanzas Analíticas → sustituto real "Balanzas Electrónicas" (id 7)
 *   - Prensa Compresión   → sustituto real "Equipo de Compresión"
 *   - Manómetros          → existe tal cual, sin cambios
 *   - Hornos, Tamices, Densímetros, Molde CBR → NO existe ningún
 *     equivalente en el catálogo real; se crean como tipos_equipo nuevos
 *     bajo sus grupos ya existentes (Hornos, Tamizado, Equipo Radiación,
 *     Ensayo CBR respectivamente).
 *
 * Corrección post-revisión (usuario, 2026-08-20): "Molde CBR" se sembró
 * primero como sustituto de "Prensa CBR" (mismo grupo, pero pieza física
 * distinta del ensayo — molde vs. prensa de carga). Revisado y corregido:
 * ahora es un tipo_equipo nuevo propio bajo el grupo "Ensayo CBR", mismo
 * criterio que Hornos/Tamices/Densímetros.
 *
 * Asociaciones equipo_tipos_ensayo: la sección 5 de MAPEO-DATOS-ENSAYOS.md
 * proponía nombres de ensayo genéricos que no coinciden 1:1 con los 22 tipos
 * realmente sembrados por seed_qa_ensayos.ts. Se sustituyó por el tipo de
 * ensayo real más cercano en cada caso; QA-05 queda sin asociaciones (no hay
 * match razonable para Manómetros en el catálogo de ensayos, y de todas
 * formas es el caso de prueba "sin historial").
 *
 * SOLO para bases de QA/desarrollo descartables.
 */
import 'dotenv/config';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../index.js';
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
  usuario,
} from '../schema/index.js';
import { tipoEnsayo } from '../schema/catalog.schema.js';
import { logger } from '../../utils/logger.js';

const STUB_USER_ID = '1'; // mismo placeholder que seed_demo_equipos.ts / getUserId() fallback.

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0]!;
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0]!;
}

async function nextCodigo(): Promise<string> {
  const r = await db.execute(sql`SELECT nextval('equipos_codigo_seq') AS nextval`);
  return String(r.rows[0]?.nextval).padStart(4, '0');
}

/** Busca o crea un tipo_equipo por nombre bajo un grupo dado (para los 3 sin equivalente real). */
async function upsertTipoEquipo(nombre: string, grupoNombre: string): Promise<number> {
  const [existing] = await db.select().from(tipoEquipo).where(eq(tipoEquipo.nombre, nombre));
  if (existing) return existing.id;

  const [g] = await db.select().from(grupo).where(eq(grupo.nombre, grupoNombre));
  if (!g) throw new Error(`Grupo "${grupoNombre}" no encontrado — no se puede crear tipo_equipo "${nombre}".`);

  const [created] = await db.insert(tipoEquipo).values({ nombre, grupoId: g.id }).returning();
  logger.info({ nombre, grupo: grupoNombre }, '＋ tipo_equipo creado (sin equivalente real en catálogo)');
  return created!.id;
}

async function findTipoEnsayoId(nombre: string): Promise<number> {
  const [row] = await db.select({ id: tipoEnsayo.id }).from(tipoEnsayo).where(eq(tipoEnsayo.nombreTipoEnsayo, nombre));
  if (!row) throw new Error(`tipo_ensayo "${nombre}" no encontrado — ¿corriste seed_qa_ensayos.ts antes?`);
  return row.id;
}

type CalDef = {
  fechaCalibracion: string;
  proximaCalibracion: string;
  fechaAviso: string | null;
  laboratorioCalibrador: string;
  procedimiento: string;
  nCertificado: string;
  estadoIngreso: 'aprobado' | 'en_proceso';
  observaciones: string;
};
type VerDef = {
  fechaVerificacion: string;
  proximaVerificacion: string;
  fechaAviso: string | null;
  metodo: string;
  procedimiento: string;
  nRegistro: string;
  estadoIngreso: 'aprobado' | 'en_proceso';
};
type ManDef = {
  fechaMantenimiento: string;
  proximoMantenimiento: string | null;
  tipo: 'preventivo' | 'correctivo';
  estadoIngreso: 'operativo' | 'en_mantenimiento' | 'dado_de_baja' | 'fuera_de_servicio';
  observaciones: string;
};

interface EquipoQADef {
  serie: string;
  codigoEsperado: string; // solo para el log de verificación, no se hardcodea el código real
  tipoNombre: string;
  nombre: string;
  marca: string;
  modelo: string;
  requiereCalibracion: boolean;
  frecCal?: number;
  avisoCal?: number;
  requiereVerificacion: boolean;
  frecVer?: number;
  avisoVer?: number;
  requiereMantenimiento: boolean;
  frecMan?: number;
  avisoMan?: number;
  estadoPersistido?: 'dado_de_baja';
  fechaBaja?: string;
  motivoBaja?: string;
  observacionesEquipo?: string;
  precisionEquipo?: string;
  rangoMedicion?: string;
  cal?: CalDef;
  ver?: VerDef;
  man?: ManDef;
  tiposEnsayo: string[];
  estadoGeneralEsperado: string;
}

async function main() {
  logger.info('🌱 Sembrando equipos de prueba QA (QA-01..QA-07)...');

  await db
    .insert(usuario)
    .values({ id: STUB_USER_ID, nombre: 'Usuario Sistema (temporal)', rol: 'sistema' })
    .onConflictDoNothing();

  const [emp] = await db.select().from(empresa).where(eq(empresa.nombre, 'Laboratorio INSITU'));
  if (!emp) throw new Error('Catálogo incompleto: falta empresa "Laboratorio INSITU".');
  const [suc] = await db
    .select()
    .from(sucursal)
    .where(and(eq(sucursal.empresaId, emp.id), eq(sucursal.nombre, 'Arica')));
  if (!suc) throw new Error('Catálogo incompleto: falta sucursal "Arica".');
  const [ubLab] = await db
    .select()
    .from(ubicacion)
    .where(and(eq(ubicacion.sucursalId, suc.id), eq(ubicacion.nombre, 'Laboratorio')));
  if (!ubLab) throw new Error('Catálogo incompleto: falta ubicación "Laboratorio".');

  // Tipos con equivalente real directo.
  const [balanzasElectronicas] = await db.select().from(tipoEquipo).where(eq(tipoEquipo.nombre, 'Balanzas Electrónicas'));
  const [equipoCompresion] = await db.select().from(tipoEquipo).where(eq(tipoEquipo.nombre, 'Equipo de Compresión'));
  const [manometros] = await db.select().from(tipoEquipo).where(eq(tipoEquipo.nombre, 'Manómetros'));
  if (!balanzasElectronicas || !equipoCompresion || !manometros) {
    throw new Error('Catálogo incompleto: falta alguno de los tipos_equipo sustitutos reales esperados.');
  }

  // Tipos sin equivalente real — se crean bajo sus grupos ya existentes.
  const hornosId = await upsertTipoEquipo('Hornos', 'Hornos');
  const tamicesId = await upsertTipoEquipo('Tamices', 'Tamizado');
  const densimetrosId = await upsertTipoEquipo('Densímetros', 'Equipo Radiación');
  const moldeCbrId = await upsertTipoEquipo('Molde CBR', 'Ensayo CBR');

  const hoy = dateOffset(0);

  const defs: EquipoQADef[] = [
    {
      serie: 'QA-SN-001',
      codigoEsperado: '(auto)',
      tipoNombre: 'Balanzas Electrónicas',
      nombre: 'Balanza Analítica QA-Vigente',
      marca: 'Mettler Toledo',
      modelo: 'ME204E',
      requiereCalibracion: true,
      frecCal: 12,
      avisoCal: 30,
      requiereVerificacion: true,
      frecVer: 6,
      avisoVer: 30,
      requiereMantenimiento: true,
      frecMan: 12,
      cal: {
        fechaCalibracion: addMonths(dateOffset(90), -12),
        proximaCalibracion: dateOffset(90),
        fechaAviso: dateOffset(60),
        laboratorioCalibrador: 'CESMEC',
        procedimiento: 'PT-001',
        nCertificado: 'CERT-QA001-CAL',
        estadoIngreso: 'aprobado',
        observaciones: 'Calibración anual completada. Sin observaciones.',
      },
      ver: {
        fechaVerificacion: addMonths(dateOffset(90), -6),
        proximaVerificacion: dateOffset(90),
        fechaAviso: dateOffset(60),
        metodo: 'Comparación con patrón certificado',
        procedimiento: 'PT-001',
        nRegistro: 'REG-QA001-VER',
        estadoIngreso: 'aprobado',
      },
      man: {
        fechaMantenimiento: addMonths(hoy, -6),
        proximoMantenimiento: addMonths(hoy, 6),
        tipo: 'preventivo',
        estadoIngreso: 'operativo',
        observaciones: 'Mantenimiento preventivo sin novedades.',
      },
      tiposEnsayo: ['Granulometría por Tamizado', 'Contenido de Humedad Natural', 'Ensayo Proctor Modificado'],
      estadoGeneralEsperado: 'activo',
    },
    {
      serie: 'QA-SN-002',
      codigoEsperado: '(auto)',
      tipoNombre: 'Hornos',
      nombre: 'Horno Secado QA-ProxAVencer',
      marca: 'Binder',
      modelo: 'FD-53',
      requiereCalibracion: true,
      frecCal: 12,
      avisoCal: 30,
      requiereVerificacion: false,
      requiereMantenimiento: true,
      frecMan: 12,
      cal: {
        fechaCalibracion: addMonths(dateOffset(15), -12),
        proximaCalibracion: dateOffset(15),
        fechaAviso: dateOffset(-15),
        laboratorioCalibrador: 'DICTUC ISO-17025',
        procedimiento: 'LI-IT-MS-01',
        nCertificado: 'CERT-QA002-CAL',
        estadoIngreso: 'aprobado',
        observaciones: 'Próxima calibración programada. Contactar DICTUC con anticipación.',
      },
      man: {
        fechaMantenimiento: addMonths(hoy, -6),
        proximoMantenimiento: addMonths(hoy, 6),
        tipo: 'preventivo',
        estadoIngreso: 'operativo',
        observaciones: 'Mantenimiento preventivo sin novedades.',
      },
      tiposEnsayo: ['Contenido de Humedad Natural'],
      estadoGeneralEsperado: 'activo',
    },
    {
      serie: 'QA-SN-003',
      codigoEsperado: '(auto)',
      tipoNombre: 'Tamices',
      nombre: 'Set Tamices QA-CalVencida',
      marca: 'Gilson',
      modelo: 'TS-2B',
      requiereCalibracion: true,
      frecCal: 12,
      avisoCal: 30,
      requiereVerificacion: true,
      frecVer: 3,
      avisoVer: 30,
      requiereMantenimiento: false,
      cal: {
        fechaCalibracion: addMonths(dateOffset(-15), -12),
        proximaCalibracion: dateOffset(-15),
        fechaAviso: dateOffset(-45),
        laboratorioCalibrador: 'CESMEC',
        procedimiento: 'PT-001',
        nCertificado: 'CERT-QA003-CAL',
        estadoIngreso: 'aprobado',
        observaciones: 'Calibración vencida. Pendiente de renovación.',
      },
      ver: {
        fechaVerificacion: addMonths(dateOffset(60), -3),
        proximaVerificacion: dateOffset(60),
        fechaAviso: dateOffset(30),
        metodo: 'Comparación con patrón certificado',
        procedimiento: 'PT-001',
        nRegistro: 'REG-QA003-VER',
        estadoIngreso: 'aprobado',
      },
      tiposEnsayo: ['Granulometría por Tamizado', 'Granulometría por Hidrometría'],
      estadoGeneralEsperado: 'inactivo',
    },
    {
      serie: 'QA-SN-004',
      codigoEsperado: '(auto)',
      tipoNombre: 'Molde CBR',
      nombre: 'Molde CBR QA-DadoDeBaja',
      marca: 'Controls',
      modelo: '50-C0201',
      requiereCalibracion: true,
      frecCal: 12,
      avisoCal: 30,
      requiereVerificacion: false,
      requiereMantenimiento: true,
      frecMan: 12,
      estadoPersistido: 'dado_de_baja',
      fechaBaja: dateOffset(-30),
      motivoBaja: 'Daño irreparable en ensayo de campo. Reemplazado por unidad nueva.',
      cal: {
        fechaCalibracion: addMonths(hoy, -13),
        proximaCalibracion: addMonths(hoy, -1),
        fechaAviso: addMonths(hoy, -2),
        laboratorioCalibrador: 'CESMEC',
        procedimiento: 'PT-001',
        nCertificado: 'CERT-QA004-CAL',
        estadoIngreso: 'aprobado',
        observaciones: 'Última calibración antes de la baja del equipo.',
      },
      man: {
        fechaMantenimiento: dateOffset(-30),
        proximoMantenimiento: null,
        tipo: 'correctivo',
        estadoIngreso: 'dado_de_baja',
        observaciones: 'Equipo dado de baja tras daño irreparable en terreno.',
      },
      tiposEnsayo: ['Ensayo CBR (sobre muestra compactada)', 'Ensayo Proctor Modificado'],
      estadoGeneralEsperado: 'dado_de_baja',
    },
    {
      serie: 'QA-SN-005',
      codigoEsperado: '(auto)',
      tipoNombre: 'Manómetros',
      nombre: 'Manómetro QA-SinHistorial',
      marca: 'Winters',
      modelo: 'PFQ807',
      requiereCalibracion: true,
      frecCal: 12,
      avisoCal: 30,
      requiereVerificacion: true,
      frecVer: 6,
      avisoVer: 30,
      requiereMantenimiento: true,
      frecMan: 12,
      avisoMan: 30,
      // Sin cal/ver/man — prueba la regla: control obligatorio sin historial = inactivo.
      tiposEnsayo: [],
      estadoGeneralEsperado: 'inactivo',
    },
    {
      serie: 'QA-SN-006',
      codigoEsperado: '(auto)',
      tipoNombre: 'Equipo de Compresión',
      nombre: 'Prensa 2000kN QA-HistorialCompleto',
      marca: 'Controls',
      modelo: '50-C6200',
      requiereCalibracion: true,
      frecCal: 12,
      avisoCal: 30,
      requiereVerificacion: true,
      frecVer: 6,
      avisoVer: 30,
      requiereMantenimiento: true,
      frecMan: 6,
      avisoMan: 30,
      cal: {
        fechaCalibracion: addMonths(hoy, -12),
        proximaCalibracion: dateOffset(30),
        fechaAviso: dateOffset(0),
        laboratorioCalibrador: 'CESMEC',
        procedimiento: 'PT-001',
        nCertificado: 'CERT-QA006-CAL-2025',
        estadoIngreso: 'aprobado',
        observaciones: 'Calibración conforme ISO 17025.',
      },
      ver: {
        fechaVerificacion: addMonths(hoy, -6),
        proximaVerificacion: dateOffset(45),
        fechaAviso: dateOffset(15),
        metodo: 'Comparación con patrón certificado',
        procedimiento: 'LI-IT-MS-01',
        nRegistro: 'REG-QA006-VER-2025',
        estadoIngreso: 'aprobado',
      },
      man: {
        fechaMantenimiento: addMonths(hoy, -6),
        proximoMantenimiento: dateOffset(90),
        tipo: 'preventivo',
        estadoIngreso: 'operativo',
        observaciones:
          'Mantenimiento preventivo semestral. Se lubricaron partes móviles y se verificó sensor de carga.',
      },
      tiposEnsayo: [
        'Compresión de Probetas Cilíndricas',
        'Resistencia a Flexión (Viga Simple)',
        'Resistencia al Hendimiento',
      ],
      estadoGeneralEsperado: 'activo',
    },
    {
      serie: 'QA-SN-007',
      codigoEsperado: '(auto)',
      tipoNombre: 'Densímetros',
      nombre: 'Densímetro Nuclear QA-TextosCompletos',
      marca: 'Troxler',
      modelo: '3430',
      requiereCalibracion: true,
      frecCal: 12,
      avisoCal: 45,
      requiereVerificacion: true,
      frecVer: 6,
      avisoVer: 45,
      requiereMantenimiento: true,
      frecMan: 12,
      avisoMan: 30,
      observacionesEquipo:
        'Equipo de uso exclusivo en terreno. Requiere autorización de Jefatura para traslado. Certificado de fuente radioactiva vigente hasta 2027.',
      precisionEquipo: '±0.5%',
      rangoMedicion: '0–2200 kg/m³',
      cal: {
        fechaCalibracion: addMonths(dateOffset(180), -12),
        proximaCalibracion: dateOffset(180),
        fechaAviso: dateOffset(135),
        laboratorioCalibrador: 'Servicio Nacional de Metrología (SNM-INEN)',
        procedimiento: 'NCh-ISO/IEC 17025:2017 / NT-CAL-DNO-001',
        nCertificado: 'CERT-QA007-DNO-2025',
        estadoIngreso: 'aprobado',
        observaciones: 'Calibración fuente Cs-137. Organismo autorizado por CCHEN. Informe N° 2025-DNO-0341.',
      },
      ver: {
        fechaVerificacion: addMonths(dateOffset(90), -6),
        proximaVerificacion: dateOffset(90),
        fechaAviso: dateOffset(45),
        metodo: 'Verificación con bloque patrón Mg certificado',
        procedimiento: 'LI-IT-MS-01 Rev.3',
        nRegistro: 'REG-QA007-VER',
        estadoIngreso: 'aprobado',
      },
      man: {
        fechaMantenimiento: addMonths(hoy, -6),
        proximoMantenimiento: addMonths(hoy, 6),
        tipo: 'preventivo',
        estadoIngreso: 'operativo',
        observaciones: 'Revisión de sellos, fuente y pantalla. Firmware actualizado a v3.2.1. Sin anomalías.',
      },
      tiposEnsayo: ['Densidad In Situ (Método Cono de Arena)', 'Densidad In Situ (Método Nuclear)'],
      estadoGeneralEsperado: 'activo',
    },
  ];

  const resumen: Array<{ serie: string; codigo: string; nombre: string; esperado: string }> = [];

  for (const def of defs) {
    const [existing] = await db.select().from(equipo).where(eq(equipo.numeroSerie, def.serie));
    if (existing) {
      logger.info({ serie: def.serie }, '⏭  Equipo ya existe, se salta (idempotencia por numero_serie).');
      resumen.push({ serie: def.serie, codigo: existing.codigo ?? '(sin código)', nombre: existing.nombre, esperado: def.estadoGeneralEsperado });
      continue;
    }

    const tipoMap: Record<string, number> = {
      'Balanzas Electrónicas': balanzasElectronicas.id,
      Hornos: hornosId,
      Tamices: tamicesId,
      'Molde CBR': moldeCbrId,
      Manómetros: manometros.id,
      'Equipo de Compresión': equipoCompresion.id,
      Densímetros: densimetrosId,
    };
    const tipoEquipoId = tipoMap[def.tipoNombre];
    if (!tipoEquipoId) throw new Error(`Tipo de equipo no resuelto: ${def.tipoNombre}`);

    const codigo = await nextCodigo();

    const [eqRow] = await db
      .insert(equipo)
      .values({
        codigo,
        tipoEquipoId,
        nombre: def.nombre,
        marca: def.marca,
        modelo: def.modelo,
        numeroSerie: def.serie,
        empresaId: emp.id,
        sucursalId: suc.id,
        ubicacionId: ubLab.id,
        estado: def.estadoPersistido ?? 'activo',
        responsableId: STUB_USER_ID,
        fechaAdquisicion: dateOffset(-400),
        fechaBaja: def.fechaBaja ?? null,
        motivoBaja: def.motivoBaja ?? null,
        observaciones: def.observacionesEquipo ?? null,
        precisionEquipo: def.precisionEquipo ?? null,
        rangoMedicion: def.rangoMedicion ?? null,
        usoLaboratorio: true,
        disponibleOt: true,
        requiereCalibracion: def.requiereCalibracion,
        frecuenciaCalibracionMeses: def.frecCal ?? null,
        diasAvisoCalibracion: def.avisoCal ?? null,
        requiereVerificacion: def.requiereVerificacion,
        frecuenciaVerificacionMeses: def.frecVer ?? null,
        diasAvisoVerificacion: def.avisoVer ?? null,
        requiereMantenimiento: def.requiereMantenimiento,
        frecuenciaMantenimientoMeses: def.frecMan ?? null,
        diasAvisoMantenimiento: def.avisoMan ?? null,
      })
      .returning();

    logger.info({ codigo: eqRow!.codigo, serie: def.serie, nombre: def.nombre }, '✓ Equipo QA insertado');

    if (def.cal) {
      await db.insert(historialCalibracion).values({
        equipoId: eqRow!.id,
        fechaCalibracion: def.cal.fechaCalibracion,
        proximaCalibracion: def.cal.proximaCalibracion,
        fechaAviso: def.cal.fechaAviso,
        laboratorioCalibrador: def.cal.laboratorioCalibrador,
        procedimiento: def.cal.procedimiento,
        nCertificado: def.cal.nCertificado,
        estadoIngreso: def.cal.estadoIngreso,
        registradoPorId: STUB_USER_ID,
        observaciones: def.cal.observaciones,
      });
    }
    if (def.ver) {
      await db.insert(historialVerificacion).values({
        equipoId: eqRow!.id,
        fechaVerificacion: def.ver.fechaVerificacion,
        proximaVerificacion: def.ver.proximaVerificacion,
        fechaAviso: def.ver.fechaAviso,
        responsableId: STUB_USER_ID,
        metodo: def.ver.metodo,
        procedimiento: def.ver.procedimiento,
        nRegistro: def.ver.nRegistro,
        estadoIngreso: def.ver.estadoIngreso,
      });
    }
    if (def.man) {
      await db.insert(historialMantenimiento).values({
        equipoId: eqRow!.id,
        fechaMantenimiento: def.man.fechaMantenimiento,
        proximoMantenimiento: def.man.proximoMantenimiento,
        tipo: def.man.tipo,
        estadoIngreso: def.man.estadoIngreso,
        responsableId: STUB_USER_ID,
        observaciones: def.man.observaciones,
      });
    }

    for (const nombreTipoEnsayo of def.tiposEnsayo) {
      const tipoEnsayoId = await findTipoEnsayoId(nombreTipoEnsayo);
      await db
        .insert(equipoTipoEnsayo)
        .values({ equipoId: eqRow!.id, tipoEnsayoId })
        .onConflictDoNothing();
    }

    resumen.push({ serie: def.serie, codigo: eqRow!.codigo!, nombre: def.nombre, esperado: def.estadoGeneralEsperado });
  }

  logger.info('✅ Seed de equipos QA completado.');
  logger.info('--- Resumen: equipo → estadoGeneral esperado ---');
  for (const r of resumen) {
    logger.info(`${r.serie} [${r.codigo}] ${r.nombre} → esperado: ${r.esperado}`);
  }

  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, '❌ Error en seed de equipos QA');
  process.exit(1);
});
