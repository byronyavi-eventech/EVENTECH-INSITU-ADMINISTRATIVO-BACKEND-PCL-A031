/**
 * src/db/seeds/seed_qa_ensayos.ts
 * Siembra el catálogo de Ensayos de prueba para el entorno de QA de la
 * fusión Mantenedores/Administrativo — MAPEO-DATOS-ENSAYOS.md, sección 7/9.
 *
 * Idempotente: usa onConflictDoNothing + lookup por clave única en cada
 * nivel de la jerarquía area_ensayo → subarea_ensayo → tipo_ensayo →
 * precio_ensayo, así que se puede correr más de una vez sin duplicar.
 *
 * SOLO para bases de QA/desarrollo descartables. No correr contra la base
 * real de producción.
 */
import 'dotenv/config';
import { eq, and } from 'drizzle-orm';
import { db } from '../index.js';
import { areaEnsayo, subareaEnsayo, tipoEnsayo, precioEnsayo } from '../schema/index.js';
import { logger } from '../../utils/logger.js';

type TipoDef = { nombre: string; codigoNorma: string; precio: string };
type SubareaDef = { nombre: string; tipos: TipoDef[] };
type AreaDef = { nombre: string; subareas: SubareaDef[] };

const CATALOGO: AreaDef[] = [
  {
    nombre: 'Mecánica de Suelos',
    subareas: [
      {
        nombre: 'Clasificación y Granulometría',
        tipos: [
          { nombre: 'Granulometría por Tamizado', codigoNorma: 'ASTM D422', precio: '42000.00' },
          { nombre: 'Granulometría por Hidrometría', codigoNorma: 'ASTM D7928', precio: '65000.00' },
          { nombre: 'Límites de Atterberg (LL + LP + IP)', codigoNorma: 'ASTM D4318', precio: '52000.00' },
          { nombre: 'Contenido de Humedad Natural', codigoNorma: 'ASTM D2216', precio: '18000.00' },
        ],
      },
      {
        nombre: 'Compactación',
        tipos: [
          { nombre: 'Ensayo Proctor Modificado', codigoNorma: 'ASTM D1557', precio: '85000.00' },
          { nombre: 'Ensayo Proctor Normal', codigoNorma: 'ASTM D698', precio: '75000.00' },
          { nombre: 'Densidad In Situ (Método Cono de Arena)', codigoNorma: 'ASTM D1556', precio: '55000.00' },
          { nombre: 'Densidad In Situ (Método Nuclear)', codigoNorma: 'ASTM D6938', precio: '48000.00' },
        ],
      },
      {
        nombre: 'Resistencia',
        tipos: [
          { nombre: 'Ensayo CBR (sobre muestra compactada)', codigoNorma: 'ASTM D1883', precio: '95000.00' },
          { nombre: 'Ensayo de Corte Directo', codigoNorma: 'ASTM D3080', precio: '110000.00' },
          { nombre: 'Compresión No Confinada', codigoNorma: 'ASTM D2166', precio: '85000.00' },
        ],
      },
    ],
  },
  {
    nombre: 'Hormigón',
    subareas: [
      {
        nombre: 'Hormigón Fresco',
        tipos: [
          { nombre: 'Cono de Asentamiento (Slump)', codigoNorma: 'NCh1019', precio: '22000.00' },
          { nombre: 'Contenido de Aire en Hormigón Fresco', codigoNorma: 'NCh1116', precio: '35000.00' },
          { nombre: 'Temperatura del Hormigón Fresco', codigoNorma: 'ASTM C1064', precio: '15000.00' },
        ],
      },
      {
        nombre: 'Hormigón Endurecido',
        tipos: [
          { nombre: 'Compresión de Probetas Cilíndricas', codigoNorma: 'NCh1037', precio: '28000.00' },
          { nombre: 'Resistencia a Flexión (Viga Simple)', codigoNorma: 'NCh1038', precio: '45000.00' },
          { nombre: 'Resistencia al Hendimiento', codigoNorma: 'NCh1172', precio: '38000.00' },
        ],
      },
    ],
  },
  {
    nombre: 'Áridos y Mezclas Asfálticas',
    subareas: [
      {
        nombre: 'Áridos',
        tipos: [
          { nombre: 'Desgaste Los Ángeles', codigoNorma: 'ASTM C131', precio: '78000.00' },
          { nombre: 'Equivalente de Arena', codigoNorma: 'ASTM D2419', precio: '52000.00' },
          { nombre: 'Índice de Lajas y Agujas', codigoNorma: 'NCh1333', precio: '65000.00' },
        ],
      },
      {
        nombre: 'Asfalto',
        tipos: [
          { nombre: 'Extracción de Asfalto (Ignición)', codigoNorma: 'ASTM D6307', precio: '120000.00' },
          { nombre: 'Granulometría de Mezcla Asfáltica', codigoNorma: 'ASTM D5444', precio: '68000.00' },
        ],
      },
    ],
  },
];

