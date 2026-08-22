/**
 * src/seeds/seed_fase1_tipos_equipo.ts
 * Cierra la Fase 1 (Catálogo Grupo → Tipo de Equipo) con el mapeo real
 * extraído de "levantamiento_servicios.md" (sección "Datos Mantenedor Equipos").
 *
 * IMPORTANTE: se usa Drizzle/pg (Node), NUNCA `docker exec -i psql < archivo.sql`
 * para este tipo de datos — ese pipe corrompió las tildes de los 8 tipos
 * originales (creados por init.sql) en un entorno Windows/Git Bash: los bytes
 * UTF-8 de í/ó llegaron a psql con un client_encoding distinto y se
 * reemplazaron por "?" (ver "Densímetro Nuclear" -> "Dens??metro Nuclear",
 * detectado y corregido acá). Node/pg sobre el wire protocol no tiene ese problema.
 *
 * Resolución de datos aplicada (el Excel original repite el mismo tipo bajo
 * varios grupos; nuestro schema exige `tipos_equipo.nombre` único y un solo
 * `grupo_id` por tipo — no admite M:N). Regla usada: cuando un nombre se repite
 * textualmente (o es un singular/plural del mismo concepto) en más de un grupo,
 * se asigna al grupo más específico/dedicado y se omite en el resto. Ejemplos:
 * "Tamices" -> Tamizado (no Patrones Secundarios); "Anillos de Carga" -> su
 * propio grupo dedicado (no Ensayo CBR); "Probeta/Medida graduada" -> Volúmenes
 * (Graduados) (no Equivalente de Arena). Esto es una decisión de esta sesión,
 * no una instrucción explícita del cliente — revisar si el agrupamiento real
 * esperado es distinto.
 *
 * Grupos "Hendimiento" y "Fraguado/Consistencia", sembrados en Fase 1 antes de
 * tener la data real (solo con el prosa del plan), NO existen como grupos de
 * primer nivel en el archivo real — son TIPOS dentro de "Hormigón" y
 * "Mortero / Cemento" respectivamente. Se eliminan acá (no los referenciaba
 * ningún tipo todavía, se verifica antes de borrar).
 */
import 'dotenv/config';
import { eq, isNull, sql } from 'drizzle-orm';
import { db } from '../index.js';
import { grupo, tipoEquipo } from '../schema/index.js';
import { logger } from '../../utils/logger.js';

// ─── Grupos nuevos que faltaban del seed inicial (Fase 1, con datos parciales) ──
const GRUPOS_FALTANTES = ['Balanzas', 'Volúmenes Graduados', 'Anillos de carga'];

// ─── Grupos provisionales incorrectos (sembrados sin la data real) ────────────
const GRUPOS_A_ELIMINAR = ['Hendimiento', 'Fraguado/Consistencia'];

// ─── Los 8 tipos ya existentes: rename (corrige encoding donde aplica) + grupo ──
const RENOMBRAR_EXISTENTES: Array<{ actual: string; nuevoNombre: string; grupo: string }> = [
  { actual: 'Balanza', nuevoNombre: 'Balanzas Analíticas', grupo: 'Balanzas' },
  { actual: 'Horno', nuevoNombre: 'Hornos', grupo: 'Hornos' },
  { actual: 'Tamiz', nuevoNombre: 'Tamices', grupo: 'Tamizado' },
  { actual: 'Cono de Abrams', nuevoNombre: 'Cono Abrams', grupo: 'Hormigón' },
  { actual: 'Densímetro Nuclear', nuevoNombre: 'Densímetros', grupo: 'Equipo Radiación' },
  { actual: 'Molde CBR', nuevoNombre: 'Molde CBR', grupo: 'Ensayo CBR' },
  {
    actual: 'Prensa de Compresión de Hormigón',
    nuevoNombre: 'Prensa Compresión',
    grupo: 'Prensas',
  },
  { actual: 'Airímetro', nuevoNombre: 'Airímetro', grupo: 'Control Hormigones' },
];
// Nombres corruptos reales encontrados en DB (init.sql + pipe psql en Windows)
const NOMBRES_CORRUPTOS: Record<string, string> = {
  'Dens??metro Nuclear': 'Densímetro Nuclear',
  'Air??metro': 'Airímetro',
  'Prensa de Compresi??n de Hormig??n': 'Prensa de Compresión de Hormigón',
};

