CREATE SCHEMA IF NOT EXISTS cotizaciones;

SET search_path TO cotizaciones;

-- =========================
-- TABLAS DE USUARIOS Y ROLES
-- =========================

CREATE TABLE tbl_usuario_cuenta (
    id_usuario_cuenta BIGSERIAL PRIMARY KEY,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    tipo_usuario VARCHAR(30) NOT NULL,
    portal_acceso VARCHAR(30) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_ultima_sesion TIMESTAMP NULL
);

CREATE TABLE tbl_rol (
    id_rol BIGSERIAL PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(250),
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE tbl_usuario_rol (
    id_usuario_cuenta BIGINT NOT NULL,
    id_rol BIGINT NOT NULL,
    fecha_asignacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id_usuario_cuenta, id_rol),

    CONSTRAINT fk_usuario_rol_usuario
        FOREIGN KEY (id_usuario_cuenta)
        REFERENCES tbl_usuario_cuenta(id_usuario_cuenta),

    CONSTRAINT fk_usuario_rol_rol
        FOREIGN KEY (id_rol)
        REFERENCES tbl_rol(id_rol)
);

CREATE TABLE tbl_usuario_interno (
    id_usuario_interno BIGSERIAL PRIMARY KEY,
    id_usuario_cuenta BIGINT NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    cargo VARCHAR(100),
    area VARCHAR(100),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_usuario_interno_cuenta
        FOREIGN KEY (id_usuario_cuenta)
        REFERENCES tbl_usuario_cuenta(id_usuario_cuenta)
);

-- =========================
-- CLIENTE, OBRA Y ENCARGADO
-- =========================

CREATE TABLE tbl_cliente (
    id_cliente BIGSERIAL PRIMARY KEY,
    id_usuario_cuenta BIGINT NULL,

    rut_empresa VARCHAR(12) UNIQUE,
    giro_empresa VARCHAR(100) NOT NULL,

    nombre_contacto VARCHAR(100) NOT NULL,
    apellidos_contacto VARCHAR(150) NOT NULL,
    celular_contacto VARCHAR(20) NOT NULL,
    email VARCHAR(150) NOT NULL,

    direccion_empresa VARCHAR(250) NOT NULL,
    region VARCHAR(100) NOT NULL,
    comuna VARCHAR(100) NOT NULL,
    ciudad VARCHAR(100) NOT NULL,

    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_cliente_usuario_cuenta
        FOREIGN KEY (id_usuario_cuenta)
        REFERENCES tbl_usuario_cuenta(id_usuario_cuenta)
);

CREATE TABLE tbl_obra (
    id_obra BIGSERIAL PRIMARY KEY,
    id_cliente BIGINT NOT NULL,

    nombre_obra VARCHAR(200) NOT NULL,
    nombre_mandante VARCHAR(200) NOT NULL,
    nombre_contratista VARCHAR(200) NOT NULL,
    ubicacion_obra VARCHAR(300) NOT NULL,

    region VARCHAR(100) NOT NULL,
    comuna VARCHAR(100) NOT NULL,
    ciudad VARCHAR(100) NOT NULL,
    duracion_meses INT NOT NULL,

    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_obra_cliente
        FOREIGN KEY (id_cliente)
        REFERENCES tbl_cliente(id_cliente),

    CONSTRAINT ck_obra_duracion
        CHECK (duracion_meses > 0)
);

CREATE TABLE tbl_encargado_obra (
    id_encargado_obra BIGSERIAL PRIMARY KEY,
    id_obra BIGINT NOT NULL,

    nombre_encargado VARCHAR(150) NOT NULL,
    correo_encargado VARCHAR(150) NOT NULL,
    telefono_encargado VARCHAR(20) NOT NULL,

    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_encargado_obra_obra
        FOREIGN KEY (id_obra)
        REFERENCES tbl_obra(id_obra)
);

-- =========================
-- CATÁLOGO DE ENSAYOS
-- =========================

CREATE TABLE tbl_area_ensayo (
    id_area BIGSERIAL PRIMARY KEY,
    nombre_area VARCHAR(150) NOT NULL UNIQUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE tbl_subarea_ensayo (
    id_subarea BIGSERIAL PRIMARY KEY,
    id_area BIGINT NOT NULL,
    nombre_subarea VARCHAR(150) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT fk_subarea_area
        FOREIGN KEY (id_area)
        REFERENCES tbl_area_ensayo(id_area)
);

CREATE TABLE tbl_tipo_ensayo (
    id_tipo_ensayo BIGSERIAL PRIMARY KEY,
    id_subarea BIGINT NOT NULL,
    nombre_tipo_ensayo VARCHAR(250) NOT NULL,
    codigo_norma VARCHAR(100),
    activo BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT fk_tipo_ensayo_subarea
        FOREIGN KEY (id_subarea)
        REFERENCES tbl_subarea_ensayo(id_subarea)
);

CREATE TABLE tbl_precio_ensayo (
    id_precio_ensayo BIGSERIAL PRIMARY KEY,
    id_tipo_ensayo BIGINT NOT NULL,

    precio NUMERIC(18,2) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT fk_precio_tipo_ensayo
        FOREIGN KEY (id_tipo_ensayo)
        REFERENCES tbl_tipo_ensayo(id_tipo_ensayo),

    CONSTRAINT ck_precio_ensayo_precio
        CHECK (precio >= 0)
);

-- =========================
-- COTIZACIÓN
-- =========================

CREATE TABLE tbl_cotizacion (
    id_cotizacion BIGSERIAL PRIMARY KEY,
    id_obra BIGINT NOT NULL,

    codigo_cotizacion VARCHAR(30) UNIQUE,
    origen_cotizacion VARCHAR(30) NOT NULL,
    id_usuario_creador BIGINT NULL,

    fecha_solicitud TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(30) NOT NULL DEFAULT 'BORRADOR',
    observaciones VARCHAR(500),

    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_cotizacion_obra
        FOREIGN KEY (id_obra)
        REFERENCES tbl_obra(id_obra),

    CONSTRAINT fk_cotizacion_usuario_creador
        FOREIGN KEY (id_usuario_creador)
        REFERENCES tbl_usuario_cuenta(id_usuario_cuenta)
);

CREATE TABLE tbl_cotizacion_detalle_ensayo (
    id_detalle_ensayo BIGSERIAL PRIMARY KEY,
    id_cotizacion BIGINT NOT NULL,
    id_tipo_ensayo BIGINT NOT NULL,

    cantidad_ensayos INT NOT NULL,
    cantidad_visitas INT NOT NULL,

    precio_unitario NUMERIC(18,2) NOT NULL,
    subtotal NUMERIC(18,2) GENERATED ALWAYS AS 
        (cantidad_ensayos * precio_unitario) STORED,

    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_detalle_cotizacion
        FOREIGN KEY (id_cotizacion)
        REFERENCES tbl_cotizacion(id_cotizacion),

    CONSTRAINT fk_detalle_tipo_ensayo
        FOREIGN KEY (id_tipo_ensayo)
        REFERENCES tbl_tipo_ensayo(id_tipo_ensayo),

    CONSTRAINT ck_detalle_cantidad_ensayos
        CHECK (cantidad_ensayos > 0),

    CONSTRAINT ck_detalle_cantidad_visitas
        CHECK (cantidad_visitas > 0),

    CONSTRAINT ck_detalle_precio_unitario
        CHECK (precio_unitario >= 0)
);