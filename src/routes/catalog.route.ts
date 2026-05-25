/**
 * catalog.route.ts
 * Routes for the laboratory test catalogue domain.
 *
 * Base path: /api/catalog  (mounted in routes/index.ts)
 *
 * POST   /ensayos      → create a complete test entry (area + subarea + tipo + precio)
 * GET    /areas        → full catalog tree (areas → subareas → tipos + active price)
 * GET    /ensayos      → paginated flat list with optional filters
 * GET    /ensayos/:id  → single tipo_ensayo with full price history
 * PUT    /ensayos/:id  → partial update of tipo_ensayo + optional price rotation
 * DELETE /ensayos/:id  → soft-delete (sets activo = false)
 */

import { Router } from 'express';
import {
  createEnsayoHandler,
  getCatalogTreeHandler,
  listEnsayosHandler,
  getEnsayoByIdHandler,
  updateEnsayoHandler,
  deactivateEnsayoHandler,
} from '../controllers/catalog.controller.js';

export const catalogRouter = Router();

catalogRouter.post('/ensayos',      createEnsayoHandler);
catalogRouter.get('/areas',         getCatalogTreeHandler);
catalogRouter.get('/ensayos',       listEnsayosHandler);
catalogRouter.get('/ensayos/:id',   getEnsayoByIdHandler);
catalogRouter.put('/ensayos/:id',   updateEnsayoHandler);
catalogRouter.delete('/ensayos/:id', deactivateEnsayoHandler);
