/**
 * src/pdf/generateFichaControl.ts
 *
 * Genera el PDF de la Ficha de Control de Equipo (FT-6.4.3/1). Estructura
 * literal a la plantilla real del cliente — ver equipo.controller.ts
 * getFichaControlHandler para la lista de campos "resueltos/inferidos" que
 * quedan pendientes de confirmar contra la plantilla (Lugar Calibración/
 * Verificación, Codigo LI).
 *
 * PDFKit no trae tablas nativas — se dibujan a mano con rect()/text() para
 * tener control exacto de anchos/alineación, en vez de traer una librería de
 * tablas aparte para un solo documento.
 */
import PDFDocument from 'pdfkit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FichaControlData, FichaControlHistorialRow } from '../services/equipo.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, 'logo-insitu.png');

const PAGE_MARGIN = 40;
const RESULTADO_LABEL: Record<FichaControlHistorialRow['resultado'], string> = {
  aprobado: 'Aprobado',
  en_proceso: 'En Proceso',
};

function formatFecha(iso: string): string {
  // Las columnas date de Postgres llegan como 'YYYY-MM-DD' — se muestran DD-MM-YYYY,
  // mismo formato que el resto de la UI (ver formatDateDisplay en EquipoDetailModal.tsx).
  if (!iso || !iso.includes('-')) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

function campoConUnidad(valor: string | null, simbolo: string | null): string {
  if (!valor) return '—';
  return simbolo ? `${valor} ${simbolo}` : valor;
}

/**
 * Dibuja una celda con borde y texto (helper de bajo nivel — todas las
 * "tablas" del documento son composiciones de esta función).
 */
function drawCell(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  opts: {
    bold?: boolean;
    size?: number;
    align?: 'left' | 'center' | 'right';
    fill?: string;
    padX?: number;
  } = {},
) {
  const { bold = false, size = 8, align = 'left', fill, padX = 4 } = opts;
  doc.rect(x, y, w, h).stroke('#000000');
  if (fill) {
    doc.save().rect(x, y, w, h).fill(fill).restore();
    doc.rect(x, y, w, h).stroke('#000000');
  }
  doc
    .font(bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(size)
    .fillColor('#000000')
    .text(text, x + padX, y + h / 2 - size / 2, { width: w - padX * 2, align });
}

export async function generateFichaControlPdf(data: FichaControlData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - PAGE_MARGIN * 2;

    // ─── Encabezado ────────────────────────────────────────────
    const headerBoxWidth = 140;
    const headerBoxX = pageWidth - PAGE_MARGIN - headerBoxWidth;

    // "Pág. 1 de 1" — esquina superior derecha, fuera de la caja FT-6.4.3/1.
    doc
      .font('Helvetica')
      .fontSize(8)
      .text('Pág. 1 de 1', headerBoxX, PAGE_MARGIN - 15, { width: headerBoxWidth, align: 'right' });

    // Logo, arriba a la izquierda.
    try {
      doc.image(LOGO_PATH, PAGE_MARGIN, PAGE_MARGIN, { fit: [100, 45] });
    } catch {
      // Si el logo no carga, el documento se sigue generando sin él — no es
      // motivo para que la ficha completa falle.
    }

    // Título centrado entre el logo y la caja de la derecha.
    const tituloX = PAGE_MARGIN + 110;
    const tituloWidth = headerBoxX - tituloX - 10;
    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .text('CONTROL DE EQUIPOS', tituloX, PAGE_MARGIN + 15, {
        width: tituloWidth,
        align: 'center',
      });

    // Caja apilada: FT-6.4.3/1 / CEQ N°.
    drawCell(doc, headerBoxX, PAGE_MARGIN, headerBoxWidth, 20, 'FT-6.4.3/1', {
      bold: true,
      size: 10,
      align: 'center',
    });
    drawCell(doc, headerBoxX, PAGE_MARGIN + 20, headerBoxWidth, 20, `CEQ N° : ${data.codigo}`, {
      bold: true,
      size: 9,
      align: 'center',
    });

    let y = PAGE_MARGIN + 70;

    // ─── Bloque de datos del equipo ────────────────────────────
    const rowH = 18;
    const halfW = contentWidth / 2;

    drawCell(doc, PAGE_MARGIN, y, contentWidth, rowH, `Equipo: ${data.nombre}`, { bold: true });
    y += rowH;

    drawCell(doc, PAGE_MARGIN, y, halfW, rowH, `Marca: ${data.marca ?? '—'}`);
    drawCell(doc, PAGE_MARGIN + halfW, y, halfW, rowH, `Modelo: ${data.modelo ?? '—'}`);
    y += rowH;

    drawCell(doc, PAGE_MARGIN, y, halfW, rowH, `Serie: ${data.numeroSerie ?? '—'}`);
    drawCell(
      doc,
      PAGE_MARGIN + halfW,
      y,
      halfW,
      rowH,
      `Rango: ${campoConUnidad(data.rangoMedicion, data.unidadRangoSimbolo)}`,
    );
    y += rowH;

    drawCell(
      doc,
      PAGE_MARGIN,
      y,
      halfW,
      rowH,
      `Precisión: ${campoConUnidad(data.precisionEquipo, data.unidadPrecisionSimbolo)}`,
    );
    drawCell(doc, PAGE_MARGIN + halfW, y, halfW, rowH, `Codigo LI: ${data.codigo}`);
    y += rowH;

    drawCell(doc, PAGE_MARGIN, y, contentWidth, rowH, `Ubicación: ${data.ubicacionNombre ?? '—'}`);
    y += rowH + 10;

    // ─── Bloque de periodicidad / lugar / procedimiento ────────
    const labelColW = contentWidth * 0.4;
    const dataColW = (contentWidth - labelColW) / 2;
    const periodH = 20;

    const periodRows: [string, string, string][] = [
      [
        'Periocidad Calibración / Verificación',
        `Calibrac: ${data.frecuenciaCalibracionMeses != null ? `${data.frecuenciaCalibracionMeses} MESES` : '—'}`,
        `Verif: ${data.frecuenciaVerificacionMeses != null ? `${data.frecuenciaVerificacionMeses} MESES` : '—'}`,
      ],
      [
        'Lugar Calibración / Verificación',
        `Calibrac: ${data.lugarCalibracion ?? '—'}`,
        `Verif: ${data.lugarVerificacion ?? '—'}`,
      ],
      [
        'Procedimiento Calibración / Verificación',
        `Calibrac: ${data.procedimientoCalibracion ?? '—'}`,
        `Verif: ${data.procedimientoVerificacion ?? '—'}`,
      ],
    ];
    for (const [label, cal, ver] of periodRows) {
      drawCell(doc, PAGE_MARGIN, y, labelColW, periodH, label, { bold: true, size: 7.5 });
      drawCell(doc, PAGE_MARGIN + labelColW, y, dataColW, periodH, cal, { size: 7.5 });
      drawCell(doc, PAGE_MARGIN + labelColW + dataColW, y, dataColW, periodH, ver, { size: 7.5 });
      y += periodH;
    }
    y += 10;

    // ─── Tabla de historial ─────────────────────────────────────
    const colUltima = 65;
    const colProxima = 65;
    const colResultado = 85;
    const colResponsable = contentWidth - colUltima - colProxima - colResultado - 130;
    const colFirma = 130;

    const fechaGroupW = colUltima + colProxima;
    const headerH1 = 16;
    const headerH2 = 16;

    // Fila 1 de encabezado: "Fecha de Calibración/Verifica" (merged sobre
    // Ultima/Proxima) + Resultado/Responsable/Firma con celda mergeada
    // verticalmente (misma altura que las 2 filas de encabezado juntas).
    drawCell(doc, PAGE_MARGIN, y, fechaGroupW, headerH1, 'Fecha de Calibración/Verifica', {
      bold: true,
      size: 7.5,
      align: 'center',
      fill: '#e5e5e5',
    });
    drawCell(doc, PAGE_MARGIN + fechaGroupW, y, colResultado, headerH1 + headerH2, 'Resultado', {
      bold: true,
      size: 8,
      align: 'center',
      fill: '#e5e5e5',
    });
    drawCell(
      doc,
      PAGE_MARGIN + fechaGroupW + colResultado,
      y,
      colResponsable,
      headerH1 + headerH2,
      'Responsable',
      { bold: true, size: 8, align: 'center', fill: '#e5e5e5' },
    );
    drawCell(
      doc,
      PAGE_MARGIN + fechaGroupW + colResultado + colResponsable,
      y,
      colFirma,
      headerH1 + headerH2,
      'Firma',
      { bold: true, size: 8, align: 'center', fill: '#e5e5e5' },
    );
    y += headerH1;

    // Fila 2 de encabezado: sub-columnas Ultima / Proxima.
    drawCell(doc, PAGE_MARGIN, y, colUltima, headerH2, 'Ultima', {
      bold: true,
      size: 7.5,
      align: 'center',
      fill: '#e5e5e5',
    });
    drawCell(doc, PAGE_MARGIN + colUltima, y, colProxima, headerH2, 'Proxima', {
      bold: true,
      size: 7.5,
      align: 'center',
      fill: '#e5e5e5',
    });
    y += headerH2;

    // Filas de datos, más reciente primero (ya vienen ordenadas así desde
    // equipo.service.ts getFichaControlData).
    const dataRowH = 18;
    for (const row of data.historial) {
      drawCell(doc, PAGE_MARGIN, y, colUltima, dataRowH, formatFecha(row.ultima), {
        size: 7.5,
        align: 'center',
      });
      drawCell(doc, PAGE_MARGIN + colUltima, y, colProxima, dataRowH, formatFecha(row.proxima), {
        size: 7.5,
        align: 'center',
      });
      drawCell(
        doc,
        PAGE_MARGIN + fechaGroupW,
        y,
        colResultado,
        dataRowH,
        RESULTADO_LABEL[row.resultado],
        { size: 7.5, align: 'center' },
      );
      drawCell(
        doc,
        PAGE_MARGIN + fechaGroupW + colResultado,
        y,
        colResponsable,
        dataRowH,
        row.responsable,
        { size: 7.5 },
      );
      drawCell(
        doc,
        PAGE_MARGIN + fechaGroupW + colResultado + colResponsable,
        y,
        colFirma,
        dataRowH,
        '',
        {},
      );
      y += dataRowH;
    }

    // Filas en blanco pre-impresas hasta completar la página (mismo criterio
    // que la plantilla original, que trae el resto de la hoja con filas
    // vacías listas para llenar a mano).
    const pageBottom = doc.page.height - PAGE_MARGIN;
    while (y + dataRowH <= pageBottom) {
      drawCell(doc, PAGE_MARGIN, y, colUltima, dataRowH, '', {});
      drawCell(doc, PAGE_MARGIN + colUltima, y, colProxima, dataRowH, '', {});
      drawCell(doc, PAGE_MARGIN + fechaGroupW, y, colResultado, dataRowH, '', {});
      drawCell(doc, PAGE_MARGIN + fechaGroupW + colResultado, y, colResponsable, dataRowH, '', {});
      drawCell(
        doc,
        PAGE_MARGIN + fechaGroupW + colResultado + colResponsable,
        y,
        colFirma,
        dataRowH,
        '',
        {},
      );
      y += dataRowH;
    }

    doc.end();
  });
}
