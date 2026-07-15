import { Router } from 'express';
import { getUfHandler } from '../controllers/uf.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export const ufRouter = Router();

// Requiere auth para que sólo el panel admin consulte el valor UF
ufRouter.get('/', requireAuth, getUfHandler);
