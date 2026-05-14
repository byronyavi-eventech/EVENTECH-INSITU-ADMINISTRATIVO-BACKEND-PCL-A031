CREATE TYPE "public"."estado_cotizacion" AS ENUM('BORRADOR', 'ENVIADA', 'ACEPTADA', 'RECHAZADA', 'VENCIDA', 'ANULADA');--> statement-breakpoint
CREATE TYPE "public"."origen_cotizacion" AS ENUM('WEB', 'INTERNO', 'EMAIL', 'TELEFONO');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"apellido" varchar(100) NOT NULL,
	"cargo" varchar(100),
	"area" varchar(100),
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rol" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"nombre_rol" varchar(50) NOT NULL,
	"descripcion" varchar(250),
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rol_nombre_rol_unique" UNIQUE("nombre_rol")
);
--> statement-breakpoint
CREATE TABLE "usuario_rol" (
	"user_id" text NOT NULL,
	"rol_id" bigserial NOT NULL,
	"asignado_por" text,
	"fecha_asignacion" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuario_rol_user_id_rol_id_pk" PRIMARY KEY("user_id","rol_id")
);
--> statement-breakpoint
CREATE TABLE "cliente" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text,
	"rut_empresa" varchar(12),
	"giro_empresa" varchar(100) NOT NULL,
	"nombre_contacto" varchar(100) NOT NULL,
	"apellidos_contacto" varchar(150) NOT NULL,
	"celular_contacto" varchar(20) NOT NULL,
	"email" varchar(150) NOT NULL,
	"direccion_empresa" varchar(250) NOT NULL,
	"region" varchar(100) NOT NULL,
	"comuna" varchar(100) NOT NULL,
	"ciudad" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cliente_rut_empresa_unique" UNIQUE("rut_empresa")
);
--> statement-breakpoint
CREATE TABLE "encargado_obra" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"obra_id" bigserial NOT NULL,
	"nombre_encargado" varchar(150) NOT NULL,
	"correo_encargado" varchar(150) NOT NULL,
	"telefono_encargado" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "encargado_obra_obra_correo_unique" UNIQUE("obra_id","correo_encargado")
);
--> statement-breakpoint
CREATE TABLE "obra" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"cliente_id" bigserial NOT NULL,
	"nombre_obra" varchar(200) NOT NULL,
	"nombre_mandante" varchar(200) NOT NULL,
	"nombre_contratista" varchar(200) NOT NULL,
	"ubicacion_obra" varchar(300) NOT NULL,
	"region" varchar(100) NOT NULL,
	"comuna" varchar(100) NOT NULL,
	"ciudad" varchar(100) NOT NULL,
	"duracion_meses" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "area_ensayo" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"nombre_area" varchar(150) NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "area_ensayo_nombre_area_unique" UNIQUE("nombre_area")
);
--> statement-breakpoint
CREATE TABLE "precio_ensayo" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tipo_ensayo_id" bigserial NOT NULL,
	"precio" numeric(12, 2) NOT NULL,
	"fecha_inicio" date NOT NULL,
	"fecha_fin" date,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subarea_ensayo" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"area_id" bigserial NOT NULL,
	"nombre_subarea" varchar(150) NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subarea_ensayo_area_nombre_unique" UNIQUE("area_id","nombre_subarea")
);
--> statement-breakpoint
CREATE TABLE "tipo_ensayo" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"subarea_id" bigserial NOT NULL,
	"nombre_tipo_ensayo" varchar(250) NOT NULL,
	"codigo_norma" varchar(100),
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tipo_ensayo_subarea_nombre_unique" UNIQUE("subarea_id","nombre_tipo_ensayo")
);
--> statement-breakpoint
CREATE TABLE "cotizacion" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"obra_id" bigserial NOT NULL,
	"codigo_cotizacion" varchar(30),
	"origen" "origen_cotizacion" NOT NULL,
	"estado" "estado_cotizacion" DEFAULT 'BORRADOR' NOT NULL,
	"observaciones" text,
	"creado_por" text,
	"fecha_solicitud" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cotizacion_codigo_cotizacion_unique" UNIQUE("codigo_cotizacion")
);
--> statement-breakpoint
CREATE TABLE "cotizacion_detalle" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"cotizacion_id" bigserial NOT NULL,
	"tipo_ensayo_id" bigserial NOT NULL,
	"cantidad_ensayos" integer NOT NULL,
	"cantidad_visitas" integer NOT NULL,
	"precio_unitario" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cotizacion_detalle_cotizacion_tipo_unique" UNIQUE("cotizacion_id","tipo_ensayo_id")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_rol_id_rol_id_fk" FOREIGN KEY ("rol_id") REFERENCES "public"."rol"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_asignado_por_user_id_fk" FOREIGN KEY ("asignado_por") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encargado_obra" ADD CONSTRAINT "encargado_obra_obra_id_obra_id_fk" FOREIGN KEY ("obra_id") REFERENCES "public"."obra"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obra" ADD CONSTRAINT "obra_cliente_id_cliente_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."cliente"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "precio_ensayo" ADD CONSTRAINT "precio_ensayo_tipo_ensayo_id_tipo_ensayo_id_fk" FOREIGN KEY ("tipo_ensayo_id") REFERENCES "public"."tipo_ensayo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subarea_ensayo" ADD CONSTRAINT "subarea_ensayo_area_id_area_ensayo_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."area_ensayo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipo_ensayo" ADD CONSTRAINT "tipo_ensayo_subarea_id_subarea_ensayo_id_fk" FOREIGN KEY ("subarea_id") REFERENCES "public"."subarea_ensayo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizacion" ADD CONSTRAINT "cotizacion_obra_id_obra_id_fk" FOREIGN KEY ("obra_id") REFERENCES "public"."obra"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizacion" ADD CONSTRAINT "cotizacion_creado_por_user_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizacion_detalle" ADD CONSTRAINT "cotizacion_detalle_cotizacion_id_cotizacion_id_fk" FOREIGN KEY ("cotizacion_id") REFERENCES "public"."cotizacion"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizacion_detalle" ADD CONSTRAINT "cotizacion_detalle_tipo_ensayo_id_tipo_ensayo_id_fk" FOREIGN KEY ("tipo_ensayo_id") REFERENCES "public"."tipo_ensayo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_provider_idx" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_expires_at_idx" ON "session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "user_email_idx" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "user_profile_activo_idx" ON "user_profile" USING btree ("activo");--> statement-breakpoint
