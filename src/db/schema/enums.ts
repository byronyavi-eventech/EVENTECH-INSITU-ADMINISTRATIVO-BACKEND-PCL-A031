/**
 * enums.ts
 * Centralised PostgreSQL native enums.
 * Kept in a separate file so they can be imported safely across schema files
 * without circular dependency issues.
 */
import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Estado del ciclo de vida de una cotización.
 * BORRADOR    → en edición, no enviada al cliente
 * ENVIADA     → enviada al cliente, pendiente de respuesta
 * ACEPTADA    → cliente aceptó, genera OT
 * RECHAZADA   → cliente rechazó
 * VENCIDA     → plazo de validez expirado sin respuesta
 * ANULADA     → anulada manualmente por un admin
 */
export const estadoCotizacionEnum = pgEnum('estado_cotizacion', [
  'BORRADOR',
  'ENVIADA',
  'ACEPTADA',
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
