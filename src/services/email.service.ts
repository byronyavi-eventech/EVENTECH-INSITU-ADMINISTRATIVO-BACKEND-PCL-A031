import { Resend } from 'resend';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import React from 'react';
import { CotizacionDocument } from '../pdf/cotizacion-document.js';
import type { QuotationListItem } from './quotation.service.js';
import { logger } from '../utils/logger.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_SENDER ?? 'Insitu <no-reply@laboratorioinsitu.cl>';

// Mail HTML

function buildEmailHtml(cotizacion: QuotationListItem): string {
  const total = cotizacion.detalles
    .reduce(
      (acc, d) => acc + parseFloat(d.precioUnitario) * d.cantidadEnsayos * d.cantidadVisitas,
      0,
    )
    .toFixed(2);

  const docCode = cotizacion.codigoCotizacion ?? `${String(cotizacion.id + 9999)}-LIA`;

  const ensayosRows = cotizacion.detalles
    .map(
      (d) => `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:10px 12px;font-size:13px;">${d.nombreTipoEnsayo}</td>
        <td style="padding:10px 12px;font-size:13px;color:#6b7280;">${d.nombreArea} › ${d.nombreSubarea}</td>
        <td style="padding:10px 12px;font-size:13px;text-align:right;">${d.cantidadEnsayos}</td>
        <td style="padding:10px 12px;font-size:13px;text-align:right;">${d.cantidadVisitas}</td>
        <td style="padding:10px 12px;font-size:13px;text-align:right;color:#6b7280;">${parseFloat(d.precioUnitario).toFixed(2)}</td>
        <td style="padding:10px 12px;font-size:13px;text-align:right;font-weight:600;">${(parseFloat(d.precioUnitario) * d.cantidadEnsayos * d.cantidadVisitas).toFixed(2)}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cotización ${docCode} — Laboratorio Insitu</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">

          <!-- Header -->
          <tr>
            <td style="background:#ffffff;padding:28px 36px;border-bottom:2px solid #c8102e;">
              <table width="100%">
                <tr>
                  <td>
                    <p style="margin:0;font-size:24px;font-weight:900;color:#c8102e;letter-spacing:1px;">INSITU</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Laboratorio de Ensayos y Calidad</p>
                  </td>
                  <td align="right">
                    <p style="margin:0;font-size:14px;font-weight:700;color:#111827;">COTIZACIÓN DE ENSAYOS Y SERVICIOS</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#c8102e;font-weight:700;">Nº ${docCode}</p>
                    <span style="display:inline-block;margin-top:8px;background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">✓ ACEPTADA / FIRMADA</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Saludo -->
          <tr>
            <td style="padding:28px 36px 0;">
              <p style="margin:0;font-size:15px;color:#111827;">Estimado/a <strong>${cotizacion.cliente.nombreContacto} ${cotizacion.cliente.apellidosContacto}</strong>,</p>
              <p style="margin:10px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
                Nos complace informarle que la cotización de servicios de ensayos para la obra
                <strong style="color:#111827;">${cotizacion.obra.nombreObra}</strong> ha sido aprobada y firmada.
                Adjunto a este correo encontrará el documento PDF con todos los detalles.
              </p>
            </td>
          </tr>

          <!-- Datos cliente / obra -->
          <tr>
            <td style="padding:24px 36px 0;">
              <div style="background:#fffbeb;padding:8px 12px;margin-bottom:12px;border-radius:4px;border-left:3px solid #f5a623;">
                <p style="margin:0;font-size:11px;font-weight:700;color:#c8102e;text-transform:uppercase;letter-spacing:.5px;">Datos Cotizante y Obra</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;width:40%;">Empresa / Razón Social</td>
                  <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#111827;">${cotizacion.cliente.giroEmpresa}</td>
                </tr>
                <tr style="background:#f9fafb;">
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Contacto</td>
                  <td style="padding:10px 16px;font-size:12px;color:#111827;">${cotizacion.cliente.nombreContacto} ${cotizacion.cliente.apellidosContacto}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Obra</td>
                  <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#111827;">${cotizacion.obra.nombreObra}</td>
                </tr>
                <tr style="background:#f9fafb;">
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Ubicación</td>
                  <td style="padding:10px 16px;font-size:12px;color:#111827;">${cotizacion.obra.ubicacionObra}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Tabla ensayos -->
          <tr>
            <td style="padding:24px 36px 0;">
              <div style="background:#fffbeb;padding:8px 12px;margin-bottom:12px;border-radius:4px;border-left:3px solid #f5a623;">
                <p style="margin:0;font-size:11px;font-weight:700;color:#c8102e;text-transform:uppercase;letter-spacing:.5px;">Métodos de Ensayo Cotizados</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <thead>
                  <tr style="background:#c8102e;">
                    <th style="padding:10px 12px;font-size:11px;color:#fff;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:.3px;">Tipo de Ensayo</th>
                    <th style="padding:10px 12px;font-size:11px;color:#fff;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:.3px;">Área</th>
                    <th style="padding:10px 12px;font-size:11px;color:#fff;text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:.3px;">Cant.</th>
                    <th style="padding:10px 12px;font-size:11px;color:#fff;text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:.3px;">Visitas</th>
                    <th style="padding:10px 12px;font-size:11px;color:#fff;text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:.3px;">P.Unit.</th>
                    <th style="padding:10px 12px;font-size:11px;color:#fff;text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:.3px;">Total (UF)</th>
                  </tr>
                </thead>
                <tbody>
                  ${ensayosRows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Total -->
          <tr>
            <td style="padding:16px 36px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td></td>
                  <td align="right" style="border-top:2px solid #c8102e;padding-top:12px;">
                    <p style="margin:0;font-size:12px;color:#111827;font-weight:700;text-transform:uppercase;">Total Estimado</p>
                    <p style="margin:4px 0 0;font-size:24px;font-weight:800;color:#c8102e;">UF ${total}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:32px 36px 24px;">
              <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
                Para cualquier consulta, no dude en contactarnos respondiendo este correo o llamando a nuestras oficinas.
              </p>
              <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
                Atentamente,<br/>
                <strong style="color:#111827;">Equipo Laboratorio Insitu</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 36px;">
              <table width="100%">
                <tr>
                  <td style="font-size:11px;color:#9ca3af;">© ${new Date().getFullYear()} Laboratorio Insitu · www.laboratorioinsitu.cl</td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendCotizacionEmail(cotizacion: QuotationListItem): Promise<void> {
  logger.info(
    { cotizacionId: cotizacion.id, to: cotizacion.cliente.email },
    'email.service: sendCotizacionEmail start',
  );

  const docCode = cotizacion.codigoCotizacion ?? `${String(cotizacion.id + 9999)}-LIA`;

  // Generate PDF buffer
  const pdfBuffer = await renderToBuffer(
    React.createElement(CotizacionDocument, { cotizacion }) as React.ReactElement<DocumentProps>,
  );

  // Send email via resend
  const { error } = await resend.emails.send({
    from: FROM,
    to: [cotizacion.cliente.email],
    subject: `Cotización ${docCode} — Laboratorio Insitu`,
    html: buildEmailHtml(cotizacion),
    attachments: [
      {
        filename: `cotizacion-${docCode}.pdf`,
        content: pdfBuffer,
      },
    ],
  });

  if (error) {
    logger.error({ cotizacionId: cotizacion.id, error }, 'email.service: resend error');
    throw new Error(`Error al enviar email: ${error.message}`);
  }

  logger.info(
    { cotizacionId: cotizacion.id, to: cotizacion.cliente.email },
    'email.service: sendCotizacionEmail OK',
  );
}
