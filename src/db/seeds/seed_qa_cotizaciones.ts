/**
 * src/db/seeds/seed_qa_cotizaciones.ts
 * Siembra 2 cotizaciones de prueba (QA-COT-01, QA-COT-02) por INSERT directo
 * — MAPEO-DATOS-ENSAYOS.md, sección 8/9. No pasa por la API (eso se prueba
 * aparte en Capa 2).
 *
 * Idempotente: cliente/obra/encargado/cuenta usan onConflictDoNothing +
 * lookup; las cotizaciones se saltan si ya existe una con el mismo
 * codigo_cotizacion generado en una corrida previa no — en vez de eso se
 * guardan por una marca reconocible en observaciones (ver CHECK abajo).
 *
 * SOLO para bases de QA/desarrollo descartables.
 */
import 'dotenv/config';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../index.js';
import { cliente, obra, encargadoObra } from '../schema/client.schema.js';
import { cuentaBancaria } from '../schema/cuenta_bancaria.schema.js';
import { cotizacion, cotizacionDetalle, cotizacionServicioGeneral } from '../schema/quotation.schema.js';
import { tipoEnsayo, precioEnsayo } from '../schema/catalog.schema.js';
import { user } from '../schema/auth.schema.js';
import { logger } from '../../utils/logger.js';

// Usuario Better Auth real, creado en Capa 2 QA (qa-tester@example.com).
const QA_INTERNAL_USER_ID = 'C6DBtZmWLCK8FrGqz19dbYZW09UKG86b';

const OBSERVACION_MARK = '[SEED QA seed_qa_cotizaciones.ts]';

async function precioActivo(nombreTipoEnsayo: string): Promise<{ tipoEnsayoId: number; precio: string }> {
  const [row] = await db
    .select({ tipoEnsayoId: tipoEnsayo.id, precio: precioEnsayo.precio })
    .from(tipoEnsayo)
    .innerJoin(
      precioEnsayo,
      and(eq(precioEnsayo.tipoEnsayoId, tipoEnsayo.id), eq(precioEnsayo.activo, true)),
    )
    .where(eq(tipoEnsayo.nombreTipoEnsayo, nombreTipoEnsayo));
  if (!row) throw new Error(`No hay precio activo para tipo_ensayo "${nombreTipoEnsayo}" — ¿corriste seed_qa_ensayos.ts?`);
  return row;
}

async function generarCodigo(): Promise<string> {
  const r = await db.execute(sql`SELECT nextval('cotizacion_codigo_seq')::text || '-LIA' AS "nextCode"`);
  return String(r.rows[0]?.nextCode);
}

