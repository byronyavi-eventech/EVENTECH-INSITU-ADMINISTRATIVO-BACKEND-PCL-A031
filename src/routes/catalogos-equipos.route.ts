/**
 * src/routes/catalogos-equipos.route.ts
 * Router para catálogos de Equipos con rutas en español — mapeadas 1:1 con el Excel del QA.
 */
import { Router, type Router as RouterType } from 'express';
import {
  listTiposEquipoHandler,
  listGruposHandler,
  listEmpresasHandler,
  listSucursalesHandler,
  listUbicacionesHandler,
  listEstadosEquipoHandler,
  listUnidadesHandler,
  listEstadosControlHandler,
  listLaboratoriosHandler,
  listProcedimientosHandler,
  listUsuariosHandler,
} from '../controllers/catalogos-equipos.controller.js';

export const catalogosEquiposRouter: RouterType = Router();

// Información General
catalogosEquiposRouter.get('/grupos', listGruposHandler);
catalogosEquiposRouter.get('/tipos-equipo', listTiposEquipoHandler);
catalogosEquiposRouter.get('/empresas', listEmpresasHandler);
catalogosEquiposRouter.get('/sucursales', listSucursalesHandler);
catalogosEquiposRouter.get('/ubicaciones', listUbicacionesHandler);
catalogosEquiposRouter.get('/estados-equipo', listEstadosEquipoHandler);

// Características Técnicas
catalogosEquiposRouter.get('/unidades', listUnidadesHandler);

// Calibración / Verificación / Mantenimiento
catalogosEquiposRouter.get('/estados-control', listEstadosControlHandler);

// Auxiliares
catalogosEquiposRouter.get('/laboratorios-calibradores', listLaboratoriosHandler);
catalogosEquiposRouter.get('/procedimientos', listProcedimientosHandler);
catalogosEquiposRouter.get('/usuarios', listUsuariosHandler);
