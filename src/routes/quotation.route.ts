import { Router } from 'express';
import {
  submitWebQuotationHandler,
  listQuotationsHandler,
  updateEstadoHandler,
  updateQuotationHandler,
} from '../controllers/quotation.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export const quotationRouter = Router();

// Public — landing page form
quotationRouter.post('/web', submitWebQuotationHandler);

// Protected — admin panel
quotationRouter.get('/', requireAuth, listQuotationsHandler);
quotationRouter.patch('/:id/estado', requireAuth, updateEstadoHandler);
quotationRouter.put('/:id', requireAuth, updateQuotationHandler);
