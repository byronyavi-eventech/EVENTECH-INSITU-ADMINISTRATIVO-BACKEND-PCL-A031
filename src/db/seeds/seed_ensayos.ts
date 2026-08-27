/**
 * src/db/seeds/seed_ensayos.ts
 * Siembra el catalogo completo de Ensayos (areas, subareas y tipos) basado
 * en los datos oficiales de la empresa.
 *
 * Idempotente: usa onConflictDoNothing + lookup por clave unica en cada
 * nivel de la jerarquia area_ensayo → subarea_ensayo → tipo_ensayo,
 * por lo que se puede correr mas de una vez sin duplicar registros.
 *
 * Los precios son mock data en UF (rango 1.0–5.0). Reemplazar con valores
 * reales antes de migrar a produccion.
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
    nombre: 'CONSTRUCCION - MECANICA DE SUELOS',
    subareas: [
      {
        nombre: 'OBRAS DE PAVIMENTACION, SEGUN CONVENIO INN-MINVU',
        tipos: [
          { nombre: 'Analisis granulometrico', codigoNorma: 'Metodo 8.102.1, Diciembre 2023, manual de Carreteras Vol. 8.', precio: '1.50' },
          { nombre: 'Compactacion, metodo proctor modificado', codigoNorma: 'NCh1534/2Of.79', precio: '3.20' },
          { nombre: 'Densidad de particulas solidas', codigoNorma: 'NCh1532.Of80', precio: '2.10' },
          { nombre: 'Densidad en el terreno, metodo cono de arena', codigoNorma: 'NCh1516.Of79', precio: '2.50' },
          { nombre: 'Densidad Maxima', codigoNorma: 'ASTM D4253-16', precio: '2.80' },
          { nombre: 'Densidad Minima', codigoNorma: 'ASTM D4254-16', precio: '2.80' },
          { nombre: 'Humedad', codigoNorma: 'NCh1515.Of79', precio: '1.00' },
          { nombre: 'Limite Liquido', codigoNorma: 'NCh1517/1.Of79', precio: '1.80' },
          { nombre: 'Limite Plastico', codigoNorma: 'NCh1517/2.Of79', precio: '1.80' },
          { nombre: 'Razon de soporte (CBR)', codigoNorma: 'NCh1852.Of81', precio: '4.50' },
        ],
      },
      {
        nombre: 'ARIDOS PARA SUELOS, SEGUN CONVENIO INN-MINVU',
        tipos: [
          { nombre: 'Densidad en terreno, metodo nuclear', codigoNorma: 'Metodo 8.502.1, Diciembre 2003, manual de Carreteras Vol. 8.', precio: '2.30' },
          { nombre: 'Humedad en terreno, metodo nuclear', codigoNorma: 'Metodo 8.502.6, Diciembre 2003, manual de Carreteras Vol. 8.', precio: '2.30' },
          { nombre: 'Muestreo de Suelos', codigoNorma: 'UNE 7371:1975', precio: '1.20' },
        ],
      },
    ],
  },
  {
    nombre: 'CONSTRUCCION - HORMIGON',
    subareas: [
      {
        nombre: 'OBRAS DE EDIFICACION Y PAVIMENTACION, SEGUN CONVENIO INN-MINVU',
        tipos: [
          { nombre: 'Compresion', codigoNorma: 'NCh1037-2009', precio: '1.80' },
          { nombre: 'Confeccion y curado en obra de probetas para ensayos de compresion', codigoNorma: 'NCh1017:2009', precio: '2.00' },
          { nombre: 'Confeccion y curado en obra de probetas para ensayos de traccion por flexion y hendimiento', codigoNorma: 'NCh1017:2009', precio: '2.00' },
          { nombre: 'Densidad aparente', codigoNorma: 'NCh1564.Of2009', precio: '1.50' },
          { nombre: 'Docilidad, metodo de asentamiento del cono de Abrams', codigoNorma: 'NCh1019.Of2009', precio: '1.20' },
          { nombre: 'Extraccion de muestras', codigoNorma: 'NCh171-2008', precio: '1.30' },
          { nombre: 'Extraccion y ensayo de testigos de Hormigon endurecido', codigoNorma: 'NCh1171/1:2012', precio: '3.50' },
          { nombre: 'Traccion por flexion', codigoNorma: 'NCh1038-2009', precio: '2.20' },
          { nombre: 'Traccion por hendimiento', codigoNorma: 'NCh1170:2012', precio: '2.20' },
          { nombre: 'Refrentado de probetas', codigoNorma: 'NCh1172.Of2010, Clausula 7, Procedimiento C', precio: '1.40' },
          { nombre: 'Absorcion de agua de las arenas', codigoNorma: 'NCh1239-2009', precio: '1.60' },
          { nombre: 'Absorcion de agua de las gravas', codigoNorma: 'NCh1117.Of2010', precio: '1.60' },
          { nombre: 'Analisis granulometrico', codigoNorma: 'NCh165.Of2009', precio: '1.50' },
          { nombre: 'Cubicidad de particulas', codigoNorma: 'Metodo 8.202.6, Junio 2022, manual de Carreteras Vol. 8.', precio: '2.00' },
          { nombre: 'Determinacion de huecos', codigoNorma: 'NCh1326Of.1977', precio: '1.70' },
          { nombre: 'Densidad aparente (Aridos)', codigoNorma: 'NCh1116:2008', precio: '1.50' },
          { nombre: 'Densidad neta de las arenas', codigoNorma: 'NCh1239-2009', precio: '1.60' },
          { nombre: 'Densidad neta de las gravas', codigoNorma: 'NCh1117.Of2010', precio: '1.60' },
          { nombre: 'Densidad real de las arenas', codigoNorma: 'NCh1239-2009', precio: '1.60' },
          { nombre: 'Densidad real de las gravas', codigoNorma: 'NCh1117.Of2010', precio: '1.60' },
        ],
      },
    ],
  },
  {
    nombre: 'CONSTRUCCION - ASFALTOS Y MEZCLAS ASFALTICAS',
    subareas: [
      {
        nombre: 'CONTROL DE MEZCLAS EN TERRENO, SEGUN CONVENIO INN-MINVU',
        tipos: [
          { nombre: 'Analisis granulometrico', codigoNorma: 'Metodo 8.302.28, diciembre 2003, Manual de carreteras, V8', precio: '1.50' },
          { nombre: 'Contenido de Bitumen', codigoNorma: 'Metodo 8.302.36, diciembre 2003, Manual de carreteras, V8', precio: '3.80' },
          { nombre: 'Densidad Real', codigoNorma: 'Metodo 8.302.38, diciembre 2022, Manual de carreteras, V8', precio: '2.40' },
          { nombre: 'Espesor', codigoNorma: 'ASTM D3549/D3549M-18', precio: '1.80' },
          { nombre: 'Extraccion de testigos de pavimentos asfalticos', codigoNorma: 'NCh1171/1,Of2012', precio: '3.00' },
          { nombre: 'Muestreo', codigoNorma: 'Metodo 8.302.27, diciembre 2003, Manual de carreteras, V8', precio: '1.20' },
        ],
      },
      {
        nombre: 'MEZCLAS EN TERRENO',
        tipos: [
          { nombre: 'Espesor', codigoNorma: '8.302.41, diciembre 2003, Manual de carreteras, V8', precio: '1.80' },
          { nombre: 'Contenido de asfalto (Ignicion)', codigoNorma: 'Metodo 8.302.56, Manual de carreteras, V8', precio: '4.00' },
          { nombre: 'Contenido de asfalto (Extraccion)', codigoNorma: 'Metodo 8.302.36, Manual de carreteras, V8', precio: '3.80' },
          { nombre: 'Diseño MARSHALL', codigoNorma: 'Metodo 8.302.40, Manual de carreteras, V8', precio: '5.00' },
          { nombre: 'Indice de huecos', codigoNorma: 'Metodo 8.302.40, Manual de carreteras, V8', precio: '2.50' },
          { nombre: 'D. M. Mezcla', codigoNorma: 'Metodo 8.302.40, Manual de carreteras, V8', precio: '2.20' },
          { nombre: 'Fluidez', codigoNorma: 'Metodo 8.302.40, Manual de carreteras, V8', precio: '2.20' },
          { nombre: 'Estabilidad', codigoNorma: 'Metodo 8.302.40, Manual de carreteras, V8', precio: '2.50' },
        ],
      },
    ],
  },
  {
    nombre: 'CALIBRACION DE PLANTA DE ASFALTO',
    subareas: [
      {
        nombre: 'General',
        tipos: [
          { nombre: 'HI-LO', codigoNorma: 'L.N.V', precio: '3.50' },
          { nombre: 'IRI', codigoNorma: 'L.N.V', precio: '3.50' },
          { nombre: 'Metodo merlin', codigoNorma: 'L.N.V', precio: '3.00' },
          { nombre: 'Macro textura', codigoNorma: 'Metodo 8.302.61, Manual de carreteras, V8', precio: '2.80' },
        ],
      },
    ],
  },
  {
    nombre: 'CONSTRUCCION - ELEMENTOS Y COMPONENTES',
    subareas: [
      {
        nombre: 'PREFABRICADOS DE HORMIGON, SEGUN CONVENIO INN-MINVU',
        tipos: [
          { nombre: 'Absorcion de agua', codigoNorma: 'NCh182:2008', precio: '1.60' },
          { nombre: 'Compresion', codigoNorma: 'Codigo MINVU N°332, 2008, 6.2.5', precio: '1.80' },
          { nombre: 'Compresion (NCh182)', codigoNorma: 'NCh182:2008', precio: '1.80' },
          { nombre: 'Contenido de humedad', codigoNorma: 'NCh182:2008', precio: '1.00' },
          { nombre: 'Extraccion de muestras', codigoNorma: 'ASTM C140/C140M', precio: '1.30' },
          { nombre: 'Flexion (6.5.4.1)', codigoNorma: 'Codigo MINVU N°332, 2008, 6.5.4.1', precio: '2.40' },
          { nombre: 'Flexion (6.6.4)', codigoNorma: 'Codigo MINVU N°332, 2008, 6.6.4', precio: '2.40' },
          { nombre: 'Impacto', codigoNorma: 'Codigo MINVU N°332, 2008, 6.5.4.2', precio: '2.00' },
          { nombre: 'Compresion (6.7.3.2)', codigoNorma: 'Codigo MINVU N°332, 2008, 6.7.3.2', precio: '1.80' },
          { nombre: 'Flexion (NCh187)', codigoNorma: 'NCh187:2010', precio: '2.40' },
          { nombre: 'Resistencia al impacto', codigoNorma: 'NCh187:2010', precio: '2.00' },
        ],
      },
    ],
  },
  {
    nombre: 'ENSAYOS NO DESTRUCTIVOS (END)',
    subareas: [
      {
        nombre: 'General',
        tipos: [
          { nombre: 'Medicion de vibraciones inducidas', codigoNorma: 'DIN 4150-3/ISO 2631/ISO 4866/BS 7385/2', precio: '4.50' },
          { nombre: 'Adherencia de pinturas', codigoNorma: 'ASTM D4541', precio: '2.00' },
          { nombre: 'Medicion de espesor de pintura', codigoNorma: 'ASTM D4541', precio: '1.80' },
          { nombre: 'Toque con toquimetro', codigoNorma: 'ASTM', precio: '1.50' },
          { nombre: 'Traccion de PVC', codigoNorma: 'ASTM', precio: '2.20' },
          { nombre: 'Traccion de pernos de anclaje', codigoNorma: 'ASTM', precio: '2.50' },
          { nombre: 'Traccion de pernos', codigoNorma: 'ASTM', precio: '2.50' },
          { nombre: 'Radiografia (Metodo ultrasonido)', codigoNorma: 'ASTM', precio: '5.00' },
          { nombre: 'Tintas penetrantes', codigoNorma: 'ASTM', precio: '3.00' },
        ],
      },
    ],
  },
  {
    nombre: 'AREA INGENIERIA',
    subareas: [
      {
        nombre: 'General',
        tipos: [
          { nombre: 'Calicatas', codigoNorma: 'Manual de carreteras/NCH/ASTM', precio: '4.00' },
          { nombre: 'D.P.H Super pesada', codigoNorma: 'ASTM', precio: '4.50' },
          { nombre: 'D.P.H Estandar', codigoNorma: 'ASTM', precio: '3.80' },
          { nombre: 'Placa de carga', codigoNorma: 'ASTM', precio: '4.20' },
          { nombre: 'Permeabilidad de carga variable', codigoNorma: 'Manual de carreteras Vol.8', precio: '3.50' },
          { nombre: 'Permeabilidad carga constante', codigoNorma: 'Manual de carreteras Vol.8', precio: '3.50' },
          { nombre: 'Porchett', codigoNorma: 'ASTM', precio: '3.20' },
          { nombre: 'Estratigrafia', codigoNorma: 'ASTM', precio: '2.50' },
          { nombre: 'Sondaje (30mts.)', codigoNorma: 'ASTM', precio: '5.00' },
          { nombre: 'R.Q.D', codigoNorma: 'ASTM', precio: '2.80' },
          { nombre: 'Granulometria bajo 200', codigoNorma: 'ASTM', precio: '1.60' },
          { nombre: 'Resistividad electrica', codigoNorma: 'ASTM', precio: '3.00' },
          { nombre: 'Resistencia termica', codigoNorma: 'ASTM', precio: '3.00' },
        ],
      },
    ],
  },
];

/** Inserta (o recupera si ya existe) el area y devuelve su id. */
async function upsertArea(nombre: string): Promise<number> {
  await db.insert(areaEnsayo).values({ nombreArea: nombre }).onConflictDoNothing();
  const [row] = await db.select({ id: areaEnsayo.id }).from(areaEnsayo).where(eq(areaEnsayo.nombreArea, nombre));
  return row.id;
}

