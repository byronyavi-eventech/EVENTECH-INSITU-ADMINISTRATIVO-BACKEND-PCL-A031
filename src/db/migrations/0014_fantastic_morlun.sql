ALTER TYPE "public"."estado_cotizacion" ADD VALUE 'PENDIENTE_PROGRAMACION' BEFORE 'RECHAZADA';--> statement-breakpoint
ALTER TYPE "public"."estado_cotizacion" ADD VALUE 'PROGRAMADO' BEFORE 'RECHAZADA';--> statement-breakpoint
CREATE TABLE "orden_trabajo" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"cotizacion_id" bigint NOT NULL,
	"visita_id" bigint NOT NULL,
	"codigo_ot" varchar(40) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orden_trabajo_visita_id_unique" UNIQUE("visita_id"),
	CONSTRAINT "orden_trabajo_codigo_ot_unique" UNIQUE("codigo_ot")
);
--> statement-breakpoint
CREATE TABLE "visita" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"cotizacion_id" bigint NOT NULL,
	"numero_visita" integer NOT NULL,
	"fecha_hora_programada" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visita_cotizacion_numero_unique" UNIQUE("cotizacion_id","numero_visita")
);
--> statement-breakpoint
CREATE TABLE "visita_ensayo" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"visita_id" bigint NOT NULL,
	"cotizacion_detalle_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visita_ensayo_cotizacion_detalle_id_unique" UNIQUE("cotizacion_detalle_id")
);
--> statement-breakpoint
ALTER TABLE "obra" ADD COLUMN "tiempo_traslado_horas" integer;--> statement-breakpoint
ALTER TABLE "cotizacion" ADD COLUMN "visitas_totales" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "orden_trabajo" ADD CONSTRAINT "orden_trabajo_cotizacion_id_cotizacion_id_fk" FOREIGN KEY ("cotizacion_id") REFERENCES "public"."cotizacion"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orden_trabajo" ADD CONSTRAINT "orden_trabajo_visita_id_visita_id_fk" FOREIGN KEY ("visita_id") REFERENCES "public"."visita"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visita" ADD CONSTRAINT "visita_cotizacion_id_cotizacion_id_fk" FOREIGN KEY ("cotizacion_id") REFERENCES "public"."cotizacion"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visita_ensayo" ADD CONSTRAINT "visita_ensayo_visita_id_visita_id_fk" FOREIGN KEY ("visita_id") REFERENCES "public"."visita"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visita_ensayo" ADD CONSTRAINT "visita_ensayo_cotizacion_detalle_id_cotizacion_detalle_id_fk" FOREIGN KEY ("cotizacion_detalle_id") REFERENCES "public"."cotizacion_detalle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orden_trabajo_cotizacion_id_idx" ON "orden_trabajo" USING btree ("cotizacion_id");--> statement-breakpoint
CREATE INDEX "visita_cotizacion_id_idx" ON "visita" USING btree ("cotizacion_id");--> statement-breakpoint
CREATE INDEX "visita_ensayo_visita_id_idx" ON "visita_ensayo" USING btree ("visita_id");