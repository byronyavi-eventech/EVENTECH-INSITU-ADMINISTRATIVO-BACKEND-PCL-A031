-- Migration: Remove ACEPTADA_CLIENTE from estado_cotizacion enum
-- PostgreSQL does not support DROP VALUE from an enum directly,
-- so we must: cast column to text → drop old type → create new type → cast back.

-- 1. Cast the column to text so we can safely drop the enum type
ALTER TABLE "cotizacion" ALTER COLUMN "estado" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "cotizacion" ALTER COLUMN "estado" SET DEFAULT 'NUEVA'::text;--> statement-breakpoint

-- 2. Drop the old enum
DROP TYPE "public"."estado_cotizacion";--> statement-breakpoint

-- 3. Recreate the enum without ACEPTADA_CLIENTE
CREATE TYPE "public"."estado_cotizacion" AS ENUM(
  'NUEVA',
  'ENVIADA_FIRMA',
  'FIRMADA',
  'ENVIADA_CLIENTE',
  'RECHAZADA_CLIENTE',
  'ESPERA_VERIFICACION',
  'PAGO_VERIFICADO',
  'PAGO_RECHAZADO',
  'RECHAZADA',
  'VENCIDA',
  'ANULADA'
);--> statement-breakpoint

-- 4. Restore the column to the new enum type
ALTER TABLE "cotizacion" ALTER COLUMN "estado" SET DEFAULT 'NUEVA'::"public"."estado_cotizacion";--> statement-breakpoint
ALTER TABLE "cotizacion" ALTER COLUMN "estado" SET DATA TYPE "public"."estado_cotizacion" USING "estado"::"public"."estado_cotizacion";