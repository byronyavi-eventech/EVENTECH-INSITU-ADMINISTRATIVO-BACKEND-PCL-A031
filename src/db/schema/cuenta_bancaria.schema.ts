/**
 * cuenta_bancaria.schema.ts
 *
 * Cuentas bancarias propias de Laboratorio Insitu Ltda.
 * Son datos maestros: la empresa define cuáles están activas.
 * El jefe de laboratorio selecciona una cuenta principal (obligatoria)
 * y una secundaria opcional al configurar cada cotización.
 *
 * Las cuentas reales se actualizan directamente en la tabla sin
 * necesidad de migrations adicionales.
 */
import {
  pgTable,
  bigserial,
  varchar,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';

export const cuentaBancaria = pgTable('cuenta_bancaria', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),

  /** Nombre del banco, ej. "BCI", "BancoEstado", "Santander" */
  banco: varchar('banco', { length: 100 }).notNull(),

  /** Tipo de cuenta: "Cuenta Corriente", "Cuenta Vista", etc. */
  tipoCuenta: varchar('tipo_cuenta', { length: 80 }).notNull(),

  /** Número de cuenta (placeholder hasta que se ingresen los reales) */
  numeroCuenta: varchar('numero_cuenta', { length: 50 }).notNull(),

  /** Titular registrado en el banco. Por defecto la razón social. */
  titular: varchar('titular', { length: 200 })
    .notNull()
    .default('LABORATORIO INSITU LTDA.'),

  /** RUT del titular */
  rut: varchar('rut', { length: 20 }).notNull().default('76.290.113-7'),

  /** Permite ocultar cuentas sin borrarlas */
  activo: boolean('activo').notNull().default(true),

  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type CuentaBancaria = typeof cuentaBancaria.$inferSelect;
export type NewCuentaBancaria = typeof cuentaBancaria.$inferInsert;
