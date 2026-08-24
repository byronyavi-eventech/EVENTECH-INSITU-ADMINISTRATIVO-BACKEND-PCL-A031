/**
 * src/routes/dashboard-equipos.route.ts
 * Router for equipment dashboard endpoints.
 */
import { Router, type Router as RouterType } from 'express';
import {
  getDashboardSummaryHandler,
  getControlStatusHandler,
  getCriticalEquiposHandler,
  getEquipoControlStatusHandler,
} from '../controllers/dashboard-equipos.controller.js';

export const dashboardEquiposRouter: RouterType = Router();

dashboardEquiposRouter.get('/summary', getDashboardSummaryHandler);
dashboardEquiposRouter.get('/controls', getControlStatusHandler);
dashboardEquiposRouter.get('/critical', getCriticalEquiposHandler);
dashboardEquiposRouter.get('/estados-equipos', getControlStatusHandler);
dashboardEquiposRouter.get('/estados-equipos/:id', getEquipoControlStatusHandler);
