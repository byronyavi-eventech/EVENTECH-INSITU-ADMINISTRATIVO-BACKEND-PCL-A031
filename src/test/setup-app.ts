/**
 * src/test/setup-app.ts
 *
 * Creates a minimal Express application that wires up only the catalog
 * router and the global error handler — identical to the real app but
 * without Better-Auth, CORS, or DB connections.
 *
 * Keeping this separate lets every test file import a fresh instance,
 * preventing state leakage between test suites.
 */
import express from 'express';
import { catalogRouter } from '../routes/catalog.route.js';
import { errorHandler } from '../middlewares/error.middleware.js';

export function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/catalog', catalogRouter);
  app.use(errorHandler);
  return app;
}
