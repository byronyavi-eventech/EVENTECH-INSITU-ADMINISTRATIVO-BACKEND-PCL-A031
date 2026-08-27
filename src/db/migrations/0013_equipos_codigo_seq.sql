-- Migration: equipos_codigo_seq
-- Crea la secuencia PostgreSQL para correlativo numérico global de equipos (0001, 0002, ...)
CREATE SEQUENCE IF NOT EXISTS "equipos_codigo_seq"
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;
--> statement-breakpoint

-- Sincronizar la secuencia si ya existen registros en equipos
SELECT setval(
  'equipos_codigo_seq',
  COALESCE((SELECT MAX(NULLIF(regexp_replace(codigo, '\D', '', 'g'), '')::bigint) FROM "equipos"), 0) + 1,
  false
);
