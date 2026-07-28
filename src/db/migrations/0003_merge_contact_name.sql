ALTER TABLE "cliente" ALTER COLUMN "nombre_contacto" SET DATA TYPE varchar(255);--> statement-breakpoint
-- Preserve existing data: merge apellidos into nombre_contacto before dropping
UPDATE "cliente" SET "nombre_contacto" = TRIM("nombre_contacto" || ' ' || "apellidos_contacto") WHERE "apellidos_contacto" IS NOT NULL AND "apellidos_contacto" != '';--> statement-breakpoint
ALTER TABLE "cliente" DROP COLUMN "apellidos_contacto";