async function main() {
  logger.info('🌱 Sembrando cotizaciones de prueba QA (INSERT directo)...');

  await db
    .insert(user)
    .values({
      id: QA_INTERNAL_USER_ID,
      name: 'QA Tester',
      email: 'qa-tester@example.com',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing();

  // ── Datos base ──────────────────────────────────────────────────────────
  await db
    .insert(cuentaBancaria)
    .values({
      banco: 'BCI',
      tipoCuenta: 'Cuenta Corriente',
      numeroCuenta: '70-000-123-4',
      titular: 'LABORATORIO INSITU LTDA.',
      rut: '76.290.113-7',
    })
    .onConflictDoNothing();
  const [cuenta] = await db
    .select()
    .from(cuentaBancaria)
    .where(and(eq(cuentaBancaria.banco, 'BCI'), eq(cuentaBancaria.numeroCuenta, '70-000-123-4')));
  if (!cuenta) throw new Error('No se pudo crear/encontrar la cuenta bancaria QA.');

  await db
    .insert(cliente)
    .values({
      rutEmpresa: '12.345.678-9',
      giroEmpresa: 'Construcción',
      nombreContacto: 'Pedro Soto Vargas',
      celularContacto: '+56912345678',
      email: 'pedro.soto@constructora-qa.cl',
      direccionEmpresa: 'Av. Los Carrera 1234',
      region: 'Arica y Parinacota',
      comuna: 'Arica',
      ciudad: 'Arica',
    })
    .onConflictDoNothing();
  const [cli] = await db.select().from(cliente).where(eq(cliente.rutEmpresa, '12.345.678-9'));
  if (!cli) throw new Error('No se pudo crear/encontrar el cliente QA-1.');

  const [existingObra] = await db
    .select()
    .from(obra)
    .where(and(eq(obra.clienteId, cli.id), eq(obra.nombreObra, 'Pavimentación Pasaje Las Rosas')));
  const obraRow =
    existingObra ??
    (
      await db
        .insert(obra)
        .values({
          clienteId: cli.id,
          nombreObra: 'Pavimentación Pasaje Las Rosas',
          nombreMandante: 'Municipalidad de Arica',
          nombreContratista: 'Constructora QA SpA',
          ubicacionObra: 'Pasaje Las Rosas s/n, Población El Morro, Arica',
          region: 'Arica y Parinacota',
          comuna: 'Arica',
          ciudad: 'Arica',
          duracionMeses: 8,
        })
        .returning()
    )[0]!;

  await db
    .insert(encargadoObra)
    .values({
      obraId: obraRow.id,
      nombreEncargado: 'Ing. Ana Martínez',
      correoEncargado: 'amartinez@constructora-qa.cl',
      telefonoEncargado: '+56923456789',
    })
    .onConflictDoNothing();

  logger.info({ cuentaId: cuenta.id, clienteId: cli.id, obraId: obraRow.id }, '✓ Datos base de Cotizaciones listos.');

  // ── QA-COT-01 — WEB, NUEVA, 3 líneas de Mecánica de Suelos ──────────────
  const [yaExisteCot01] = await db
    .select()
    .from(cotizacion)
    .where(and(eq(cotizacion.obraId, obraRow.id), eq(cotizacion.origen, 'WEB')));

  if (yaExisteCot01) {
    logger.info({ id: yaExisteCot01.id, codigo: yaExisteCot01.codigoCotizacion }, '⏭  QA-COT-01 ya existe, se salta.');
  } else {
    const [cot01] = await db
      .insert(cotizacion)
      .values({
        obraId: obraRow.id,
        origen: 'WEB',
        estado: 'NUEVA',
        condicionPago: 'PAGO_100',
        observaciones: `${OBSERVACION_MARK} QA-COT-01 — flujo WEB mínimo, pendiente de firma.`,
      })
      .returning();
    const codigo01 = await generarCodigo();
    await db.update(cotizacion).set({ codigoCotizacion: codigo01 }).where(eq(cotizacion.id, cot01!.id));

    const lineas01 = [
      { nombre: 'Ensayo Proctor Modificado', cantidadEnsayos: 2, cantidadVisitas: 1 },
      { nombre: 'Densidad In Situ (Método Cono de Arena)', cantidadEnsayos: 5, cantidadVisitas: 2 },
      { nombre: 'Granulometría por Tamizado', cantidadEnsayos: 3, cantidadVisitas: 1 },
    ];
    for (const l of lineas01) {
      const { tipoEnsayoId, precio } = await precioActivo(l.nombre);
      await db.insert(cotizacionDetalle).values({
        cotizacionId: cot01!.id,
        tipoEnsayoId,
        cantidadEnsayos: l.cantidadEnsayos,
        cantidadVisitas: l.cantidadVisitas,
        precioUnitario: precio,
      });
    }
    logger.info({ id: cot01!.id, codigo: codigo01, lineas: lineas01.length }, '✓ QA-COT-01 insertada (WEB/NUEVA).');
  }

  // ── QA-COT-02 — INTERNO, FIRMADA, 4 líneas Hormigón/Áridos + 1 servicio ──
  const [yaExisteCot02] = await db
    .select()
    .from(cotizacion)
    .where(and(eq(cotizacion.obraId, obraRow.id), eq(cotizacion.origen, 'INTERNO')));

  if (yaExisteCot02) {
    logger.info({ id: yaExisteCot02.id, codigo: yaExisteCot02.codigoCotizacion }, '⏭  QA-COT-02 ya existe, se salta.');
  } else {
    const [cot02] = await db
      .insert(cotizacion)
      .values({
        obraId: obraRow.id,
        origen: 'INTERNO',
        estado: 'FIRMADA',
        condicionPago: 'PAGO_50',
        tipoAjuste: 'DESCUENTO',
        porcentajeAjuste: '10.00',
        diasVigenciaToken: 30,
        cuentaPrincipalId: cuenta.id,
        creadoPor: QA_INTERNAL_USER_ID,
        firmaBase64: '',
        observaciones: `${OBSERVACION_MARK} QA-COT-02 — flujo INTERNO, firmada, lista para PDF/email.`,
      })
      .returning();
    const codigo02 = await generarCodigo();
    await db.update(cotizacion).set({ codigoCotizacion: codigo02 }).where(eq(cotizacion.id, cot02!.id));

    const lineas02 = [
      { nombre: 'Cono de Asentamiento (Slump)', cantidadEnsayos: 10, cantidadVisitas: 5 },
      { nombre: 'Compresión de Probetas Cilíndricas', cantidadEnsayos: 30, cantidadVisitas: 5 },
      { nombre: 'Resistencia al Hendimiento', cantidadEnsayos: 10, cantidadVisitas: 2 },
      { nombre: 'Desgaste Los Ángeles', cantidadEnsayos: 1, cantidadVisitas: 1 },
    ];
    for (const l of lineas02) {
      const { tipoEnsayoId, precio } = await precioActivo(l.nombre);
      await db.insert(cotizacionDetalle).values({
        cotizacionId: cot02!.id,
        tipoEnsayoId,
        cantidadEnsayos: l.cantidadEnsayos,
        cantidadVisitas: l.cantidadVisitas,
        precioUnitario: precio,
      });
    }

    await db.insert(cotizacionServicioGeneral).values({
      cotizacionId: cot02!.id,
      descripcion: 'Desplazamiento a terreno fuera de Arica (ida y vuelta)',
      cantidad: 2,
      precioUnitario: '150000.00',
    });

    logger.info(
      { id: cot02!.id, codigo: codigo02, lineas: lineas02.length, servicios: 1 },
      '✓ QA-COT-02 insertada (INTERNO/FIRMADA).',
    );
  }

  logger.info('✅ Seed de cotizaciones QA completado.');
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, '❌ Error en seed de cotizaciones QA');
  process.exit(1);
});