CREATE INDEX "rol_activo_idx" ON "rol" USING btree ("activo");--> statement-breakpoint
CREATE INDEX "usuario_rol_user_id_idx" ON "usuario_rol" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "usuario_rol_rol_id_idx" ON "usuario_rol" USING btree ("rol_id");--> statement-breakpoint
CREATE INDEX "cliente_user_id_idx" ON "cliente" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cliente_email_idx" ON "cliente" USING btree ("email");--> statement-breakpoint
CREATE INDEX "cliente_rut_empresa_idx" ON "cliente" USING btree ("rut_empresa");--> statement-breakpoint
CREATE INDEX "encargado_obra_obra_id_idx" ON "encargado_obra" USING btree ("obra_id");--> statement-breakpoint
CREATE INDEX "obra_cliente_id_idx" ON "obra" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "obra_ciudad_idx" ON "obra" USING btree ("ciudad");--> statement-breakpoint
CREATE INDEX "area_ensayo_activo_idx" ON "area_ensayo" USING btree ("activo");--> statement-breakpoint
CREATE INDEX "precio_ensayo_tipo_ensayo_id_idx" ON "precio_ensayo" USING btree ("tipo_ensayo_id");--> statement-breakpoint
CREATE INDEX "precio_ensayo_activo_idx" ON "precio_ensayo" USING btree ("activo");--> statement-breakpoint
CREATE INDEX "precio_ensayo_fechas_idx" ON "precio_ensayo" USING btree ("fecha_inicio","fecha_fin");--> statement-breakpoint
CREATE INDEX "subarea_ensayo_area_id_idx" ON "subarea_ensayo" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX "subarea_ensayo_activo_idx" ON "subarea_ensayo" USING btree ("activo");--> statement-breakpoint
CREATE INDEX "tipo_ensayo_subarea_id_idx" ON "tipo_ensayo" USING btree ("subarea_id");--> statement-breakpoint
CREATE INDEX "tipo_ensayo_activo_idx" ON "tipo_ensayo" USING btree ("activo");--> statement-breakpoint
CREATE INDEX "cotizacion_obra_id_idx" ON "cotizacion" USING btree ("obra_id");--> statement-breakpoint
CREATE INDEX "cotizacion_estado_idx" ON "cotizacion" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "cotizacion_creado_por_idx" ON "cotizacion" USING btree ("creado_por");--> statement-breakpoint
CREATE INDEX "cotizacion_active_idx" ON "cotizacion" USING btree ("obra_id") WHERE "cotizacion"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "cotizacion_fecha_solicitud_idx" ON "cotizacion" USING btree ("fecha_solicitud");--> statement-breakpoint
CREATE INDEX "cotizacion_detalle_cotizacion_id_idx" ON "cotizacion_detalle" USING btree ("cotizacion_id");--> statement-breakpoint
CREATE INDEX "cotizacion_detalle_tipo_ensayo_id_idx" ON "cotizacion_detalle" USING btree ("tipo_ensayo_id");