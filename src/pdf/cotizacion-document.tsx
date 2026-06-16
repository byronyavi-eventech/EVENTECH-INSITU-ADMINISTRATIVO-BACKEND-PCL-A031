import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { QuotationListItem } from '../services/quotation.service.js';

//  Estilos

const PRIMARY = '#1a56db';
const DARK = '#111827';
const MUTED = '#6b7280';
const BORDER = '#e5e7eb';
const BG_LIGHT = '#f9fafb';
const BG_ACCENT = '#eff6ff';
const SUCCESS = '#059669';

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
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY,
  },
  headerLeft: {
    flexDirection: 'column',
    gap: 2,
  },
  companyName: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: PRIMARY,
    letterSpacing: 0.5,
  },
  companyTagline: {
    fontSize: 8,
    color: MUTED,
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  docTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: DARK,
  },
  docId: {
    fontSize: 9,
    color: MUTED,
    fontFamily: 'Helvetica',
  },
  statusBadge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: BG_ACCENT,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: PRIMARY,
  },
  statusText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: PRIMARY,
  },
  //  Sección
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: PRIMARY,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: BG_ACCENT,
  },
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
  //  Tabla
  table: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    overflow: 'hidden',
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
  // Columnas tabla
  colEnsayo: { flex: 3 },
  colArea: { flex: 2 },
  colCant: { flex: 1, textAlign: 'right' },
  colVisitas: { flex: 1, textAlign: 'right' },
  colPrecio: { flex: 1.5, textAlign: 'right' },
  colTotal: { flex: 1.5, textAlign: 'right' },
  // Total
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
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
  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  footerText: {
    fontSize: 7,
    color: MUTED,
  },
  footerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: SUCCESS,
  },
  footerBadgeText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: SUCCESS,
  },
  // Observaciones
  obsBox: {
    backgroundColor: BG_LIGHT,
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: BORDER,
    borderLeftWidth: 3,
    borderLeftColor: PRIMARY,
  },
  obsText: {
    fontSize: 8,
    color: DARK,
    lineHeight: 1.5,
  },
});

// Helpers

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function Field({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: string | null | undefined;
  bold?: boolean;
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={bold ? styles.fieldValue : styles.fieldValueLight}>{value ?? '—'}</Text>
    </View>
  );
}

//  Documento

interface CotizacionDocumentProps {
  cotizacion: QuotationListItem;
}

