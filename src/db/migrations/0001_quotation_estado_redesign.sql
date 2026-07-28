-- =============================================================================
-- Migration: Redeseno ciclo de vida cotizacion
-- Fecha: 2026-07-28
-- Descripcion: Cambia de 6 a 9 estados, migra datos existentes,
--              y agrega columnas token_enviado_at y respuesta_cliente_at.
-- =============================================================================

-- PASO 1: Agregar nuevos valores al enum existente
ALTER TYPE estado_cotizacion ADD VALUE IF NOT EXISTS 'NUEVA';
ALTER TYPE estado_cotizacion ADD VALUE IF NOT EXISTS 'ENVIADA_FIRMA';
ALTER TYPE estado_cotizacion ADD VALUE IF NOT EXISTS 'FIRMADA';
ALTER TYPE estado_cotizacion ADD VALUE IF NOT EXISTS 'ENVIADA_CLIENTE';
ALTER TYPE estado_cotizacion ADD VALUE IF NOT EXISTS 'ACEPTADA_CLIENTE';
ALTER TYPE estado_cotizacion ADD VALUE IF NOT EXISTS 'RECHAZADA_CLIENTE';

-- PASO 2: Migrar datos existentes
UPDATE cotizacion SET estado = 'NUEVA'         WHERE estado = 'BORRADOR';
UPDATE cotizacion SET estado = 'ENVIADA_FIRMA'  WHERE estado = 'ENVIADA';
UPDATE cotizacion SET estado = 'FIRMADA'        WHERE estado = 'ACEPTADA';

-- PASO 3: Agregar nuevas columnas
ALTER TABLE cotizacion
  ADD COLUMN IF NOT EXISTS token_enviado_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS respuesta_cliente_at TIMESTAMPTZ;

-- PASO 4: Recrear el tipo enum sin los valores obsoletos
ALTER TABLE cotizacion ALTER COLUMN estado DROP DEFAULT;
ALTER TABLE cotizacion ALTER COLUMN estado TYPE TEXT;
DROP TYPE IF EXISTS estado_cotizacion CASCADE;

CREATE TYPE estado_cotizacion AS ENUM (
  'NUEVA',
  'ENVIADA_FIRMA',
  'FIRMADA',
  'ENVIADA_CLIENTE',
  'ACEPTADA_CLIENTE',
  'RECHAZADA_CLIENTE',
  'RECHAZADA',
  'VENCIDA',
  'ANULADA'
);

ALTER TABLE cotizacion
  ALTER COLUMN estado TYPE estado_cotizacion
  USING estado::estado_cotizacion;

ALTER TABLE cotizacion ALTER COLUMN estado SET DEFAULT 'NUEVA'::estado_cotizacion;

-- PASO 5: Verificacion
SELECT estado, COUNT(*) FROM cotizacion GROUP BY estado ORDER BY estado;
