/**
 * src/seeds/inject_filtros_demo.ts
 * Inyección de datos enriquecidos con múltiples estados, sucursales, grupos
 * e historiales completos para probar filtros en el frontend.
 *
 * ⚠️ UTILIDAD DE QA MANUAL — NUNCA ejecutar en UAT/producción ni de forma
 * automática (no está wireada a ningún script npm ni a Dockerfile/
 * docker-compose, y debe seguir así). A diferencia de seed_demo_equipos.ts,
 * este script NO solo agrega equipos/historiales — también INSERTA
 * catálogo fabricado propio (4 sucursales, grupos y tipos_equipo con
 * nombres/prefijos que no existen en el levantamiento real del cliente,
 * ej. "Balanza Analítica"/BALA vs. la real "Balanzas Analíticas"/BAL) que
 * queda mezclado permanentemente con el catálogo real si se corre. Limpieza
 * pre-GitHub (2026-08-07): se detectó que una corrida anterior de este
 * script dejó 15 tipos_equipo fantasma en la DB — ver CLAUDE.md para el
 * detalle y la decisión pendiente de limpiarlos.
 */
import 'dotenv/config';
import { db } from '../index.js';
import { eq } from 'drizzle-orm';
import {
  empresa,
  sucursal,
  ubicacion,
  grupo,
  tipoEquipo,
  laboratorioCalibrador,
  procedimientoEquipo,
  equipo,
  historialCalibracion,
  historialVerificacion,
  historialMantenimiento,
  usuario,
  unidadMedida,
} from '../schema/index.js';
import { logger } from '../../utils/logger.js';

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

