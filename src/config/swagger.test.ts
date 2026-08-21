import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec, swaggerUiOptions } from './swagger.js';

// Fase B (integración nativa): app de test minimal — monta solo el
// middleware de Swagger UI, no la app real completa (src/app.ts). La app
// real importa auth.ts, que instancia Resend al cargar el módulo y revienta
// sin RESEND_API_KEY (mismo problema que ya se documentó para
// full-qa-audit.ts) — por eso los tests de controllers de este proyecto
// tampoco importan la app real (ver src/test/setup-app.ts).
function buildApp() {
  const app = express();
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
  app.get('/swagger.json', (_req, res) => {
    res.json(swaggerSpec);
  });
  return app;
}

const app = buildApp();

describe('Swagger Documentation Endpoints', () => {
  it('swaggerSpec should be a valid object', () => {
    expect(swaggerSpec).toBeDefined();
    expect(swaggerSpec.openapi).toBe('3.0.3');
  });

  it('GET /swagger.json - should return OpenAPI 3.0 specification JSON', async () => {
    const res = await request(app).get('/swagger.json');
    expect(res.status).toBe(200);
    expect(res.type).toMatch(/json/);
    const body =
      typeof res.body === 'object' && Object.keys(res.body).length > 0
        ? res.body
        : JSON.parse(res.text);
    expect(body.openapi).toBe('3.0.3');
    expect(body.info.title).toBe('API Módulo de Mantenedores de Equipos (QA Verified)');
    expect(body.paths).toHaveProperty('/api/health');
    expect(body.paths).toHaveProperty('/api/equipos');
  });

  it('GET /docs/ - should serve Swagger UI HTML page', async () => {
    const res = await request(app).get('/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });

  it('GET /api-docs/ - should serve Swagger UI HTML page', async () => {
    const res = await request(app).get('/api-docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });
});
