import { db } from '../db/index.js';
import {
  cliente,
  obra,
  encargadoObra,
  cotizacion,
  cotizacionDetalle,
  tipoEnsayo,
  subareaEnsayo,
  areaEnsayo,
  precioEnsayo,
} from '../db/schema/index.js';
import { eq, and, ilike, isNull } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

export interface EnsayoLineInput {
  area: string;
  subarea: string;
  ensayo: string;
  cantidad: number;
  visitas: number;
}

export interface SubmitWebQuotationInput {
  //  Step 1
  rutEmpresa: string;
  giroEmpresa: string;
  nombreContacto: string;
  apellidosContacto: string;
  celularContacto: string;
  emailContacto: string;
  direccionEmpresa: string;
  regionEmpresa: string;
  comunaEmpresa: string;
  ciudadEmpresa: string;

  //  Step 2
  nombreObra: string;
  nombreMandante: string;
  nombreContratista: string;
  ubicacionObra: string;
  regionObra: string;
  comunaObra: string;
  ciudadObra: string;
  duracionObra: number;

  //  Step 3
  nombreEncargado: string;
  correoEncargado: string;
  telefonoEncargado: string;

  //  Step 4
  ensayos: EnsayoLineInput[];
}

export interface SubmitWebQuotationResult {
  cotizacionId: number;
  clienteId: number;
  obraId: number;
}

