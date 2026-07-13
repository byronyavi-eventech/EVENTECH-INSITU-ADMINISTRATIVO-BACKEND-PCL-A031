CREATE TABLE "cotizacion_servicio_general" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"cotizacion_id" bigserial NOT NULL,
	"descripcion" varchar(255) NOT NULL,
	"cantidad" integer DEFAULT 1 NOT NULL,
	"precio_unitario" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cotizacion_servicio_general" ADD CONSTRAINT "cotizacion_servicio_general_cotizacion_id_cotizacion_id_fk" FOREIGN KEY ("cotizacion_id") REFERENCES "public"."cotizacion"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cotizacion_servicio_general_cotizacion_id_idx" ON "cotizacion_servicio_general" USING btree ("cotizacion_id");