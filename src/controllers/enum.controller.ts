/**
 * src/controllers/enum.controller.ts
 * Handler for querying system enum values.
 */
import { AppError } from '../utils/app-error.js';
import { wrap } from '../utils/controller-helpers.js';

// Fase 3 (2026-08-04): estado_equipo pasa a ser 100% calculado (activo/inactivo)
// salvo dado_de_baja (manual, vía DELETE). estado_calibracion/verificacion/
// mantenimiento representan el "estado de ingreso" manual — reemplazan el
// antiguo resultado (conforme/no_conforme/observado).
const ENUMS_DISPONIBLES: Record<string, string[]> = {
  estado_equipo: ['activo', 'inactivo', 'dado_de_baja'],
  estado_calibracion: ['aprobado', 'en_proceso'],
  estado_verificacion: ['aprobado', 'en_proceso'],
  estado_mantenimiento: ['operativo', 'en_mantenimiento', 'dado_de_baja', 'fuera_de_servicio'],
  tipo_mantenimiento: ['preventivo', 'correctivo'],
};

export const getEnumHandler = wrap(async (req, res) => {
  const tipo = req.params['tipo'] as string;
  if (!tipo) {
    throw new AppError('Parámetro tipo es requerido.', 400);
  }
  const valores = ENUMS_DISPONIBLES[tipo];
  if (!valores) {
    throw new AppError(
      `Enum '${tipo}' no existe. Disponibles: ${Object.keys(ENUMS_DISPONIBLES).join(', ')}`,
      404,
    );
  }
  res.status(200).json({
    status: 'success',
    data: valores.map((v: string) => ({ value: v, label: v })),
  });
});
