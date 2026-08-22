import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// vi.mock BEFORE imports
vi.mock('../services/equipo.service.js', () => ({
  listEquipos: vi.fn(),
  getEquipoById: vi.fn(),
  createEquipo: vi.fn(),
  updateEquipo: vi.fn(),
  deactivateEquipo: vi.fn(),
  // Fase 6 (2026-08-22): getUserId() (equipo.controller.ts) cae acá cuando no
  // hay sesión — el mock necesita exportarla igual que el módulo real.
  SISTEMA_USER_ID: 'seed-sistema-eventech',
}));

import * as equipoService from '../services/equipo.service.js';
import { AppError } from '../utils/app-error.js';
import { equipoRouter } from '../routes/equipo.route.js';
import { errorHandler } from '../middlewares/error.middleware.js';

// Fase B (integración nativa): app de test minimal, sin auth en la cadena —
// mismo patrón que src/test/setup-app.ts (monta solo el router bajo prueba +
// errorHandler, mockea el service). Reemplaza el buildApp()+vi.mock(auth.js)
// de Fase 3 — ya no hace falta simular sesión para testear el router aislado.
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/equipment', equipoRouter);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

describe('Equipo Controller', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/equipment', () => {
    it('returns 200 with default pagination on success', async () => {
      vi.mocked(equipoService.listEquipos).mockResolvedValueOnce({
        data: [{ id: 1, codigo: 'BAL-001', nombre: 'Balanza' }] as any,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const res = await request(app).get('/api/equipment');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'success',
        data: [{ id: 1, codigo: 'BAL-001', nombre: 'Balanza' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
      expect(equipoService.listEquipos).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
      });
    });

    it('returns 200 with filters applied', async () => {
      vi.mocked(equipoService.listEquipos).mockResolvedValueOnce({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      const res = await request(app).get('/api/equipment?tipoEquipoId=1&estado=activo');

      expect(res.status).toBe(200);
      expect(equipoService.listEquipos).toHaveBeenCalledWith({
        tipoEquipoId: 1,
        estado: 'activo',
        page: 1,
        limit: 20,
      });
    });

    it('returns 400 when page parameter is not a number', async () => {
      const res = await request(app).get('/api/equipment?page=invalid');

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(equipoService.listEquipos).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/equipment/:id', () => {
    it('returns 200 when equipment is found', async () => {
      vi.mocked(equipoService.getEquipoById).mockResolvedValueOnce({
        id: 1,
        codigo: 'BAL-001',
        nombre: 'Balanza analítica',
      } as any);

      const res = await request(app).get('/api/equipment/1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'success',
        data: {
          id: 1,
          codigo: 'BAL-001',
          nombre: 'Balanza analítica',
        },
      });
      expect(equipoService.getEquipoById).toHaveBeenCalledWith(1);
    });

    it('forwards AppError 404 when equipment is not found', async () => {
      vi.mocked(equipoService.getEquipoById).mockRejectedValueOnce(
        new AppError('Equipo con id 999 no encontrado.', 404),
      );

      const res = await request(app).get('/api/equipment/999');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        status: 'error',
        message: 'Equipo con id 999 no encontrado.',
      });
    });

    it('returns 400 when id parameter is non-numeric', async () => {
      const res = await request(app).get('/api/equipment/abc');

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(equipoService.getEquipoById).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/equipment', () => {
    it('returns 201 when creating equipment with valid payload', async () => {
      const payload = {
        tipoEquipoId: 1,
        nombre: 'Balanza digital',
        sucursalId: 1,
        ubicacionId: 1,
        requiereCalibracion: true,
        frecuenciaCalibracionMeses: 12,
        diasAvisoCalibracion: 30,
      };

      vi.mocked(equipoService.createEquipo).mockResolvedValueOnce({
        id: 2,
        codigo: 'BAL-002',
        nombre: 'Balanza digital',
      } as any);

      const res = await request(app).post('/api/equipment').send(payload);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toEqual({
        id: 2,
        codigo: 'BAL-002',
        nombre: 'Balanza digital',
      });
    });

    it('returns 400 when Zod validation fails due to missing frequency', async () => {
      const payload = {
        tipoEquipoId: 1,
        nombre: 'Balanza digital',
        sucursalId: 1,
        ubicacionId: 1,
        requiereCalibracion: true,
        // frecuenciaCalibracionMeses missing
      };

      const res = await request(app).post('/api/equipment').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toContain('frecuenciaCalibracionMeses es obligatorio');
      expect(equipoService.createEquipo).not.toHaveBeenCalled();
    });

    it('forwards 404 AppError when service throws tipo not found', async () => {
      const payload = {
        tipoEquipoId: 99,
        nombre: 'Balanza digital',
        sucursalId: 1,
        ubicacionId: 1,
      };

      vi.mocked(equipoService.createEquipo).mockRejectedValueOnce(
        new AppError('Tipo de equipo con id 99 no encontrado.', 404),
      );

      const res = await request(app).post('/api/equipment').send(payload);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        status: 'error',
        message: 'Tipo de equipo con id 99 no encontrado.',
      });
    });
  });

  describe('PUT /api/equipment/:id', () => {
    it('returns 200 on successful equipment update', async () => {
      const payload = {
        tipoEquipoId: 1,
        nombre: 'Balanza Modificada',
        sucursalId: 1,
        ubicacionId: 1,
      };

      vi.mocked(equipoService.updateEquipo).mockResolvedValueOnce({
        id: 1,
        nombre: 'Balanza Modificada',
      } as any);

      const res = await request(app).put('/api/equipment/1').send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.nombre).toBe('Balanza Modificada');
    });

    it('forwards 404 AppError when updating non-existent equipment', async () => {
      const payload = {
        tipoEquipoId: 1,
        nombre: 'Balanza Modificada',
        sucursalId: 1,
        ubicacionId: 1,
      };

      vi.mocked(equipoService.updateEquipo).mockRejectedValueOnce(
        new AppError('Equipo con id 999 no encontrado.', 404),
      );

      const res = await request(app).put('/api/equipment/999').send(payload);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe('error');
    });
  });

  describe('DELETE /api/equipment/:id', () => {
    it('returns 200 on logical deactivation', async () => {
      vi.mocked(equipoService.deactivateEquipo).mockResolvedValueOnce({
        id: 1,
        estado: 'dado_de_baja',
        fechaBaja: '2026-07-31',
        motivoBaja: 'Mantenimiento preventivo vencido',
      } as any);

      const res = await request(app)
        .delete('/api/equipment/1')
        .send({ motivo: 'Mantenimiento preventivo vencido' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'success',
        data: {
          id: 1,
          estado: 'dado_de_baja',
          fechaBaja: '2026-07-31',
          motivoBaja: 'Mantenimiento preventivo vencido',
        },
      });
    });

    it('returns 404 when deactivating non-existent equipment', async () => {
      vi.mocked(equipoService.deactivateEquipo).mockRejectedValueOnce(
        new AppError('Equipo con id 999 no encontrado.', 404),
      );

      const res = await request(app).delete('/api/equipment/999');

      expect(res.status).toBe(404);
      expect(res.body.status).toBe('error');
    });
  });
});
