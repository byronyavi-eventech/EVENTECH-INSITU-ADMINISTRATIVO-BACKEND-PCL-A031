/**
 * enums.ts
 * Centralised PostgreSQL native enums.
 * Kept in a separate file so they can be imported safely across schema files
 * without circular dependency issues.
 */
import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Estado del ciclo de vida de una cotización (12 estados).
 *
 * NUEVA                → en edición, no enviada (antes BORRADOR)
 * ENVIADA_FIRMA        → enviada al jefe de laboratorio para firma
 * FIRMADA              → jefe de laboratorio aprobó y firmó
 * ENVIADA_CLIENTE      → PDF + botones ACEPTAR/RECHAZAR enviados al cliente por email
 * ACEPTADA_CLIENTE     → (DEPRECADO - no se usa en flujo nuevo)
 * RECHAZADA_CLIENTE    → cliente rechazó la cotización via email
 * ESPERA_VERIFICACION  → cliente subió comprobantes de pago, espera revisión admin
 * PAGO_VERIFICADO      → admin confirmó que el pago fue realizado
 * PAGO_RECHAZADO       → admin rechazó los comprobantes (pago no válido)
 * RECHAZADA            → rechazada internamente por el equipo
 * VENCIDA              → plazo de validez expirado sin respuesta del cliente
 * ANULADA              → anulada manualmente por un admin
 *
 * Flujo principal:
 *   NUEVA → ENVIADA_FIRMA → FIRMADA → ENVIADA_CLIENTE
 *                                          ↓
 *                                  ESPERA_VERIFICACION → PAGO_VERIFICADO
 *                                                      ↘ PAGO_RECHAZADO
 *                                          ↘ RECHAZADA_CLIENTE (si cliente rechaza)
 */
export const estadoCotizacionEnum = pgEnum('estado_cotizacion', [
  'NUEVA',
  'ENVIADA_FIRMA',
  'FIRMADA',
  'ENVIADA_CLIENTE',
  'ACEPTADA_CLIENTE',
  'RECHAZADA_CLIENTE',
  'ESPERA_VERIFICACION',
  'PAGO_VERIFICADO',
  'PAGO_RECHAZADO',
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

/**
 * Condición de pago acordada con el cliente.
 */
export const condicionPagoEnum = pgEnum('condicion_pago', [
  'PAGO_100',
  'PAGO_50',
  'CREDITO_30_DIAS',
]);

/**
 * Tipo de ajuste (descuento o incremento) sobre el total.
 */
export const tipoAjusteEnum = pgEnum('tipo_ajuste', [
  'SIN_AJUSTE',
  'DESCUENTO',
  'INCREMENTO',
]);
