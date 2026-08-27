/**
 * seed.ts
 * Inserts the application's base roles into the `rol` table.
 * Safe to run multiple times — uses ON CONFLICT DO NOTHING.
 *
 * Usage:
 *   pnpm db:seed
 */
import { db } from './index.js';
import { rol } from './schema/rbac.schema.js';
import * as dotenv from 'dotenv';
import { sql } from 'drizzle-orm';

dotenv.config();

const BASE_ROLES: Array<{ nombreRol: string; descripcion: string }> = [
  {
    nombreRol: 'ENCARGADO_ADMINISTRATIVO',
    descripcion:
      'Gestiona cotizaciones: puede crear, enviar a firma, rechazar y reabrir borradores. No puede aceptar (firmar).',
  },
  {
    nombreRol: 'JEFE_LABORATORIO',
    descripcion:
      'Acceso completo a cotizaciones incluyendo firma/aceptación. Accede al Mantenedor de Firmas.',
  },
  {
    nombreRol: 'ASISTENTE_OPERACIONES',
    descripcion: 'Acceso al módulo Mantenedores de Equipos.',
  },
];

async function seed() {
  console.log('🌱  Seeding roles...');

  for (const r of BASE_ROLES) {
    await db
      .insert(rol)
      .values({ nombreRol: r.nombreRol, descripcion: r.descripcion, activo: true })
      .onConflictDoNothing({ target: rol.nombreRol });

    console.log(`  ✓  ${r.nombreRol}`);
  }

  console.log('✅  Seed complete.');
  await sql`SELECT 1`; // keep pool alive until process exits
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});
