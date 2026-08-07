-- ============================================================
-- 0006_notas_comerciales.sql
-- Adds:
--   1. cuenta_bancaria table (company bank accounts)
--   2. New columns on cotizacion for "Notas Comerciales":
--      - condicion_pago
--      - cuenta_principal_id / cuenta_secundaria_id
--      - tipo_ajuste / porcentaje_ajuste
--   3. Seed data: 3 placeholder bank accounts
-- ============================================================

-- 1. New PG Enums
CREATE TYPE "condicion_pago" AS ENUM (
  'PAGO_100',
  'PAGO_50',
  'CREDITO_30_DIAS'
);

CREATE TYPE "tipo_ajuste" AS ENUM (
  'SIN_AJUSTE',
  'DESCUENTO',
  'INCREMENTO'
);

-- 2. cuenta_bancaria table
CREATE TABLE "cuenta_bancaria" (
  "id"           bigserial PRIMARY KEY,
  "banco"        varchar(100)  NOT NULL,
  "tipo_cuenta"  varchar(80)   NOT NULL,
  "numero_cuenta" varchar(50)  NOT NULL,
  "titular"      varchar(200)  NOT NULL DEFAULT 'LABORATORIO INSITU LTDA.',
  "rut"          varchar(20)   NOT NULL DEFAULT '76.290.113-7',
  "activo"       boolean       NOT NULL DEFAULT true,
  "created_at"   timestamptz   NOT NULL DEFAULT now(),
  "updated_at"   timestamptz   NOT NULL DEFAULT now()
);

-- 3. Seed: 3 placeholder accounts (to be replaced with real numbers)
INSERT INTO "cuenta_bancaria" ("banco", "tipo_cuenta", "numero_cuenta")
VALUES
  ('BCI',           'Cuenta Corriente', '12345678'),
  ('BancoEstado',   'Cuenta Corriente', '12345678'),
  ('Santander',     'Cuenta Corriente', '12345678');

-- 4. New columns on cotizacion
ALTER TABLE "cotizacion"
  ADD COLUMN "condicion_pago"       condicion_pago   NOT NULL DEFAULT 'PAGO_100',
  ADD COLUMN "cuenta_principal_id"  bigint           REFERENCES "cuenta_bancaria"("id") ON DELETE SET NULL,
  ADD COLUMN "cuenta_secundaria_id" bigint           REFERENCES "cuenta_bancaria"("id") ON DELETE SET NULL,
  ADD COLUMN "tipo_ajuste"          tipo_ajuste      NOT NULL DEFAULT 'SIN_AJUSTE',
  ADD COLUMN "porcentaje_ajuste"    numeric(5, 2);
