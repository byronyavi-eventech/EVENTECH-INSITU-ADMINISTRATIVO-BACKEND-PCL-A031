import { Router } from 'express';
import { healthRouter } from './health.route.js';
import { catalogRouter } from './catalog.route.js';
import { quotationRouter } from './quotation.route.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export const routes = Router();

// Public
routes.use('/health', healthRouter);
routes.use('/quotations', quotationRouter);

// Protected
routes.use(requireAuth);

routes.use('/catalog', catalogRouter);