export function CotizacionDocument({ cotizacion }: CotizacionDocumentProps) {
  const total = cotizacion.detalles.reduce(
    (acc, d) => acc + parseFloat(d.precioUnitario) * d.cantidadEnsayos * d.cantidadVisitas,
    0,
  );

  const docCode = cotizacion.codigoCotizacion ?? `COT-${String(cotizacion.id).padStart(5, '0')}`;

  return (
    <Document
      title={`Cotización ${docCode}`}
      author="Laboratorios Insitu"
      subject="Cotización de servicios de ensayos"
    >
      <Page size="A4" style={styles.page}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.companyName}>INSITU</Text>
            <Text style={styles.companyTagline}>Laboratorio de Ensayos y Calidad</Text>
            <Text style={[styles.companyTagline, { marginTop: 6 }]}>laboratorioinsitu.cl</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.docTitle}>COTIZACIÓN</Text>
            <Text style={styles.docId}>{docCode}</Text>
            <Text style={styles.docId}>Fecha: {formatDate(cotizacion.createdAt)}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>✓ ACEPTADA / FIRMADA</Text>
            </View>
          </View>
        </View>

        {/* ── Cliente + Obra ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información del cliente y obra</Text>
          <View style={styles.grid2}>
            {/* Cliente */}
            <View style={styles.card}>
              <Field label="Empresa / Razón Social" value={cotizacion.cliente.giroEmpresa} bold />
              <Field label="RUT" value={cotizacion.cliente.rutEmpresa} />
              <Field
                label="Contacto"
                value={`${cotizacion.cliente.nombreContacto} ${cotizacion.cliente.apellidosContacto}`}
              />
              <Field label="Email" value={cotizacion.cliente.email} />
              <Field label="Teléfono" value={cotizacion.cliente.celularContacto} />
              <Field
                label="Dirección"
                value={`${cotizacion.cliente.direccionEmpresa}, ${cotizacion.cliente.comuna}, ${cotizacion.cliente.region}`}
              />
            </View>
            {/* Obra */}
            <View style={styles.card}>
              <Field label="Nombre de la Obra" value={cotizacion.obra.nombreObra} bold />
              <Field label="Mandante" value={cotizacion.obra.nombreMandante} />
              <Field label="Contratista" value={cotizacion.obra.nombreContratista} />
              <Field
                label="Ubicación"
                value={`${cotizacion.obra.ubicacionObra}, ${cotizacion.obra.comuna}, ${cotizacion.obra.region}`}
              />
              <Field label="Duración estimada" value={`${cotizacion.obra.duracionMeses} meses`} />
              {cotizacion.encargado && (
                <Field
                  label="Encargado de Obra"
                  value={`${cotizacion.encargado.nombreEncargado} — ${cotizacion.encargado.telefonoEncargado}`}
                />
              )}
            </View>
          </View>
        </View>

        {/* ── Ensayos ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detalle de ensayos y servicios</Text>
          <View style={styles.table}>
            {/* Cabecera */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.colEnsayo]}>Tipo de Ensayo</Text>
              <Text style={[styles.tableHeaderCell, styles.colArea]}>Área / Subárea</Text>
              <Text style={[styles.tableHeaderCell, styles.colCant]}>Cant.</Text>
              <Text style={[styles.tableHeaderCell, styles.colVisitas]}>Visitas</Text>
              <Text style={[styles.tableHeaderCell, styles.colPrecio]}>P. Unit. (UF)</Text>
              <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total (UF)</Text>
            </View>
            {/* Filas */}
            {cotizacion.detalles.map((d, i) => {
              const rowTotal = parseFloat(d.precioUnitario) * d.cantidadEnsayos * d.cantidadVisitas;
              return (
                <View key={d.id} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowEven : {}]}>
                  <Text style={[styles.tableCell, styles.colEnsayo]}>{d.nombreTipoEnsayo}</Text>
                  <Text style={[styles.tableCellMuted, styles.colArea]}>
                    {d.nombreArea} › {d.nombreSubarea}
                  </Text>
                  <Text style={[styles.tableCell, styles.colCant]}>{d.cantidadEnsayos}</Text>
                  <Text style={[styles.tableCell, styles.colVisitas]}>{d.cantidadVisitas}</Text>
                  <Text style={[styles.tableCellMuted, styles.colPrecio]}>
                    {parseFloat(d.precioUnitario).toFixed(2)}
                  </Text>
                  <Text
                    style={[styles.tableCell, styles.colTotal, { fontFamily: 'Helvetica-Bold' }]}
                  >
                    {rowTotal.toFixed(2)}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Total */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL ESTIMADO</Text>
            <Text style={styles.totalValue}>UF {total.toFixed(2)}</Text>
          </View>
        </View>

        {/* ── Observaciones ── */}
        {cotizacion.observaciones &&
          cotizacion.observaciones !== '[]' &&
          cotizacion.observaciones.trim() !== '' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Observaciones</Text>
              <View style={styles.obsBox}>
                <Text style={styles.obsText}>{cotizacion.observaciones}</Text>
              </View>
            </View>
          )}

        {/* ── Footer ── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Generado el{' '}
            {new Date().toLocaleDateString('es-CL', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}{' '}
            · laboratorioinsitu.cl
          </Text>
          <View style={styles.footerBadge}>
            <View style={styles.footerBadgeDot} />
            <Text style={styles.footerBadgeText}>Cotización Aceptada</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