// ─── Tipos nuevos por grupo (excluye los 8 renombrados arriba y los duplicados
// cross-grupo ya resueltos según la nota de resolución de datos) ──────────────
const TIPOS_NUEVOS: Record<string, string[]> = {
  'Patrones Secundarios': [
    'Termómetros',
    'Flexómetros',
    'Pié de Metro',
    'Higrómetro',
    'Micrómetros',
    'Deformimetros',
  ],
  Balanzas: ['Balanzas Electrónicas'],
  Longitud: ['Deformimetros Diales', 'Reglas', 'Escuadras', 'Galgas Feeller'],
  'Condiciones Ambientales': ['Cronómetro', 'Termo higrómetro'],
  Presión: ['Manómetros', 'Bombas de Presión', 'Cámara de Vacío'],
  'Equipo Radiación': ['Detectores de Radiación'],
  Tamizado: ['Cuarteadores', 'Microscopio para tamices', 'Aparato Índice Laminar'],
  'Ensayo Proctor': [
    'Pisón Proctor Normal',
    'Pisón Proctor Modificado',
    'Moldes Proctor 100 mm',
    'Moldes Proctor 150 mm',
  ],
  'Límites Consistencia': ['Casagrande', 'Acanaladores y Accesorios', 'Equipo Límite Contracción'],
  'Ensayo CBR': [
    'Prensa CBR',
    'Marco Reacción',
    'Deformímetro',
    'Pisón Penetración',
    'Molde',
    'Disco Espaciador',
    'Collarín',
    'Placas Anulares',
    'Placas Ranuradas',
    'Trípode de Expansión',
    'Placa Base con vástago',
  ],
  Volúmenes: ['Medidas Volumetricas'],
  'Desgaste de los Ángeles': ['Máquina desgaste', 'Set de Esferas'],
  'Cono de Arena': ['Cono de Arena'],
  Hornos: ['Baño María', 'Cocinillas', 'Marmitas Capín'],
  Prensas: [
    'Prensa Flexión',
    'Panel de control Cono de Arena Gigante',
    'Dispositivos flexión',
    'Porta medio cilindro',
    'Mordazas tracción',
    'Dispositivos doblado',
    'Dispositivos compresión / Suples',
  ],
  'Volúmenes Graduados': [
    'Probetas graduadas',
    'Vasos precipitados',
    'Pipetas / Bureta',
    'Matraces',
    'Tubos Ensayo Riedel Weber',
  ],
  'Control Hormigones': ['Penetrómetro Mortero'],
  'No Confinada': ['Moldes No Confinada'],
  'Equivalente de Arena': ['Agitador mecánico', 'Sifón Irrigador', 'Pisón (Lastre)'],
  Hormigón: [
    'Placas',
    'Pisón',
    'Poruña',
    'Molde Refrentado',
    'Moldes Cúbicos 20 x 20',
    'Moldes Cilíndricos',
    'Moldes Cúbicos 15 x 15',
    'Viguetas',
    'Betonera',
    'Aserradora de Testigo',
    'Testiguera',
    'Hendimiento',
    'Cojín Elastómerico',
  ],
  'Densidad Real Arena': ['Cono Truncado', 'Pisón Densidad Arena'],
  'Mortero/Cemento': [
    'Mezclador',
    'Moldes Rilem',
    'Equipo Blaine',
    'Permeámetro',
    'Fraguado / Consistencia',
    'Mesa de Golpe',
    'Retráctometro',
    'Retentividad',
    'Cono Marsh',
    'Moldes Mortero / Hormig. Proy.',
    'Equipo de Flexión',
    'Equipo de Compresión',
  ],
  'Anillos de carga': ['Anillos de Carga'],
  'Vibradores Hormigón': ['Vibradores', 'Sonda'],
  'Impureza Orgánica': ['Comparador Colorimétrico', 'Botellas Graduadas'],
  Herramientas: ['GPS', 'Generador Eléctrico', 'Taladro'],
};

