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
import { requireRole } from '../middlewares/role.middleware.js';

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

// Gestión interna de cotizaciones — gateado por rol (ENCARGADO_ADMINISTRATIVO
// o JEFE_LABORATORIO), mismo patrón que ASISTENTE_OPERACIONES para
// Mantenedores de Equipos.
quotationRouter.patch(
  '/:id/estado',
  requireAuth,
  requireRole('ENCARGADO_ADMINISTRATIVO', 'JEFE_LABORATORIO'),
  updateEstadoHandler,
);
quotationRouter.put(
  '/:id',
  requireAuth,
  requireRole('ENCARGADO_ADMINISTRATIVO', 'JEFE_LABORATORIO'),
  updateQuotationHandler,
);

// PDF + Email (interno — firma del jefe)
quotationRouter.get(
  '/:id/pdf',
  requireAuth,
  requireRole('ENCARGADO_ADMINISTRATIVO', 'JEFE_LABORATORIO'),
  getPdfHandler,
);
quotationRouter.post(
  '/:id/send-email',
  requireAuth,
  requireRole('ENCARGADO_ADMINISTRATIVO', 'JEFE_LABORATORIO'),
  sendEmailHandler,
);

// Email al cliente con botones ACEPTAR / RECHAZAR — gateado por rol, mismo
// patrón que ASISTENTE_OPERACIONES para Mantenedores de Equipos.
quotationRouter.post(
  '/:id/send-cliente-email',
  requireAuth,
  requireRole('JEFE_LABORATORIO'),
  sendClienteEmailHandler,
);

// Comprobantes de pago — admin descarga, verifica o rechaza
quotationRouter.get(
  '/:id/comprobantes',
  requireAuth,
  requireRole('ENCARGADO_ADMINISTRATIVO', 'JEFE_LABORATORIO'),
  getComprobantesHandler,
);
quotationRouter.patch(
  '/:id/verificar-pago',
  requireAuth,
  requireRole('ENCARGADO_ADMINISTRATIVO', 'JEFE_LABORATORIO'),
  verificarPagoHandler,
);
quotationRouter.patch(
  '/:id/rechazar-pago',
  requireAuth,
  requireRole('ENCARGADO_ADMINISTRATIVO', 'JEFE_LABORATORIO'),
  rechazarPagoHandler,
);

// Programación de Ensayos — admin solicita al cliente programar visitas
quotationRouter.patch(
  '/:id/solicitar-programacion',
  requireAuth,
  requireRole('ENCARGADO_ADMINISTRATIVO', 'JEFE_LABORATORIO'),
  solicitarProgramacionHandler,
);

// Agendamientos — vista central de todas las visitas programadas (solo lectura)
quotationRouter.get(
  '/agendamientos',
  requireAuth,
  requireRole('ENCARGADO_ADMINISTRATIVO', 'JEFE_LABORATORIO'),
  listAgendamientosHandler,
);
