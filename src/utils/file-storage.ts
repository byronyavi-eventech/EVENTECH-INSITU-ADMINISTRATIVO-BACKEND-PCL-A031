/**
 * src/utils/file-storage.ts
 * Storage de archivos adjuntos de Equipos (certificados/registros/documentos
 * de calibración/verificación/mantenimiento), con driver configurable vía
 * STORAGE_DRIVER (Fase 3 del cierre, 2026-08-06 — preparación para la
 * infraestructura AWS real, sin credenciales todavía):
 *
 * - STORAGE_DRIVER=local (default): filesystem local, uploads/{categoria}/
 *   servido en /uploads. Comportamiento sin cambios.
 * - STORAGE_DRIVER=s3: sube a S3_BUCKET_NAME vía @aws-sdk/client-s3, detrás de
 *   S3_BUCKET_NAME/AWS_REGION (+ credenciales estándar del SDK — variables de
 *   entorno AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY o el rol IAM del propio
 *   Lightsail/EC2, nunca hardcodeadas acá). No probado contra un bucket real
 *   todavía — sin credenciales no hay forma de validarlo end-to-end — pero
 *   la lógica queda lista para cuando lleguen.
 *
 * saveUploadedFile() mantiene la misma firma (Buffer + nombre lógico → URL)
 * sea cual sea el driver activo — es el único punto de integración que le
 * importa al resto del código (equipo.service.ts).
 */
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { logger } from './logger.js';

const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');

export type AdjuntoCategoria = 'calibraciones' | 'verificaciones' | 'mantenimientos';

type StorageDriver = 'local' | 's3';

function getDriver(): StorageDriver {
  const val = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
  return val === 's3' ? 's3' : 'local';
}

async function saveLocal(
  categoria: AdjuntoCategoria,
  filename: string,
  buffer: Buffer,
): Promise<string> {
  const dir = path.join(UPLOADS_ROOT, categoria);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);
  return `/uploads/${categoria}/${filename}`;
}

// Import perezoso: @aws-sdk/client-s3 solo se carga si STORAGE_DRIVER=s3, así
// el driver local (el único usado hoy) no paga el costo de inicializar el SDK.
async function saveS3(
  categoria: AdjuntoCategoria,
  filename: string,
  buffer: Buffer,
): Promise<string> {
  // Fase 3 (fusión): renombrado de S3_BUCKET a S3_BUCKET_NAME para usar la
  // misma variable que ya define s3.service.ts del Core — un solo bucket
  // configurado, no dos nombres de variable para el mismo valor.
  const bucket = process.env.S3_BUCKET_NAME;
  const region = process.env.AWS_REGION;
  if (!bucket || !region) {
    throw new Error(
      'STORAGE_DRIVER=s3 requiere S3_BUCKET_NAME y AWS_REGION configurados (ver .env.example).',
    );
  }

  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  // Sin credenciales explícitas acá a propósito: el SDK las resuelve solo,
  // vía AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY o el rol IAM de la instancia
  // (Lightsail/EC2) — nunca hardcodeadas ni pasadas por parámetro.
  const client = new S3Client({ region });

  const key = `${categoria}/${filename}`;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
    }),
  );

  logger.info({ bucket, key }, 'file-storage: archivo subido a S3');

  // CloudFront (o el endpoint público del bucket) queda detrás de una
  // variable propia — no se asume un dominio fijo. Si no está configurado,
  // se cae al endpoint directo de S3 del bucket/región.
  const publicBase = process.env.S3_PUBLIC_URL || `https://${bucket}.s3.${region}.amazonaws.com`;
  return `${publicBase.replace(/\/$/, '')}/${key}`;
}

/**
 * Guarda un archivo subido y devuelve su URL pública (relativa en `local`,
 * absoluta en `s3`) — ver comentario de cabecera para el driver activo.
 */
export async function saveUploadedFile(
  categoria: AdjuntoCategoria,
  originalName: string,
  buffer: Buffer,
): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();
  const filename = `${randomUUID()}${ext}`;

  return getDriver() === 's3'
    ? saveS3(categoria, filename, buffer)
    : saveLocal(categoria, filename, buffer);
}
