import { Router } from 'express';
import { submitWebQuotationHandler } from '../controllers/quotation.controller.js';

export const quotationRouter = Router();

quotationRouter.post('/web', submitWebQuotationHandler);
