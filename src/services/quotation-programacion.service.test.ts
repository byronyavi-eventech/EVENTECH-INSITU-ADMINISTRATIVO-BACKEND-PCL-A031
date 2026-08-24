/**
 * quotation-programacion.service.test.ts
 *
 * Tests de INTEGRACIÓN (no mockeados) para confirmarProgramacion() —
 * flujo de Programación de Ensayos, Fase 5 Parte A.
 *
 * A diferencia del resto de la suite (que mockea la capa de servicio para
 * testear solo el controller), esta lógica es intrínsecamente relacional
 * (transacciones, constraints UNIQUE, joins) — mockear el query builder de
 * Drizzle de forma realista sería más frágil que ejercitar el Postgres real
 * de desarrollo. Requiere DATABASE_URL apuntando a una DB corriendo (ya
 * necesaria para `pnpm dev` en este proyecto).
 *
 * Cada test crea su propio cliente/obra/cotización/detalles marcados con el
 * prefijo "[TEST FASE5]" y los borra en `afterEach` — no depende de datos
 * de seed_qa_*.ts ni dej rastros en la DB al terminar.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  cliente,
  obra,
  cotizacion,
  cotizacionDetalle,
  areaEnsayo,
  subareaEnsayo,
  tipoEnsayo,
  visita,
  ordenTrabajo,
  visitaEnsayo,
} from '../db/schema/index.js';
import { confirmarProgramacion } from './quotation.service.js';
import { generateQuotationToken } from './token.service.js';
import { AppError } from '../utils/app-error.js';

// ─── Fixtures de catálogo (compartidas, creadas una vez) ───────────────────

let tipoEnsayoIds: number[] = [];
let areaId: number;
let subareaId: number;

beforeAll(async () => {
  const [area] = await db
    .insert(areaEnsayo)
    .values({ nombreArea: '[TEST FASE5] Área' })
    .returning({ id: areaEnsayo.id });
  areaId = area.id;

  const [subarea] = await db
    .insert(subareaEnsayo)
    .values({ areaId, nombreSubarea: '[TEST FASE5] Subárea' })
    .returning({ id: subareaEnsayo.id });
  subareaId = subarea.id;

  const tipos = await db
    .insert(tipoEnsayo)
    .values(
      Array.from({ length: 5 }, (_, i) => ({
        subareaId,
        nombreTipoEnsayo: `[TEST FASE5] Ensayo ${i + 1}`,
      })),
    )
    .returning({ id: tipoEnsayo.id });
  tipoEnsayoIds = tipos.map((t) => t.id);
});

afterAll(async () => {
  await db.delete(tipoEnsayo).where(eq(tipoEnsayo.subareaId, subareaId));
  await db.delete(subareaEnsayo).where(eq(subareaEnsayo.id, subareaId));
  await db.delete(areaEnsayo).where(eq(areaEnsayo.id, areaId));
});

// ─── Helper: siembra cotización aislada por test ───────────────────────────

interface FixtureOpts {
  numDetalles: number;
  visitasTotales: number;
  estado?: 'PENDIENTE_PROGRAMACION' | 'PROGRAMADO';
  tiempoTrasladoHoras?: number | null;
}

interface Fixture {
  cotizacionId: number;
  obraId: number;
  clienteId: number;
  detalleIds: number[];
  codigoCotizacion: string;
}

const fixturesToClean: Array<{ cotizacionId: number; obraId: number; clienteId: number }> = [];

async function seedFixture(opts: FixtureOpts): Promise<Fixture> {
  const suffix = Math.random().toString(36).slice(2, 8);

  const [c] = await db
    .insert(cliente)
    .values({
      giroEmpresa: '[TEST FASE5] Constructora',
      nombreContacto: 'Test Fase5',
      celularContacto: '+56912345678',
      email: `test-fase5-${suffix}@example.com`,
      direccionEmpresa: 'Calle Falsa 123',
      region: 'Arica y Parinacota',
      comuna: 'Arica',
      ciudad: 'Arica',
    })
    .returning({ id: cliente.id });

  const [o] = await db
    .insert(obra)
    .values({
      clienteId: c.id,
      nombreObra: '[TEST FASE5] Obra',
      nombreMandante: 'Mandante Test',
      nombreContratista: 'Contratista Test',
      ubicacionObra: 'Sitio de prueba s/n',
      region: 'Arica y Parinacota',
      comuna: 'Arica',
      ciudad: 'Arica',
      duracionMeses: 1,
      tiempoTrasladoHoras: opts.tiempoTrasladoHoras ?? null,
    })
    .returning({ id: obra.id });

  const codigoCotizacion = `TEST5-${suffix}`;
  const [cot] = await db
    .insert(cotizacion)
    .values({
      obraId: o.id,
      origen: 'INTERNO',
      estado: opts.estado ?? 'PENDIENTE_PROGRAMACION',
      codigoCotizacion,
      visitasTotales: opts.visitasTotales,
    })
    .returning({ id: cotizacion.id });

  const detalleIdsToUse = tipoEnsayoIds.slice(0, opts.numDetalles);
  const detalles = await db
    .insert(cotizacionDetalle)
    .values(
      detalleIdsToUse.map((tipoEnsayoId) => ({
        cotizacionId: cot.id,
        tipoEnsayoId,
        cantidadEnsayos: 1,
        cantidadVisitas: 1,
        precioUnitario: '10000.00',
      })),
    )
    .returning({ id: cotizacionDetalle.id });

  fixturesToClean.push({ cotizacionId: cot.id, obraId: o.id, clienteId: c.id });

  return {
    cotizacionId: cot.id,
    obraId: o.id,
    clienteId: c.id,
    detalleIds: detalles.map((d) => d.id),
    codigoCotizacion,
  };
}

afterEach(async () => {
  while (fixturesToClean.length > 0) {
    const f = fixturesToClean.pop()!;
    await db.delete(ordenTrabajo).where(eq(ordenTrabajo.cotizacionId, f.cotizacionId));
    await db.delete(cotizacion).where(eq(cotizacion.id, f.cotizacionId)); // cascada: detalle, visita, visita_ensayo
    await db.delete(obra).where(eq(obra.id, f.obraId));
    await db.delete(cliente).where(eq(cliente.id, f.clienteId));
  }
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('confirmarProgramacion (integración, DB real)', () => {
  it('genera 1 OT con TODOS los ensayos cuando visitasTotales = 1', async () => {
    const f = await seedFixture({ numDetalles: 3, visitasTotales: 1 });
    const token = await generateQuotationToken(f.cotizacionId, 'PROGRAMAR');

    const result = await confirmarProgramacion(
      {
        token,
        visitas: [
          {
            numeroVisita: 1,
            fechaHoraProgramada: '2027-01-15T10:00:00.000Z',
            detalleIds: f.detalleIds,
          },
        ],
      },
      f.cotizacionId,
    );

    expect(result.estado).toBe('PROGRAMADO');
    expect(result.ordenesTrabajo).toHaveLength(1);
    expect(result.ordenesTrabajo[0].codigoOt).toBe(`OT-${f.codigoCotizacion}-1`);
    expect(result.ordenesTrabajo[0].ensayos).toHaveLength(3);

    const [row] = await db
      .select({ estado: cotizacion.estado })
      .from(cotizacion)
      .where(eq(cotizacion.id, f.cotizacionId));
    expect(row.estado).toBe('PROGRAMADO');
  });

  it('genera N OTs, cada una con EXCLUSIVAMENTE los ensayos de su visita', async () => {
    const f = await seedFixture({ numDetalles: 3, visitasTotales: 3 });
    const token = await generateQuotationToken(f.cotizacionId, 'PROGRAMAR');

    const result = await confirmarProgramacion(
      {
        token,
        visitas: [
          { numeroVisita: 1, fechaHoraProgramada: '2027-01-10T09:00:00.000Z', detalleIds: [f.detalleIds[0]] },
          { numeroVisita: 2, fechaHoraProgramada: '2027-01-15T09:00:00.000Z', detalleIds: [f.detalleIds[1]] },
          { numeroVisita: 3, fechaHoraProgramada: '2027-01-20T09:00:00.000Z', detalleIds: [f.detalleIds[2]] },
        ],
      },
      f.cotizacionId,
    );

    expect(result.ordenesTrabajo).toHaveLength(3);
    expect(result.ordenesTrabajo.map((o) => o.codigoOt)).toEqual([
      `OT-${f.codigoCotizacion}-1`,
      `OT-${f.codigoCotizacion}-2`,
      `OT-${f.codigoCotizacion}-3`,
    ]);
    // Cada OT tiene exactamente 1 ensayo, y no se repiten entre OTs.
    for (const ot of result.ordenesTrabajo) {
      expect(ot.ensayos).toHaveLength(1);
    }
    const idsEnOts = result.ordenesTrabajo.flatMap((o) => o.ensayos.map((e) => e.id));
    expect(new Set(idsEnOts).size).toBe(3);
  });

  it('rechaza asignación con ensayos huérfanos (no todos los detalles asignados)', async () => {
    const f = await seedFixture({ numDetalles: 2, visitasTotales: 1 });
    const token = await generateQuotationToken(f.cotizacionId, 'PROGRAMAR');

    await expect(
      confirmarProgramacion(
        {
          token,
          visitas: [
            {
              numeroVisita: 1,
              fechaHoraProgramada: '2027-01-15T10:00:00.000Z',
              detalleIds: [f.detalleIds[0]], // falta detalleIds[1]
            },
          ],
        },
        f.cotizacionId,
      ),
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining('deben quedar asignados'),
    });
  });

  it('rechaza asignación con un ensayo duplicado en más de una visita', async () => {
    const f = await seedFixture({ numDetalles: 2, visitasTotales: 2 });
    const token = await generateQuotationToken(f.cotizacionId, 'PROGRAMAR');

    await expect(
      confirmarProgramacion(
        {
          token,
          visitas: [
            {
              numeroVisita: 1,
              fechaHoraProgramada: '2027-01-10T10:00:00.000Z',
              detalleIds: [f.detalleIds[0], f.detalleIds[1]],
            },
            {
              numeroVisita: 2,
              fechaHoraProgramada: '2027-01-15T10:00:00.000Z',
              detalleIds: [f.detalleIds[1]], // duplicado
            },
          ],
        },
        f.cotizacionId,
      ),
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining('más de una visita'),
    });
  });

  it('rechaza por tiempo de traslado insuficiente', async () => {
    const f = await seedFixture({
      numDetalles: 1,
      visitasTotales: 1,
      tiempoTrasladoHoras: 48, // obra requiere 48h de anticipación
    });
    const token = await generateQuotationToken(f.cotizacionId, 'PROGRAMAR');

    // Fecha a solo 1h desde "ahora" — viola las 48h requeridas.
    const enUnaHora = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await expect(
      confirmarProgramacion(
        { token, visitas: [{ numeroVisita: 1, fechaHoraProgramada: enUnaHora, detalleIds: f.detalleIds }] },
        f.cotizacionId,
      ),
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining('anticipación'),
    });

    // Confirma que NO se generó nada — la cotización sigue pendiente.
    const [row] = await db
      .select({ estado: cotizacion.estado })
      .from(cotizacion)
      .where(eq(cotizacion.id, f.cotizacionId));
    expect(row.estado).toBe('PENDIENTE_PROGRAMACION');
  });

  it('rechaza por coherencia cronológica (visita posterior con fecha <= a la anterior)', async () => {
    const f = await seedFixture({ numDetalles: 2, visitasTotales: 2 });
    const token = await generateQuotationToken(f.cotizacionId, 'PROGRAMAR');

    await expect(
      confirmarProgramacion(
        {
          token,
          visitas: [
            { numeroVisita: 1, fechaHoraProgramada: '2027-01-15T10:00:00.000Z', detalleIds: [f.detalleIds[0]] },
            // Visita 2 con la MISMA fecha que la 1 — no es posterior.
            { numeroVisita: 2, fechaHoraProgramada: '2027-01-15T10:00:00.000Z', detalleIds: [f.detalleIds[1]] },
          ],
        },
        f.cotizacionId,
      ),
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining('coherencia cronológica'),
    });
  });

  it('rechaza reconfirmar una cotización que ya está PROGRAMADA', async () => {
    const f = await seedFixture({ numDetalles: 1, visitasTotales: 1 });
    const token = await generateQuotationToken(f.cotizacionId, 'PROGRAMAR');
    const visitas = [
      { numeroVisita: 1, fechaHoraProgramada: '2027-01-15T10:00:00.000Z', detalleIds: f.detalleIds },
    ];

    await confirmarProgramacion({ token, visitas }, f.cotizacionId); // primera vez: OK
    await expect(confirmarProgramacion({ token, visitas }, f.cotizacionId)).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining('PROGRAMADO'),
    });

    // No debe haberse duplicado la OT.
    const ots = await db.select().from(ordenTrabajo).where(eq(ordenTrabajo.cotizacionId, f.cotizacionId));
    expect(ots).toHaveLength(1);
  });

  it('rechaza si el id de la URL no corresponde al token', async () => {
    const f = await seedFixture({ numDetalles: 1, visitasTotales: 1 });
    const token = await generateQuotationToken(f.cotizacionId, 'PROGRAMAR');

    await expect(
      confirmarProgramacion(
        {
          token,
          visitas: [{ numeroVisita: 1, fechaHoraProgramada: '2027-01-15T10:00:00.000Z', detalleIds: f.detalleIds }],
        },
        f.cotizacionId + 999999, // id incorrecto
      ),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});
