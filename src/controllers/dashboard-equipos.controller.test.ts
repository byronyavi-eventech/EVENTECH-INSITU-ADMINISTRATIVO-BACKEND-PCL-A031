import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// vi.mock BEFORE imports
vi.mock('../services/equipo.service.js', () => ({
  getDashboardSummary: vi.fn(),
  getControlStatus: vi.fn(),
  getCriticalEquipos: vi.fn(),
}));

import * as equipoService from '../services/equipo.service.js';
import { AppError } from '../utils/app-error.js';
import { dashboardEquiposRouter } from '../routes/dashboard-equipos.route.js';
import { errorHandler } from '../middlewares/error.middleware.js';

// Fase B (integración nativa): app de test minimal, sin auth en la cadena —
// mismo patrón que src/test/setup-app.ts.
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/dashboard-equipos', dashboardEquiposRouter);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

describe('Dashboard Equipos Controller', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/dashboard-equipos/summary', () => {
    it('returns 200 with the summary payload', async () => {
      vi.mocked(equipoService.getDashboardSummary).mockResolvedValueOnce({
        porEstado: [{ estado: 'activo', total: 1 }],
        porTipo: [],
        porSucursal: [],
      });

      const res = await request(app).get('/api/dashboard-equipos/summary');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'success',
        data: { porEstado: [{ estado: 'activo', total: 1 }], porTipo: [], porSucursal: [] },
      });
    });
  });

  describe('GET /api/dashboard-equipos/controls', () => {
    it('returns 200 with the control status list', async () => {
      vi.mocked(equipoService.getControlStatus).mockResolvedValueOnce([
        { equipoId: 1, estadoGeneral: 'activo' },
      ] as any);

      const res = await request(app).get('/api/dashboard-equipos/controls');

      expect(res.status).toBe(200);
      expect(equipoService.getControlStatus).toHaveBeenCalledWith();
    });
  });

  describe('GET /api/dashboard-equipos/critical', () => {
    it('returns 200 with the critical equipment list', async () => {
      vi.mocked(equipoService.getCriticalEquipos).mockResolvedValueOnce([
        { equipoId: 1, estadoGeneral: 'inactivo' },
      ] as any);

      const res = await request(app).get('/api/dashboard-equipos/critical');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([{ equipoId: 1, estadoGeneral: 'inactivo' }]);
    });
  });

  describe('GET /api/dashboard-equipos/estados-equipos/:id', () => {
    it('returns 200 when the equipment control status is found', async () => {
      vi.mocked(equipoService.getControlStatus).mockResolvedValueOnce({
        equipoId: 1,
        estadoGeneral: 'activo',
      } as any);

      const res = await request(app).get('/api/dashboard-equipos/estados-equipos/1');

      expect(res.status).toBe(200);
      expect(equipoService.getControlStatus).toHaveBeenCalledWith(1);
    });

    it('returns 404 when getControlStatus resolves null (not found or dado de baja)', async () => {
      vi.mocked(equipoService.getControlStatus).mockResolvedValueOnce(null as any);

      const res = await request(app).get('/api/dashboard-equipos/estados-equipos/999');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        status: 'error',
        message: 'Equipo con id 999 no encontrado o dado de baja.',
      });
    });

    it('returns 400 when id parameter is non-numeric', async () => {
      const res = await request(app).get('/api/dashboard-equipos/estados-equipos/abc');

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(equipoService.getControlStatus).not.toHaveBeenCalled();
    });

    it('forwards unexpected errors thrown by the service', async () => {
      vi.mocked(equipoService.getControlStatus).mockRejectedValueOnce(new AppError('boom', 500));

      const res = await request(app).get('/api/dashboard-equipos/estados-equipos/1');

      expect(res.status).toBe(500);
    });
  });
});
