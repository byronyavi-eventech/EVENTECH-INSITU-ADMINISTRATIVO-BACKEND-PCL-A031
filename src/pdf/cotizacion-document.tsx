import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import path from 'path';
import type { QuotationListItem } from '../services/quotation.service.js';
import {
  AREAS_SERVICIO,
  SERVICIOS_GENERALES,
  NOTAS_SERVICIO,
  CONFIDENCIALIDAD,
  COMPROMISOS,
  ACREDITACIONES,
  TEXTO_ACEPTACION,
} from './cotizacion-constants.js';

// Estilos Originales Modernos adaptados al Logo (Rojo y Amarillo)
const PRIMARY = '#c8102e'; // Rojo del logo
const SECONDARY = '#f5a623'; // Amarillo del logo
const DARK = '#111827';
const MUTED = '#6b7280';
const BORDER = '#e5e7eb';
const BG_LIGHT = '#f9fafb';
const BG_ACCENT = '#fffbeb'; // Amarillo extra claro para fondos

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: DARK,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
    backgroundColor: '#ffffff',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY,
  },
  headerLeft: {
    width: 120,
  },
  logo: {
    width: 100,
    height: 'auto',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  docTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: DARK,
    marginBottom: 4,
  },
  docCodeText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: PRIMARY,
  },
  headerRight: {
    alignItems: 'flex-end',
    width: 120,
  },
  dateText: {
    fontSize: 9,
    color: MUTED,
    fontFamily: 'Helvetica-Bold',
  },
  // Secciones Generales
  section: {
    marginBottom: 16,
  },
  sectionTitleBox: {
    backgroundColor: BG_ACCENT,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: SECONDARY,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: PRIMARY,
    textTransform: 'uppercase',
  },
  paragraph: {
    fontSize: 8,
    color: DARK,
    lineHeight: 1.4,
    marginBottom: 8,
  },
  listItem: {
    fontSize: 8,
    color: DARK,
    lineHeight: 1.4,
    marginBottom: 3,
    paddingLeft: 8,
  },
  // Grid / Cards originales
  grid2: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: BG_LIGHT,
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  fieldLabel: {
    fontSize: 7,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 9,
    color: DARK,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
  },
  fieldValueLight: {
    fontSize: 9,
    color: DARK,
    marginBottom: 8,
  },
  // Tabla original moderna
  table: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: PRIMARY,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    alignItems: 'center',
  },
  tableRowEven: {
    backgroundColor: BG_LIGHT,
  },
  tableCell: {
    fontSize: 8,
    color: DARK,
  },
  tableCellMuted: {
    fontSize: 8,
    color: MUTED,
  },
  // Total
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: PRIMARY,
    gap: 16,
  },
  totalLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: DARK,
  },
  totalValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: PRIMARY,
  },
  // Firmas y Cierre
  signatureBox: {
    marginTop: 30,
    borderTopWidth: 1,
    borderTopColor: DARK,
    width: 200,
    paddingTop: 8,
    alignItems: 'center',
  },
  signatureText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
  },
  signatureImage: {
    width: 120,
    height: 'auto',
    marginBottom: -10,
  },
  footerSection: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerContact: {
    fontSize: 8,
    color: MUTED,
    lineHeight: 1.4,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 7,
    color: MUTED,
  },
});

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function Field({ label, value, bold = false }: { label: string; value: string | null | undefined; bold?: boolean }) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={bold ? styles.fieldValue : styles.fieldValueLight}>{value ?? '—'}</Text>
    </View>
  );
}

// In production the compiled JS lives at dist/pdf/cotizacion-document.js.
// The PNG assets are copied there by the Dockerfile (COPY src/pdf/*.png dist/pdf/).
// In development they sit next to the source file in src/pdf/.
const PDF_ASSETS_DIR =
  process.env.NODE_ENV === 'production'
    ? path.join(process.cwd(), 'dist', 'pdf')
    : path.join(process.cwd(), 'src', 'pdf');

const getImagePath = (name: string) => path.join(PDF_ASSETS_DIR, name);

interface CotizacionDocumentProps {
  cotizacion: QuotationListItem;
  firmaBase64?: string | null;
  logoDataUri?: string;
}

