/**
 * catalog.controller.test.ts
 *
 * Integration tests for the catalog HTTP layer.
 *
 * Strategy — mock the SERVICE, test the CONTROLLER:
 *   • The service layer owns the business logic; it has its own unit tests.
 *   • Here we test everything the controller is responsible for:
 *       1. Input validation via Zod (400 shape, field-level messages).
 *       2. Correct delegation to the service with the right arguments.
 *       3. Correct HTTP status codes and response envelope.
 *       4. Proper translation of AppErrors into HTTP responses.
 *
 * Tools:
 *   • vitest  — test runner + assertion library + spy/mock primitives.
 *   • supertest — sends real HTTP requests against the in-process Express app.
 *
 * No database is touched — all service calls are replaced with vi.fn() stubs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../test/setup-app.js';
import { AppError } from '../utils/app-error.js';

// ---------------------------------------------------------------------------
// Mock the service module BEFORE any controller import resolves it.
// Vitest hoists vi.mock() to the top of the file automatically.
// ---------------------------------------------------------------------------
vi.mock('../services/catalog.service.js', () => ({
  createEnsayo:     vi.fn(),
  getCatalogTree:   vi.fn(),
  listEnsayos:      vi.fn(),
  getEnsayoById:    vi.fn(),
  updateEnsayo:     vi.fn(),
  deactivateEnsayo: vi.fn(),
}));

// Import mocked service functions so we can control return values per-test.
import {
  createEnsayo,
  listEnsayos,
  getEnsayoById,
  updateEnsayo,
  deactivateEnsayo,
} from '../services/catalog.service.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ENSAYO_DETAIL = {
  id: 1,
  nombreTipoEnsayo: 'Ensayo Proctor Modificado ASTM D1557',
  codigoNorma: 'ASTM D1557',
  activo: true,
  area:    { id: 1, nombreArea: 'Mecánica de Suelos' },
  subarea: { id: 1, nombreSubarea: 'Compactación' },
  precios: [
    { id: 1, precio: '85000.00', fechaInicio: '2026-01-01', fechaFin: null, activo: true },
  ],
};

const LIST_RESULT = {
  data: [
    {
      id: 1,
      nombreTipoEnsayo: 'Ensayo Proctor',
      codigoNorma: null,
      activo: true,
      area:    { id: 1, nombreArea: 'Mecánica de Suelos' },
      subarea: { id: 1, nombreSubarea: 'Compactación' },
      precioActivo: '85000.00',
      fechaInicioPrecio: '2026-01-01',
    },
  ],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const app = buildApp();

/** Casts an imported mock to the correct vitest mock type. */
function asMock<T extends (...args: any[]) => any>(fn: T) {
  return fn as unknown as ReturnType<typeof vi.fn>;
}

// Reset all mocks between tests to avoid cross-test interference.
beforeEach(() => {
  vi.resetAllMocks();
});

// ===========================================================================
// GET /api/catalog/ensayos — paginated list
// ===========================================================================

describe('GET /api/catalog/ensayos', () => {
  it('200 — returns paginated list with default params', async () => {
    asMock(listEnsayos).mockResolvedValue(LIST_RESULT);

    const res = await request(app).get('/api/catalog/ensayos');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 20 });
    expect(listEnsayos).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20, activo: true }),
    );
  });

  it('200 — passes parsed query params to service', async () => {
    asMock(listEnsayos).mockResolvedValue({ data: [], pagination: { page: 2, limit: 5, total: 0, totalPages: 0 } });

    const res = await request(app)
      .get('/api/catalog/ensayos')
      .query({ page: '2', limit: '5', activo: 'false', q: 'proctor' });

    expect(res.status).toBe(200);
    expect(listEnsayos).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 5, activo: false, q: 'proctor' }),
    );
  });

  it('400 — rejects non-numeric page', async () => {
    const res = await request(app).get('/api/catalog/ensayos').query({ page: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(listEnsayos).not.toHaveBeenCalled();
  });

  it('400 — rejects limit > 100', async () => {
    const res = await request(app).get('/api/catalog/ensayos').query({ limit: '101' });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });

  it('400 — rejects invalid activo value', async () => {
    const res = await request(app).get('/api/catalog/ensayos').query({ activo: 'maybe' });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });
});

// ===========================================================================
// GET /api/catalog/ensayos/:id — single detail
// ===========================================================================

