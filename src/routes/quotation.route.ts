import { Router } from 'express';
import {
  submitWebQuotationHandler,
  listQuotationsHandler,
  updateEstadoHandler,
  updateQuotationHandler,
  getPdfHandler,
  sendEmailHandler,
  sendClienteEmailHandler,
  respondQuotationHandler,
  getCuentasHandler,
} from '../controllers/quotation.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export const quotationRouter = Router();

// Public — landing page form
quotationRouter.post('/web', submitWebQuotationHandler);

// Public — client responds to quotation via email link (GET with token query param)
quotationRouter.get('/respond', respondQuotationHandler);

// Protected — admin panel
quotationRouter.get('/cuentas', requireAuth, getCuentasHandler);
quotationRouter.get('/', requireAuth, listQuotationsHandler);
quotationRouter.patch('/:id/estado', requireAuth, updateEstadoHandler);
quotationRouter.put('/:id', requireAuth, updateQuotationHandler);

// PDF + Email (interno — firma del jefe)
quotationRouter.get('/:id/pdf', requireAuth, getPdfHandler);
quotationRouter.post('/:id/send-email', requireAuth, sendEmailHandler);

// Email al cliente con botones ACEPTAR / RECHAZAR
quotationRouter.post('/:id/send-cliente-email', requireAuth, sendClienteEmailHandler);
