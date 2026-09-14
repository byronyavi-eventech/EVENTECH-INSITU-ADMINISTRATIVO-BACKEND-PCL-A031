/**
 * catalog-public.route.ts
 * Subconjunto de solo-lectura del catálogo de ensayos, sin autenticación.
 *
 * Consumido por el formulario público de cotización (WEBPAGE-103), que no
 * tiene sesión ni rol. Reutiliza el mismo controller/handler que el catálogo
 * protegido — no duplica lógica, solo cambia dónde se monta.
 *
 * Base path: /api/catalog  (mounted en routes/index.ts, sección Public)
 *
 * GET /areas → árbol completo del catálogo (áreas → subáreas → tipos + precio activo)
 *
 * Nota: NO exponer aquí /ensayos, /ensayos/:id ni los POST/PUT/DELETE — esos
 * siguen exclusivamente en catalog.route.ts, detrás de requireAuth + rol.
 */

import { Router } from 'express';
import { getCatalogTreeHandler } from '../controllers/catalog.controller.js';

export const catalogPublicRouter = Router();

catalogPublicRouter.get('/areas', getCatalogTreeHandler);