async function main() {
  logger.info('🌱 Iniciando inyección masiva para filtros...');

  // 1. Usuarios
  await db
    .insert(usuario)
    .values([
      { id: '1', nombre: 'Juan Pérez', email: 'jperez@laboratorio.cl', rol: 'Jefe de Laboratorio' },
      {
        id: '2',
        nombre: 'María González',
        email: 'mgonzalez@laboratorio.cl',
        rol: 'Supervisora QA',
      },
      {
        id: '3',
        nombre: 'Carlos Rodríguez',
        email: 'crodriguez@laboratorio.cl',
        rol: 'Técnico de Calibración',
      },
    ])
    .onConflictDoNothing();

  // 2. Empresa
  let [emp] = await db.select().from(empresa).limit(1);
  if (!emp) {
    [emp] = await db.insert(empresa).values({ nombre: 'Laboratorio INSITU' }).returning();
  }

  // 3. Sucursales (Arica, Santiago, Antofagasta, Concepción, Valparaíso)
  const nombresSucursales = ['Arica', 'Santiago', 'Antofagasta', 'Concepción', 'Valparaíso'];
  for (const nombre of nombresSucursales) {
    await db.insert(sucursal).values({ empresaId: emp!.id, nombre }).onConflictDoNothing();
  }
  const sucursales = await db.select().from(sucursal).where(eq(sucursal.empresaId, emp!.id));
  const sMap = Object.fromEntries(sucursales.map((s) => [s.nombre, s.id]));

  // 4. Ubicaciones por sucursal
  const ubicacionesTotales = [];
  for (const s of sucursales) {
    const ubs = await db
      .insert(ubicacion)
      .values([
        { sucursalId: s.id, nombre: 'Laboratorio Principal' },
        { sucursalId: s.id, nombre: 'Bodega Central' },
        { sucursalId: s.id, nombre: 'Terreno / Obras' },
        { sucursalId: s.id, nombre: 'Control de Calidad' },
      ])
      .onConflictDoNothing()
      .returning();
    ubicacionesTotales.push(...ubs);
  }
  // Si ya existían, seleccionamos todas
  const allUbs = await db.select().from(ubicacion);

  function getUbicacionId(sucursalNombre: string, ubicacionNombre: string): number {
    const sId = sMap[sucursalNombre];
    const u = allUbs.find(
      (ub) =>
        ub.sucursalId === sId &&
        (ub.nombre.includes(ubicacionNombre) || ub.nombre === ubicacionNombre),
    );
    if (u) return u.id;
    const fallback = allUbs.find((ub) => ub.sucursalId === sId);
    return fallback ? fallback.id : allUbs[0]!.id;
  }

  // 5. Grupos
  const NOMBRES_GRUPOS = [
    'Balanzas',
    'Hornos',
    'Tamizado',
    'Hormigón',
    'Equipo Radiación',
    'Ensayo CBR',
    'Prensas',
    'Control Hormigones',
    'Suelos',
    'Asfaltos',
    'Instrumentación Térmica',
    'Análisis Químico',
  ];
  await db
    .insert(grupo)
    .values(NOMBRES_GRUPOS.map((nombre) => ({ nombre })))
    .onConflictDoNothing();
  const grupos = await db.select().from(grupo);
  const gMap = Object.fromEntries(grupos.map((g) => [g.nombre, g.id]));

  // 6. Tipos de equipo
  const defTipos = [
    { nombre: 'Balanza Analítica', prefijoCodigo: 'BALA', grupoId: gMap['Balanzas']! },
    { nombre: 'Balanza de Gran Capacidad', prefijoCodigo: 'BALG', grupoId: gMap['Balanzas']! },
    { nombre: 'Horno de Secado Muestras', prefijoCodigo: 'HORN', grupoId: gMap['Hornos']! },
    { nombre: 'Mufla Eléctrica', prefijoCodigo: 'MUF', grupoId: gMap['Hornos']! },
    { nombre: 'Set Tamices ASTM', prefijoCodigo: 'TAMI', grupoId: gMap['Tamizado']! },
    { nombre: 'Tamizadora Electromagnética', prefijoCodigo: 'TAME', grupoId: gMap['Tamizado']! },
    { nombre: 'Cono de Abrams', prefijoCodigo: 'CONO', grupoId: gMap['Hormigón']! },
    { nombre: 'Densímetro Nuclear', prefijoCodigo: 'DENS', grupoId: gMap['Equipo Radiación']! },
    { nombre: 'Prensa CBR/Marshall', prefijoCodigo: 'PCBR', grupoId: gMap['Ensayo CBR']! },
    { nombre: 'Prensa de Compresión 2000kN', prefijoCodigo: 'PREN', grupoId: gMap['Prensas']! },
    { nombre: 'Airímetro Digital', prefijoCodigo: 'AIRI', grupoId: gMap['Control Hormigones']! },
    { nombre: 'Penetrómetro de Suelos', prefijoCodigo: 'PENE', grupoId: gMap['Suelos']! },
    { nombre: 'Viscosímetro Saybolt', prefijoCodigo: 'VISC', grupoId: gMap['Asfaltos']! },
    {
      nombre: 'Termómetro Patrón Calibrado',
      prefijoCodigo: 'TERM',
      grupoId: gMap['Instrumentación Térmica']!,
    },
    {
      nombre: 'Espectrofotómetro UV-Vis',
      prefijoCodigo: 'ESPE',
      grupoId: gMap['Análisis Químico']!,
    },
  ];
  for (const t of defTipos) {
    await db.insert(tipoEquipo).values(t).onConflictDoNothing();
  }
  const tipos = await db.select().from(tipoEquipo);
  const tMap = Object.fromEntries(tipos.map((t) => [t.nombre, t]));

  // 7. Unidades de medida
  const [unGrama] = await db.select().from(unidadMedida).limit(1);

  // 8. Laboratorio calibrador y Procedimientos
  let [labCesmec] = await db
    .select()
    .from(laboratorioCalibrador)
    .where(eq(laboratorioCalibrador.nombre, 'CESMEC'));
  if (!labCesmec) {
    [labCesmec] = await db.insert(laboratorioCalibrador).values({ nombre: 'CESMEC' }).returning();
  }
  let [labDictuc] = await db
    .select()
    .from(laboratorioCalibrador)
    .where(eq(laboratorioCalibrador.nombre, 'DICTUC'));
  if (!labDictuc) {
    [labDictuc] = await db
      .insert(laboratorioCalibrador)
      .values({ nombre: 'DICTUC ISO-17025' })
      .returning();
  }

  let [procCal] = await db.select().from(procedimientoEquipo).limit(1);
  if (!procCal) {
    [procCal] = await db
      .insert(procedimientoEquipo)
      .values({ codigo: 'PROC-CAL-01', descripcion: 'Calibración Estándar ISO 17025' })
      .returning();
  }

  // 9. Matriz de equipos a generar con diversidad de estados, sucursales y grupos
  const nuevosEquipos = [
    // --- ESTADO FINAL: ACTIVO (Todas las verificaciones y calibraciones vigentes u operativas) ---
    {
      codigo: 'BAL-2001',
      tipo: 'Balanza Analítica',
      nombre: 'Balanza Analítica Mettler Toledo ME204T',
      marca: 'Mettler Toledo',
      modelo: 'ME204T',
      serie: 'MT-884920',
      sucursal: 'Santiago',
      ubicacion: 'Laboratorio Principal',
      precisionEquipo: '±0.0001 g',
      rangoMedicion: '0.1 mg - 220 g',
      responsableId: '1',
      estadoBase: 'activo' as const,
      cal: 'vigente',
      ver: 'vigente',
      man: 'operativo',
    },
    {
      codigo: 'HOR-2002',
      tipo: 'Horno de Secado Muestras',
      nombre: 'Horno Memmert UN110 Convección Forzada',
      marca: 'Memmert',
      modelo: 'UN110',
      serie: 'MM-55201',
      sucursal: 'Antofagasta',
      ubicacion: 'Laboratorio Principal',
      precisionEquipo: '±0.5 °C',
      rangoMedicion: '20 °C - 300 °C',
      responsableId: '2',
      estadoBase: 'activo' as const,
      cal: 'proxima_a_vencer',
      ver: 'vigente',
      man: 'operativo',
    },
    {
      codigo: 'DENS-2003',
      tipo: 'Densímetro Nuclear',
      nombre: 'Densímetro Nuclear Troxler 3440 Plus',
      marca: 'Troxler',
      modelo: '3440-P',
      serie: 'TX-90211',
      sucursal: 'Arica',
      ubicacion: 'Terreno / Obras',
      precisionEquipo: '±0.2%',
      rangoMedicion: '1100 - 2400 kg/m3',
      responsableId: '3',
      estadoBase: 'activo' as const,
      cal: 'vigente',
      ver: 'vigente',
      man: 'operativo',
    },
    {
      codigo: 'VISC-2004',
      tipo: 'Viscosímetro Saybolt',
      nombre: 'Viscosímetro Saybolt Universal Doble Tubo',
      marca: 'Koehler',
      modelo: 'K21410',
      serie: 'KH-1029',
      sucursal: 'Concepción',
      ubicacion: 'Control de Calidad',
      precisionEquipo: '±0.1 s',
      rangoMedicion: '15 - 500 s',
      responsableId: '1',
      estadoBase: 'activo' as const,
      cal: 'vigente',
      ver: 'proxima_a_vencer',
      man: 'operativo',
    },
    {
      codigo: 'TERM-2005',
      tipo: 'Termómetro Patrón Calibrado',
      nombre: 'Termómetro Patrón Digital Fluke 1523',
      marca: 'Fluke Calibration',
      modelo: '1523',
      serie: 'FK-39401',
      sucursal: 'Valparaíso',
      ubicacion: 'Laboratorio Principal',
      precisionEquipo: '±0.05 °C',
      rangoMedicion: '-200 °C a 660 °C',
      responsableId: '2',
      estadoBase: 'activo' as const,
      cal: 'vigente',
      ver: 'vigente',
      man: 'operativo',
    },

    // --- ESTADO FINAL: INACTIVO (Calibración/verificación vencida o en proceso/mantenimiento) ---
    {
      codigo: 'PREN-3001',
      tipo: 'Prensa de Compresión 2000kN',
      nombre: 'Prensa Digital de Compresión Hormigón 2000 kN',
      marca: 'Controls Group',
      modelo: 'AUTOMAX 2000',
      serie: 'CG-2022-09',
      sucursal: 'Santiago',
      ubicacion: 'Laboratorio Principal',
      precisionEquipo: 'Clase 1 (±1%)',
      rangoMedicion: '20 - 2000 kN',
      responsableId: '1',
      estadoBase: 'inactivo' as const,
      cal: 'vencida',
      ver: 'vigente',
      man: 'operativo',
    },
    {
      codigo: 'AIRI-3002',
      tipo: 'Airímetro Digital',
      nombre: 'Medidor de Aire Incorporado Type B',
      marca: 'Humboldt',
      modelo: 'H-2780A',
      serie: 'HB-4401',
      sucursal: 'Antofagasta',
      ubicacion: 'Terreno / Obras',
      precisionEquipo: '±0.1%',
      rangoMedicion: '0 - 10%',
      responsableId: '3',
      estadoBase: 'inactivo' as const,
      cal: 'vigente',
      ver: 'vencida',
      man: 'operativo',
    },
    {
      codigo: 'MUF-3003',
      tipo: 'Mufla Eléctrica',
      nombre: 'Mufla de Alta Temperatura 1200°C',
      marca: 'Nabertherm',
      modelo: 'L 9/11/B410',
      serie: 'NB-77812',
      sucursal: 'Concepción',
      ubicacion: 'Laboratorio Principal',
      precisionEquipo: '±2 °C',
      rangoMedicion: '100 °C - 1200 °C',
      responsableId: '2',
      estadoBase: 'inactivo' as const,
      cal: 'vigente',
      ver: 'vigente',
      man: 'en_mantenimiento',
    },
    {
      codigo: 'TAME-3004',
      tipo: 'Tamizadora Electromagnética',
      nombre: 'Tamizadora de Laboratorio Ro-Tap 8 pulgadas',
      marca: 'W.S. Tyler',
      modelo: 'Ro-Tap RX-29',
      serie: 'TY-11204',
      sucursal: 'Arica',
      ubicacion: 'Bodega Central',
      precisionEquipo: '±1%',
      rangoMedicion: '150 - 300 RPM',
      responsableId: '1',
      estadoBase: 'inactivo' as const,
      cal: 'vigente',
      ver: 'vigente',
      man: 'fuera_de_servicio',
    },
    {
      codigo: 'PCBR-3005',
      tipo: 'Prensa CBR/Marshall',
      nombre: 'Prensa Multiensayo CBR y Marshall 50 kN',
      marca: 'Ele International',
      modelo: 'Multitest 50',
      serie: 'EI-88301',
      sucursal: 'Valparaíso',
      ubicacion: 'Laboratorio Principal',
      precisionEquipo: 'Clase 0.5',
      rangoMedicion: '1 - 50 kN',
      responsableId: '3',
      estadoBase: 'inactivo' as const,
      cal: 'en_proceso',
      ver: 'vigente',
      man: 'operativo',
    },

    // --- ESTADO FINAL: DADO DE BAJA ---
    {
      codigo: 'ESPE-4001',
      tipo: 'Espectrofotómetro UV-Vis',
      nombre: 'Espectrofotómetro UV-Vis Doble Haz',
      marca: 'Shimadzu',
      modelo: 'UV-1900i',
      serie: 'SH-40912',
      sucursal: 'Santiago',
      ubicacion: 'Control de Calidad',
      precisionEquipo: '±0.1 nm',
      rangoMedicion: '190 - 1100 nm',
      responsableId: '2',
      estadoBase: 'dado_de_baja' as const,
      cal: 'vencida',
      ver: 'vencida',
      man: 'dado_de_baja',
      fechaBaja: dateOffset(-60),
      motivoBaja:
        'Deterioro irreversible del sistema óptico por humedad y antigüedad superior a 15 años.',
    },
    {
      codigo: 'PENE-4002',
      tipo: 'Penetrómetro de Suelos',
      nombre: 'Penetrómetro de Bolsillo para Suelos',
      marca: 'Soiltest',
      modelo: 'CL-700A',
      serie: 'ST-00291',
      sucursal: 'Antofagasta',
      ubicacion: 'Bodega Central',
      precisionEquipo: '±0.1 kg/cm2',
      rangoMedicion: '0 - 4.5 kg/cm2',
      responsableId: '1',
      estadoBase: 'dado_de_baja' as const,
      cal: 'vencida',
      ver: 'vencida',
      man: 'dado_de_baja',
      fechaBaja: dateOffset(-120),
      motivoBaja: 'Reemplazado por penetrómetro digital de nueva generación ISO.',
    },
  ];

  const offsetMap: Record<string, number> = {
    vencida: -20,
    proxima_a_vencer: 10,
    vigente: 120,
    en_proceso: 15,
  };

  for (const item of nuevosEquipos) {
    const tObj = tMap[item.tipo];
    if (!tObj) {
      logger.warn(`Tipo de equipo no encontrado: ${item.tipo}`);
      continue;
    }

    const sId = sMap[item.sucursal] || sucursales[0]!.id;
    const uId = getUbicacionId(item.sucursal, item.ubicacion);

    // Evitamos duplicar si el código ya existe
    const [existente] = await db.select().from(equipo).where(eq(equipo.codigo, item.codigo));
    if (existente) {
      logger.info({ codigo: item.codigo }, 'El equipo ya existe en BD, omitiendo insert.');
      continue;
    }

    const [eqInsertado] = await db
      .insert(equipo)
      .values({
        codigo: item.codigo,
        tipoEquipoId: tObj.id,
        nombre: item.nombre,
        marca: item.marca,
        modelo: item.modelo,
        numeroSerie: item.serie,
        empresaId: emp!.id,
        sucursalId: sId,
        ubicacionId: uId,
        estado: item.estadoBase,
        responsableId: item.responsableId,
        fechaAdquisicion: dateOffset(-500),
        fechaBaja: item.fechaBaja || null,
        motivoBaja: item.motivoBaja || null,
        // Fase 5 (2026-08-07): capacidad/unidadId/resolucion purgados de
        // `equipos` — Precisión y Rango de Medición ahora tienen cada uno su
        // propio selector de unidad, reusando el mismo catálogo de gramos como
        // default razonable para datos de demo.
        precisionEquipo: item.precisionEquipo,
        unidadPrecisionId: unGrama ? unGrama.id : null,
        rangoMedicion: item.rangoMedicion,
        unidadRangoId: unGrama ? unGrama.id : null,
        usoLaboratorio: true,
        disponibleOt: item.estadoBase !== 'dado_de_baja',
        requiereCalibracion: true,
        frecuenciaCalibracionMeses: 12,
        diasAvisoCalibracion: 30,
        requiereVerificacion: true,
        frecuenciaVerificacionMeses: 6,
        diasAvisoVerificacion: 30,
        requiereMantenimiento: true,
        frecuenciaMantenimientoMeses: 6,
        diasAvisoMantenimiento: 30,
        observaciones: `Registro inyectado para pruebas de filtro. Estado base: ${item.estadoBase}`,
      })
      .returning();

    const eqId = eqInsertado!.id;
    logger.info({ id: eqId, codigo: item.codigo, nombre: item.nombre }, '✓ Equipo inyectado');

    // Insertar Historial de Calibración
    const offsetCal = offsetMap[item.cal] || 60;
    const proxCal = dateOffset(offsetCal);
    const fechaCal = addMonths(proxCal, -12);
    await db.insert(historialCalibracion).values({
      equipoId: eqId,
      fechaCalibracion: fechaCal,
      proximaCalibracion: proxCal,
      fechaAviso: dateOffset(offsetCal - 30),
      // UAT post-demo (2026-08-07): laboratorioCalibrador/procedimiento son
      // texto libre ahora, ver equipo.schema.ts. labCesmec/labDictuc/procCal
      // (insertados como catálogo arriba) se conservan solo como fuente de
      // texto realista para el dataset de demo.
      laboratorioCalibrador: (item.codigo.length % 2 === 0 ? labCesmec : labDictuc)!.nombre,
      procedimiento: procCal.codigo,
      nCertificado: `CERT-${item.codigo}-2025`,
      estadoIngreso: item.cal === 'en_proceso' ? 'en_proceso' : 'aprobado',
      registradoPorId: item.responsableId,
      observaciones: `Certificado de calibración de prueba (${item.cal})`,
    });

    // Insertar Historial de Verificación
    const offsetVer = offsetMap[item.ver] || 60;
    const proxVer = dateOffset(offsetVer);
    const fechaVer = addMonths(proxVer, -6);
    await db.insert(historialVerificacion).values({
      equipoId: eqId,
      fechaVerificacion: fechaVer,
      proximaVerificacion: proxVer,
      fechaAviso: dateOffset(offsetVer - 30),
      responsableId: item.responsableId,
      nRegistro: `VER-${item.codigo}-2025`,
      estadoIngreso: item.ver === 'en_proceso' ? 'en_proceso' : 'aprobado',
      metodo: `Verificación según procedimiento operativo interno (${item.ver})`,
      procedimiento: procCal.codigo,
    });

    // Insertar Historial de Mantenimiento
    const proxMan = dateOffset(60);
    const fechaMan = addMonths(proxMan, -6);
    await db.insert(historialMantenimiento).values({
      equipoId: eqId,
      fechaMantenimiento: fechaMan,
      proximoMantenimiento: proxMan,
      fechaAviso: dateOffset(30),
      tipo: 'preventivo',
      estadoIngreso: item.man as any,
      responsableId: item.responsableId,
      observaciones: `Registro de mantenimiento (${item.man})`,
    });
  }

  logger.info('🎉 Inyección masiva de equipos e historiales finalizada exitosamente.');
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, '❌ Error en inyección masiva');
  process.exit(1);
});
