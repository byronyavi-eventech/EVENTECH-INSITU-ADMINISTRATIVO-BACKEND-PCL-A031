import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// vi.mock BEFORE imports — catalogos-equipos.controller.ts llama a Drizzle
// directo (sin capa de service), así que se mockea el cliente db con una
// cadena encadenable mínima (from/where/orderBy) en vez de un service.
vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { db } from '../db/index.js';
import { catalogosEquiposRouter } from '../routes/catalogos-equipos.route.js';
import { errorHandler } from '../middlewares/error.middleware.js';

// Fase B (integración nativa): app de test minimal, sin auth en la cadena —
// mismo patrón que src/test/setup-app.ts.
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/catalogos-equipos', catalogosEquiposRouter);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

/** Configura db.select().from(...).where?(...).orderBy(...) para resolver `rows`. */
function mockDbRows(rows: unknown[]) {
  const chain = {
    where: vi.fn(() => chain),
    orderBy: vi.fn().mockResolvedValue(rows),
  };
  vi.mocked(db.select).mockReturnValue({ from: vi.fn(() => chain) } as any);
  return chain;
}

describe('Catalogos Equipos Controller', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/catalogos-equipos/grupos', () => {
    it('returns 200 with the active groups list', async () => {
      mockDbRows([{ id: 1, nombre: 'Balanzas', activo: true }]);

      const res = await request(app).get('/api/catalogos-equipos/grupos');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'success',
        data: [{ id: 1, nombre: 'Balanzas', activo: true }],
      });
    });
  });

  describe('GET /api/catalogos-equipos/tipos-equipo', () => {
    it('returns 200 with all types when grupoId is not provided', async () => {
      mockDbRows([{ id: 1, nombre: 'Balanzas Analíticas', grupoId: 9 }]);

      const res = await request(app).get('/api/catalogos-equipos/tipos-equipo');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([{ id: 1, nombre: 'Balanzas Analíticas', grupoId: 9 }]);
    });

    it('returns 200 filtered when grupoId is a valid positive integer', async () => {
      const chain = mockDbRows([{ id: 1, nombre: 'Balanzas Analíticas', grupoId: 9 }]);

      const res = await request(app).get('/api/catalogos-equipos/tipos-equipo?grupoId=9');

      expect(res.status).toBe(200);
      expect(chain.where).toHaveBeenCalledTimes(1);
    });

    it('returns 400 when grupoId is not numeric', async () => {
      // db.select()/.from() se evalúan antes que el argumento de .where() (orden
      // de evaluación de JS) — parseNumericParam lanza AppError al construir ese
      // argumento, antes de que .where() llegue a invocarse. Se mockea igual para
      // que .from() no reviente con un TypeError ajeno a lo que se está probando.
      const chain = mockDbRows([]);

      const res = await request(app).get('/api/catalogos-equipos/tipos-equipo?grupoId=abc');

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(chain.where).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/catalogos-equipos/empresas', () => {
    it('returns 200 with the companies list', async () => {
      mockDbRows([{ id: 1, nombre: 'Laboratorio INSITU' }]);

      const res = await request(app).get('/api/catalogos-equipos/empresas');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([{ id: 1, nombre: 'Laboratorio INSITU' }]);
    });
  });

  describe('GET /api/catalogos-equipos/sucursales', () => {
    it('returns 400 when empresaId is not a positive integer', async () => {
      const chain = mockDbRows([]);

      const res = await request(app).get('/api/catalogos-equipos/sucursales?empresaId=-1');

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(chain.where).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/catalogos-equipos/ubicaciones', () => {
    it('returns 400 when sucursalId is not a positive integer', async () => {
      const chain = mockDbRows([]);

      const res = await request(app).get('/api/catalogos-equipos/ubicaciones?sucursalId=abc');

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(chain.where).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/catalogos-equipos/estados-equipo', () => {
    it('returns the static list without touching the DB', async () => {
      const res = await request(app).get('/api/catalogos-equipos/estados-equipo');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([
        { value: 'activo', label: 'activo' },
        { value: 'inactivo', label: 'inactivo' },
        { value: 'dado_de_baja', label: 'dado_de_baja' },
      ]);
      expect(db.select).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/catalogos-equipos/estados-control', () => {
    it('returns the static list without touching the DB', async () => {
      const res = await request(app).get('/api/catalogos-equipos/estados-control');

      expect(res.status).toBe(200);
      expect(res.body.data.map((d: { value: string }) => d.value)).toEqual([
        'vigente',
        'vencida',
        'proxima_a_vencer',
        'no_aplica',
        'sin_registro',
      ]);
      expect(db.select).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/catalogos-equipos/unidades', () => {
    it('returns 200 with the units list', async () => {
      mockDbRows([{ id: 1, nombre: 'Kilogramos', simbolo: 'kg' }]);

      const res = await request(app).get('/api/catalogos-equipos/unidades');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([{ id: 1, nombre: 'Kilogramos', simbolo: 'kg' }]);
    });
  });

  describe('GET /api/catalogos-equipos/laboratorios-calibradores', () => {
    it('returns 200 with the labs list', async () => {
      mockDbRows([{ id: 1, nombre: 'CESMEC' }]);

      const res = await request(app).get('/api/catalogos-equipos/laboratorios-calibradores');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([{ id: 1, nombre: 'CESMEC' }]);
    });
  });

  describe('GET /api/catalogos-equipos/procedimientos', () => {
    it('returns 200 with the procedures list', async () => {
      mockDbRows([{ id: 1, codigo: 'PT-001' }]);

      const res = await request(app).get('/api/catalogos-equipos/procedimientos');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([{ id: 1, codigo: 'PT-001' }]);
    });
  });
});
