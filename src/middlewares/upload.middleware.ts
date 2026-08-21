/**
 * src/middlewares/upload.middleware.ts
 * Multer en memoria (no disco temporal) — el buffer se persiste vía file-storage.ts.
 * Límite 10MB, solo PDF/imagen/Word: cubre certificados, registros y documentos
 * de mantenimiento (no hay especificación de tipos en el levantamiento del cliente).
 */
import multer from 'multer';
import type { RequestHandler } from 'express';
import path from 'node:path';
import { AppError } from '../utils/app-error.js';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

// QA Audit (2026-08-04): file.mimetype viene del header Content-Type de la
// parte multipart, que el cliente controla libremente — validar solo eso
// permite subir un .exe/.php declarando falsamente Content-Type: application/pdf,
// y file-storage.ts usa la extensión de file.originalname (también del
// cliente) para nombrar el archivo guardado. Se exige que ambos coincidan con
// el mismo tipo permitido, cerrando el bypass por spoofing.
const ALLOWED_EXTENSIONS_BY_MIME: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};

export const uploadArchivo: RequestHandler = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(
        new AppError(
          `Tipo de archivo no permitido: ${file.mimetype}. Use PDF, JPG, PNG o Word.`,
          400,
        ),
      );
      return;
    }
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS_BY_MIME[file.mimetype]!.includes(ext)) {
      cb(
        new AppError(
          `La extensión "${ext}" no coincide con el tipo de archivo declarado (${file.mimetype}).`,
          400,
        ),
      );
      return;
    }
    cb(null, true);
  },
}).single('file');