async function main() {
  logger.info('🌱 Cerrando Fase 1 — Grupo → Tipo de Equipo...');

  // 1. Grupos faltantes
  const gruposInsertados = await db
    .insert(grupo)
    .values(GRUPOS_FALTANTES.map((nombre) => ({ nombre })))
    .onConflictDoNothing()
    .returning();
  logger.info(
    { gruposInsertados: gruposInsertados.map((g) => g.nombre) },
    '✓ Grupos faltantes sembrados',
  );

  // 2. Eliminar grupos provisionales incorrectos (con guardia de seguridad)
  for (const nombreGrupo of GRUPOS_A_ELIMINAR) {
    const [g] = await db.select().from(grupo).where(eq(grupo.nombre, nombreGrupo)).limit(1);
    if (!g) continue;
    const [{ count: refs }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tipoEquipo)
      .where(eq(tipoEquipo.grupoId, g.id));
    if (Number(refs) > 0) {
      throw new Error(
        `No se puede eliminar el grupo "${nombreGrupo}": tiene ${refs} tipo(s) asociados.`,
      );
    }
    await db.delete(grupo).where(eq(grupo.id, g.id));
    logger.info({ grupo: nombreGrupo }, '✓ Grupo provisional eliminado');
  }

  // Mapa nombre de grupo -> id (post inserción/eliminación)
  const todosLosGrupos = await db.select().from(grupo);
  const grupoIdPorNombre = new Map(todosLosGrupos.map((g) => [g.nombre, g.id]));

  // 3. Corregir encoding corrupto + renombrar/asignar grupo a los 8 tipos existentes
  for (const [nombreCorrupto, nombreCorregido] of Object.entries(NOMBRES_CORRUPTOS)) {
    await db
      .update(tipoEquipo)
      .set({ nombre: nombreCorregido })
      .where(eq(tipoEquipo.nombre, nombreCorrupto));
  }

  for (const { actual, nuevoNombre, grupo: nombreGrupo } of RENOMBRAR_EXISTENTES) {
    const grupoId = grupoIdPorNombre.get(nombreGrupo);
    if (!grupoId)
      throw new Error(`Grupo "${nombreGrupo}" no encontrado para renombrar "${actual}".`);
    const res = await db
      .update(tipoEquipo)
      .set({ nombre: nuevoNombre, grupoId })
      .where(eq(tipoEquipo.nombre, actual))
      .returning({ id: tipoEquipo.id });
    if (res.length === 0) {
      await db
        .insert(tipoEquipo)
        .values({ nombre: nuevoNombre, grupoId })
        .onConflictDoNothing();
      logger.info(
        { nuevoNombre, grupo: nombreGrupo },
        '✓ Tipo base sembrado (no existía previamente)',
      );
    } else {
      logger.info(
        { actual, nuevoNombre, grupo: nombreGrupo },
        '✓ Tipo existente renombrado y asignado a grupo',
      );
    }
  }

  // 4. Insertar tipos nuevos por grupo (prefijoCodigo=null — Fase 1B: correlativo global)
  let totalNuevos = 0;
  for (const [nombreGrupo, tipos] of Object.entries(TIPOS_NUEVOS)) {
    const grupoId = grupoIdPorNombre.get(nombreGrupo);
    if (!grupoId) throw new Error(`Grupo "${nombreGrupo}" no encontrado al insertar tipos nuevos.`);

    const insertados = await db
      .insert(tipoEquipo)
      .values(tipos.map((nombre) => ({ nombre, grupoId, prefijoCodigo: null })))
      .onConflictDoNothing()
      .returning({ id: tipoEquipo.id });
    totalNuevos += insertados.length;
    logger.info(
      { grupo: nombreGrupo, insertados: insertados.length, esperados: tipos.length },
      '✓ Tipos nuevos sembrados',
    );
  }

  // 5. Verificar que no quede ningún tipo sin grupo antes de endurecer la columna
  const sinGrupo = await db
    .select({ id: tipoEquipo.id, nombre: tipoEquipo.nombre })
    .from(tipoEquipo)
    .where(isNull(tipoEquipo.grupoId));
  if (sinGrupo.length > 0) {
    logger.error(
      { sinGrupo },
      '❌ Hay tipos sin grupo_id — no se puede cerrar Fase 1 (columna queda nullable)',
    );
  } else {
    logger.info('✅ Todos los tipos de equipo tienen grupo_id asignado.');
  }

  logger.info({ totalNuevos, totalGrupos: todosLosGrupos.length }, '✅ Fase 1 — seed completado.');
  process.exit(sinGrupo.length > 0 ? 1 : 0);
}

main().catch((err) => {
  logger.error({ err }, '❌ Error en seed de Fase 1');
  process.exit(1);
});
