import { Router } from 'express';
import { healthRouter } from './health.route.js';

export const routes = Router();

routes.use('/health', healthRouter);
