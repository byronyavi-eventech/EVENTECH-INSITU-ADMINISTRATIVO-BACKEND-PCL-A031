/**
 * src/db/seeds/seed_catalogo_base.ts
 *
 * Siembra el catálogo base de la jerarquía de equipos:
 *   empresa "Laboratorio INSITU"
 *     └─ sucursal "Arica"
 *          ├─ ubicación "Laboratorio"
 *          ├─ ubicación "Bodega"
 *          └─ ubicación "Terreno"
 *   laboratorio_calibrador "CESMEC"
 *
 * Este era el rol de init.sql (bootstrap Postgres). Al no estar configurado
 * en el docker-compose de producción se crea este seed idempotente equivalente.
 *
 * Idempotente: todos los inserts usan onConflictDoNothing sobre el índice único.
 * Seguro de correr múltiples veces.
 */
import 'dotenv/config';
import { db } from '../index.js';
import {
  empresa,
  sucursal,
  ubicacion,
  laboratorioCalibrador,
} from '../schema/equipo.schema.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../utils/logger.js';

async function main() {
  logger.info('🌱 Iniciando seed_catalogo_base...');

  // ─── 1. Empresa ──────────────────────────────────────────────────────────
  await db
    .insert(empresa)
    .values({ nombre: 'Laboratorio INSITU', activo: true })
    .onConflictDoNothing();

  const [emp] = await db
    .select()
    .from(empresa)
    .where(eq(empresa.nombre, 'Laboratorio INSITU'));
  logger.info({ id: emp.id }, '  ✓ empresa "Laboratorio INSITU"');

  // ─── 2. Sucursal ─────────────────────────────────────────────────────────
  await db
    .insert(sucursal)
    .values({ empresaId: emp.id, nombre: 'Arica', activo: true })
    .onConflictDoNothing();

  const [suc] = await db
    .select()
    .from(sucursal)
    .where(and(eq(sucursal.empresaId, emp.id), eq(sucursal.nombre, 'Arica')));
  logger.info({ id: suc.id }, '  ✓ sucursal "Arica"');

  // ─── 3. Ubicaciones ──────────────────────────────────────────────────────
  const ubicaciones = ['Laboratorio', 'Bodega', 'Terreno'];
  for (const nombre of ubicaciones) {
    await db
      .insert(ubicacion)
      .values({ sucursalId: suc.id, nombre, activo: true })
      .onConflictDoNothing();
    logger.info(`  ✓ ubicación "${nombre}"`);
  }

  // ─── 4. Laboratorio calibrador ───────────────────────────────────────────
  await db
    .insert(laboratorioCalibrador)
    .values({ nombre: 'CESMEC', activo: true })
    .onConflictDoNothing();
  logger.info('  ✓ laboratorio calibrador "CESMEC"');

  logger.info('✅ seed_catalogo_base completado.');
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, '❌ Error en seed_catalogo_base');
  process.exit(1);
});
