/**
 * enums.ts
 * Centralised PostgreSQL native enums.
 * Kept in a separate file so they can be imported safely across schema files
 * without circular dependency issues.
 */
import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Estado del ciclo de vida de una cotización (9 estados).
 *
 * NUEVA            → en edición, no enviada (antes BORRADOR)
 * ENVIADA_FIRMA    → enviada al jefe de laboratorio para firma (antes ENVIADA)
 * FIRMADA          → jefe de laboratorio aprobó y firmó (antes ACEPTADA)
 * ENVIADA_CLIENTE  → PDF + botones ACEPTAR/RECHAZAR enviados al cliente por email
 * ACEPTADA_CLIENTE → cliente aceptó la cotización via email
 * RECHAZADA_CLIENTE→ cliente rechazó la cotización via email
 * RECHAZADA        → rechazada internamente por el equipo
 * VENCIDA          → plazo de validez expirado sin respuesta del cliente
 * ANULADA          → anulada manualmente por un admin
 *
 * Flujo principal:
 *   NUEVA → ENVIADA_FIRMA → FIRMADA → ENVIADA_CLIENTE → ACEPTADA_CLIENTE
 *                                                     ↘ RECHAZADA_CLIENTE
 */
export const estadoCotizacionEnum = pgEnum('estado_cotizacion', [
  'NUEVA',
  'ENVIADA_FIRMA',
  'FIRMADA',
  'ENVIADA_CLIENTE',
  'ACEPTADA_CLIENTE',
  'RECHAZADA_CLIENTE',
  'RECHAZADA',
  'VENCIDA',
  'ANULADA',
]);

/**
 * Canal por el que ingresó la solicitud de cotización.
 * WEB      → portal público (puede no tener usuario_cuenta)
 * INTERNO  → generada internamente por un usuario del sistema
 * EMAIL    → solicitud recibida por correo electrónico
 * TELEFONO → solicitud por llamada / gestión directa
 */
export const origenCotizacionEnum = pgEnum('origen_cotizacion', [
  'WEB',
  'INTERNO',
  'EMAIL',
  'TELEFONO',
]);
