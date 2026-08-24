/**
 * index.ts — Schema barrel export
 *
 * Import from this file everywhere in the application.
 * Better Auth reads from `schema.*` via the drizzleAdapter —
 * this export must include the auth tables at the top level.
 *
 * Usage:
 *   import * as schema from './db/schema/index.js';
 *   const db = drizzle(pool, { schema });
 */

// Better Auth tables (required at top level for drizzleAdapter)
export * from './auth.schema.js';

// Profile extension
export * from './profile.schema.js';

// RBAC
export * from './rbac.schema.js';

// Client domain
export * from './client.schema.js';

// Catalog domain
export * from './catalog.schema.js';

// Bank accounts (company-owned, configurable by admin)
export * from './cuenta_bancaria.schema.js';

// Quotation domain
export * from './quotation.schema.js';

// Payment receipts (comprobantes subidos por el cliente a S3)
export * from './comprobante.schema.js';

// Equipos (Mantenedores/Laboratorio)
export * from './equipo.schema.js';

// Drizzle relations (for db.query.* typed access)
export * from './relations.js';

// Enums (exported for use in application code / validation schemas)
export * from './enums.js';
