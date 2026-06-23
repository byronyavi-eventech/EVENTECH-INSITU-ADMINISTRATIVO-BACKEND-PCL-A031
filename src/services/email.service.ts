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

  const docCode = cotizacion.codigoCotizacion ?? `COT-${String(cotizacion.id).padStart(5, '0')}`;

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
  <title>Cotización ${docCode} — Laboratorios Insitu</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">

          <!-- Header -->
          <tr>
            <td style="background:#1a56db;padding:28px 36px;">
              <table width="100%">
                <tr>
                  <td>
                    <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:1px;">INSITU</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#bfdbfe;">Laboratorio de Ensayos y Calidad</p>
                  </td>
                  <td align="right">
                    <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;">COTIZACIÓN</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#bfdbfe;">${docCode}</p>
                    <span style="display:inline-block;margin-top:8px;background:#ffffff20;border:1px solid #93c5fd;color:#bfdbfe;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">✓ ACEPTADA / FIRMADA</span>
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
                Nos complace informarle que la siguiente cotización de servicios de ensayos para la obra
                <strong style="color:#111827;">${cotizacion.obra.nombreObra}</strong> ha sido aprobada y firmada.
                Adjunto a este correo encontrará el documento PDF con todos los detalles.
              </p>
            </td>
          </tr>

          <!-- Datos cliente / obra -->
          <tr>
            <td style="padding:20px 36px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <tr style="background:#f9fafb;">
                  <td style="padding:10px 16px;font-size:11px;font-weight:700;color:#1a56db;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb;" colspan="2">Datos del cliente</td>
                </tr>
                <tr>
                  <td style="padding:8px 16px;font-size:12px;color:#6b7280;width:40%;">Empresa</td>
                  <td style="padding:8px 16px;font-size:12px;font-weight:600;color:#111827;">${cotizacion.cliente.giroEmpresa}</td>
                </tr>
                <tr style="background:#f9fafb;">
                  <td style="padding:8px 16px;font-size:12px;color:#6b7280;">Contacto</td>
                  <td style="padding:8px 16px;font-size:12px;color:#111827;">${cotizacion.cliente.nombreContacto} ${cotizacion.cliente.apellidosContacto}</td>
                </tr>
                <tr>
                  <td style="padding:8px 16px;font-size:12px;color:#6b7280;">Obra</td>
                  <td style="padding:8px 16px;font-size:12px;color:#111827;">${cotizacion.obra.nombreObra}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Tabla ensayos -->
          <tr>
            <td style="padding:20px 36px 0;">
              <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#1a56db;text-transform:uppercase;letter-spacing:.5px;">Detalle de ensayos</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <thead>
                  <tr style="background:#1a56db;">
                    <th style="padding:10px 12px;font-size:11px;color:#fff;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:.3px;">Ensayo</th>
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
            <td style="padding:12px 36px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td></td>
                  <td align="right" style="border-top:2px solid #1a56db;padding-top:10px;">
                    <p style="margin:0;font-size:12px;color:#6b7280;">Total Estimado</p>
                    <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:#1a56db;">UF ${total}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:24px 36px;">
              <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
                Para cualquier consulta, no dude en contactarnos respondiendo este correo o llamando a nuestras oficinas.
              </p>
              <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
                Atentamente,<br/>
                <strong style="color:#111827;">Equipo Laboratorios Insitu</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 36px;">
              <table width="100%">
                <tr>
                  <td style="font-size:11px;color:#9ca3af;">© ${new Date().getFullYear()} Laboratorios Insitu · laboratorioinsitu.cl</td>
                  <td align="right" style="font-size:11px;color:#059669;font-weight:600;">✓ Cotización Aceptada</td>
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

  const docCode = cotizacion.codigoCotizacion ?? `COT-${String(cotizacion.id).padStart(5, '0')}`;

  // Generate PDF buffer
  const pdfBuffer = await renderToBuffer(
    React.createElement(CotizacionDocument, { cotizacion }) as React.ReactElement<DocumentProps>,
  );

  // Send email via resend
  const { error } = await resend.emails.send({
    from: FROM,
    to: [cotizacion.cliente.email],
    subject: `Cotización ${docCode} — Laboratorios Insitu`,
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
