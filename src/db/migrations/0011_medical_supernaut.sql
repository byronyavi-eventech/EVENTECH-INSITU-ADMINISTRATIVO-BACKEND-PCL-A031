CREATE TYPE "public"."estado_equipo" AS ENUM('activo', 'inactivo', 'en_mantenimiento', 'en_calibracion', 'dado_de_baja');--> statement-breakpoint
CREATE TYPE "public"."estado_ingreso_cal_ver" AS ENUM('aprobado', 'en_proceso');--> statement-breakpoint
CREATE TYPE "public"."estado_ingreso_mantenimiento" AS ENUM('operativo', 'en_mantenimiento', 'dado_de_baja', 'fuera_de_servicio');--> statement-breakpoint
CREATE TYPE "public"."tipo_mantenimiento" AS ENUM('preventivo', 'correctivo');--> statement-breakpoint
CREATE TABLE "empresas" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"nombre" varchar(150) NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "empresas_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "equipos" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"codigo" varchar(50),
	"tipo_equipo_id" bigserial NOT NULL,
	"nombre" varchar(150) NOT NULL,
	"marca" varchar(100),
	"modelo" varchar(100),
	"numero_serie" varchar(100),
	"empresa_id" bigserial NOT NULL,
	"sucursal_id" bigserial NOT NULL,
	"ubicacion_id" bigserial NOT NULL,
	"estado" "estado_equipo" DEFAULT 'activo' NOT NULL,
	"responsable_id" text,
	"fecha_adquisicion" date,
	"fecha_baja" date,
	"motivo_baja" text,
	"observaciones" text,
	"precision_equipo" varchar(50),
	"unidad_precision_id" integer,
	"rango_medicion" varchar(100),
	"unidad_rango_id" integer,
	"disponible_ot" boolean DEFAULT true NOT NULL,
	"uso_obra" boolean DEFAULT false NOT NULL,
	"uso_laboratorio" boolean DEFAULT false NOT NULL,
	"permite_uso_simultaneo" boolean DEFAULT false NOT NULL,
	"requiere_reserva" boolean DEFAULT false NOT NULL,
	"requiere_calibracion" boolean DEFAULT false NOT NULL,
	"requiere_verificacion" boolean DEFAULT false NOT NULL,
	"requiere_mantenimiento" boolean DEFAULT false NOT NULL,
	"frecuencia_calibracion_meses" integer,
	"frecuencia_verificacion_meses" integer,
	"frecuencia_mantenimiento_meses" integer,
	"dias_aviso_calibracion" integer,
	"dias_aviso_verificacion" integer,
	"dias_aviso_mantenimiento" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipos_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "equipo_tipos_ensayo" (
	"equipo_id" bigserial NOT NULL,
	"tipo_ensayo_id" bigserial NOT NULL,
	CONSTRAINT "equipo_tipos_ensayo_equipo_id_tipo_ensayo_id_unique" UNIQUE("equipo_id","tipo_ensayo_id")
);
--> statement-breakpoint
CREATE TABLE "grupos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grupos_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "historial_calibraciones" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"equipo_id" bigserial NOT NULL,
	"fecha_calibracion" date NOT NULL,
	"proxima_calibracion" date NOT NULL,
	"laboratorio_calibrador" text,
	"procedimiento" text,
	"n_certificado" varchar(100),
	"documento_url" varchar(500),
	"estado_ingreso" "estado_ingreso_cal_ver" DEFAULT 'aprobado' NOT NULL,
	"fecha_aviso" date,
	"registrado_por_id" text NOT NULL,
	"observaciones" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "historial_calibraciones_n_certificado_unique" UNIQUE("n_certificado")
);
--> statement-breakpoint
CREATE TABLE "historial_mantenimientos" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"equipo_id" bigserial NOT NULL,
	"fecha_mantenimiento" date NOT NULL,
	"proximo_mantenimiento" date,
	"tipo" "tipo_mantenimiento" DEFAULT 'preventivo' NOT NULL,
	"estado_ingreso" "estado_ingreso_mantenimiento" DEFAULT 'operativo' NOT NULL,
	"fecha_aviso" date,
	"responsable_id" text NOT NULL,
	"documento_url" varchar(500),
	"observaciones" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historial_verificaciones" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"equipo_id" bigserial NOT NULL,
	"fecha_verificacion" date NOT NULL,
	"proxima_verificacion" date NOT NULL,
	"responsable_id" text NOT NULL,
	"metodo" varchar(150),
	"procedimiento" text,
	"n_registro" varchar(100),
	"documento_url" varchar(500),
	"observaciones" text,
	"estado_ingreso" "estado_ingreso_cal_ver" DEFAULT 'aprobado' NOT NULL,
	"fecha_aviso" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "historial_verificaciones_n_registro_unique" UNIQUE("n_registro")
);
--> statement-breakpoint
CREATE TABLE "laboratorios_calibradores" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"nombre" varchar(150) NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "laboratorios_calibradores_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "procedimientos" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"codigo" varchar(50) NOT NULL,
	"descripcion" varchar(255),
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "procedimientos_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "sucursales" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"empresa_id" bigserial NOT NULL,
	"nombre" varchar(150) NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sucursales_empresa_id_nombre_unique" UNIQUE("empresa_id","nombre")
);
--> statement-breakpoint
CREATE TABLE "tipos_equipo" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"prefijo_codigo" varchar(10),
	"grupo_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tipos_equipo_nombre_unique" UNIQUE("nombre"),
	CONSTRAINT "tipos_equipo_prefijo_codigo_unique" UNIQUE("prefijo_codigo")
);
--> statement-breakpoint
CREATE TABLE "ubicaciones" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"sucursal_id" bigserial NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ubicaciones_sucursal_id_nombre_unique" UNIQUE("sucursal_id","nombre")
);
--> statement-breakpoint
CREATE TABLE "unidades_medida" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"nombre" varchar(50) NOT NULL,
	"simbolo" varchar(10) NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unidades_medida_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" text PRIMARY KEY NOT NULL,
	"nombre" varchar(150) NOT NULL,
	"email" varchar(150),
	"rol" varchar(50),
	"activo" boolean DEFAULT true,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_tipo_equipo_id_tipos_equipo_id_fk" FOREIGN KEY ("tipo_equipo_id") REFERENCES "public"."tipos_equipo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_ubicacion_id_ubicaciones_id_fk" FOREIGN KEY ("ubicacion_id") REFERENCES "public"."ubicaciones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_responsable_id_usuarios_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_unidad_precision_id_unidades_medida_id_fk" FOREIGN KEY ("unidad_precision_id") REFERENCES "public"."unidades_medida"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_unidad_rango_id_unidades_medida_id_fk" FOREIGN KEY ("unidad_rango_id") REFERENCES "public"."unidades_medida"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipo_tipos_ensayo" ADD CONSTRAINT "equipo_tipos_ensayo_equipo_id_equipos_id_fk" FOREIGN KEY ("equipo_id") REFERENCES "public"."equipos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipo_tipos_ensayo" ADD CONSTRAINT "equipo_tipos_ensayo_tipo_ensayo_id_tipo_ensayo_id_fk" FOREIGN KEY ("tipo_ensayo_id") REFERENCES "public"."tipo_ensayo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historial_calibraciones" ADD CONSTRAINT "historial_calibraciones_equipo_id_equipos_id_fk" FOREIGN KEY ("equipo_id") REFERENCES "public"."equipos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historial_calibraciones" ADD CONSTRAINT "historial_calibraciones_registrado_por_id_usuarios_id_fk" FOREIGN KEY ("registrado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historial_mantenimientos" ADD CONSTRAINT "historial_mantenimientos_equipo_id_equipos_id_fk" FOREIGN KEY ("equipo_id") REFERENCES "public"."equipos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historial_mantenimientos" ADD CONSTRAINT "historial_mantenimientos_responsable_id_usuarios_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historial_verificaciones" ADD CONSTRAINT "historial_verificaciones_equipo_id_equipos_id_fk" FOREIGN KEY ("equipo_id") REFERENCES "public"."equipos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historial_verificaciones" ADD CONSTRAINT "historial_verificaciones_responsable_id_usuarios_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sucursales" ADD CONSTRAINT "sucursales_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipos_equipo" ADD CONSTRAINT "tipos_equipo_grupo_id_grupos_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "public"."grupos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ubicaciones" ADD CONSTRAINT "ubicaciones_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "equipos_tipo_equipo_id_idx" ON "equipos" USING btree ("tipo_equipo_id");--> statement-breakpoint
