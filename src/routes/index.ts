import { Router } from 'express';
import { healthRouter } from './health.route.js';
import { catalogRouter } from './catalog.route.js';

export const routes = Router();

routes.use('/health', healthRouter);
routes.use('/catalog', catalogRouter);
