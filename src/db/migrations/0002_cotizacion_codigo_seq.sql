-- Migration: cotizacion_codigo_seq
-- Crea una secuencia PostgreSQL para generar códigos de cotización del tipo "10000-LIA".
-- La secuencia empieza en 10000. El sufijo "-LIA" se concatena en la capa de aplicación.
-- Las filas existentes con codigo_cotizacion NULL reciben un código retroactivo.

-- 1. Crear secuencia (comienza en 10000)
CREATE SEQUENCE IF NOT EXISTS "cotizacion_codigo_seq"
  START WITH 10000
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;
--> statement-breakpoint

-- 2. Backfill: asignar código a cotizaciones existentes que no tienen uno.
--    Usamos una CTE para evitar múltiples llamadas a nextval por fila.
UPDATE "cotizacion"
SET "codigo_cotizacion" = nextval('cotizacion_codigo_seq')::text || '-LIA'
WHERE "codigo_cotizacion" IS NULL;
--> statement-breakpoint
