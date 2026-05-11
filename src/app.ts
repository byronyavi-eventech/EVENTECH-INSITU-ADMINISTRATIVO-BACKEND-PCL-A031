import express from 'express';
import cors from 'cors';
import { routes } from './routes/index.js';
import { errorHandler } from './middlewares/error.middleware.js';

export const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);

// Error Handling
app.use(errorHandler);
