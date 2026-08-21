/**
 * src/routes/equipo.route.ts
 * Router for laboratory equipment endpoints.
 */
import { Router, type Router as RouterType } from 'express';
import {
  listEquiposHandler,
  createEquipoHandler,
  getEquipoByIdHandler,
  updateEquipoHandler,
  deactivateEquipoHandler,
  getFichaControlHandler,
  createCalibracionHandler,
  listCalibracionesHandler,
  attachCertificadoCalibracionHandler,
  createVerificacionHandler,
  listVerificacionesHandler,
  attachRegistroVerificacionHandler,
  createMantenimientoHandler,
  listMantenimientosHandler,
  attachDocumentoMantenimientoHandler,
  associateTipoEnsayoHandler,
  listTiposEnsayoHandler,
  dissociateTipoEnsayoHandler,
} from '../controllers/equipo.controller.js';
import { uploadArchivo } from '../middlewares/upload.middleware.js';

export const equipoRouter: RouterType = Router();

equipoRouter.get('/', listEquiposHandler);
equipoRouter.post('/', createEquipoHandler);
equipoRouter.get('/:id', getEquipoByIdHandler);
equipoRouter.get('/:id/ficha-control', getFichaControlHandler);
equipoRouter.put('/:id', updateEquipoHandler);
// PATCH /:id/status eliminado (Fase 3, 2026-08-04): activo/inactivo/dado_de_baja
// pasan a ser 100% calculados. La única baja manual sigue siendo DELETE /:id.
equipoRouter.delete('/:id', deactivateEquipoHandler);
equipoRouter.post('/:id/calibrations', createCalibracionHandler);
equipoRouter.get('/:id/calibrations', listCalibracionesHandler);
equipoRouter.post('/:id/verifications', createVerificacionHandler);
equipoRouter.get('/:id/verifications', listVerificacionesHandler);
equipoRouter.post('/:id/maintenances', createMantenimientoHandler);
equipoRouter.get('/:id/maintenances', listMantenimientosHandler);
equipoRouter.post('/:id/test-types', associateTipoEnsayoHandler);
equipoRouter.get('/:id/test-types', listTiposEnsayoHandler);
equipoRouter.delete('/:id/test-types/:testTypeId', dissociateTipoEnsayoHandler);

// ── Alias en español (Excel QA) ──
equipoRouter.post('/:id/calibraciones', createCalibracionHandler);
equipoRouter.get('/:id/calibraciones', listCalibracionesHandler);
equipoRouter.post('/:id/verificaciones', createVerificacionHandler);
equipoRouter.get('/:id/verificaciones', listVerificacionesHandler);
equipoRouter.post('/:id/mantenimientos', createMantenimientoHandler);
equipoRouter.get('/:id/mantenimientos', listMantenimientosHandler);
equipoRouter.post('/:id/tipos-ensayo', associateTipoEnsayoHandler);
equipoRouter.get('/:id/tipos-ensayo', listTiposEnsayoHandler);
equipoRouter.delete('/:id/tipos-ensayo/:testTypeId', dissociateTipoEnsayoHandler);

// ── Adjuntos (Fase 4 — filas rojas del Excel viejo) ──
equipoRouter.post(
  '/:id/calibraciones/:calibracionId/certificado',
  uploadArchivo,
  attachCertificadoCalibracionHandler,
);
equipoRouter.post(
  '/:id/calibrations/:calibracionId/certificate',
  uploadArchivo,
  attachCertificadoCalibracionHandler,
);
equipoRouter.post(
  '/:id/verificaciones/:verificacionId/registro',
  uploadArchivo,
  attachRegistroVerificacionHandler,
);
equipoRouter.post(
  '/:id/verifications/:verificacionId/record',
  uploadArchivo,
  attachRegistroVerificacionHandler,
);
equipoRouter.post(
  '/:id/mantenimientos/:mantenimientoId/documento',
  uploadArchivo,
  attachDocumentoMantenimientoHandler,
);
equipoRouter.post(
  '/:id/maintenances/:mantenimientoId/document',
  uploadArchivo,
  attachDocumentoMantenimientoHandler,
);