CREATE INDEX "equipos_sucursal_id_idx" ON "equipos" USING btree ("sucursal_id");--> statement-breakpoint
CREATE INDEX "equipos_ubicacion_id_idx" ON "equipos" USING btree ("ubicacion_id");--> statement-breakpoint
CREATE INDEX "equipos_estado_idx" ON "equipos" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "equipos_responsable_id_idx" ON "equipos" USING btree ("responsable_id");--> statement-breakpoint
CREATE INDEX "equipos_unidad_precision_id_idx" ON "equipos" USING btree ("unidad_precision_id");--> statement-breakpoint
CREATE INDEX "equipos_unidad_rango_id_idx" ON "equipos" USING btree ("unidad_rango_id");--> statement-breakpoint
CREATE INDEX "historial_calibraciones_equipo_id_idx" ON "historial_calibraciones" USING btree ("equipo_id");--> statement-breakpoint
CREATE INDEX "historial_calibraciones_proxima_calibracion_idx" ON "historial_calibraciones" USING btree ("proxima_calibracion");--> statement-breakpoint
CREATE INDEX "historial_mantenimientos_equipo_id_idx" ON "historial_mantenimientos" USING btree ("equipo_id");--> statement-breakpoint
CREATE INDEX "historial_mantenimientos_proximo_mantenimiento_idx" ON "historial_mantenimientos" USING btree ("proximo_mantenimiento");--> statement-breakpoint
CREATE INDEX "historial_verificaciones_equipo_id_idx" ON "historial_verificaciones" USING btree ("equipo_id");--> statement-breakpoint
CREATE INDEX "historial_verificaciones_proxima_verificacion_idx" ON "historial_verificaciones" USING btree ("proxima_verificacion");--> statement-breakpoint
CREATE INDEX "sucursales_empresa_id_idx" ON "sucursales" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "tipos_equipo_grupo_id_idx" ON "tipos_equipo" USING btree ("grupo_id");--> statement-breakpoint
CREATE INDEX "ubicaciones_sucursal_id_idx" ON "ubicaciones" USING btree ("sucursal_id");