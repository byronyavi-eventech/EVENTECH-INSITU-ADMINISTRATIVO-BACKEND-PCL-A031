/**
 * src/seeds/seed_unidades.ts
 * Completa el catálogo de unidades_medida con el listado del levantamiento nuevo
 * (sección 2): g, kg, mm, cm³, ml, µm, °C, °k, N, seg, r/min, N/A.
 * Idempotente: usa onConflictDoNothing por nombre único. No borra ni modifica
 * las unidades ya cargadas (kg, g, mm, cm, L, mL, N, kN, %, °C).
 */
import 'dotenv/config';
import { db } from '../index.js';
import { unidadMedida } from '../schema/index.js';
import { logger } from '../../utils/logger.js';

const UNIDADES = [
  { nombre: 'Centímetros cúbicos', simbolo: 'cm³' },
  { nombre: 'Micrómetros', simbolo: 'µm' },
  { nombre: 'Grados Kelvin', simbolo: '°k' },
  { nombre: 'Segundos', simbolo: 'seg' },
  { nombre: 'Revoluciones por minuto', simbolo: 'r/min' },
  { nombre: 'No aplica', simbolo: 'N/A' },
];

async function main() {
  logger.info('🌱 Sembrando unidades de medida faltantes...');

  const rows = await db.insert(unidadMedida).values(UNIDADES).onConflictDoNothing().returning();

  logger.info(
    { insertadas: rows.length, total: UNIDADES.length },
    '✅ Seed de unidades completado.',
  );
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, '❌ Error en seed de unidades');
  process.exit(1);
});
