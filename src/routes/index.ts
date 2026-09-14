import { Router } from 'express';
import { healthRouter } from './health.route.js';
import { catalogRouter } from './catalog.route.js';
import { catalogPublicRouter } from './catalog-public.route.js';
import { quotationRouter } from './quotation.route.js';
import { userRouter } from './user.route.js';
import { ufRouter } from './uf.route.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole, requireAnyRole } from '../middlewares/role.middleware.js';
// Fase B (integración nativa): antes vivían bajo /api/mantenedores/* como
// "módulo" aparte (Fase 3) — ahora montados directo, mismo nivel que
// catalog/uf/user, como si siempre hubieran sido parte del Core.
import { equipoRouter } from './equipo.route.js';
import { catalogosEquiposRouter } from './catalogos-equipos.route.js';
import { dashboardEquiposRouter } from './dashboard-equipos.route.js';
import { enumRouter } from './enum.route.js';

export const routes = Router();

// Public
routes.use('/health', healthRouter);
routes.use('/quotations', quotationRouter);
// Solo GET /areas (árbol de catálogo) — el formulario público de cotización
// no tiene sesión. El resto de /catalog (POST/PUT/DELETE, listado paginado)
// sigue abajo, protegido.
routes.use('/catalog', catalogPublicRouter);

// Protected
routes.use(requireAuth);

// Exception: must stay reachable for a zero-role user, so the frontend can
// ask "what are my roles?" and get [] back instead of a 403.
routes.use('/', userRouter);

// Baseline gate — zero roles in usuario_rol → 403 from here down.
routes.use(requireAnyRole);

routes.use('/catalog', catalogRouter);
routes.use('/uf', ufRouter);

// Mantenedores de Equipos — gateado por rol, mismo patrón que
// JEFE_LABORATORIO para Firmas de Cotizaciones.
routes.use('/equipos', requireRole('ASISTENTE_OPERACIONES'), equipoRouter);
routes.use('/equipment', requireRole('ASISTENTE_OPERACIONES'), equipoRouter);
routes.use(
  '/catalogos-equipos',
  requireRole('ASISTENTE_OPERACIONES'),
  catalogosEquiposRouter,
);
routes.use(
  '/dashboard-equipos',
  requireRole('ASISTENTE_OPERACIONES'),
  dashboardEquiposRouter,
);
routes.use('/enums', requireRole('ASISTENTE_OPERACIONES'), enumRouter);
