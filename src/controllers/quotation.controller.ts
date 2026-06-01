import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { submitWebQuotation } from '../services/quotation.service.js';
import { AppError } from '../utils/app-error.js';


type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

const wrap = (fn: AsyncHandler): AsyncHandler =>
  async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      next(err);
    }
  };

function assertValid<T>(
  parsed: { success: true; data: T } | { success: false; error: z.ZodError },
): T {
  if (!parsed.success) {
    const messages = parsed.error.issues.map((i) => i.message).join(' | ');
    throw new AppError(messages, 400);
  }
  return parsed.data;
}

const phoneRegex = /^(\+?56)?\s?9\s?[0-9]{4}\s?[0-9]{4}$/;

const ensayoLineSchema = z.object({
  area:     z.string().trim().min(1, '"area" es requerido'),
  subarea:  z.string().trim().min(1, '"subarea" es requerido'),
  ensayo:   z.string().trim().min(1, '"ensayo" es requerido'),
  cantidad: z.coerce.number().int().min(1, '"cantidad" debe ser al menos 1'),
  visitas:  z.coerce.number().int().min(1, '"visitas" debe ser al menos 1'),
});

const submitWebQuotationSchema = z.object({
  //  Step 1
  rutEmpresa: z
    .string({ error: '"rutEmpresa" es requerido.' })
    .trim()
    .min(1, '"rutEmpresa" no puede estar vacío.'),

  giroEmpresa: z
    .string({ error: '"giroEmpresa" es requerido.' })
    .trim()
    .min(2,  '"giroEmpresa" debe tener al menos 2 caracteres.')
    .max(255, '"giroEmpresa" no puede exceder 255 caracteres.'),

  nombreContacto: z
    .string({ error: '"nombreContacto" es requerido.' })
    .trim()
    .min(2, '"nombreContacto" debe tener al menos 2 caracteres.')
    .max(100, '"nombreContacto" no puede exceder 100 caracteres.'),

  apellidosContacto: z
    .string({ error: '"apellidosContacto" es requerido.' })
    .trim()
    .min(2, '"apellidosContacto" debe tener al menos 2 caracteres.')
    .max(150, '"apellidosContacto" no puede exceder 150 caracteres.'),

  celularContacto: z
    .string({ error: '"celularContacto" es requerido.' })
    .trim()
    .regex(phoneRegex, '"celularContacto": formato inválido (Ej: +569 1234 5678).'),

  emailContacto: z
    .string({ error: '"emailContacto" es requerido.' })
    .trim()
    .email('"emailContacto" no es un email válido.')
    .max(150, '"emailContacto" no puede exceder 150 caracteres.')
    .transform((s) => s.toLowerCase()),

  direccionEmpresa: z
    .string({ error: '"direccionEmpresa" es requerido.' })
    .trim()
    .min(5, '"direccionEmpresa" debe tener al menos 5 caracteres.')
    .max(250, '"direccionEmpresa" no puede exceder 250 caracteres.'),

  regionEmpresa: z
    .string({ error: '"regionEmpresa" es requerido.' })
    .trim()
    .min(1, '"regionEmpresa" no puede estar vacío.')
    .max(100, '"regionEmpresa" no puede exceder 100 caracteres.'),

  comunaEmpresa: z
    .string({ error: '"comunaEmpresa" es requerido.' })
    .trim()
    .min(1, '"comunaEmpresa" no puede estar vacío.')
    .max(100, '"comunaEmpresa" no puede exceder 100 caracteres.'),

  ciudadEmpresa: z
    .string({ error: '"ciudadEmpresa" es requerido.' })
    .trim()
    .min(2, '"ciudadEmpresa" debe tener al menos 2 caracteres.')
    .max(100, '"ciudadEmpresa" no puede exceder 100 caracteres.'),

  //  Step 2
  nombreObra: z
    .string({ error: '"nombreObra" es requerido.' })
    .trim()
    .min(2, '"nombreObra" debe tener al menos 2 caracteres.')
    .max(200, '"nombreObra" no puede exceder 200 caracteres.'),

  nombreMandante: z
    .string({ error: '"nombreMandante" es requerido.' })
    .trim()
    .min(2, '"nombreMandante" debe tener al menos 2 caracteres.')
    .max(200, '"nombreMandante" no puede exceder 200 caracteres.'),

  nombreContratista: z
    .string({ error: '"nombreContratista" es requerido.' })
    .trim()
    .min(2, '"nombreContratista" debe tener al menos 2 caracteres.')
    .max(200, '"nombreContratista" no puede exceder 200 caracteres.'),

  ubicacionObra: z
    .string({ error: '"ubicacionObra" es requerido.' })
    .trim()
    .min(5, '"ubicacionObra" debe tener al menos 5 caracteres.')
    .max(300, '"ubicacionObra" no puede exceder 300 caracteres.'),

  regionObra: z
    .string({ error: '"regionObra" es requerido.' })
    .trim()
    .min(1, '"regionObra" no puede estar vacío.')
    .max(100, '"regionObra" no puede exceder 100 caracteres.'),

  comunaObra: z
    .string({ error: '"comunaObra" es requerido.' })
    .trim()
    .min(1, '"comunaObra" no puede estar vacío.')
    .max(100, '"comunaObra" no puede exceder 100 caracteres.'),

  ciudadObra: z
    .string({ error: '"ciudadObra" es requerido.' })
    .trim()
    .min(2, '"ciudadObra" debe tener al menos 2 caracteres.')
    .max(100, '"ciudadObra" no puede exceder 100 caracteres.'),

  duracionObra: z.coerce
    .number({ error: '"duracionObra" debe ser un número.' })
    .int()
    .min(1, '"duracionObra" debe ser al menos 1 mes.'),

  //  Step 3
  nombreEncargado: z
    .string({ error: '"nombreEncargado" es requerido.' })
    .trim()
    .min(2, '"nombreEncargado" debe tener al menos 2 caracteres.')
    .max(150, '"nombreEncargado" no puede exceder 150 caracteres.'),

  correoEncargado: z
    .string({ error: '"correoEncargado" es requerido.' })
    .trim()
    .email('"correoEncargado" no es un email válido.')
    .max(150, '"correoEncargado" no puede exceder 150 caracteres.')
    .transform((s) => s.toLowerCase()),

  telefonoEncargado: z
    .string({ error: '"telefonoEncargado" es requerido.' })
    .trim()
    .regex(phoneRegex, '"telefonoEncargado": formato inválido (Ej: +569 1234 5678).'),

  //  Step 4
  ensayos: z
    .array(ensayoLineSchema)
    .min(1, 'Debe incluir al menos un ensayo.'),
});


export const submitWebQuotationHandler: AsyncHandler = wrap(async (req, res) => {
  const body = assertValid(submitWebQuotationSchema.safeParse(req.body));
  const data = await submitWebQuotation(body);
  res.status(201).json({ status: 'success', data });
});