/** Inserta (o recupera si ya existe) la subarea y devuelve su id. */
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

/** Inserta el precio activo del tipo si aun no tiene uno (activo=true, fechaFin=null). */
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
  logger.info('🌱 Sembrando catalogo de Ensayos (produccion)...');

  let areasCount = 0;
  let subareasCount = 0;
  let tiposCount = 0;
  let preciosCount = 0;

  for (const area of CATALOGO) {
    const areaId = await upsertArea(area.nombre);
    areasCount++;
    logger.info(`  ✓ Area: ${area.nombre}`);

    for (const subarea of area.subareas) {
      const subareaId = await upsertSubarea(areaId, subarea.nombre);
      subareasCount++;

      for (const tipo of subarea.tipos) {
        const tipoId = await upsertTipoEnsayo(subareaId, tipo);
        tiposCount++;
        const inserted = await ensurePrecioActivo(tipoId, tipo.precio);
        if (inserted) preciosCount++;
      }
      logger.info(`    ✓ Subarea: ${subarea.nombre} (${subarea.tipos.length} ensayos)`);
    }
  }

  logger.info(
    { areas: areasCount, subareas: subareasCount, tipos: tiposCount, preciosInsertados: preciosCount },
    '✅ Seed de catalogo de Ensayos completado.',
  );

  // Verificacion: arbol completo Area → Subarea → Tipo → Precio activo.
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

  logger.info(`--- Arbol Area → Subarea → Tipo → Precio activo (${arbol.length} filas) ---`);
  for (const fila of arbol) {
    logger.info(`  ${fila.area} / ${fila.subarea} / ${fila.tipo} [${fila.norma}] — ${fila.precio} UF`);
  }

  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, '❌ Error en seed de catalogo de Ensayos');
  process.exit(1);
});
