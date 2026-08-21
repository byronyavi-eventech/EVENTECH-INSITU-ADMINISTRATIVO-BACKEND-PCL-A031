import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { routes } from './routes/index.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';
import { swaggerSpec, swaggerUiOptions } from './config/swagger.js';

export const app = express();

// Middlewares
// change url to env vars
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
  process.env.LANDING_PAGE_URL,
].filter(Boolean) as string[];

app.use(cors({ origin: allowedOrigins, credentials: true }));

app.all('/api/auth/*splat', toNodeHandler(auth));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Docs (Fase B, integración nativa) — spec scopeada a las rutas de Equipos
// por ahora (F-6, ver INTEGRACION-NATIVA-RESUMEN.md); no cubre catalog/
// quotation/uf todavía.
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
app.get('/swagger.json', (_req, res) => {
  res.json(swaggerSpec);
});

// Routes
app.use('/api', routes);

// Error Handling
app.use(errorHandler);
