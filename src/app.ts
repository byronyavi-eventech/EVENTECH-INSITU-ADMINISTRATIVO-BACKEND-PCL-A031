import express from 'express';
import cors from 'cors';
import { routes } from './routes/index.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';

export const app = express();

// Middlewares
const allowedOrigins = ['http://localhost:5173', process.env.FRONTEND_URL].filter(
  Boolean,
) as string[];

app.use(cors({ origin: allowedOrigins, credentials: true }));

app.all('/api/auth/*splat', toNodeHandler(auth));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);

// Error Handling
app.use(errorHandler);
