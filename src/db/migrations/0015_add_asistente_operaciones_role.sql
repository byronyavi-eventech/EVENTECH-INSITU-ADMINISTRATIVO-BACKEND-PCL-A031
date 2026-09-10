-- Custom SQL migration file, put your code below! --
-- Adds the ASISTENTE_OPERACIONES role to the RBAC catalogue (rol table).
-- Gates access to the Mantenedores de Equipos module (equipos, catalogos-equipos,
-- dashboard-equipos, enums), same pattern as JEFE_LABORATORIO for Firmas.
-- No user is assigned this role by this migration — assignment happens via
-- usuario_rol, separately, per environment.
INSERT INTO "rol" ("nombre_rol", "descripcion", "activo")
VALUES ('ASISTENTE_OPERACIONES', 'Acceso al módulo Mantenedores de Equipos.', true)
ON CONFLICT ("nombre_rol") DO NOTHING;
