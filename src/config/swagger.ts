/**
 * src/config/swagger.ts
 * Especificación OpenAPI 3.0 para la API del Módulo de Mantenedores de Equipos.
 * Mapeado 1:1 con las filas y categorías del Excel (captura de pantalla).
 */

export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'API Módulo de Mantenedores de Equipos (QA Verified)',
    version: '1.0.0',
    description: `API RESTful para la gestión y control de equipos de laboratorio, calibraciones, verificaciones, mantenimientos y catálogos de soporte.

### Autenticación
Los endpoints protegidos requieren sesión real de Better Auth (cookie de sesión) — ver \`middlewares/auth.middleware.ts\`.`,
    contact: {
      name: 'Soporte EVENTECH / INSITU',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Servidor Local (Desarrollo)',
    },
    {
      url: '/',
      description: 'Ruta Relativa',
    },
  ],
  tags: [
    { name: 'Información General', description: 'Catálogos de información general de equipos' },
    {
      name: 'Características Técnicas',
      description: 'Catálogos de parámetros y especificaciones técnicas',
    },
    { name: 'Calibración', description: 'Catálogos y registros de calibración' },
    { name: 'Verificación', description: 'Catálogos y registros de verificación' },
    { name: 'Mantenimiento', description: 'Catálogos y registros de mantenimiento' },
    {
      name: 'Configuración OT',
      description: 'Asociación de tipos de ensayo y servicios para órdenes de trabajo',
    },
    {
      name: 'Acciones del Sistema',
      description: 'Operaciones del sistema como cargar ficha de equipo para editar',
    },
    { name: 'CRUD Equipos', description: 'Gestión del ciclo de vida e historial de equipos' },
    { name: 'Dashboard', description: 'Métricas de control y estado de equipos' },
    { name: 'Health', description: 'Estado operacional del servicio' },
  ],
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Verificar salud de la API',
        description: 'Retorna el estado operacional del módulo de mantenedores.',
        responses: {
          '200': {
            description: 'Servicio operando correctamente',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: {
                      type: 'object',
                      properties: {
                        module: { type: 'string', example: 'mantenedores' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ─── Información General ─────────────────────────────────────
    '/api/catalogos/grupos': {
      get: {
        tags: ['Información General'],
        summary: 'Grupo',
        description:
          'Devuelve el catálogo de grupos activos (agrupación superior a Tipo de Equipo).',
        responses: {
          '200': { description: 'Lista de grupos' },
        },
      },
    },

    '/api/catalogos/tipos-equipo': {
      get: {
        tags: ['Información General'],
        summary: 'Tipo de Equipo',
        description:
          'Devuelve id, nombre, prefijo_codigo para los tipos de equipo en catálogo. Permite filtrar por ?grupoId={id}.',
        parameters: [
          {
            name: 'grupoId',
            in: 'query',
            schema: { type: 'integer' },
            description: 'ID del grupo para filtrar tipos de equipo',
          },
        ],
        responses: {
          '200': { description: 'Lista de tipos de equipo obtenida con éxito' },
        },
      },
    },

    '/api/catalogos/sucursales': {
      get: {
        tags: ['Información General'],
        summary: 'Sucursal / Ciudad',
        description:
          'Devuelve las sucursales asociadas a una empresa. Permite filtrar por ?empresaId={id}.',
        parameters: [
          {
            name: 'empresaId',
            in: 'query',
            schema: { type: 'integer' },
            description: 'ID de la empresa para filtrar sucursales',
          },
        ],
        responses: {
          '200': { description: 'Lista de sucursales' },
        },
      },
    },

    '/api/catalogos/ubicaciones': {
      get: {
        tags: ['Información General'],
        summary: 'Ubicación',
        description:
          'Devuelve las ubicaciones físicas asociadas a una sucursal (ej. Laboratorio, Bodega, Terreno). Permite filtrar por ?sucursalId={id}.',
        parameters: [
          {
            name: 'sucursalId',
            in: 'query',
            schema: { type: 'integer' },
            description: 'ID de la sucursal para filtrar ubicaciones',
          },
        ],
        responses: {
          '200': { description: 'Lista de ubicaciones' },
        },
      },
    },

    '/api/catalogos/estados-equipo': {
      get: {
        tags: ['Información General'],
        summary: 'Estado del Equipo',
        description:
          'Lista estática de estados del equipo. Activo/Inactivo se calculan (Fase 3); Dado de baja es manual vía DELETE.',
        responses: {
          '200': {
            description: 'Valores de estados de equipo: ["activo","inactivo","dado_de_baja"]',
          },
        },
      },
    },

    '/api/catalogos/empresas': {
      get: {
        tags: ['Información General'],
        summary: 'Empresa',
        description: 'Devuelve el catálogo de empresas.',
        responses: {
          '200': { description: 'Lista de empresas' },
        },
      },
    },

    // ─── Características Técnicas ────────────────────────────────
    '/api/catalogos/unidades': {
      get: {
        tags: ['Características Técnicas'],
        summary: 'Unidad',
        description: 'Devuelve el catálogo de unidades de medida.',
        responses: {
          '200': { description: 'Lista de unidades de medida' },
        },
      },
    },

    // ─── Calibración ──────────────────────────────────────────────
    '/api/catalogos/estados-control': {
      get: {
        tags: ['Calibración', 'Verificación', 'Mantenimiento'],
        summary: 'Estado Calibración / Verificación / Mantenimiento',
        description: 'Lista estática reutilizable para los 3 campos de estado de control.',
        responses: {
          '200': {
            description:
              'Valores de estados de control: ["vigente","vencida","proxima_a_vencer","no_aplica","sin_registro"]',
          },
        },
      },
    },

    // ─── Catálogos auxiliares ─────────────────────────────────────
    '/api/catalogos/laboratorios-calibradores': {
      get: {
        tags: ['Calibración'],
        summary: 'Laboratorio Calibrador',
        description: 'Devuelve el catálogo de laboratorios calibradores externos.',
        responses: {
          '200': { description: 'Lista de laboratorios calibradores' },
        },
      },
    },

    '/api/catalogos/procedimientos': {
      get: {
        tags: ['Calibración', 'Verificación'],
        summary: 'Procedimiento',
        description: 'Devuelve el catálogo de procedimientos de calibración/verificación.',
        responses: {
          '200': { description: 'Lista de procedimientos' },
        },
      },
    },

    '/api/catalogos/usuarios': {
      get: {
        tags: ['Información General'],
        summary: 'Usuario',
        description:
          'Devuelve el catálogo de usuarios activos (responsable/registradoPor en equipos e historiales).',
        responses: {
          '200': { description: 'Lista de usuarios activos' },
        },
      },
    },

    // ─── Enums ──────────────────────────────────────────────────
    '/api/enums/{tipo}': {
      get: {
        tags: ['Información General'],
        summary: 'Consultar valores de un enum del sistema',
        description:
          'Devuelve los valores válidos para un enum. Disponibles: estado_equipo, estado_calibracion, estado_verificacion, estado_mantenimiento, tipo_mantenimiento.',
        parameters: [
          {
            name: 'tipo',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Nombre del enum a consultar',
          },
        ],
        responses: {
          '200': { description: 'Lista de valores {value, label} del enum' },
          '404': { description: 'Enum no existe' },
        },
      },
    },

    // ─── Configuración OT ─────────────────────────────────────────
    '/api/equipos/{id}/tipos-ensayo': {
      get: {
        tags: ['Configuración OT'],
        summary: 'Tipos de Ensayo / Servicios',
        description:
          'Obtiene los tipos de ensayo asociados a un equipo de laboratorio, incluyendo los nombres del catálogo de ensayos.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'ID del equipo',
          },
        ],
        responses: {
          '200': { description: 'Lista de tipos de ensayo asociados con nombre' },
        },
      },
      post: {
        tags: ['Configuración OT'],
        summary: 'Asociar Tipo de Ensayo',
        description: 'Asocia un tipo de ensayo del catálogo a un equipo de laboratorio.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'ID del equipo',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tipoEnsayoId'],
                properties: {
                  tipoEnsayoId: { type: 'integer', example: 1 },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Asociación creada exitosamente' },
        },
      },
    },

    // ─── Acciones del Sistema ─────────────────────────────────────
    '/api/equipos/{id}': {
      get: {
        tags: ['Acciones del Sistema', 'CRUD Equipos'],
        summary: 'Cargar Ficha para Editar',
        description:
          'Obtiene el detalle completo del equipo resolviendo todos los catálogos por nombre para cargar el formulario de edición.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': { description: 'Ficha del equipo con catálogos resueltos' },
        },
      },
      put: {
        tags: ['CRUD Equipos'],
        summary: 'PUT /api/equipos/:id — editar equipo de prueba',
        description: 'Actualiza los datos del equipo.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateEquipoInput' },
            },
          },
        },
        responses: {
          '200': { description: 'Equipo actualizado' },
        },
      },
    },

    // ─── CRUD Equipos e Historiales ──────────────────────────────
    '/api/equipos': {
      get: {
        tags: ['CRUD Equipos'],
        summary: 'Listar Equipos',
        description: 'Obtiene la lista paginada de equipos.',
        parameters: [
          { name: 'tipoEquipoId', in: 'query', schema: { type: 'integer' } },
          { name: 'sucursalId', in: 'query', schema: { type: 'integer' } },
          { name: 'ubicacionId', in: 'query', schema: { type: 'integer' } },
          { name: 'estado', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          '200': { description: 'Lista de equipos' },
        },
      },
      post: {
        tags: ['CRUD Equipos'],
        summary: 'POST /api/equipos — crear equipo de prueba',
        description: 'Registra un nuevo equipo de laboratorio en la base de datos.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateEquipoInput' },
            },
          },
        },
        responses: {
          '201': { description: 'Equipo creado exitosamente' },
        },
      },
    },

    '/api/equipos/{id}/calibraciones': {
      get: {
        tags: ['Calibración', 'CRUD Equipos'],
        summary: 'Listar Historial Calibración',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Historial de calibraciones' } },
      },
      post: {
        tags: ['Calibración', 'CRUD Equipos'],
        summary: 'POST /api/equipos/:id/calibraciones — insertar historial calibración',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateCalibracionInput' },
            },
          },
        },
        responses: { '201': { description: 'Calibración registrada' } },
      },
    },

    '/api/equipos/{id}/calibraciones/{calibracionId}/certificado': {
      post: {
        tags: ['Calibración', 'CRUD Equipos'],
        summary: 'Adjuntar Certificado de Calibración',
        description:
          'Sube un archivo (PDF/JPG/PNG/Word, máx. 10MB) y lo asocia como documento_url del registro de calibración.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'ID del equipo',
          },
          {
            name: 'calibracionId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'ID del historial de calibración',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: { file: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
        responses: { '200': { description: 'Certificado adjuntado' } },
      },
    },

    '/api/equipos/{id}/verificaciones': {
      get: {
        tags: ['Verificación', 'CRUD Equipos'],
        summary: 'Listar Historial Verificación',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Historial de verificaciones' } },
      },
      post: {
        tags: ['Verificación', 'CRUD Equipos'],
        summary: 'POST /api/equipos/:id/verificaciones — insertar historial verificación',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateVerificacionInput' },
            },
          },
        },
        responses: { '201': { description: 'Verificación registrada' } },
      },
    },

    '/api/equipos/{id}/verificaciones/{verificacionId}/registro': {
      post: {
        tags: ['Verificación', 'CRUD Equipos'],
        summary: 'Adjuntar Registro de Verificación',
        description:
          'Sube un archivo (PDF/JPG/PNG/Word, máx. 10MB) y lo asocia como documento_url del registro de verificación.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'ID del equipo',
          },
          {
            name: 'verificacionId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'ID del historial de verificación',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: { file: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
        responses: { '200': { description: 'Registro adjuntado' } },
      },
    },

    '/api/equipos/{id}/mantenimientos': {
      get: {
        tags: ['Mantenimiento', 'CRUD Equipos'],
        summary: 'Listar Historial Mantenimiento',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Historial de mantenimientos' } },
      },
      post: {
        tags: ['Mantenimiento', 'CRUD Equipos'],
        summary: 'POST /api/equipos/:id/mantenimientos — insertar historial mantenimiento',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateMantenimientoInput' },
            },
          },
        },
        responses: { '201': { description: 'Mantenimiento registrado' } },
      },
    },

    '/api/equipos/{id}/mantenimientos/{mantenimientoId}/documento': {
      post: {
        tags: ['Mantenimiento', 'CRUD Equipos'],
        summary: 'Adjuntar Documento de Mantenimiento',
        description:
          'Sube un archivo (PDF/JPG/PNG/Word, máx. 10MB) y lo asocia como documento_url del registro de mantenimiento.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'ID del equipo',
          },
          {
            name: 'mantenimientoId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'ID del historial de mantenimiento',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: { file: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
        responses: { '200': { description: 'Documento adjuntado' } },
      },
    },

    // ─── Dashboard ───────────────────────────────────────────────
    '/api/dashboard/summary': {
      get: {
        tags: ['Dashboard'],
        summary: 'Resumen general',
        description:
          'Métricas globales: porEstado (Estado General calculado, Fase 3), porTipo, porSucursal.',
        responses: {
          '200': { description: 'Métricas globales del dashboard' },
        },
      },
    },

    '/api/dashboard/controls': {
      get: {
        tags: ['Dashboard'],
        summary: 'Estados de control (semáforo)',
        description:
          'Estado de control y Estado General calculado para todos los equipos no dados de baja. Alias: GET /api/dashboard/estados-equipos.',
        responses: {
          '200': { description: 'Lista de estados de control por equipo' },
        },
      },
    },

    '/api/dashboard/critical': {
      get: {
        tags: ['Dashboard'],
        summary: 'Equipos críticos',
        description: 'Lista de equipos cuyo Estado General calculado es "inactivo" (Fase 3).',
        responses: {
          '200': { description: 'Lista de equipos críticos' },
        },
      },
    },

    '/api/dashboard/estados-equipos/{id}': {
      get: {
        tags: ['Dashboard'],
        summary: 'GET /api/dashboard/estados-equipos/:id — estado calculado del equipo',
        description:
          'Confirma que el equipo aparece con su estado de controles calculado correctamente (vigente/vencida/etc.).',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': { description: 'Estado de controles calculado para el equipo' },
        },
      },
    },
  },

  components: {
    schemas: {
      Equipo: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          codigo: { type: 'string', example: 'BAL-001' },
          nombre: { type: 'string', example: 'Balanza de Precisión' },
          tipoEquipoId: { type: 'integer', example: 1 },
          marca: { type: 'string', example: 'Sartorius' },
          modelo: { type: 'string', example: 'Entris II' },
          numeroSerie: { type: 'string', example: 'BAL-2026-X' },
          sucursalId: { type: 'integer', example: 1 },
          ubicacionId: { type: 'integer', example: 1 },
          estado: { type: 'string', example: 'activo' },
        },
      },

      CreateEquipoInput: {
        type: 'object',
        required: ['tipoEquipoId', 'nombre', 'sucursalId', 'ubicacionId'],
        properties: {
          tipoEquipoId: { type: 'integer', example: 1 },
          nombre: { type: 'string', example: 'Balanza de Precisión 0.01g' },
          marca: { type: 'string', example: 'Sartorius' },
          modelo: { type: 'string', example: 'Entris II' },
          numeroSerie: { type: 'string', example: 'BAL-2026-X' },
          sucursalId: { type: 'integer', example: 1 },
          ubicacionId: { type: 'integer', example: 1 },
          responsableId: {
            type: 'string',
            example: '1',
            description:
              'Fase 2 (2026-08-06) — id de usuarios.id, text (nanoid de Better Auth a futuro), no integer',
          },
          fechaAdquisicion: { type: 'string', format: 'date', example: '2025-06-01' },
          observaciones: {
            type: 'string',
            example: 'Equipo adquirido para reemplazo de línea antigua',
          },
          precisionEquipo: { type: 'string', example: 'Class II' },
          unidadPrecisionId: {
            type: 'integer',
            example: 3,
            description: 'Fase 5 (2026-08-07) — FK a unidades_medida, propio de Precisión',
          },
          rangoMedicion: { type: 'string', example: '0-2200 g' },
          unidadRangoId: {
            type: 'integer',
            example: 3,
            description: 'Fase 5 (2026-08-07) — FK a unidades_medida, propio de Rango de Medición',
          },
          disponibleOt: { type: 'boolean', example: true },
          usoObra: { type: 'boolean', example: false },
          usoLaboratorio: { type: 'boolean', example: true },
          permiteUsoSimultaneo: { type: 'boolean', example: false },
          requiereReserva: { type: 'boolean', example: true },
          requiereCalibracion: { type: 'boolean', example: true },
          frecuenciaCalibracionMeses: { type: 'integer', example: 12 },
          diasAvisoCalibracion: {
            type: 'integer',
            example: 30,
            description: 'Obligatorio si requiereCalibracion=true (Fase 3)',
          },
          requiereVerificacion: { type: 'boolean', example: true },
          frecuenciaVerificacionMeses: { type: 'integer', example: 6 },
          diasAvisoVerificacion: {
            type: 'integer',
            example: 15,
            description: 'Obligatorio si requiereVerificacion=true (Fase 3)',
          },
          requiereMantenimiento: { type: 'boolean', example: true },
          frecuenciaMantenimientoMeses: { type: 'integer', example: 6 },
          diasAvisoMantenimiento: {
            type: 'integer',
            example: 15,
            description: 'Obligatorio si requiereMantenimiento=true (Fase 3)',
          },
        },
      },

      CreateCalibracionInput: {
        type: 'object',
        required: ['fechaCalibracion'],
        properties: {
          fechaCalibracion: { type: 'string', format: 'date', example: '2026-01-15' },
          // UAT post-demo (2026-08-07): laboratorioCalibrador/procedimiento
          // pasaron de FK a texto libre, pedido de Noelia — sin confirmar
          // obligatoriedad, quedan optional (ver equipo.validator.ts).
          laboratorioCalibrador: { type: 'string', example: 'CESMEC' },
          procedimiento: { type: 'string', example: 'PT-001' },
          nCertificado: { type: 'string', example: 'CERT-2026-001' },
          estadoIngreso: {
            type: 'string',
            enum: ['aprobado', 'en_proceso'],
            example: 'aprobado',
            description: 'Fase 3 — reemplaza el antiguo campo resultado',
          },
          registradoPorId: {
            type: 'string',
            example: '1',
            description:
              'Fase 2 (2026-08-06) — id de usuarios.id, text (nanoid de Better Auth a futuro), no integer',
          },
          observaciones: { type: 'string', example: 'Calibración realizada sin desviaciones' },
        },
      },

      CreateVerificacionInput: {
        type: 'object',
        required: ['fechaVerificacion'],
        properties: {
          fechaVerificacion: { type: 'string', format: 'date', example: '2026-03-01' },
          responsableId: {
            type: 'string',
            example: '1',
            description:
              'Fase 2 (2026-08-06) — id de usuarios.id, text (nanoid de Better Auth a futuro), no integer',
          },
          metodo: { type: 'string', example: 'Verificación con masa patrón M1' },
          // UAT post-demo (2026-08-07): procedimiento pasó de FK a texto
          // libre, pedido de Noelia — mismo criterio que CreateCalibracionInput.
          procedimiento: { type: 'string', example: 'LI-IT-MS-01' },
          nRegistro: { type: 'string', example: 'VER-2026-012' },
          estadoIngreso: {
            type: 'string',
            enum: ['aprobado', 'en_proceso'],
            example: 'aprobado',
            description: 'Fase 3 — reemplaza el antiguo campo resultado',
          },
        },
      },

      CreateMantenimientoInput: {
        type: 'object',
        required: ['fechaMantenimiento'],
        properties: {
          fechaMantenimiento: { type: 'string', format: 'date', example: '2026-02-10' },
          tipo: { type: 'string', enum: ['preventivo', 'correctivo'], example: 'preventivo' },
          estadoIngreso: {
            type: 'string',
            enum: ['operativo', 'en_mantenimiento', 'dado_de_baja', 'fuera_de_servicio'],
            example: 'operativo',
            description:
              'Fase 3 — este ES el estado calculado de Mantenimiento, sin lógica de fechas',
          },
          responsableId: {
            type: 'string',
            example: '1',
            description:
              'Fase 2 (2026-08-06) — id de usuarios.id, text (nanoid de Better Auth a futuro), no integer',
          },
          descripcion: { type: 'string', example: 'Limpieza de sensores y cambio de filtros' },
        },
      },
    },
  },
};

export const swaggerUiOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Swagger UI - Mantenedores API (QA Verified)',
};
