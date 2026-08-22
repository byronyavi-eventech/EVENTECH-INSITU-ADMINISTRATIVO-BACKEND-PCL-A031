-- Fix manual (2026-08-22): drizzle-kit generó 4x "DROP CONSTRAINT" explícitos
-- después de "DROP TABLE usuarios CASCADE" — pero CASCADE ya elimina esas 4
-- FKs al borrar la tabla referenciada, así que los DROP CONSTRAINT explícitos
-- fallaban con "constraint does not exist" (verificado corriendo la cadena
-- completa de migraciones desde cero contra una BD limpia). Se eliminan por
-- redundantes/rotos; el CASCADE ya hace el trabajo.
ALTER TABLE "usuarios" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "usuarios" CASCADE;--> statement-breakpoint
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_responsable_id_user_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historial_calibraciones" ADD CONSTRAINT "historial_calibraciones_registrado_por_id_user_id_fk" FOREIGN KEY ("registrado_por_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historial_mantenimientos" ADD CONSTRAINT "historial_mantenimientos_responsable_id_user_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historial_verificaciones" ADD CONSTRAINT "historial_verificaciones_responsable_id_user_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;