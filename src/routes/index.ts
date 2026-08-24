import { Router } from 'express';
import { healthRouter } from './health.route.js';
import { catalogRouter } from './catalog.route.js';
import { quotationRouter } from './quotation.route.js';
import { userRouter } from './user.route.js';
import { ufRouter } from './uf.route.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
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

// Protected
routes.use(requireAuth);

routes.use('/catalog', catalogRouter);
routes.use('/uf', ufRouter);
routes.use('/', userRouter);
routes.use('/equipos', equipoRouter);
routes.use('/equipment', equipoRouter);
routes.use('/catalogos-equipos', catalogosEquiposRouter);
routes.use('/dashboard-equipos', dashboardEquiposRouter);
routes.use('/enums', enumRouter);
