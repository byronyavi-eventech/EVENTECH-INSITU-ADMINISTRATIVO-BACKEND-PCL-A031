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
  getUploadSessionHandler,
  confirmarPagoHandler,
  getComprobantesHandler,
  verificarPagoHandler,
  rechazarPagoHandler,
} from '../controllers/quotation.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export const quotationRouter = Router();

// Public — landing page form
quotationRouter.post('/web', submitWebQuotationHandler);

// Public — client responds to quotation via email link (GET with token query param)
// - RECHAZAR → cambia estado a RECHAZADA_CLIENTE directamente
// - ACEPTAR  → redirige a la landing page /cotizacion/pago-upload para subir comprobantes
quotationRouter.get('/respond', respondQuotationHandler);

// Public — cliente obtiene presigned PUT URLs para subir comprobantes a S3
quotationRouter.post('/upload-session', getUploadSessionHandler);

// Public — cliente confirma que subió los comprobantes (cambia estado a ESPERA_VERIFICACION)
quotationRouter.post('/confirmar-pago', confirmarPagoHandler);

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

// Comprobantes de pago — admin descarga, verifica o rechaza
quotationRouter.get('/:id/comprobantes', requireAuth, getComprobantesHandler);
quotationRouter.patch('/:id/verificar-pago', requireAuth, verificarPagoHandler);
quotationRouter.patch('/:id/rechazar-pago', requireAuth, rechazarPagoHandler);
