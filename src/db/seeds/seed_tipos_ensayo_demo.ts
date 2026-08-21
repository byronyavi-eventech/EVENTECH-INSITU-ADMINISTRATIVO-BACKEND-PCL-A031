/**
 * SEED DE DEMO ÚNICAMENTE. Estos datos son FICTICIOS y existen solo en la
 * tabla espejo local de este proyecto standalone, para poder demostrar el
 * multi-select de tipos de ensayo mañana. Cuando este módulo se integre al
 * monorepo real de Eventech InSitu, esta tabla y este seed se ELIMINAN — el
 * catálogo real de tipo_ensayo ya existe con datos reales en ese proyecto.
 */
import { db } from '../index.js';
import { tipoEnsayo, unidadMedida } from '../schema/index.js';
import { logger } from '../../utils/logger.js';

async function seedTiposEnsayoDemo() {
  try {
    const datosTiposEnsayo = [
      { subareaId: 1, nombreTipoEnsayo: 'Ensayo Proctor Modificado', codigoNorma: 'ASTM D1557' },
      { subareaId: 1, nombreTipoEnsayo: 'Ensayo CBR', codigoNorma: 'ASTM D1883' },
      { subareaId: 2, nombreTipoEnsayo: 'Granulometría por Tamizado', codigoNorma: 'ASTM D422' },
      { subareaId: 3, nombreTipoEnsayo: 'Compresión de Hormigón', codigoNorma: 'NCh1037' },
      { subareaId: 3, nombreTipoEnsayo: 'Cono de Asentamiento', codigoNorma: 'NCh1019' },
      { subareaId: 4, nombreTipoEnsayo: 'Densidad In Situ', codigoNorma: 'ASTM D6938' },
    ];
    const insertados = await db.insert(tipoEnsayo).values(datosTiposEnsayo).returning();
    logger.info({ count: insertados.length }, 'Tipos de ensayo de demo insertados');
    console.table(insertados);

    const datosUnidades = [
      { nombre: 'Kilogramos', simbolo: 'kg' },
      { nombre: 'Gramos', simbolo: 'g' },
      { nombre: 'Milímetros', simbolo: 'mm' },
      { nombre: 'Centímetros', simbolo: 'cm' },
      { nombre: 'Litros', simbolo: 'L' },
      { nombre: 'Mililitros', simbolo: 'mL' },
      { nombre: 'Newton', simbolo: 'N' },
      { nombre: 'Kilonewton', simbolo: 'kN' },
      { nombre: 'Porcentaje', simbolo: '%' },
      { nombre: 'Grados Celsius', simbolo: '°C' },
    ];
    const insertadasUnidades = await db
      .insert(unidadMedida)
      .values(datosUnidades)
      .onConflictDoNothing()
      .returning();
    logger.info({ count: insertadasUnidades.length }, 'Unidades de medida insertadas');
  } catch (err) {
    logger.error({ err }, 'Error en seed de tipos de ensayo demo');
    process.exit(1);
  }
  process.exit(0);
}

seedTiposEnsayoDemo();
