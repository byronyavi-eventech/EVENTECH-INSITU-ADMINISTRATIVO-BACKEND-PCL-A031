/**
 * src/routes/enum.route.ts
 * Router for system enum values endpoints.
 */
import { Router, type Router as RouterType } from 'express';
import { getEnumHandler } from '../controllers/enum.controller.js';

export const enumRouter: RouterType = Router();

enumRouter.get('/:tipo', getEnumHandler);