export async function submitWebQuotation(
  input: SubmitWebQuotationInput,
): Promise<SubmitWebQuotationResult> {
  logger.info(
    { rutEmpresa: input.rutEmpresa, nombreObra: input.nombreObra },
    'quotation.service: submitWebQuotation start',
  );

  const result = await db.transaction(async (tx) => {
    const [existingCliente] = await tx
      .select()
      .from(cliente)
      .where(eq(cliente.rutEmpresa, input.rutEmpresa))
      .limit(1);

    let clienteId: number;

    if (existingCliente) {
      await tx
        .update(cliente)
        .set({
          giroEmpresa:       input.giroEmpresa,
          nombreContacto:    input.nombreContacto,
          apellidosContacto: input.apellidosContacto,
          celularContacto:   input.celularContacto,
          email:             input.emailContacto,
          direccionEmpresa:  input.direccionEmpresa,
          region:            input.regionEmpresa,
          comuna:            input.comunaEmpresa,
          ciudad:            input.ciudadEmpresa,
          updatedAt:         new Date(),
        })
        .where(eq(cliente.id, existingCliente.id));

      clienteId = existingCliente.id;
      logger.debug({ clienteId }, 'quotation.service: existing cliente updated');
    } else {
      const [newCliente] = await tx
        .insert(cliente)
        .values({
          rutEmpresa:        input.rutEmpresa,
          giroEmpresa:       input.giroEmpresa,
          nombreContacto:    input.nombreContacto,
          apellidosContacto: input.apellidosContacto,
          celularContacto:   input.celularContacto,
          email:             input.emailContacto,
          direccionEmpresa:  input.direccionEmpresa,
          region:            input.regionEmpresa,
          comuna:            input.comunaEmpresa,
          ciudad:            input.ciudadEmpresa,
        })
        .returning({ id: cliente.id });

      clienteId = newCliente.id;
      logger.debug({ clienteId }, 'quotation.service: new cliente created');
    }

    const [newObra] = await tx
      .insert(obra)
      .values({
        clienteId:         clienteId,
        nombreObra:        input.nombreObra,
        nombreMandante:    input.nombreMandante,
        nombreContratista: input.nombreContratista,
        ubicacionObra:     input.ubicacionObra,
        region:            input.regionObra,
        comuna:            input.comunaObra,
        ciudad:            input.ciudadObra,
        duracionMeses:     input.duracionObra,
      })
      .returning({ id: obra.id });

    const obraId = newObra.id;
    logger.debug({ obraId }, 'quotation.service: obra created');

    await tx.insert(encargadoObra).values({
      obraId:            obraId,
      nombreEncargado:   input.nombreEncargado,
      correoEncargado:   input.correoEncargado,
      telefonoEncargado: input.telefonoEncargado,
    });

    logger.debug({ obraId }, 'quotation.service: encargado created');

    const observacionesSnapshot = JSON.stringify(input.ensayos);

    const [newCotizacion] = await tx
      .insert(cotizacion)
      .values({
        obraId:        obraId,
        origen:        'WEB',
        estado:        'BORRADOR',
        observaciones: observacionesSnapshot,
        // creadoPor is intentionally NULL — no internal user for web quotes.
      })
      .returning({ id: cotizacion.id });

    const cotizacionId = newCotizacion.id;
    logger.debug({ cotizacionId }, 'quotation.service: cotizacion header created');

    if (input.ensayos.length > 0) {
      const detallesToInsert: (typeof cotizacionDetalle.$inferInsert)[] = [];

      for (const line of input.ensayos) {
        // Normalize unicode (NFC) to avoid decomposition mismatches with ilike
        const areaNorm    = line.area.trim().normalize('NFC');
        const subareaNorm = line.subarea.trim().normalize('NFC');
        const ensayoNorm  = line.ensayo.trim().normalize('NFC');

        const [matchedArea] = await tx
          .select({ id: areaEnsayo.id })
          .from(areaEnsayo)
          .where(ilike(areaEnsayo.nombreArea, areaNorm))
          .limit(1);

        if (!matchedArea) {
          logger.warn(
            { cotizacionId, area: areaNorm },
            'quotation.service: area not found — skipping line',
          );
          continue;
        }

        const [matchedSubarea] = await tx
          .select({ id: subareaEnsayo.id })
          .from(subareaEnsayo)
          .where(
            and(
              eq(subareaEnsayo.areaId, matchedArea.id),
              ilike(subareaEnsayo.nombreSubarea, subareaNorm),
            ),
          )
          .limit(1);

        if (!matchedSubarea) {
          logger.warn(
            { cotizacionId, areaId: matchedArea.id, subarea: subareaNorm },
            'quotation.service: subarea not found — skipping line',
          );
          continue;
        }

        const [matchedTipo] = await tx
          .select({ id: tipoEnsayo.id })
          .from(tipoEnsayo)
          .where(
            and(
              eq(tipoEnsayo.subareaId, matchedSubarea.id),
              ilike(tipoEnsayo.nombreTipoEnsayo, ensayoNorm),
            ),
          )
          .limit(1);

        if (!matchedTipo) {
          logger.warn(
            { cotizacionId, subareaId: matchedSubarea.id, ensayo: ensayoNorm },
            'quotation.service: tipo_ensayo not found — skipping line',
          );
          continue;
        }

        logger.debug(
          { cotizacionId, tipoEnsayoId: matchedTipo.id, area: areaNorm, ensayo: ensayoNorm },
          'quotation.service: ensayo matched OK',
        );

        // Snapshot the active price at quote creation time.
        const [activePrecio] = await tx
          .select({ precio: precioEnsayo.precio })
          .from(precioEnsayo)
          .where(
            and(
              eq(precioEnsayo.tipoEnsayoId, matchedTipo.id),
              eq(precioEnsayo.activo, true),
              isNull(precioEnsayo.fechaFin),
            ),
          )
          .limit(1);

        if (!activePrecio) {
          logger.warn(
            { cotizacionId, tipoEnsayoId: matchedTipo.id },
            'quotation.service: no active price found for tipo_ensayo — using 0',
          );
        }

        detallesToInsert.push({
          cotizacionId:    cotizacionId,
          tipoEnsayoId:   matchedTipo.id,
          cantidadEnsayos: line.cantidad,
          cantidadVisitas: line.visitas,
          precioUnitario:  activePrecio?.precio ?? '0',
        });
      }

      if (detallesToInsert.length > 0) {
        await tx.insert(cotizacionDetalle).values(detallesToInsert);
        logger.debug(
          { cotizacionId, lines: detallesToInsert.length },
          'quotation.service: detalle lines inserted',
        );
      } else {
        logger.warn(
          { cotizacionId },
          'quotation.service: no detalle lines were matched — cotizacion_detalle is empty',
        );
      }
    }

    return { cotizacionId, clienteId, obraId };
  });

  logger.info(
    { cotizacionId: result.cotizacionId },
    'quotation.service: submitWebQuotation OK',
  );

  return result;
}