describe('GET /api/catalog/ensayos/:id', () => {
  it('200 — returns detail when found', async () => {
    asMock(getEnsayoById).mockResolvedValue(ENSAYO_DETAIL);

    const res = await request(app).get('/api/catalog/ensayos/1');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toMatchObject({ id: 1, nombreTipoEnsayo: expect.any(String) });
    expect(getEnsayoById).toHaveBeenCalledWith(1);
  });

  it('404 — forwards AppError from service', async () => {
    asMock(getEnsayoById).mockRejectedValue(new AppError('Tipo de ensayo con id 999 no encontrado.', 404));

    const res = await request(app).get('/api/catalog/ensayos/999');

    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toContain('999');
  });

  it('400 — rejects non-numeric id param', async () => {
    const res = await request(app).get('/api/catalog/ensayos/abc');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(getEnsayoById).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// POST /api/catalog/ensayos — create
// ===========================================================================

describe('POST /api/catalog/ensayos', () => {
  const validPayload = {
    nombreArea: 'Mecánica de Suelos',
    nombreSubarea: 'Compactación',
    nombreTipoEnsayo: 'Ensayo Proctor Modificado ASTM D1557',
    codigoNorma: 'ASTM D1557',
    precio: '85000',
    fechaInicio: '2026-01-01',
  };

  it('201 — creates ensayo and returns result', async () => {
    const serviceResult = {
      area:        { id: 1, nombreArea: 'Mecánica de Suelos' },
      subarea:     { id: 1, nombreSubarea: 'Compactación' },
      tipoEnsayo:  { id: 1, nombreTipoEnsayo: 'Ensayo Proctor Modificado ASTM D1557', codigoNorma: 'ASTM D1557' },
      precio:      { id: 1, precio: '85000.00', fechaInicio: '2026-01-01' },
    };
    asMock(createEnsayo).mockResolvedValue(serviceResult);

    const res = await request(app).post('/api/catalog/ensayos').send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.tipoEnsayo.id).toBe(1);
    expect(createEnsayo).toHaveBeenCalledWith(expect.objectContaining({ precio: '85000' }));
  });

  it('400 — missing required nombreArea', async () => {
    const { nombreArea: _, ...rest } = validPayload;
    const res = await request(app).post('/api/catalog/ensayos').send(rest);

    expect(res.status).toBe(400);
    expect(createEnsayo).not.toHaveBeenCalled();
  });

  it('400 — invalid precio format (comma separator)', async () => {
    const res = await request(app)
      .post('/api/catalog/ensayos')
      .send({ ...validPayload, precio: '85,000' });

    expect(res.status).toBe(400);
  });

  it('400 — precio = 0', async () => {
    const res = await request(app)
      .post('/api/catalog/ensayos')
      .send({ ...validPayload, precio: '0' });

    expect(res.status).toBe(400);
  });

  it('400 — invalid fechaInicio format', async () => {
    const res = await request(app)
      .post('/api/catalog/ensayos')
      .send({ ...validPayload, fechaInicio: '25-05-2026' }); // wrong format

    expect(res.status).toBe(400);
  });

  it('409 — forwards conflict AppError from service', async () => {
    asMock(createEnsayo).mockRejectedValue(
      new AppError('El tipo de ensayo "Ensayo Proctor Modificado ASTM D1557" ya existe.', 409),
    );

    const res = await request(app).post('/api/catalog/ensayos').send(validPayload);

    expect(res.status).toBe(409);
    expect(res.body.status).toBe('error');
  });
});

// ===========================================================================
// PUT /api/catalog/ensayos/:id — partial update
// ===========================================================================

describe('PUT /api/catalog/ensayos/:id', () => {
  const updatedTipo = {
    id: 1,
    nombreTipoEnsayo: 'Proctor Modificado (rev 2026)',
    codigoNorma: 'ASTM D1557-21',
    activo: true,
  };

  it('200 — updates name only', async () => {
    asMock(updateEnsayo).mockResolvedValue({ tipoEnsayo: updatedTipo });

    const res = await request(app)
      .put('/api/catalog/ensayos/1')
      .send({ nombreTipoEnsayo: 'Proctor Modificado (rev 2026)' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.tipoEnsayo.nombreTipoEnsayo).toBe('Proctor Modificado (rev 2026)');
    expect(updateEnsayo).toHaveBeenCalledWith(1, expect.objectContaining({ nombreTipoEnsayo: 'Proctor Modificado (rev 2026)' }));
  });

  it('200 — rotates price and returns nuevoPrecio', async () => {
    const nuevoPrecio = { id: 2, precio: '95000.00', fechaInicio: '2026-06-01' };
    asMock(updateEnsayo).mockResolvedValue({ tipoEnsayo: updatedTipo, nuevoPrecio });

    const res = await request(app)
      .put('/api/catalog/ensayos/1')
      .send({ precio: '95000', fechaInicio: '2026-06-01' });

    expect(res.status).toBe(200);
    expect(res.body.data.nuevoPrecio).toMatchObject({ precio: '95000.00' });
    expect(updateEnsayo).toHaveBeenCalledWith(1, expect.objectContaining({
      precio: '95000',
      fechaInicio: '2026-06-01',
    }));
  });

  it('200 — clears codigoNorma with null', async () => {
    asMock(updateEnsayo).mockResolvedValue({
      tipoEnsayo: { ...updatedTipo, codigoNorma: null },
    });

    const res = await request(app)
      .put('/api/catalog/ensayos/1')
      .send({ codigoNorma: null });

    expect(res.status).toBe(200);
    expect(updateEnsayo).toHaveBeenCalledWith(1, expect.objectContaining({ codigoNorma: null }));
  });

  it('400 — rejects empty body (no fields)', async () => {
    const res = await request(app).put('/api/catalog/ensayos/1').send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('al menos uno');
    expect(updateEnsayo).not.toHaveBeenCalled();
  });

  it('400 — rejects fechaInicio without precio', async () => {
    const res = await request(app)
      .put('/api/catalog/ensayos/1')
      .send({ fechaInicio: '2026-09-01' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('fechaInicio');
    expect(updateEnsayo).not.toHaveBeenCalled();
  });

  it('400 — rejects invalid precio format', async () => {
    const res = await request(app)
      .put('/api/catalog/ensayos/1')
      .send({ precio: '95,000' });

    expect(res.status).toBe(400);
    expect(updateEnsayo).not.toHaveBeenCalled();
  });

  it('400 — rejects precio = 0', async () => {
    const res = await request(app).put('/api/catalog/ensayos/1').send({ precio: '0' });

    expect(res.status).toBe(400);
  });

  it('400 — rejects non-numeric id param', async () => {
    const res = await request(app)
      .put('/api/catalog/ensayos/abc')
      .send({ precio: '95000' });

    expect(res.status).toBe(400);
    expect(updateEnsayo).not.toHaveBeenCalled();
  });

  it('404 — forwards not-found AppError from service', async () => {
    asMock(updateEnsayo).mockRejectedValue(
      new AppError('Tipo de ensayo con id 999 no encontrado.', 404),
    );

    const res = await request(app)
      .put('/api/catalog/ensayos/999')
      .send({ precio: '95000' });

    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
  });

  it('409 — forwards duplicate-name AppError from service', async () => {
    asMock(updateEnsayo).mockRejectedValue(
      new AppError('El nombre "Proctor" ya existe en la misma subárea.', 409),
    );

    const res = await request(app)
      .put('/api/catalog/ensayos/1')
      .send({ nombreTipoEnsayo: 'Proctor' });

    expect(res.status).toBe(409);
    expect(res.body.status).toBe('error');
  });
});

// ===========================================================================
// DELETE /api/catalog/ensayos/:id — soft-delete
// ===========================================================================

describe('DELETE /api/catalog/ensayos/:id', () => {
  it('200 — deactivates ensayo and returns { id, activo: false }', async () => {
    asMock(deactivateEnsayo).mockResolvedValue({ id: 1, activo: false });

    const res = await request(app).delete('/api/catalog/ensayos/1');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toEqual({ id: 1, activo: false });
    expect(deactivateEnsayo).toHaveBeenCalledWith(1);
  });

  it('400 — rejects non-numeric id param', async () => {
    const res = await request(app).delete('/api/catalog/ensayos/abc');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(deactivateEnsayo).not.toHaveBeenCalled();
  });

  it('404 — forwards not-found AppError from service', async () => {
    asMock(deactivateEnsayo).mockRejectedValue(
      new AppError('Tipo de ensayo con id 999 no encontrado.', 404),
    );

    const res = await request(app).delete('/api/catalog/ensayos/999');

    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toContain('999');
  });

  it('409 — forwards already-inactive AppError from service', async () => {
    asMock(deactivateEnsayo).mockRejectedValue(
      new AppError('El tipo de ensayo con id 1 ya está inactivo.', 409),
    );

    const res = await request(app).delete('/api/catalog/ensayos/1');

    expect(res.status).toBe(409);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toContain('inactivo');
  });
});
