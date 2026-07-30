ALTER TABLE "cotizacion" ALTER COLUMN "estado" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "cotizacion" ALTER COLUMN "estado" SET DEFAULT 'NUEVA'::text;--> statement-breakpoint
DROP TYPE "public"."estado_cotizacion";--> statement-breakpoint
CREATE TYPE "public"."estado_cotizacion" AS ENUM('NUEVA', 'ENVIADA_FIRMA', 'FIRMADA', 'ENVIADA_CLIENTE', 'ACEPTADA_CLIENTE', 'RECHAZADA_CLIENTE', 'RECHAZADA', 'VENCIDA', 'ANULADA');--> statement-breakpoint
ALTER TABLE "cotizacion" ALTER COLUMN "estado" SET DEFAULT 'NUEVA'::"public"."estado_cotizacion";--> statement-breakpoint
ALTER TABLE "cotizacion" ALTER COLUMN "estado" SET DATA TYPE "public"."estado_cotizacion" USING "estado"::"public"."estado_cotizacion";--> statement-breakpoint
ALTER TABLE "cotizacion" ADD COLUMN "token_enviado_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cotizacion" ADD COLUMN "respuesta_cliente_at" timestamp with time zone;