/** Inserta (o recupera si ya existe) el área y devuelve su id. */
async function upsertArea(nombre: string): Promise<number> {
  await db.insert(areaEnsayo).values({ nombreArea: nombre }).onConflictDoNothing();
  const [row] = await db.select({ id: areaEnsayo.id }).from(areaEnsayo).where(eq(areaEnsayo.nombreArea, nombre));
  return row.id;
}

/** Inserta (o recupera si ya existe) la subárea y devuelve su id. */
async function upsertSubarea(areaId: number, nombre: string): Promise<number> {
  await db
    .insert(subareaEnsayo)
    .values({ areaId, nombreSubarea: nombre })
    .onConflictDoNothing();
  const [row] = await db
    .select({ id: subareaEnsayo.id })
    .from(subareaEnsayo)
    .where(and(eq(subareaEnsayo.areaId, areaId), eq(subareaEnsayo.nombreSubarea, nombre)));
  return row.id;
}

/** Inserta (o recupera si ya existe) el tipo de ensayo y devuelve su id. */
async function upsertTipoEnsayo(subareaId: number, def: TipoDef): Promise<number> {
  await db
    .insert(tipoEnsayo)
    .values({ subareaId, nombreTipoEnsayo: def.nombre, codigoNorma: def.codigoNorma })
    .onConflictDoNothing();
  const [row] = await db
    .select({ id: tipoEnsayo.id })
    .from(tipoEnsayo)
    .where(and(eq(tipoEnsayo.subareaId, subareaId), eq(tipoEnsayo.nombreTipoEnsayo, def.nombre)));
  return row.id;
}

/** Inserta el precio activo del tipo si aún no tiene uno (activo=true, fecha_fin=null). */
async function ensurePrecioActivo(tipoEnsayoId: number, precio: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: precioEnsayo.id })
    .from(precioEnsayo)
    .where(and(eq(precioEnsayo.tipoEnsayoId, tipoEnsayoId), eq(precioEnsayo.activo, true)));
  if (existing) return false;

  const hoy = new Date().toISOString().slice(0, 10);
  await db.insert(precioEnsayo).values({
    tipoEnsayoId,
    precio,
    fechaInicio: hoy,
    fechaFin: null,
    activo: true,
  });
  return true;
}

async function main() {
  logger.info('🌱 Sembrando catálogo de Ensayos (QA)...');

  let areasCount = 0;
  let subareasCount = 0;
  let tiposCount = 0;
  let preciosCount = 0;

  for (const area of CATALOGO) {
    const areaId = await upsertArea(area.nombre);
    areasCount++;
    for (const subarea of area.subareas) {
      const subareaId = await upsertSubarea(areaId, subarea.nombre);
      subareasCount++;
      for (const tipo of subarea.tipos) {
        const tipoId = await upsertTipoEnsayo(subareaId, tipo);
        tiposCount++;
        const inserted = await ensurePrecioActivo(tipoId, tipo.precio);
        if (inserted) preciosCount++;
      }
    }
  }

  logger.info(
    { areas: areasCount, subareas: subareasCount, tipos: tiposCount, preciosInsertados: preciosCount },
    '✅ Seed de catálogo de Ensayos completado.',
  );

  // Verificación: logueamos el árbol completo Area → Subárea → Tipo → Precio activo.
  const arbol = await db
    .select({
      area: areaEnsayo.nombreArea,
      subarea: subareaEnsayo.nombreSubarea,
      tipo: tipoEnsayo.nombreTipoEnsayo,
      norma: tipoEnsayo.codigoNorma,
      precio: precioEnsayo.precio,
    })
    .from(tipoEnsayo)
    .innerJoin(subareaEnsayo, eq(tipoEnsayo.subareaId, subareaEnsayo.id))
    .innerJoin(areaEnsayo, eq(subareaEnsayo.areaId, areaEnsayo.id))
    .leftJoin(
      precioEnsayo,
      and(eq(precioEnsayo.tipoEnsayoId, tipoEnsayo.id), eq(precioEnsayo.activo, true)),
    )
    .orderBy(areaEnsayo.nombreArea, subareaEnsayo.nombreSubarea, tipoEnsayo.nombreTipoEnsayo);

  logger.info('--- Árbol Area → Subárea → Tipo → Precio activo ---');
  for (const fila of arbol) {
    logger.info(`${fila.area} / ${fila.subarea} / ${fila.tipo} [${fila.norma}] — $${fila.precio}`);
  }
  logger.info(`Total filas en árbol: ${arbol.length} (esperado: 21)`);

  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, '❌ Error en seed de catálogo de Ensayos');
  process.exit(1);
});
