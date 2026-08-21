/**
 * src/__tests__/equipos.validator.test.ts
 * Tests unitarios para el schema Zod de creación de equipos.
 */
import { describe, it, expect } from 'vitest';
import { createEquipoSchema } from './equipo.validator.js';

describe('createEquipoSchema', () => {
  it('rechaza cuando requiereCalibracion=true y falta frecuenciaCalibracionMeses', () => {
    const result = createEquipoSchema.safeParse({
      tipoEquipoId: 1,
      nombre: 'Equipo sin frecuencia',
      sucursalId: 1,
      ubicacionId: 1,
      requiereCalibracion: true,
      // frecuenciaCalibracionMeses intencionalmente omitida
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('frecuenciaCalibracionMeses');
    }
  });

  it('acepta un payload válido completo', () => {
    const result = createEquipoSchema.safeParse({
      tipoEquipoId: 1,
      nombre: 'Balanza analítica',
      marca: 'Mettler Toledo',
      modelo: 'ME204',
      numeroSerie: 'SN-001',
      sucursalId: 1,
      ubicacionId: 1,
      responsableId: '1',
      fechaAdquisicion: '2025-01-15',
      requiereCalibracion: true,
      frecuenciaCalibracionMeses: 12,
      diasAvisoCalibracion: 30,
      requiereVerificacion: true,
      frecuenciaVerificacionMeses: 6,
      diasAvisoVerificacion: 15,
      requiereMantenimiento: false,
    });
    expect(result.success).toBe(true);
  });

  it('rechaza tipoEquipoId negativo o cero', () => {
    const resultNegativo = createEquipoSchema.safeParse({
      tipoEquipoId: -1,
      nombre: 'Equipo inválido',
      sucursalId: 1,
      ubicacionId: 1,
    });
    expect(resultNegativo.success).toBe(false);

    const resultCero = createEquipoSchema.safeParse({
      tipoEquipoId: 0,
      nombre: 'Equipo inválido',
      sucursalId: 1,
      ubicacionId: 1,
    });
    expect(resultCero.success).toBe(false);
  });

  it('rechaza cuando requiereVerificacion=true y falta frecuenciaVerificacionMeses', () => {
    const result = createEquipoSchema.safeParse({
      tipoEquipoId: 2,
      nombre: 'Equipo sin frecuencia ver',
      sucursalId: 1,
      ubicacionId: 1,
      requiereVerificacion: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('frecuenciaVerificacionMeses');
    }
  });
});
