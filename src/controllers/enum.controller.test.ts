import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { enumRouter } from '../routes/enum.route.js';
import { errorHandler } from '../middlewares/error.middleware.js';

// Fase B (integración nativa): app de test minimal, sin auth en la cadena —
// mismo patrón que src/test/setup-app.ts.
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/enums', enumRouter);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

describe('Enum Controller', () => {
  describe('GET /api/enums/:tipo', () => {
    it('returns 200 with estado_equipo values', async () => {
      const res = await request(app).get('/api/enums/estado_equipo');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'success',
        data: [
          { value: 'activo', label: 'activo' },
          { value: 'inactivo', label: 'inactivo' },
          { value: 'dado_de_baja', label: 'dado_de_baja' },
        ],
      });
    });

    it('returns 200 with estado_mantenimiento values (Fase 3)', async () => {
      const res = await request(app).get('/api/enums/estado_mantenimiento');

      expect(res.status).toBe(200);
      expect(res.body.data.map((d: { value: string }) => d.value)).toEqual([
        'operativo',
        'en_mantenimiento',
        'dado_de_baja',
        'fuera_de_servicio',
      ]);
    });

    it('returns 404 with the list of available enums when tipo does not exist', async () => {
      const res = await request(app).get('/api/enums/inexistente');

      expect(res.status).toBe(404);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toContain("Enum 'inexistente' no existe");
      expect(res.body.message).toContain('estado_equipo');
    });
  });
});
