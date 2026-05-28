import { Router } from 'express';
import { healthRouter } from './health.route.js';
import { catalogRouter } from './catalog.route.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export const routes = Router();

// Public
routes.use('/health', healthRouter);

// Protected
routes.use(requireAuth);

routes.use('/catalog', catalogRouter);
