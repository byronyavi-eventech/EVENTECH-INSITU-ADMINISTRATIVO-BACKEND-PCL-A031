/**
 * token.service.ts
 *
 * Genera y verifica tokens de respuesta para emails de cotización enviados al
 * cliente. Utiliza HMAC-SHA256 sobre la Web Crypto API nativa de Node.js (>=15),
 * sin dependencias externas.
 *
 * Formato del token: base64url(header).base64url(payload).base64url(signature)
 * El secreto usado es BETTER_AUTH_SECRET.
 */

const SECRET = process.env.BETTER_AUTH_SECRET ?? '';
const TOKEN_TTL_DAYS = Number(process.env.QUOTATION_TOKEN_TTL_DAYS ?? 15);

export type QuotationTokenAccion = 'ACEPTAR' | 'RECHAZAR';

export interface QuotationTokenPayload {
  cotizacionId: number;
  accion: QuotationTokenAccion;
  exp: number; // Unix timestamp (seconds)
  iat: number; // Unix timestamp (seconds)
}

// -- Internal helpers ---------------------------------------------------------

function b64url(input: string | Uint8Array): string {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : input;
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function b64urlDecode(input: string): Uint8Array {
  // Restore standard base64 padding/chars before decoding
  const padded =
    input.replace(/-/g, '+').replace(/_/g, '/') +
    '=='.slice(0, (4 - (input.length % 4)) % 4);
  // Allocate a fresh ArrayBuffer (no pool offset issues)
  const raw = Buffer.from(padded, 'base64');
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw[i];
  return arr;
}

async function getCryptoKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function signData(data: string): Promise<string> {
  const key = await getCryptoKey();
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(data),
  );
  return b64url(new Uint8Array(signature));
}

async function verifyData(data: string, sig: string): Promise<boolean> {
  const key = await getCryptoKey();
  const sigBytes = b64urlDecode(sig); // fresh Uint8Array with correct buffer
  return crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes.buffer as ArrayBuffer, // fresh ArrayBuffer, never SharedArrayBuffer
    new TextEncoder().encode(data),
  );
}

// -- Public API ---------------------------------------------------------------

/**
 * Genera un token firmado para que el cliente pueda ACEPTAR o RECHAZAR
 * una cotizacion desde su email.
 */
export async function generateQuotationToken(
  cotizacionId: number,
  accion: QuotationTokenAccion,
  ttlDays?: number,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const effectiveTtl = (ttlDays != null && ttlDays > 0) ? ttlDays : TOKEN_TTL_DAYS;
  const payload: QuotationTokenPayload = {
    cotizacionId,
    accion,
    iat: now,
    exp: now + effectiveTtl * 24 * 60 * 60,
  };

  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'QCT' }));
  const body = b64url(JSON.stringify(payload));
  const toSign = `${header}.${body}`;
  const signature = await signData(toSign);

  return `${toSign}.${signature}`;
}

/**
 * Verifica y decodifica un token de respuesta de cotizacion.
 * Lanza un Error si el token es invalido, fue manipulado o esta expirado.
 */
export async function verifyQuotationToken(
  token: string,
): Promise<QuotationTokenPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Token con formato invalido.');
  }

  const [header, body, signature] = parts;
  const toVerify = `${header}.${body}`;

  const valid = await verifyData(toVerify, signature);
  if (!valid) {
    throw new Error('Token con firma invalida. Posible manipulacion.');
  }

  let payload: QuotationTokenPayload;
  try {
    payload = JSON.parse(
      Buffer.from(b64urlDecode(body)).toString('utf-8'),
    ) as QuotationTokenPayload;
  } catch {
    throw new Error('No se pudo decodificar el payload del token.');
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw new Error('El token ha expirado. Solicita un nuevo email de cotizacion.');
  }

  if (!payload.cotizacionId || !['ACEPTAR', 'RECHAZAR'].includes(payload.accion)) {
    throw new Error('Token con datos invalidos.');
  }

  return payload;
}