export function CotizacionDocument({ cotizacion, firmaBase64, logoDataUri }: CotizacionDocumentProps) {
  const subtotal = cotizacion.detalles.reduce(
    (acc, d) => acc + parseFloat(d.precioUnitario) * d.cantidadEnsayos * d.cantidadVisitas,
    0,
  );

  // Compute adjusted total
  const porcentaje = cotizacion.porcentajeAjuste ? parseFloat(cotizacion.porcentajeAjuste) : 0;
  let ajuste = 0;
  if (cotizacion.tipoAjuste === 'DESCUENTO') {
    ajuste = -(subtotal * porcentaje / 100);
  } else if (cotizacion.tipoAjuste === 'INCREMENTO') {
    ajuste = subtotal * porcentaje / 100;
  }
  const total = subtotal + ajuste;

  // Condicion de pago label
  const condicionPagoLabel: Record<string, string> = {
    PAGO_100:       'Pago 100% anticipado',
    PAGO_50:        'Pago 50% al inicio',
    CREDITO_30_DIAS: 'Crédito a 30 días',
  };
  const condLabel = condicionPagoLabel[cotizacion.condicionPago] ?? cotizacion.condicionPago;

  const docCode = cotizacion.codigoCotizacion ?? `${String(cotizacion.id + 9999)}-LIA`;

  return (
    <Document
      title={`Cotización ${docCode}`}
      author="Laboratorio Insitu"
      subject="Cotización de servicios de ensayos"
    >
      <Page size="A4" style={styles.page} wrap>
        
        {/* ── HEADER ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {logoDataUri && <Image src={logoDataUri} style={styles.logo} />}
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.docTitle}>COTIZACION DE ENSAYOS Y SERVICIOS</Text>
            <Text style={styles.docCodeText}>Nº {docCode}</Text>
          </View>
          <View style={styles.headerRight}>
             <Text style={styles.dateText}>Fecha de emision: {formatDate(cotizacion.createdAt)}</Text>
          </View>
        </View>

        {/* ── ESTIMADO CLIENTE ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { marginBottom: 4 }]}>ESTIMADO CLIENTE</Text>
          <Text style={styles.paragraph}>
            Laboratorio In Situ que ha definido su marco de acción dentro del ámbito de la construcción, 
            público y privada. Dentro de estos campos se han desarrollado específicamente las áreas de Control de Calidad, 
            a fin de establecer algunos de nuestros servicios, se pueden citar, sin que se limite a ellos, los siguientes:
          </Text>
          <View style={[styles.grid2, { marginTop: 4 }]}>
             <View style={{ flex: 1 }}>
               {AREAS_SERVICIO.slice(0, 4).map((area, idx) => (
                 <Text key={idx} style={styles.listItem}>{area}</Text>
               ))}
             </View>
             <View style={{ flex: 1 }}>
               {AREAS_SERVICIO.slice(4, 8).map((area, idx) => (
                 <Text key={idx} style={styles.listItem}>{area}</Text>
               ))}
             </View>
          </View>
        </View>

        {/* ── DATOS COTIZANTE Y OBRA (Diseño Original) ── */}
        <View style={styles.section}>
          <View style={styles.sectionTitleBox}>
            <Text style={styles.sectionTitle}>Datos Cotizante y Obra</Text>
          </View>
          <View style={styles.grid2}>
            {/* Cliente */}
            <View style={styles.card}>
              <Field label="Empresa / Razón Social" value={cotizacion.cliente.giroEmpresa} bold />
              <Field label="Contacto" value={cotizacion.cliente.nombreContacto} />
              <Field label="Teléfono" value={cotizacion.cliente.celularContacto} />
              <Field label="Email" value={cotizacion.cliente.email} />
              <Field label="Dirección" value={`${cotizacion.cliente.direccionEmpresa}, ${cotizacion.cliente.comuna}`} />
            </View>
            {/* Obra */}
            <View style={styles.card}>
              <Field label="Obra" value={cotizacion.obra.nombreObra} bold />
              <Field label="Ubicación" value={`${cotizacion.obra.ubicacionObra}, ${cotizacion.obra.comuna}, ${cotizacion.obra.region}`} />
              <Field label="Mandante" value={cotizacion.obra.nombreMandante} />
              <Field label="Contratista" value={cotizacion.obra.nombreContratista} />
              {cotizacion.encargado && (
                <Field label="Encargado" value={`${cotizacion.encargado.nombreEncargado} - ${cotizacion.encargado.telefonoEncargado}`} />
              )}
            </View>
          </View>
        </View>

        {/* ── METODOS DE ENSAYO COTIZADOS ── */}
        <View style={styles.section}>
          <View style={styles.sectionTitleBox}>
            <Text style={styles.sectionTitle}>Métodos de Ensayo Cotizados</Text>
          </View>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Tipo de Ensayo</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Área</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Cant.</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Visitas</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: 'right' }]}>P. Unit. (UF)</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: 'right' }]}>Total (UF)</Text>
            </View>
            {cotizacion.detalles.map((d, i) => {
              const rowTotal = parseFloat(d.precioUnitario) * d.cantidadEnsayos * d.cantidadVisitas;
              return (
                <View key={d.id} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowEven : {}]} wrap={false}>
                  <Text style={[styles.tableCell, { flex: 3 }]}>{d.nombreTipoEnsayo}</Text>
                  <Text style={[styles.tableCellMuted, { flex: 2 }]}>{d.nombreArea}</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{d.cantidadEnsayos}</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{d.cantidadVisitas}</Text>
                  <Text style={[styles.tableCellMuted, { flex: 1.5, textAlign: 'right' }]}>{parseFloat(d.precioUnitario).toFixed(2)}</Text>
                  <Text style={[styles.tableCell, { flex: 1.5, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{rowTotal.toFixed(2)}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.totalRow} wrap={false}>
            {cotizacion.tipoAjuste !== 'SIN_AJUSTE' && (
              <>
                <Text style={styles.totalLabel}>SUBTOTAL</Text>
                <Text style={[styles.totalValue, { fontSize: 11, color: MUTED }]}>UF {subtotal.toFixed(2)}</Text>
              </>
            )}
          </View>
          {cotizacion.tipoAjuste !== 'SIN_AJUSTE' && (
            <View style={[styles.totalRow, { borderTopWidth: 0, paddingTop: 2, marginTop: 0 }]} wrap={false}>
              <Text style={styles.totalLabel}>
                {cotizacion.tipoAjuste === 'DESCUENTO' ? `DESCUENTO (${porcentaje}%)` : `INCREMENTO (${porcentaje}%)`}
              </Text>
              <Text style={[styles.totalValue, { fontSize: 11, color: cotizacion.tipoAjuste === 'DESCUENTO' ? '#16a34a' : '#c8102e' }]}>
                {cotizacion.tipoAjuste === 'DESCUENTO' ? '-' : '+'}UF {Math.abs(ajuste).toFixed(2)}
              </Text>
            </View>
          )}
          <View style={styles.totalRow} wrap={false}>
            <Text style={styles.totalLabel}>TOTAL ESTIMADO</Text>
            <Text style={styles.totalValue}>UF {total.toFixed(2)}</Text>
          </View>
        </View>

        {/* ── SERVICIOS ASOCIADOS A LOS ENSAYOS ── */}
        <View style={styles.section} wrap={false}>
          <View style={styles.sectionTitleBox}>
             <Text style={styles.sectionTitle}>5.- Servicios Asociados a los Ensayos</Text>
          </View>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: 40 }]}>Item</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Servicios Generales</Text>
              <Text style={[styles.tableHeaderCell, { width: 60, textAlign: 'right' }]}>Cantidad</Text>
              <Text style={[styles.tableHeaderCell, { width: 80, textAlign: 'right' }]}>Total (U.F.)</Text>
            </View>
            {SERVICIOS_GENERALES.map((srv, i) => (
              <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowEven : {}]}>
                 <Text style={[styles.tableCell, { width: 40 }]}>{srv.item}</Text>
                 <Text style={[styles.tableCell, { flex: 1 }]}>{srv.servicio}</Text>
                 <Text style={[styles.tableCell, { width: 60, textAlign: 'right' }]}>{srv.cantidad}</Text>
                 <Text style={[styles.tableCell, { width: 80, textAlign: 'right' }]}>{srv.total}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── NOTAS DE SERVICIO ── */}
        <View style={styles.section}>
          <View style={styles.sectionTitleBox}>
             <Text style={styles.sectionTitle}>Notas de Servicio</Text>
          </View>
          {NOTAS_SERVICIO.map((nota, i) => (
            <Text key={i} style={styles.listItem}>{nota}</Text>
          ))}
        </View>

        {/* ── CONFIDENCIALIDAD ── */}
        <View style={styles.section} wrap={false}>
          <View style={styles.sectionTitleBox}>
             <Text style={styles.sectionTitle}>Confidencialidad</Text>
          </View>
          {CONFIDENCIALIDAD.map((txt, i) => (
            <Text key={i} style={styles.listItem}>{txt}</Text>
          ))}
        </View>

        {/* ── COMPROMISOS ── */}
        <View style={styles.section} wrap={false}>
          <View style={styles.sectionTitleBox}>
             <Text style={styles.sectionTitle}>Compromisos</Text>
          </View>
          {COMPROMISOS.map((txt, i) => (
            <Text key={i} style={styles.listItem}>{txt}</Text>
          ))}
        </View>

        {/* ── ACREDITACIONES ── */}
        <View style={styles.section} wrap={false}>
          <View style={styles.sectionTitleBox}>
             <Text style={styles.sectionTitle}>Acreditaciones</Text>
          </View>
          {ACREDITACIONES.map((txt, i) => (
            <Text key={i} style={styles.listItem}>{txt}</Text>
          ))}
        </View>

        {/* ── NOTAS COMERCIALES (dinámicas) ── */}
        <View style={styles.section} wrap={false}>
          <View style={styles.sectionTitleBox}>
             <Text style={styles.sectionTitle}>Notas Comerciales</Text>
          </View>
          {/* Condición de pago */}
          <Text style={styles.listItem}>1.- Condición de Pago: {condLabel}.</Text>
          <Text style={styles.listItem}>2.- La emisión de la (O.C.) o carta de servicio implica la aceptación de los términos comerciales y técnicos de esta cotización.</Text>
          <Text style={styles.listItem}>3.- Para la conversión a pesos, se considerará el valor de la UF del día de la emisión del Estado de Pago. (solo si aplica)</Text>
          <Text style={styles.listItem}>4.- Vigencia del Precio: {cotizacion.diasVigenciaToken} días desde el envío de la cotización.</Text>
          {/* Forma de pago + cuentas */}
          <Text style={[styles.listItem, { marginTop: 4 }]}>5.- Forma de Pago: Transferencia Electrónica a razón de:</Text>
          {cotizacion.cuentaPrincipal && (
            <Text style={[styles.listItem, { paddingLeft: 16 }]}>
              • (Principal) {cotizacion.cuentaPrincipal.titular} — RUT {cotizacion.cuentaPrincipal.rut} — {cotizacion.cuentaPrincipal.banco} {cotizacion.cuentaPrincipal.tipoCuenta} N°{cotizacion.cuentaPrincipal.numeroCuenta}
            </Text>
          )}
          {cotizacion.cuentaSecundaria && (
            <Text style={[styles.listItem, { paddingLeft: 16 }]}>
              • (Alternativa) {cotizacion.cuentaSecundaria.titular} — RUT {cotizacion.cuentaSecundaria.rut} — {cotizacion.cuentaSecundaria.banco} {cotizacion.cuentaSecundaria.tipoCuenta} N°{cotizacion.cuentaSecundaria.numeroCuenta}
            </Text>
          )}
          {/* Ajuste */}
          {cotizacion.tipoAjuste !== 'SIN_AJUSTE' && (
            <Text style={[styles.listItem, { marginTop: 4 }]}>
              6.- Ajuste aplicado al total: {cotizacion.tipoAjuste === 'DESCUENTO' ? `Descuento de ${porcentaje}%` : `Incremento de ${porcentaje}%`} (UF {Math.abs(ajuste).toFixed(2)}).
            </Text>
          )}
        </View>

        {/* ── ACEPTACIÓN DEL SERVICIO ── */}
        <View style={styles.section} wrap={false}>
          <View style={styles.sectionTitleBox}>
             <Text style={styles.sectionTitle}>Aceptación del Servicio</Text>
          </View>
          <Text style={[styles.paragraph, { marginTop: 10 }]}>{TEXTO_ACEPTACION}</Text>
          
          <View style={{ alignItems: 'flex-end', marginTop: 40 }}>
             <View style={styles.signatureBox}>
               <Text style={styles.signatureText}>Firma del solicitante</Text>
             </View>
          </View>
        </View>

        {/* ── DESPEDIDA Y FIRMAS ── */}
        <View style={[styles.section, { marginTop: 40 }]} wrap={false}>
          <Text style={styles.paragraph}>Esperando que la presente sea de su conveniencia, le saluda cordialmente,</Text>
          <View style={styles.footerSection}>
            <View style={{ flex: 1 }}>
              {logoDataUri && <Image src={logoDataUri} style={styles.logo} />}
              <Text style={{ fontSize: 7, color: MUTED, marginTop: 4 }}>...Es ver calidad</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.signatureText, { marginBottom: 4 }]}>PAOLA MOSCOSO YUCRA</Text>
              <Text style={styles.footerContact}>Jefe de Laboratorio</Text>
              <Text style={styles.footerContact}>Laboratorio Insitu Ltda.</Text>
              <Text style={styles.footerContact}>Fono: 56 - 57 - 2 2500774</Text>
              <Text style={styles.footerContact}>Av. Union Europea 2831</Text>
              <Text style={[styles.footerContact, { fontFamily: 'Helvetica-Bold' }]}>IQUIQUE</Text>
              <Text style={[styles.footerContact, { color: PRIMARY }]}>www.laboratorioinsitu.cl</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
               {firmaBase64 && firmaBase64.trim() !== '' && (
                 <Image
                   src={`data:image/png;base64,${firmaBase64}`}
                   style={styles.signatureImage}
                 />
               )}
            </View>
          </View>
        </View>

        {/* Numeración de páginas automática de React-PDF */}
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
          `Página ${pageNumber} de ${totalPages}`
        )} fixed />
        
      </Page>
    </Document>
  );
}
