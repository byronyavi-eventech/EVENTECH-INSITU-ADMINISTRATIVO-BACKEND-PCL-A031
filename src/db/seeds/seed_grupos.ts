/**
 * src/seeds/seed_grupos.ts
 * Siembra el catálogo de Grupos (levantamiento nuevo, sección 3).
 * Idempotente: usa onConflictDoNothing por nombre único.
 */
import 'dotenv/config';
import { db } from '../index.js';
import { grupo } from '../schema/index.js';
import { logger } from '../../utils/logger.js';

const GRUPOS = [
  'Patrones Secundarios',
  'Longitud',
  'Condiciones Ambientales',
  'Presión',
  'Equipo Radiación',
  'Tamizado',
  'Ensayo Proctor',
  'Límites Consistencia',
  'Ensayo CBR',
  'Volúmenes',
  'Desgaste de los Ángeles',
  'Cono de Arena',
  'Hornos',
  'Prensas',
  'Control Hormigones',
  'No Confinada',
  'Equivalente de Arena',
  'Hormigón',
  'Densidad Real Arena',
  'Hendimiento',
  'Mortero/Cemento',
  'Fraguado/Consistencia',
  'Vibradores Hormigón',
  'Impureza Orgánica',
  'Herramientas',
];

async function main() {
  logger.info('🌱 Sembrando grupos...');

  const rows = await db
    .insert(grupo)
    .values(GRUPOS.map((nombre) => ({ nombre })))
    .onConflictDoNothing()
    .returning();

  logger.info({ insertados: rows.length, total: GRUPOS.length }, '✅ Seed de grupos completado.');
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, '❌ Error en seed de grupos');
  process.exit(1);
});
