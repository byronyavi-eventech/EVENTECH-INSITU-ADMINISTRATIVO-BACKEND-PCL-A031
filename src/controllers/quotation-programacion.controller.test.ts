/**
 * quotation-programacion.controller.test.ts
 *
 * Tests de controller (mockeados, sin DB real) para el flujo de
 * Programación de Ensayos — Fase 5 Parte A, ítems 1 y 2:
 *   1. Cambio de estado inicial PAGO_VERIFICADO → PENDIENTE_PROGRAMACION.
 *   2. Envío de correo (mockeado — NO pega a Resend real).
 *
 * Mismo patrón que equipo.controller.test.ts: mockea toda la capa de
 * servicios/email/token, monta solo quotationRouter + errorHandler, y usa
 * supertest. requireAuth se mockea como no-op — lo que se testea acá es el
 * handler, no el middleware de auth.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// vi.mock BEFORE imports
vi.mock('../services/quotation.service.js', () => ({
  submitWebQuotation: vi.fn(),
  listQuotations: vi.fn(),
  updateEstadoCotizacion: vi.fn(),
  updateQuotation: vi.fn(),
  getCotizacionById: vi.fn(),
  confirmarPago: vi.fn(),
  getComprobantesByCotizacion: vi.fn(),
  getProgramacionDataByToken: vi.fn(),
  confirmarProgramacion: vi.fn(),
}));
vi.mock('../services/email.service.js', () => ({
  sendCotizacionEmail: vi.fn(),
  sendCotizacionClienteEmail: vi.fn(),
  sendProgramacionEmail: vi.fn(),
}));
vi.mock('../services/token.service.js', () => ({
  verifyQuotationToken: vi.fn(),
  generateQuotationToken: vi.fn(),
}));
vi.mock('../services/s3.service.js', () => ({
  generateUploadPresignedUrls: vi.fn(),
  generateDownloadPresignedUrls: vi.fn(),
}));
vi.mock('../pdf/cotizacion-document.js', () => ({
  CotizacionDocument: () => null,
  loadLogoDataUri: () => 'data:image/png;base64,',
}));
vi.mock('../middlewares/auth.middleware.js', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../db/index.js', () => ({
  db: {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  },
}));

import * as quotationService from '../services/quotation.service.js';
import * as emailService from '../services/email.service.js';
import * as tokenService from '../services/token.service.js';
import { AppError } from '../utils/app-error.js';
import { quotationRouter } from '../routes/quotation.route.js';
import { errorHandler } from '../middlewares/error.middleware.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/quotations', quotationRouter);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

describe('Programación de Ensayos — Controller', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('PATCH /api/quotations/:id/solicitar-programacion', () => {
    const cotizacionPagoVerificado = {
      id: 5,
      estado: 'PAGO_VERIFICADO',
      cliente: { email: 'cliente@obra.cl', nombreContacto: 'Juan Pérez' },
      obra: { nombreObra: 'Edificio Test' },
      codigoCotizacion: '10005-LIA',
    };

    it('cambia el estado a PENDIENTE_PROGRAMACION y dispara el email (mockeado)', async () => {
      vi.mocked(quotationService.getCotizacionById).mockResolvedValueOnce(
        cotizacionPagoVerificado as any,
      );
      vi.mocked(tokenService.generateQuotationToken).mockResolvedValueOnce('fake-token-abc');
      vi.mocked(emailService.sendProgramacionEmail).mockResolvedValueOnce(undefined);

      const res = await request(app).patch('/api/quotations/5/solicitar-programacion');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.estado).toBe('PENDIENTE_PROGRAMACION');
      expect(res.body.data.id).toBe(5);
      expect(res.body.data.programarUrl).toContain('/programar-ensayos?token=');

      // Ítem 2: el correo se disparó — mockeado, jamás llegó a pegarle a Resend real.
      expect(emailService.sendProgramacionEmail).toHaveBeenCalledTimes(1);
      expect(emailService.sendProgramacionEmail).toHaveBeenCalledWith(
        cotizacionPagoVerificado,
        'fake-token-abc',
      );
      expect(tokenService.generateQuotationToken).toHaveBeenCalledWith(5, 'PROGRAMAR');
    });

    it('rechaza con 422 si la cotización no está en PAGO_VERIFICADO', async () => {
      vi.mocked(quotationService.getCotizacionById).mockResolvedValueOnce({
        ...cotizacionPagoVerificado,
        estado: 'NUEVA',
      } as any);

      const res = await request(app).patch('/api/quotations/5/solicitar-programacion');

      expect(res.status).toBe(422);
      expect(res.body.status).toBe('error');
      // No debe haberse disparado ningún correo si el estado no calza.
      expect(emailService.sendProgramacionEmail).not.toHaveBeenCalled();
      expect(tokenService.generateQuotationToken).not.toHaveBeenCalled();
    });

    it('rechaza con 400 si el id no es un número válido', async () => {
      const res = await request(app).patch('/api/quotations/abc/solicitar-programacion');

      expect(res.status).toBe(400);
      expect(quotationService.getCotizacionById).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/quotations/:id/confirmar-programacion', () => {
    it('devuelve 200 con las OTs generadas cuando el service resuelve OK', async () => {
      vi.mocked(quotationService.confirmarProgramacion).mockResolvedValueOnce({
        id: 7,
        estado: 'PROGRAMADO',
        ordenesTrabajo: [
          {
            codigoOt: 'OT-10007-LIA-1',
            numeroVisita: 1,
            fechaHoraProgramada: '2027-01-15T10:00:00.000Z',
            ensayos: [{ id: 1, nombreTipoEnsayo: 'Ensayo X' }],
          },
        ],
      } as any);

      const res = await request(app)
        .post('/api/quotations/7/confirmar-programacion')
        .send({
          token: 'tok',
          visitas: [
            {
              numeroVisita: 1,
              fechaHoraProgramada: '2027-01-15T10:00:00.000Z',
              detalleIds: [1],
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.ordenesTrabajo).toHaveLength(1);
      expect(res.body.message).toContain('1 OT generada');
    });

    it('forwarda el AppError del service (ej. rechazo por traslado) con su status real', async () => {
      vi.mocked(quotationService.confirmarProgramacion).mockRejectedValueOnce(
        new AppError('Visita 1: esta obra requiere al menos 48h de anticipación.', 422),
      );

      const res = await request(app)
        .post('/api/quotations/7/confirmar-programacion')
        .send({ token: 'tok', visitas: [{ numeroVisita: 1, fechaHoraProgramada: '2027-01-15T10:00:00.000Z', detalleIds: [1] }] });

      expect(res.status).toBe(422);
      expect(res.body.message).toContain('anticipación');
    });

    it('rechaza con 400 si falta el body (token/visitas)', async () => {
      const res = await request(app).post('/api/quotations/7/confirmar-programacion').send({});

      expect(res.status).toBe(400);
      expect(quotationService.confirmarProgramacion).not.toHaveBeenCalled();
    });
  });
});
