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
  rechazarClienteHandler,
  getCuentasHandler,
  getUploadSessionHandler,
  confirmarPagoHandler,
  getComprobantesHandler,
  verificarPagoHandler,
  rechazarPagoHandler,
  solicitarProgramacionHandler,
  getProgramacionByTokenHandler,
  confirmarProgramacionHandler,
  listAgendamientosHandler,
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

// Public — cliente confirma pago
quotationRouter.post('/confirmar-pago', confirmarPagoHandler);

// Public — cliente rechaza cotización con motivo (landing page)
quotationRouter.post('/rechazar-cliente', rechazarClienteHandler);

// Public — cliente carga el portal de Programación de Ensayos con su token
quotationRouter.get('/programacion/:token', getProgramacionByTokenHandler);

// Public — cliente confirma la programación (cierre del flujo, genera OT(s))
quotationRouter.post('/:id/confirmar-programacion', confirmarProgramacionHandler);

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

// Programación de Ensayos — admin solicita al cliente programar visitas
quotationRouter.patch('/:id/solicitar-programacion', requireAuth, solicitarProgramacionHandler);

// Agendamientos — vista central de todas las visitas programadas (solo lectura)
quotationRouter.get('/agendamientos', requireAuth, listAgendamientosHandler);
