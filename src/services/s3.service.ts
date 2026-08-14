/**
 * s3.service.ts
 *
 * Servicio para interactuar con AWS S3.
 * - Genera presigned PUT URLs para que el cliente suba comprobantes directamente.
 * - Genera presigned GET URLs para que el admin descargue los comprobantes.
 *
 * Los archivos se organizan bajo el prefijo: comprobantes/{cotizacionId}/{uuid}-{filename}
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';

const REGION = process.env.AWS_REGION ?? 'us-east-1';
const BUCKET = process.env.S3_BUCKET_NAME ?? '';

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
  },
});

// Tipos MIME permitidos para los comprobantes
const ALLOWED_CONTENT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']);

// Tamaño máximo por archivo: 10 MB
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// Máximo de archivos por cotización
const MAX_FILES_PER_COTIZACION = 5;

export interface UploadTarget {
  /** S3 key que se debe usar al subir el archivo (guardar en BD después). */
  s3Key: string;
  /** Nombre original del archivo. */
  nombreArchivo: string;
  /** MIME type. */
  contentType: string;
  /** Tamaño declarado por el cliente. */
  sizeBytes: number;
  /** URL firmada para hacer PUT directamente a S3. Válida 15 min. */
  uploadUrl: string;
}

export interface FileDescriptor {
  nombreArchivo: string;
  contentType: string;
  sizeBytes: number;
}

/**
 * Valida y genera presigned PUT URLs para que el cliente suba comprobantes
 * directamente a S3 sin pasar por el backend.
 *
 * @param cotizacionId - ID de la cotización (usado como prefijo de carpeta).
 * @param files - Descriptores de los archivos a subir.
 * @returns Array de UploadTarget con las presigned URLs.
 */
export async function generateUploadPresignedUrls(
  cotizacionId: number,
  files: FileDescriptor[],
): Promise<UploadTarget[]> {
  if (!BUCKET) {
    throw new Error('S3_BUCKET_NAME no está configurado en las variables de entorno.');
  }

  if (files.length === 0) {
    throw new Error('Se requiere al menos un archivo.');
  }

  if (files.length > MAX_FILES_PER_COTIZACION) {
    throw new Error(`Máximo ${MAX_FILES_PER_COTIZACION} archivos permitidos por cotización.`);
  }

  for (const file of files) {
    if (!ALLOWED_CONTENT_TYPES.has(file.contentType)) {
      throw new Error(
        `Tipo de archivo no permitido: ${file.contentType}. Se aceptan PDF, JPG y PNG.`,
      );
    }
    if (file.sizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new Error(`El archivo "${file.nombreArchivo}" supera el límite de 10 MB.`);
    }
    if (file.sizeBytes <= 0) {
      throw new Error(`El archivo "${file.nombreArchivo}" tiene tamaño inválido.`);
    }
  }

  logger.info(
    { cotizacionId, count: files.length },
    's3.service: generating upload presigned URLs',
  );

  const targets: UploadTarget[] = await Promise.all(
    files.map(async (file) => {
      const ext = file.nombreArchivo.split('.').pop() ?? 'bin';
      const s3Key = `comprobantes/${cotizacionId}/${randomUUID()}.${ext}`;

      const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: s3Key,
        ContentType: file.contentType,
        ContentLength: file.sizeBytes,
        // Metadata para auditoría
        Metadata: {
          'cotizacion-id': String(cotizacionId),
          'original-name': encodeURIComponent(file.nombreArchivo),
        },
      });

      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 15 * 60 }); // 15 min

      return {
        s3Key,
        nombreArchivo: file.nombreArchivo,
        contentType: file.contentType,
        sizeBytes: file.sizeBytes,
        uploadUrl,
      };
    }),
  );

  logger.info(
    { cotizacionId, count: targets.length },
    's3.service: upload presigned URLs generated OK',
  );
  return targets;
}

export interface DownloadTarget {
  s3Key: string;
  nombreArchivo: string;
  contentType: string;
  sizeBytes: number;
  downloadUrl: string;
}

/**
 * Genera presigned GET URLs para que el admin pueda descargar los comprobantes.
 * Las URLs son válidas por 60 minutos.
 */
export async function generateDownloadPresignedUrls(
  comprobantes: Array<{
    s3Key: string;
    nombreArchivo: string;
    contentType: string;
    sizeBytes: number;
  }>,
): Promise<DownloadTarget[]> {
  if (!BUCKET) {
    throw new Error('S3_BUCKET_NAME no está configurado en las variables de entorno.');
  }

  logger.info({ count: comprobantes.length }, 's3.service: generating download presigned URLs');

  const targets: DownloadTarget[] = await Promise.all(
    comprobantes.map(async (c) => {
      const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: c.s3Key,
        ResponseContentDisposition: `attachment; filename="${encodeURIComponent(c.nombreArchivo)}"`,
      });

      const downloadUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 60 }); // 60 min

      return {
        s3Key: c.s3Key,
        nombreArchivo: c.nombreArchivo,
        contentType: c.contentType,
        sizeBytes: c.sizeBytes,
        downloadUrl,
      };
    }),
  );

  logger.info({ count: targets.length }, 's3.service: download presigned URLs generated OK');
  return targets;
}
