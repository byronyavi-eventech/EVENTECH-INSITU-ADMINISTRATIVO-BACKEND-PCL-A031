-- Migration 0007: Pago Verificacion
-- Agrega los nuevos estados al enum estado_cotizacion y crea la tabla
-- cotizacion_comprobante para almacenar referencias S3 de comprobantes de pago.
--
-- NOTA: ALTER TYPE ... ADD VALUE no es transaccional en PostgreSQL.
-- Si la migración falla después de este punto, los valores del enum
-- ya habrán sido agregados y no se pueden revertir con rollback.

-- ── 1. Nuevos valores en el enum estado_cotizacion ──────────────────────────

ALTER TYPE "estado_cotizacion" ADD VALUE 'ESPERA_VERIFICACION';
ALTER TYPE "estado_cotizacion" ADD VALUE 'PAGO_VERIFICADO';
ALTER TYPE "estado_cotizacion" ADD VALUE 'PAGO_RECHAZADO';

-- ── 2. Nueva tabla cotizacion_comprobante ────────────────────────────────────

CREATE TABLE IF NOT EXISTS "cotizacion_comprobante" (
  "id"             bigserial PRIMARY KEY,
  "cotizacion_id"  bigint NOT NULL REFERENCES "cotizacion"("id") ON DELETE CASCADE,
  "s3_key"         varchar(512) NOT NULL,
  "nombre_archivo" varchar(255) NOT NULL,
  "content_type"   varchar(100) NOT NULL,
  "size_bytes"     integer NOT NULL,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "comprobante_cotizacion_id_idx"
  ON "cotizacion_comprobante" ("cotizacion_id");
