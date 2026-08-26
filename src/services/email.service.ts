import { Resend } from 'resend';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import React from 'react';
import { CotizacionDocument, loadLogoDataUri } from '../pdf/cotizacion-document.js';
import type { QuotationListItem } from './quotation.service.js';
import { logger } from '../utils/logger.js';
import { generateQuotationToken } from './token.service.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_SENDER ?? 'Insitu <no-reply@laboratorioinsitu.cl>';

// Override de destinatario para pruebas (dev/QA) — si está seteado, TODOS los
// emails que pasan por sendProgramacionEmail van a esta casilla en vez del
// email real del cliente. El cuerpo del correo sigue mostrando los datos
// reales de la cotización. NO usar en producción — dejar vacío/undefined.
const EMAIL_TEST_OVERRIDE = process.env.EMAIL_TEST_OVERRIDE?.trim() || undefined;

// Mail HTML

function buildEmailHtml(cotizacion: QuotationListItem): string {
  const subtotal = cotizacion.detalles.reduce(
    (acc, d) => acc + parseFloat(d.precioUnitario) * d.cantidadEnsayos * d.cantidadVisitas,
    0,
  );

  const porcentaje = cotizacion.porcentajeAjuste ? parseFloat(cotizacion.porcentajeAjuste) : 0;
  let ajuste = 0;
  if (cotizacion.tipoAjuste === 'DESCUENTO') ajuste = -(subtotal * porcentaje / 100);
  else if (cotizacion.tipoAjuste === 'INCREMENTO') ajuste = subtotal * porcentaje / 100;
  const totalFinal = (subtotal + ajuste).toFixed(2);
  const subtotalStr = subtotal.toFixed(2);

  const condicionPagoLabel: Record<string, string> = {
    PAGO_100: 'Pago 100% anticipado',
    PAGO_50: 'Pago 50% al inicio',
    CREDITO_30_DIAS: 'Cr&eacute;dito a 30 d&iacute;as',
  };
  const condLabel = condicionPagoLabel[cotizacion.condicionPago] ?? cotizacion.condicionPago;

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
                    <span style="display:inline-block;margin-top:8px;background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">&#x2713; FIRMADA</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Saludo -->
          <tr>
            <td style="padding:28px 36px 0;">
              <p style="margin:0;font-size:15px;color:#111827;">Estimado/a <strong>${cotizacion.cliente.nombreContacto}</strong>,</p>
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
                  <td style="padding:10px 16px;font-size:12px;color:#111827;">${cotizacion.cliente.nombreContacto}</td>
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
                    ${cotizacion.tipoAjuste !== 'SIN_AJUSTE' ? `
                    <p style="margin:0;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Subtotal</p>
                    <p style="margin:2px 0 8px;font-size:18px;font-weight:700;color:#374151;">UF ${subtotalStr}</p>
                    <p style="margin:0;font-size:12px;color:${cotizacion.tipoAjuste === 'DESCUENTO' ? '#16a34a' : '#d97706'};font-weight:600;">
                      ${cotizacion.tipoAjuste === 'DESCUENTO' ? 'DESCUENTO' : 'INCREMENTO'} ${porcentaje}%:
                      ${cotizacion.tipoAjuste === 'DESCUENTO' ? '-' : '+'}UF ${Math.abs(ajuste).toFixed(2)}
                    </p>
                    <hr style="border:none;border-top:1px solid #e5e7eb;margin:8px 0;" />
                    ` : ''}
                    <p style="margin:0;font-size:12px;color:#111827;font-weight:700;text-transform:uppercase;">Total Estimado</p>
                    <p style="margin:4px 0 0;font-size:24px;font-weight:800;color:#c8102e;">UF ${totalFinal}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Notas Comerciales -->
          <tr>
            <td style="padding:16px 36px 0;">
              <div style="background:#fffbeb;padding:8px 12px;margin-bottom:12px;border-radius:4px;border-left:3px solid #f5a623;">
                <p style="margin:0;font-size:11px;font-weight:700;color:#c8102e;text-transform:uppercase;letter-spacing:.5px;">Informaci&oacute;n de Pago</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;width:40%;">Condici&oacute;n de Pago</td>
                  <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#111827;">${condLabel}</td>
                </tr>
                <tr style="background:#f9fafb;">
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Forma de Pago</td>
                  <td style="padding:10px 16px;font-size:12px;color:#111827;">Transferencia Electr&oacute;nica</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Titular</td>
                  <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#111827;">LABORATORIO INSITU LTDA. &mdash; RUT 76.290.113-7</td>
                </tr>
                ${cotizacion.cuentaPrincipal ? `
                <tr style="background:#f9fafb;">
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Cuenta Principal</td>
                  <td style="padding:10px 16px;font-size:12px;color:#111827;">
                    <strong>${cotizacion.cuentaPrincipal.banco}</strong> &mdash; ${cotizacion.cuentaPrincipal.tipoCuenta} N&deg;${cotizacion.cuentaPrincipal.numeroCuenta}
                  </td>
                </tr>` : ''}
                ${cotizacion.cuentaSecundaria ? `
                <tr>
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Cuenta Alternativa</td>
                  <td style="padding:10px 16px;font-size:12px;color:#111827;">
                    <strong>${cotizacion.cuentaSecundaria.banco}</strong> &mdash; ${cotizacion.cuentaSecundaria.tipoCuenta} N&deg;${cotizacion.cuentaSecundaria.numeroCuenta}
                  </td>
                </tr>` : ''}
                <tr style="background:#f9fafb;">
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Vigencia</td>
                  <td style="padding:10px 16px;font-size:12px;color:#111827;">${cotizacion.diasVigenciaToken} d&iacute;as desde el env&iacute;o</td>
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

export async function sendCotizacionEmail(
  cotizacion: QuotationListItem & { firmaBase64: string | null },
): Promise<void> {
  logger.info(
    { cotizacionId: cotizacion.id, to: cotizacion.cliente.email },
    'email.service: sendCotizacionEmail start',
  );

  const docCode = cotizacion.codigoCotizacion ?? `${String(cotizacion.id + 9999)}-LIA`;

  // Generate PDF buffer
  const pdfBuffer = await renderToBuffer(
    React.createElement(CotizacionDocument, {
      cotizacion,
      firmaBase64: cotizacion.firmaBase64,
      logoDataUri: loadLogoDataUri(),
    }) as React.ReactElement<DocumentProps>,
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

// ---------------------------------------------------------------------------
// Email al CLIENTE con botones ACEPTAR / RECHAZAR
// ---------------------------------------------------------------------------

function buildClientEmailHtml(
  cotizacion: QuotationListItem,
  acceptUrl: string,
  rejectUrl: string,
): string {
  const subtotal = cotizacion.detalles.reduce(
    (acc, d) => acc + parseFloat(d.precioUnitario) * d.cantidadEnsayos * d.cantidadVisitas,
    0,
  );

  // Add servicios generales to subtotal
  const totalServicios = (cotizacion.serviciosGenerales ?? []).reduce(
    (acc, s) => acc + parseFloat(s.precioUnitario) * s.cantidad,
    0,
  );
  const subtotalConServicios = subtotal + totalServicios;

  // Compute adjustment
  const porcentaje = cotizacion.porcentajeAjuste ? parseFloat(cotizacion.porcentajeAjuste) : 0;
  let ajuste = 0;
  if (cotizacion.tipoAjuste === 'DESCUENTO') ajuste = -(subtotalConServicios * porcentaje / 100);
  else if (cotizacion.tipoAjuste === 'INCREMENTO') ajuste = subtotalConServicios * porcentaje / 100;
  const totalGeneral = (subtotalConServicios + ajuste).toFixed(2);
  const subtotalStr = subtotalConServicios.toFixed(2);

  const condicionPagoLabel: Record<string, string> = {
    PAGO_100: 'Pago 100% anticipado',
    PAGO_50: 'Pago 50% al inicio',
    CREDITO_30_DIAS: 'Cr&eacute;dito a 30 d&iacute;as',
  };
  const condLabel = condicionPagoLabel[cotizacion.condicionPago] ?? cotizacion.condicionPago;

  const docCode = cotizacion.codigoCotizacion ?? `${String(cotizacion.id + 9999)}-LIA`;

  const ensayosRows = cotizacion.detalles
    .map(
      (d) => `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:10px 12px;font-size:13px;">${d.nombreTipoEnsayo}</td>
        <td style="padding:10px 12px;font-size:13px;color:#6b7280;">${d.nombreArea} &rsaquo; ${d.nombreSubarea}</td>
        <td style="padding:10px 12px;font-size:13px;text-align:right;">${d.cantidadEnsayos}</td>
        <td style="padding:10px 12px;font-size:13px;text-align:right;">${d.cantidadVisitas}</td>
        <td style="padding:10px 12px;font-size:13px;text-align:right;color:#6b7280;">${parseFloat(d.precioUnitario).toFixed(2)}</td>
        <td style="padding:10px 12px;font-size:13px;text-align:right;font-weight:600;">${(parseFloat(d.precioUnitario) * d.cantidadEnsayos * d.cantidadVisitas).toFixed(2)}</td>
      </tr>`,
    )
    .join('');

  const serviciosRows = (cotizacion.serviciosGenerales ?? [])
    .map(
      (s) => `
      <tr style="border-bottom:1px solid #e5e7eb;background:#fffbeb;">
        <td style="padding:10px 12px;font-size:13px;" colspan="4">${s.descripcion}</td>
        <td style="padding:10px 12px;font-size:13px;text-align:right;color:#6b7280;">${parseFloat(s.precioUnitario).toFixed(2)}</td>
        <td style="padding:10px 12px;font-size:13px;text-align:right;font-weight:600;">${(parseFloat(s.precioUnitario) * s.cantidad).toFixed(2)}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cotizacion ${docCode} Laboratorio Insitu</title>
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
                    <p style="margin:0;font-size:14px;font-weight:700;color:#111827;">COTIZACION DE ENSAYOS Y SERVICIOS</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#c8102e;font-weight:700;">N&deg; ${docCode}</p>
                    <span style="display:inline-block;margin-top:8px;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">PENDIENTE DE RESPUESTA</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Saludo -->
          <tr>
            <td style="padding:28px 36px 0;">
              <p style="margin:0;font-size:15px;color:#111827;">Estimado/a <strong>${cotizacion.cliente.nombreContacto}</strong>,</p>
              <p style="margin:10px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
                Le enviamos la cotizacion de servicios de ensayos para la obra
                <strong style="color:#111827;">${cotizacion.obra.nombreObra}</strong>.
                Por favor revise el detalle adjunto y confirme su respuesta haciendo clic en uno de los siguientes botones.
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
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;width:40%;">Empresa / Razon Social</td>
                  <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#111827;">${cotizacion.cliente.giroEmpresa}</td>
                </tr>
                <tr style="background:#f9fafb;">
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Contacto</td>
                  <td style="padding:10px 16px;font-size:12px;color:#111827;">${cotizacion.cliente.nombreContacto}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Obra</td>
                  <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#111827;">${cotizacion.obra.nombreObra}</td>
                </tr>
                <tr style="background:#f9fafb;">
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Ubicacion</td>
                  <td style="padding:10px 16px;font-size:12px;color:#111827;">${cotizacion.obra.ubicacionObra}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Tabla ensayos -->
          <tr>
            <td style="padding:24px 36px 0;">
              <div style="background:#fffbeb;padding:8px 12px;margin-bottom:12px;border-radius:4px;border-left:3px solid #f5a623;">
                <p style="margin:0;font-size:11px;font-weight:700;color:#c8102e;text-transform:uppercase;letter-spacing:.5px;">Metodos de Ensayo Cotizados</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <thead>
                  <tr style="background:#c8102e;">
                    <th style="padding:10px 12px;font-size:11px;color:#fff;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:.3px;">Tipo de Ensayo</th>
                    <th style="padding:10px 12px;font-size:11px;color:#fff;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:.3px;">Area</th>
                    <th style="padding:10px 12px;font-size:11px;color:#fff;text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:.3px;">Cant.</th>
                    <th style="padding:10px 12px;font-size:11px;color:#fff;text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:.3px;">Visitas</th>
                    <th style="padding:10px 12px;font-size:11px;color:#fff;text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:.3px;">P.Unit.</th>
                    <th style="padding:10px 12px;font-size:11px;color:#fff;text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:.3px;">Total (UF)</th>
                  </tr>
                </thead>
                <tbody>
                  ${ensayosRows}
                  ${serviciosRows}
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
                    ${cotizacion.tipoAjuste !== 'SIN_AJUSTE' ? `
                    <p style="margin:0;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Subtotal</p>
                    <p style="margin:2px 0 8px;font-size:18px;font-weight:700;color:#374151;">UF ${subtotalStr}</p>
                    <p style="margin:0;font-size:12px;color:${cotizacion.tipoAjuste === 'DESCUENTO' ? '#16a34a' : '#d97706'};font-weight:600;">
                      ${cotizacion.tipoAjuste === 'DESCUENTO' ? 'DESCUENTO' : 'INCREMENTO'} ${porcentaje}%:
                      ${cotizacion.tipoAjuste === 'DESCUENTO' ? '-' : '+'}UF ${Math.abs(ajuste).toFixed(2)}
                    </p>
                    <hr style="border:none;border-top:1px solid #e5e7eb;margin:8px 0;" />
                    ` : ''}
                    <p style="margin:0;font-size:12px;color:#111827;font-weight:700;text-transform:uppercase;">Total Estimado</p>
                    <p style="margin:4px 0 0;font-size:24px;font-weight:800;color:#c8102e;">UF ${totalGeneral}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#9ca3af;">Valores expresados en Unidades de Fomento (UF)</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Notas Comerciales / Información de Pago -->
          <tr>
            <td style="padding:16px 36px 0;">
              <div style="background:#fffbeb;padding:8px 12px;margin-bottom:12px;border-radius:4px;border-left:3px solid #f5a623;">
                <p style="margin:0;font-size:11px;font-weight:700;color:#c8102e;text-transform:uppercase;letter-spacing:.5px;">Informaci&oacute;n de Pago</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;width:40%;">Condici&oacute;n de Pago</td>
                  <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#111827;">${condLabel}</td>
                </tr>
                <tr style="background:#f9fafb;">
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Forma de Pago</td>
                  <td style="padding:10px 16px;font-size:12px;color:#111827;">Transferencia Electr&oacute;nica</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Titular</td>
                  <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#111827;">LABORATORIO INSITU LTDA. &mdash; RUT 76.290.113-7</td>
                </tr>
                ${cotizacion.cuentaPrincipal ? `
                <tr style="background:#f9fafb;">
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Cuenta Principal</td>
                  <td style="padding:10px 16px;font-size:12px;color:#111827;">
                    <strong>${cotizacion.cuentaPrincipal.banco}</strong> &mdash; ${cotizacion.cuentaPrincipal.tipoCuenta} N&deg;${cotizacion.cuentaPrincipal.numeroCuenta}
                  </td>
                </tr>` : ''}
                ${cotizacion.cuentaSecundaria ? `
                <tr>
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Cuenta Alternativa</td>
                  <td style="padding:10px 16px;font-size:12px;color:#111827;">
                    <strong>${cotizacion.cuentaSecundaria.banco}</strong> &mdash; ${cotizacion.cuentaSecundaria.tipoCuenta} N&deg;${cotizacion.cuentaSecundaria.numeroCuenta}
                  </td>
                </tr>` : ''}
                <tr style="background:#f9fafb;">
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Vigencia</td>
                  <td style="padding:10px 16px;font-size:12px;color:#111827;">${cotizacion.diasVigenciaToken} d&iacute;as desde el env&iacute;o</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Botones de respuesta -->
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 20px;font-size:14px;color:#374151;font-weight:600;text-align:center;">Por favor, confirme su respuesta:</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:0 8px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" bgcolor="#16a34a" style="border-radius:8px;">
                          <a href="${acceptUrl}"
                             target="_blank"
                             style="display:block;background:#16a34a;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:8px;letter-spacing:.3px;mso-padding-alt:14px 40px;">
                            <!--[if mso]>&nbsp;<![endif]-->
                            ACEPTAR COTIZACION
                            <!--[if mso]>&nbsp;<![endif]-->
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="center" style="padding:0 8px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" bgcolor="#dc2626" style="border-radius:8px;">
                          <a href="${rejectUrl}"
                             target="_blank"
                             style="display:block;background:#dc2626;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:8px;letter-spacing:.3px;mso-padding-alt:14px 40px;">
                            <!--[if mso]>&nbsp;<![endif]-->
                            RECHAZAR COTIZACION
                            <!--[if mso]>&nbsp;<![endif]-->
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
                Los botones tienen una vigencia de ${cotizacion.diasVigenciaToken} dias desde el envio de este correo.
              </p>
            </td>
          </tr>


          <!-- Nota legal -->
          <tr>
            <td style="padding:0 36px 24px;">
              <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;">
                Si tiene preguntas sobre esta cotizacion, no dude en contactarnos respondiendo este correo
                o llamando a nuestras oficinas.
              </p>
              <p style="margin:12px 0 0;font-size:12px;color:#6b7280;">
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
                  <td style="font-size:11px;color:#9ca3af;">&copy; ${new Date().getFullYear()} Laboratorio Insitu &middot; www.laboratorioinsitu.cl</td>
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

/**
 * Envia el email al CLIENTE con botones ACEPTAR / RECHAZAR.
 * Genera dos tokens HMAC-SHA256 (uno por accion) embebidos como URLs en el email.
 * Cambia el estado de la cotizacion a ENVIADA_CLIENTE via la URL de respuesta.
 */
export async function sendCotizacionClienteEmail(
  cotizacion: QuotationListItem & { firmaBase64: string | null },
  ttlDays?: number,
): Promise<void> {
  logger.info(
    { cotizacionId: cotizacion.id, to: cotizacion.cliente.email },
    'email.service: sendCotizacionClienteEmail start',
  );

  const backendUrl =
    process.env.BACKEND_PUBLIC_URL ??
    process.env.BETTER_AUTH_URL ??
    'http://localhost:3000';

  const [acceptToken, rejectToken] = await Promise.all([
    generateQuotationToken(cotizacion.id, 'ACEPTAR', ttlDays),
    generateQuotationToken(cotizacion.id, 'RECHAZAR', ttlDays),
  ]);

  const acceptUrl = `${backendUrl}/api/quotations/respond?token=${encodeURIComponent(acceptToken)}`;
  const rejectUrl = `${backendUrl}/api/quotations/respond?token=${encodeURIComponent(rejectToken)}`;

  const docCode = cotizacion.codigoCotizacion ?? `${String(cotizacion.id + 9999)}-LIA`;

  // Generate PDF buffer
  const pdfBuffer = await renderToBuffer(
    React.createElement(CotizacionDocument, {
      cotizacion,
      firmaBase64: cotizacion.firmaBase64,
      logoDataUri: loadLogoDataUri(),
    }) as React.ReactElement<DocumentProps>,
  );

  const { error } = await resend.emails.send({
    from: FROM,
    to: [cotizacion.cliente.email],
    subject: `Cotizacion ${docCode} Pendiente de su respuesta`,
    html: buildClientEmailHtml(cotizacion, acceptUrl, rejectUrl),
    attachments: [
      {
        filename: `cotizacion-${docCode}.pdf`,
        content: pdfBuffer,
      },
    ],
  });

  if (error) {
    logger.error(
      { cotizacionId: cotizacion.id, error },
      'email.service: resend error (cliente)',
    );
    throw new Error(`Error al enviar email al cliente: ${error.message}`);
  }

  logger.info(
    { cotizacionId: cotizacion.id, to: cotizacion.cliente.email },
    'email.service: sendCotizacionClienteEmail OK',
  );
}

// ---------------------------------------------------------------------------
// Comprobante de solicitud recibida al CLIENTE (envío del formulario web)
// ---------------------------------------------------------------------------

function buildSolicitudRecibidaEmailHtml(cotizacion: QuotationListItem, docCode: string): string {
  const ensayosRows = cotizacion.detalles
    .map(
      (d) => `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:10px 12px;font-size:13px;">${d.nombreTipoEnsayo}</td>
        <td style="padding:10px 12px;font-size:13px;color:#6b7280;">${d.nombreArea} &rsaquo; ${d.nombreSubarea}</td>
        <td style="padding:10px 12px;font-size:13px;text-align:right;">${d.cantidadEnsayos}</td>
      </tr>`,
    )
    .join('');

  const fechaSolicitud = new Date(cotizacion.createdAt).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const tieneObservaciones =
    !!cotizacion.observaciones && cotizacion.observaciones.trim() !== '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Solicitud de Cotización ${docCode} — Laboratorio Insitu</title>
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
                    <p style="margin:0;font-size:14px;font-weight:700;color:#111827;">SOLICITUD DE COTIZACIÓN</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#c8102e;font-weight:700;">Nº ${docCode}</p>
                    <span style="display:inline-block;margin-top:8px;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">RECIBIDA</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Saludo -->
          <tr>
            <td style="padding:28px 36px 0;">
              <p style="margin:0;font-size:15px;color:#111827;">Hola <strong>${cotizacion.cliente.nombreContacto}</strong>:</p>
              <p style="margin:10px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
                Hemos recibido correctamente tu <strong style="color:#111827;">solicitud de cotización</strong>.
              </p>
              <p style="margin:10px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
                Tu solicitud fue registrada con el número <strong style="color:#c8102e;">${docCode}</strong> y será
                revisada por nuestro equipo para preparar la cotización correspondiente.
              </p>
            </td>
          </tr>

          <!-- Datos de la solicitud -->
          <tr>
            <td style="padding:24px 36px 0;">
              <div style="background:#fffbeb;padding:8px 12px;margin-bottom:12px;border-radius:4px;border-left:3px solid #f5a623;">
                <p style="margin:0;font-size:11px;font-weight:700;color:#c8102e;text-transform:uppercase;letter-spacing:.5px;">Datos de la Solicitud</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;width:40%;">Empresa</td>
                  <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#111827;">${cotizacion.cliente.giroEmpresa}</td>
                </tr>
                <tr style="background:#f9fafb;">
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">RUT</td>
                  <td style="padding:10px 16px;font-size:12px;color:#111827;">${cotizacion.cliente.rutEmpresa ?? '—'}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Obra / Proyecto</td>
                  <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#111827;">${cotizacion.obra.nombreObra}</td>
                </tr>
                <tr style="background:#f9fafb;">
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Ubicación de la obra</td>
                  <td style="padding:10px 16px;font-size:12px;color:#111827;">${cotizacion.obra.ubicacionObra}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Fecha de solicitud</td>
                  <td style="padding:10px 16px;font-size:12px;color:#111827;">${fechaSolicitud}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Tabla ensayos -->
          <tr>
            <td style="padding:24px 36px 0;">
              <div style="background:#fffbeb;padding:8px 12px;margin-bottom:12px;border-radius:4px;border-left:3px solid #f5a623;">
                <p style="margin:0;font-size:11px;font-weight:700;color:#c8102e;text-transform:uppercase;letter-spacing:.5px;">Ensayos Solicitados</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <thead>
                  <tr style="background:#c8102e;">
                    <th style="padding:10px 12px;font-size:11px;color:#fff;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:.3px;">Tipo de Ensayo</th>
                    <th style="padding:10px 12px;font-size:11px;color:#fff;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:.3px;">Área</th>
                    <th style="padding:10px 12px;font-size:11px;color:#fff;text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:.3px;">Cant.</th>
                  </tr>
                </thead>
                <tbody>
                  ${ensayosRows}
                </tbody>
              </table>
            </td>
          </tr>

          ${
            tieneObservaciones
              ? `
          <!-- Observaciones -->
          <tr>
            <td style="padding:24px 36px 0;">
              <div style="background:#fffbeb;padding:8px 12px;margin-bottom:12px;border-radius:4px;border-left:3px solid #f5a623;">
                <p style="margin:0;font-size:11px;font-weight:700;color:#c8102e;text-transform:uppercase;letter-spacing:.5px;">Observaciones</p>
              </div>
              <p style="margin:0;font-size:13px;color:#374151;line-height:1.6;">${cotizacion.observaciones}</p>
            </td>
          </tr>`
              : ''
          }

          <!-- CTA -->
          <tr>
            <td style="padding:32px 36px 0;">
              <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
                Nuestro equipo revisará los antecedentes de tu solicitud y <strong style="color:#111827;">se
                pondrá en contacto contigo a través del número de celular registrado en los datos del
                cotizante</strong>, en caso de requerir información adicional o coordinación.
              </p>
              <p style="margin:10px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
                Posteriormente, recibirás la <strong style="color:#111827;">cotización formal</strong> en el
                correo electrónico registrado.
              </p>
              <p style="margin:14px 0 0;font-size:12px;color:#92400e;line-height:1.6;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:10px 12px;">
                <strong>Importante:</strong> este correo confirma únicamente la recepción de tu solicitud. Los
                ensayos, cantidades, disponibilidad y valores estarán sujetos a revisión y serán confirmados
                mediante la cotización formal.
              </p>
              <p style="margin:16px 0 0;font-size:12px;color:#111827;font-weight:700;">
                N.° de solicitud: <span style="color:#c8102e;">${docCode}</span>
              </p>
              <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
                Saludos,<br/>
                <strong style="color:#111827;">Laboratorio INSITU</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 36px;">
              <table width="100%">
                <tr>
                  <td style="font-size:11px;color:#9ca3af;">
                    Este es un correo generado automáticamente. Por favor no respondas a este mensaje.<br/>
                    © ${new Date().getFullYear()} Laboratorio Insitu · www.laboratorioinsitu.cl
                  </td>
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

/**
 * Envía al CLIENTE el comprobante de recepción de su solicitud de cotización
 * (justo después de enviar el formulario web), con el PDF de la solicitud
 * adjunto. Distinto de sendCotizacionClienteEmail: ese es el envío FORMAL
 * (botones Aceptar/Rechazar) una vez la cotización está FIRMADA por el
 * equipo; este es solo un acuse de recibo inmediato, sin precios finales.
 */
export async function sendSolicitudRecibidaEmail(
  cotizacion: QuotationListItem & { firmaBase64: string | null },
): Promise<void> {
  const destinatario = EMAIL_TEST_OVERRIDE ?? cotizacion.cliente.email;

  logger.info(
    { cotizacionId: cotizacion.id, to: destinatario, testOverride: !!EMAIL_TEST_OVERRIDE },
    'email.service: sendSolicitudRecibidaEmail start',
  );

  const docCode = cotizacion.codigoCotizacion ?? `${String(cotizacion.id + 9999)}-LIA`;

  // PDF adjunto desactivado (2026-08-25): la maqueta oficial de Noe/Manus no lo
  // contempla — fue una decisión provisoria mía antes de tener el diseño
  // final. Dejo la generación lista y comentada por si se pide reactivar.
  //
  // const pdfBuffer = await renderToBuffer(
  //   React.createElement(CotizacionDocument, {
  //     cotizacion,
  //     firmaBase64: cotizacion.firmaBase64,
  //     logoDataUri: loadLogoDataUri(),
  //   }) as React.ReactElement<DocumentProps>,
  // );

  const { error } = await resend.emails.send({
    from: FROM,
    to: [destinatario],
    subject: `Solicitud de Cotización ${docCode} recibida — Laboratorio Insitu`,
    html: buildSolicitudRecibidaEmailHtml(cotizacion, docCode),
    // attachments: [
    //   {
    //     filename: `solicitud-cotizacion-${docCode}.pdf`,
    //     content: pdfBuffer,
    //   },
    // ],
  });

  if (error) {
    logger.error(
      { cotizacionId: cotizacion.id, error },
      'email.service: resend error (solicitud recibida)',
    );
    throw new Error(`Error al enviar email de solicitud recibida: ${error.message}`);
  }

  logger.info(
    { cotizacionId: cotizacion.id, to: destinatario },
    'email.service: sendSolicitudRecibidaEmail OK',
  );
}

// ---------------------------------------------------------------------------
// Email interno — NUEVA cotización → ENCARGADO_ADMINISTRATIVO
// ---------------------------------------------------------------------------

function buildNuevaNotificationHtml(cotizacion: QuotationListItem): string {
  const docCode = cotizacion.codigoCotizacion ?? `${String(cotizacion.id + 9999)}-LIA`;
  const totalEnsayos = cotizacion.detalles.reduce((acc, d) => acc + d.cantidadEnsayos, 0);
  const subtotal = cotizacion.detalles.reduce(
    (acc, d) => acc + parseFloat(d.precioUnitario) * d.cantidadEnsayos * d.cantidadVisitas,
    0,
  );
  const porcentaje = cotizacion.porcentajeAjuste ? parseFloat(cotizacion.porcentajeAjuste) : 0;
  let ajuste = 0;
  if (cotizacion.tipoAjuste === 'DESCUENTO') ajuste = -(subtotal * porcentaje / 100);
  else if (cotizacion.tipoAjuste === 'INCREMENTO') ajuste = subtotal * porcentaje / 100;
  const totalFinal = (subtotal + ajuste).toFixed(2);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nueva Cotización ${docCode} — Laboratorio Insitu</title>
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
                    <p style="margin:0;font-size:14px;font-weight:700;color:#111827;">NOTIFICACIÓN INTERNA</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#c8102e;font-weight:700;">Nº ${docCode}</p>
                    <span style="display:inline-block;margin-top:8px;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">&#x2B50; NUEVA COTIZACIÓN</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Saludo -->
          <tr>
            <td style="padding:28px 36px 0;">
              <p style="margin:0;font-size:15px;color:#111827;">Se ha recibido una nueva solicitud de cotización.</p>
              <p style="margin:10px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
                Ingrese al sistema para revisar, asignar precio y procesar la cotización.
              </p>
            </td>
          </tr>

          <!-- Datos cliente / obra -->
          <tr>
            <td style="padding:24px 36px 0;">
              <div style="background:#fffbeb;padding:8px 12px;margin-bottom:12px;border-radius:4px;border-left:3px solid #f5a623;">
                <p style="margin:0;font-size:11px;font-weight:700;color:#c8102e;text-transform:uppercase;letter-spacing:.5px;">Datos del Solicitante y Obra</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;width:40%;">Empresa / Razón Social</td>
                  <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#111827;">${cotizacion.cliente.giroEmpresa}</td>
                </tr>
                <tr style="background:#f9fafb;">
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Contacto</td>
                  <td style="padding:10px 16px;font-size:12px;color:#111827;">${cotizacion.cliente.nombreContacto}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Email</td>
                  <td style="padding:10px 16px;font-size:12px;color:#111827;">${cotizacion.cliente.email}</td>
                </tr>
                <tr style="background:#f9fafb;">
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Teléfono</td>
                  <td style="padding:10px 16px;font-size:12px;color:#111827;">${cotizacion.cliente.celularContacto}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Obra</td>
                  <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#111827;">${cotizacion.obra.nombreObra}</td>
                </tr>
                <tr style="background:#f9fafb;">
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Ubicación</td>
                  <td style="padding:10px 16px;font-size:12px;color:#111827;">${cotizacion.obra.ubicacionObra}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Ensayos solicitados</td>
                  <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#111827;">${cotizacion.detalles.length} tipo(s) · ${totalEnsayos} ensayo(s)</td>
                </tr>
                <tr style="background:#f9fafb;">
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Total estimado</td>
                  <td style="padding:10px 16px;font-size:14px;font-weight:800;color:#c8102e;">UF ${totalFinal}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer note -->
          <tr>
            <td style="padding:32px 36px 24px;">
              <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;">
                Este es un mensaje automático del sistema de cotizaciones de Laboratorio Insitu.
              </p>
            </td>
          </tr>
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

/**
 * Sends an internal notification to all ENCARGADO_ADMINISTRATIVO users
 * when a quotation is in state NUEVA.
 * Fire-and-forget: the caller should .catch() errors.
 */
export async function sendNuevaNotificationEmail(
  cotizacion: QuotationListItem,
  recipients: string[],
): Promise<void> {
  if (recipients.length === 0) return;

  const docCode = cotizacion.codigoCotizacion ?? `${String(cotizacion.id + 9999)}-LIA`;

  logger.info(
    { cotizacionId: cotizacion.id, recipients },
    'email.service: sendNuevaNotificationEmail start',
  );

  const { error } = await resend.emails.send({
    from: FROM,
    to: recipients,
    subject: `Nueva cotización recibida — ${docCode} — ${cotizacion.obra.nombreObra}`,
    html: buildNuevaNotificationHtml(cotizacion),
  });

  if (error) {
    logger.error(
      { cotizacionId: cotizacion.id, error },
      'email.service: resend error (nueva notification)',
    );
    throw new Error(`Error al enviar notificación NUEVA: ${error.message}`);
  }

  logger.info(
    { cotizacionId: cotizacion.id, recipients },
    'email.service: sendNuevaNotificationEmail OK',
  );
}

// ---------------------------------------------------------------------------
// Email interno — ENVIADA_FIRMA → JEFE_LABORATORIO
// ---------------------------------------------------------------------------

function buildEnviadaFirmaNotificationHtml(cotizacion: QuotationListItem): string {
  const docCode = cotizacion.codigoCotizacion ?? `${String(cotizacion.id + 9999)}-LIA`;
  const subtotal = cotizacion.detalles.reduce(
    (acc, d) => acc + parseFloat(d.precioUnitario) * d.cantidadEnsayos * d.cantidadVisitas,
    0,
  );
  const porcentaje = cotizacion.porcentajeAjuste ? parseFloat(cotizacion.porcentajeAjuste) : 0;
  let ajuste = 0;
  if (cotizacion.tipoAjuste === 'DESCUENTO') ajuste = -(subtotal * porcentaje / 100);
  else if (cotizacion.tipoAjuste === 'INCREMENTO') ajuste = subtotal * porcentaje / 100;
  const totalFinal = (subtotal + ajuste).toFixed(2);

  const condicionPagoLabel: Record<string, string> = {
    PAGO_100: 'Pago 100% anticipado',
    PAGO_50: 'Pago 50% al inicio',
    CREDITO_30_DIAS: 'Crédito a 30 días',
  };
  const condLabel = condicionPagoLabel[cotizacion.condicionPago] ?? cotizacion.condicionPago;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cotización ${docCode} requiere firma — Laboratorio Insitu</title>
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
                    <p style="margin:0;font-size:14px;font-weight:700;color:#111827;">NOTIFICACIÓN INTERNA</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#c8102e;font-weight:700;">Nº ${docCode}</p>
                    <span style="display:inline-block;margin-top:8px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">&#x270D; PENDIENTE DE FIRMA</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Saludo -->
          <tr>
            <td style="padding:28px 36px 0;">
              <p style="margin:0;font-size:15px;color:#111827;">Una cotización ha sido enviada a firma y requiere su atención.</p>
              <p style="margin:10px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
                Ingrese al sistema para revisar el documento y proceder con la firma.
              </p>
            </td>
          </tr>

          <!-- Datos cliente / obra -->
          <tr>
            <td style="padding:24px 36px 0;">
              <div style="background:#fffbeb;padding:8px 12px;margin-bottom:12px;border-radius:4px;border-left:3px solid #f5a623;">
                <p style="margin:0;font-size:11px;font-weight:700;color:#c8102e;text-transform:uppercase;letter-spacing:.5px;">Datos del Cliente y Obra</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;width:40%;">Empresa / Razón Social</td>
                  <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#111827;">${cotizacion.cliente.giroEmpresa}</td>
                </tr>
                <tr style="background:#f9fafb;">
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Contacto</td>
                  <td style="padding:10px 16px;font-size:12px;color:#111827;">${cotizacion.cliente.nombreContacto}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Obra</td>
                  <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#111827;">${cotizacion.obra.nombreObra}</td>
                </tr>
                <tr style="background:#f9fafb;">
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Ubicación</td>
                  <td style="padding:10px 16px;font-size:12px;color:#111827;">${cotizacion.obra.ubicacionObra}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Condición de Pago</td>
                  <td style="padding:10px 16px;font-size:12px;color:#111827;">${condLabel}</td>
                </tr>
                <tr style="background:#f9fafb;">
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Total estimado</td>
                  <td style="padding:10px 16px;font-size:14px;font-weight:800;color:#c8102e;">UF ${totalFinal}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer note -->
          <tr>
            <td style="padding:32px 36px 24px;">
              <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;">
                Este es un mensaje automático del sistema de cotizaciones de Laboratorio Insitu.
              </p>
            </td>
          </tr>
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

/**
 * Sends an internal notification to all JEFE_LABORATORIO users
 * when a quotation transitions to ENVIADA_FIRMA.
 * Fire-and-forget: the caller should .catch() errors.
 */
export async function sendEnviadaFirmaNotificationEmail(
  cotizacion: QuotationListItem,
  recipients: string[],
): Promise<void> {
  if (recipients.length === 0) return;

  const docCode = cotizacion.codigoCotizacion ?? `${String(cotizacion.id + 9999)}-LIA`;

  logger.info(
    { cotizacionId: cotizacion.id, recipients },
    'email.service: sendEnviadaFirmaNotificationEmail start',
  );

  const { error } = await resend.emails.send({
    from: FROM,
    to: recipients,
    subject: `Cotización ${docCode} requiere su firma — ${cotizacion.obra.nombreObra}`,
    html: buildEnviadaFirmaNotificationHtml(cotizacion),
  });

  if (error) {
    logger.error(
      { cotizacionId: cotizacion.id, error },
      'email.service: resend error (enviada_firma notification)',
    );
    throw new Error(`Error al enviar notificación ENVIADA_FIRMA: ${error.message}`);
  }

  logger.info(
    { cotizacionId: cotizacion.id, recipients },
    'email.service: sendEnviadaFirmaNotificationEmail OK',
  );
}

// ---------------------------------------------------------------------------
// Email al CLIENTE — Solicitud de Programación de Ensayos (Fase 2)
// ---------------------------------------------------------------------------

function buildProgramacionEmailHtml(
  cotizacion: QuotationListItem,
  programarUrl: string,
): string {
  const docCode = cotizacion.codigoCotizacion ?? `${String(cotizacion.id + 9999)}-LIA`;
  const totalEnsayos = cotizacion.detalles.reduce((acc, d) => acc + d.cantidadEnsayos, 0);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Programación de Ensayos ${docCode} — Laboratorio Insitu</title>
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
                    <p style="margin:0;font-size:14px;font-weight:700;color:#111827;">PROGRAMACIÓN DE ENSAYOS</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#c8102e;font-weight:700;">N&deg; ${docCode}</p>
                    <span style="display:inline-block;margin-top:8px;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">PAGO VERIFICADO</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Saludo -->
          <tr>
            <td style="padding:28px 36px 0;">
              <p style="margin:0;font-size:15px;color:#111827;">Estimado/a <strong>${cotizacion.cliente.nombreContacto}</strong>,</p>
              <p style="margin:10px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
                Hemos verificado el pago de su cotización para la obra
                <strong style="color:#111827;">${cotizacion.obra.nombreObra}</strong>.
                El siguiente paso es coordinar la fecha y hora de las visitas a terreno para
                realizar los ensayos contratados.
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
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;width:40%;">Empresa / Raz&oacute;n Social</td>
                  <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#111827;">${cotizacion.cliente.giroEmpresa}</td>
                </tr>
                <tr style="background:#f9fafb;">
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Contacto</td>
                  <td style="padding:10px 16px;font-size:12px;color:#111827;">${cotizacion.cliente.nombreContacto}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Obra</td>
                  <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#111827;">${cotizacion.obra.nombreObra}</td>
                </tr>
                <tr style="background:#f9fafb;">
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Ubicaci&oacute;n</td>
                  <td style="padding:10px 16px;font-size:12px;color:#111827;">${cotizacion.obra.ubicacionObra}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-size:12px;color:#6b7280;">Ensayos contratados</td>
                  <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#111827;">${cotizacion.detalles.length} tipo(s) &middot; ${totalEnsayos} ensayo(s)</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 20px;font-size:14px;color:#374151;font-weight:600;text-align:center;">Programe sus visitas y ensayos:</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" bgcolor="#c8102e" style="border-radius:8px;">
                          <a href="${programarUrl}"
                             target="_blank"
                             style="display:block;background:#c8102e;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:8px;letter-spacing:.3px;mso-padding-alt:14px 40px;">
                            <!--[if mso]>&nbsp;<![endif]-->
                            PROGRAMAR VISITAS Y ENSAYOS
                            <!--[if mso]>&nbsp;<![endif]-->
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
                Este enlace es personal e intransferible. Si no puede hacer clic en el bot&oacute;n,
                copie y pegue esta direcci&oacute;n en su navegador:<br/>
                <span style="color:#6b7280;word-break:break-all;">${programarUrl}</span>
              </p>
            </td>
          </tr>

          <!-- Nota legal -->
          <tr>
            <td style="padding:0 36px 24px;">
              <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;">
                Si tiene preguntas, no dude en contactarnos respondiendo este correo o llamando a nuestras oficinas.
              </p>
              <p style="margin:12px 0 0;font-size:12px;color:#6b7280;">
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
                  <td style="font-size:11px;color:#9ca3af;">&copy; ${new Date().getFullYear()} Laboratorio Insitu &middot; www.laboratorioinsitu.cl</td>
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

/**
 * Envia el email al CLIENTE solicitando programar visitas y ensayos.
 * Genera un token HMAC-SHA256 (accion 'PROGRAMAR') embebido en la URL del
 * portal /programar-ensayos del frontend. No adjunta PDF (a diferencia de
 * los otros emails al cliente) — esto es una notificación + CTA, no un
 * documento formal.
 *
 * Si EMAIL_TEST_OVERRIDE está seteado (dev/QA), el correo se envía a esa
 * casilla en vez de al email real del cliente, manteniendo el contenido real.
 */
export async function sendProgramacionEmail(
  cotizacion: QuotationListItem,
  token: string,
): Promise<void> {
  const destinatario = EMAIL_TEST_OVERRIDE ?? cotizacion.cliente.email;

  logger.info(
    { cotizacionId: cotizacion.id, to: destinatario, testOverride: !!EMAIL_TEST_OVERRIDE },
    'email.service: sendProgramacionEmail start',
  );

  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001';
  // Query param, no path segment — mismo patrón que /cotizacion/pago-upload?token=
  // ya usado en insitu-nextjs.
  const programarUrl = `${frontendUrl}/programar-ensayos?token=${encodeURIComponent(token)}`;

  const docCode = cotizacion.codigoCotizacion ?? `${String(cotizacion.id + 9999)}-LIA`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: [destinatario],
    subject: `Programe sus visitas y ensayos — Cotización ${docCode} — Laboratorio Insitu`,
    html: buildProgramacionEmailHtml(cotizacion, programarUrl),
  });

  if (error) {
    logger.error(
      { cotizacionId: cotizacion.id, error },
      'email.service: resend error (programacion)',
    );
    throw new Error(`Error al enviar email de programación: ${error.message}`);
  }

  logger.info(
    { cotizacionId: cotizacion.id, to: destinatario },
    'email.service: sendProgramacionEmail OK',
  );
}
