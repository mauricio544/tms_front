import { Message } from '../../../../core/services/message';
import { Component, OnInit, inject, ChangeDetectorRef, ViewContainerRef, TemplateRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { Overlay, OverlayConfig, OverlayModule, OverlayRef } from '@angular/cdk/overlay';
import { PortalModule, TemplatePortal } from '@angular/cdk/portal';
import { UiAlertComponent } from '../../shared/ui/alert/alert';
import { UiConfirmComponent } from '../../shared/ui/confirm/confirm';
import { NgIconComponent, provideIcons } from "@ng-icons/core";
import { heroPencil, heroNoSymbol } from "@ng-icons/heroicons/outline";
import { Utils } from '../../../../core/services/utils';
import { Envios } from '../../../../core/services/envios';
import { Personas } from '../../../../core/services/personas';
import { Puntos as PuntosService } from '../../../../core/services/puntos';
import { DetalleEnvio as DetalleEnvioService } from '../../../../core/services/detalle-envio';
import { Generales } from '../../../../core/services/generales';
import { Comprobantes } from '../../../../core/services/comprobantes';
import { DetallesComprobante } from '../../../../core/services/detalles-comprobante';
import { Movimientos } from '../../../../core/services/movimientos';
import { DetalleMovimientos } from '../../../../core/services/detalle-movimientos';
import { Clientes } from '../../../../core/services/clientes';
import {
  Envio,
  Persona,
  PersonaListItemResponse,
  Puntos as PuntoModel,
  DetalleEnvioCreate,
  General,
  MessageCreate,
  SerieComprobante as SerieComprobanteModel,
  EnvioTrackingPublicLinkRequest,
  EnvioListRead
} from '../../../../core/mapped';
import { Utilitarios } from '../../../../core/services/utilitarios';
import { forkJoin } from 'rxjs';
import { SerieComprobante as SerieComprobanteService } from '../../../../core/services/serie-comprobante';

@Component({
  selector: 'feature-envios',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, UiAlertComponent, UiConfirmComponent, Utils, OverlayModule, PortalModule, NgIconComponent],
  templateUrl: './envios.html',
  styleUrl: './envios.css',
  providers: [provideIcons({ heroPencil, heroNoSymbol })],
})
export class EnviosFeature implements OnInit {
  private readonly enviosSrv = inject(Envios);
  private readonly personasSrv = inject(Personas);
  private readonly puntosSrv = inject(PuntosService);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly overlay = inject(Overlay);
  private readonly vcr = inject(ViewContainerRef);
  private readonly detalleSrv = inject(DetalleEnvioService);
  private readonly generalesSrv = inject(Generales);
  private readonly comprobantesSrv = inject(Comprobantes);
  private readonly detCompSrv = inject(DetallesComprobante);
  private readonly movsSrv = inject(Movimientos);
  private readonly detMovsSrv = inject(DetalleMovimientos);
  private readonly clientesSrv = inject(Clientes);
  private readonly messageSrv = inject(Message);
  private readonly utilSrv = inject(Utilitarios);
  private readonly serieSrv = inject(SerieComprobanteService);
  // Estado principal
  lista_envios: Envio[] = [];
  loading = false;
  error: string | null = null;

  // Vista (tarjetas/tabla) con persistencia
  viewMode: 'cards' | 'table' = 'cards';
  setViewMode(m: 'cards' | 'table') { this.viewMode = m; try { localStorage.setItem('envios.viewMode', m); } catch { } }

  // Filtros y paginación
  search = '';
  fechaFiltro = '';

  pageSize = 8;

  entregaFilter: 'all' | 'delivered' | 'pending' = 'all';

  personaSearchTarget: 'both' | 'remitente' | 'destinatario' = 'both';
  origenFilterId: number | null = null;
  destinoFilterId: number | null = null;

  // Crear/Editar inline
  compInlineForEntrega: boolean = false;
  compEnvioId: number | null = null;
  showCreate = false;
  showEdit = false;
  saving = false;
  saveError: string | null = null;

  // WhatsApp (opcional en creacion)
  sendWhatsapp: boolean = false;
  whatsappPhone: string = '';

  // Confirmación de eliminación
  confirmOpen = false;
  confirmTitle = 'Confirmar eliminación';
  confirmMessage = '';
  pendingDeleteId: number | null = null;
  pendingDeleteLabel = '';

  // Notificaciones
  notif: string | null = null;
  notifType: 'success' | 'error' = 'success';

  // Edición
  editing = false;
  editingId: number | null = null;
  page: number  = 1;
  item: Envio | null = null;

  private tipoNombreById(id: number | null | undefined): string {
    if (id == null) return '';
    const n = Number(id || 0);
    const f = (this.compTipos || []).find((s: any) => Number(this.normalizeTipoComprobante((s as any).tipo_comprobante_sunat)) === n);
    const tipo = f ? this.normalizeTipoComprobante((f as any).tipo_comprobante_sunat) : this.normalizeTipoComprobante(id);
    if (tipo === '01') return 'Factura';
    if (tipo === '03') return 'Boleta';
    return String(id);
  }
  private format2(n: any): string { try { return (Number(n)||0).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2}); } catch { return String(n); } }
  trackingUrl(id: number | null | undefined): string {
    const eid = Number(id || 0);
    if (!eid) return '';
    try { return `${window.location.origin}/tracking/${eid}`; } catch { return `/tracking/${eid}`; }
  }

  private printEtiquetasFor(envio: any, detalles: any[], publicUrl?: string | null) {
    const e: any = envio;
    const dets: any[] = detalles || [];
    if (!e || !dets.length) return;
    const origen = this.getPuntoNombre(e.punto_origen_id);
    const destino = this.getPuntoNombre(e.punto_destino_id);
    const tracking = String(publicUrl || '').trim() || this.trackingUrl(e.id);
    const qr = tracking ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(tracking)}` : '';
    const rows = dets.map((d, i) => {
      const desc = String(d.descripcion || '');
      const qty = Math.max(1, Number(d.cantidad || 0));
      const perUnit = Array.from({ length: qty }).map((_, unitIdx) => `<div class="label">
  <div class="head">
    <div class="title">ETIQUETA ENVIO</div>
    <div class="id">Envio #${e.id || '-'} · ${i + 1}.${unitIdx + 1}</div>
  </div>
  <div class="body">
    <div class="row"><span class="k">Item</span><span class="v">${i + 1}</span></div>
    <div class="row"><span class="k">Descripcion</span><span class="v">${desc}</span></div>
    <div class="row"><span class="k">Cantidad</span><span class="v">1</span></div>
    <div class="row"><span class="k">Origen</span><span class="v">${origen}</span></div>
    <div class="row"><span class="k">Destino</span><span class="v">${destino}</span></div>
  </div>
  <div class="qr">${qr ? `<img src="${qr}" alt="QR" />` : ''}</div>
</div>`).join('');
      return perUnit;
    }).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Etiquetas Envio ${e.id || ''}</title>
<style>
  @page { margin: 8mm; }
  body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:0;}
  .sheet{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .label{border:1px solid #e2e8f0;border-radius:8px;padding:8px;break-inside:avoid;min-height:120px;}
  .head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}
  .title{font-size:12px;font-weight:700;}
  .id{font-size:11px;color:#64748b;}
  .row{display:flex;gap:6px;font-size:11px;margin:2px 0;}
  .k{color:#64748b;min-width:64px;}
  .v{font-weight:600;word-break:break-word;}
  .qr{display:flex;justify-content:flex-end;margin-top:6px;}
  .qr img{width:72px;height:72px;border:1px solid #e2e8f0;padding:3px;}
  @media print { .sheet{grid-template-columns:1fr 1fr;} }
</style>
</head><body>
  <div class="sheet">${rows}</div>
  <script>window.addEventListener('load',()=>{window.print(); setTimeout(()=>window.close(),300)});</script>
</body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open(); w.document.write(html); w.document.close();
  }

  printEtiquetas() {
    this.printEtiquetasFor(this.ticketEnvio, this.ticketDetalles, this.publicTrackingUrl);
  }

  openEtiquetas(item: Envio) {
    const envioId = Number((item as any)?.id || 0);
    if (!envioId) return;
    this.detalleSrv.getDetallesEnvio(envioId).subscribe({
      next: (list: any[]) => { this.printEtiquetasFor(item, list || []); },
      error: () => { this.showNotif('No se pudo cargar el detalle para etiquetas', 'error'); }
    });
  }
  private resolveClientePersonaId(): number {
    const current = Number(this.compClienteId || 0);
    if (current) return current;
    const nro = String(this.compDocNumber || '').trim();
    const tipo = this.compDocType;
    if (!nro || !tipo) return 0;
    const found = (this.personas || []).find(p => (p as any).nro_documento === nro && (p as any).tipo_documento === tipo);
    const id = Number((found as any)?.id || 0);
    if (id) this.compClienteId = id;
    return id;
  }
  private withClienteForComprobante(next: (clienteId: number | null) => void) {
    const personaId = this.resolveClientePersonaId();
    const cia = Number(localStorage.getItem('cia') || 0) || Number(localStorage.getItem('cia_id') || 0);
    if (!personaId || !cia) { next(null); return; }
    const body: any = { persona_id: personaId, cliente_compania_id: cia, rol: 'user_cliente' };
    this.clientesSrv.createCliente(body).subscribe({
      next: (created: any) => { const id = Number((created as any)?.id || 0); next(id || null); },
      error: () => { next(null); }
    });
  }

  private clienteNombreByDocumento(doc: string, useRazon: boolean): string {
    const nro = String(doc || '').trim();
    if (!nro) return '';
    const found = (this.personas || []).find((p: any) => String((p as any).nro_documento || '').trim() === nro);
    if (!found) return '';
    if (useRazon) return String((found as any).razon_social || '').trim();
    const nombre = [String((found as any).nombre || '').trim(), String((found as any).apellido || '').trim()].filter(Boolean).join(' ').trim();
    return nombre;
  }
  private openComprobanteWindow(header: any, detalles: Array<{ numero_item: number; cantidad: number; descripcion: any; precio_unitario: number }>) {
    const c: any = header || {};
    const d = Array.isArray(detalles) ? detalles : []; const fallback = (!d || d.length===0) ? (this.stagedDetalles||[]).map((x:any,i:number)=>({ numero_item: i+1, cantidad: Number((x as any).cantidad)||0, descripcion: (x as any).descripcion, precio_unitario: Number((x as any).precio_unitario)||0 })) : d;
    const tipoKey = this.normalizeTipoComprobante(c?.tipo_comprobante_sunat ?? c?.tipo_comprobante);
    const tipoNombre = (tipoKey ? this.tipoNombreById(Number(tipoKey)) : '').toLowerCase();
    const docTitle = tipoNombre.includes('fact') ? 'Factura' : (tipoNombre.includes('bol') ? 'Boleta' : 'Comprobante');
    const numero = String(c.serie || '-') + '-' + String(c.numero || '-');
    const ruc = String(localStorage.getItem('ruc') || '');
    const razon = String(localStorage.getItem('razon_social') || '');
    const isFactura = tipoKey ? this.isFacturaTipo(tipoKey) : (this.tipoNombreById(Number(c.tipo_comprobante)).toLowerCase().includes("fact"));
            const row = (x: any) => {
      const base = (Number(x.cantidad)||0) * (Number(x.precio_unitario)||0);
      const igvL = isFactura ? base * 0.18 : 0;
      const importe = base + igvL;
      return '<tr class="align-top">' +
        '<td class="border border-gray-300 px-2 py-1 text-center">' + String(x.numero_item||'') + '</td>' +
        '<td class="border border-gray-300 px-2 py-1 text-center">' + this.format2(x.cantidad) + '</td>' +
        '<td class="border border-gray-300 px-2 py-1 text-center">NIU</td>' +
        '<td class="border border-gray-300 px-2 py-1">' + String(x.descripcion||'') + (isFactura ? '<div class="text-[11px] text-gray-600">Afecto al IGV</div>' : '') + '</td>' +
        '<td class="border border-gray-300 px-2 py-1 text-right">' + this.format2(x.precio_unitario) + '</td>' +
        '<td class="border border-gray-300 px-2 py-1 text-right">' + this.format2(igvL) + '</td>' +
        '<td class="border border-gray-300 px-2 py-1 text-right">' + this.format2(importe) + '</td>' +
      '</tr>';
    };
    const rows = fallback.map(row).join("");
    const fechaEmision = this.utilSrv.formatFecha(c.fecha_comprobante || "");
    const fechaPago = this.utilSrv.formatFecha(c.fecha_pago || "");
    const clienteDocumento = String(c.cliente_documento || "-");
    const clienteNombre = this.clienteNombreByDocumento(clienteDocumento, isFactura);
    // Construye filas y totales
    const compRows = (fallback || []).map((x, i) => {
      const cantidad = Number((x as any).cantidad) || 0;
      const v_unit = Number((x as any).precio_unitario) || 0;
      const base = cantidad * v_unit;
      const igv = isFactura ? +(base * 0.18).toFixed(2) : 0;
      const importe = base + igv;
      return { numero_item: (Number((x as any).numero_item) || (i+1)), cantidad, unidad: "NIU", descripcion: (x as any).descripcion, v_unit, igv, importe };
    });
    const baseTotal = compRows.reduce((s,r)=>s + r.cantidad * r.v_unit, 0);
    const igvTotal = isFactura ? +((baseTotal * 0.18).toFixed(2)) : 0;
    const totalTotal = baseTotal + igvTotal;
    this.compRows = compRows;
    this.compTotals = { base: baseTotal, igv: igvTotal, total: totalTotal };
    this.compView = {
      razon, ruc, docTitle, numero, fechaEmision, fechaPago, moneda: "PEN (S/)", formaPago: "-", clienteDocumento, clienteNombre
    };
    this.showComprobante = true;
    try { this.cdr.detectChanges(); } catch {}
    try { this.cdr.detectChanges(); } catch {}
  }// Entrega (overlay)
  entregaOpen = false;
  entregaItem: Envio | null = null;
  entregaClaveInput = '';
  entregaFecha = '';
  entregaSaving = false;
  entregaError: string | null = null;
  private entregaRef: OverlayRef | null = null;
  @ViewChild('entregaTpl') entregaTpl!: TemplateRef<any>;

  // Ticket modal
  showTicket = false;
  ticketEnvio: Envio | null = null;
  ticketDetalles: Array<{ numero_item: number; cantidad: number; descripcion: any; precio_unitario: number }> = [];
  get ticketTotal(): number { return (this.ticketDetalles || []).reduce((s, d) => s + (Number(d.cantidad) || 0) * (Number(d.precio_unitario) || 0), 0); }
  publicTrackingUrl: string | null = null;
  publicTrackingQrUrl: string | null = null;
  publicTrackingLoading = false;
  publicTrackingError: string | null = null;
  openTicket(env: Envio, fromDetalles: Array<{ cantidad: number; descripcion: any; precio_unitario: number }> = []) {
    this.ticketEnvio = env;
    this.ticketDetalles = (fromDetalles || []).map((d, i) => ({ numero_item: i + 1, cantidad: Number(d.cantidad) || 0, descripcion: d.descripcion, precio_unitario: Number(d.precio_unitario) || 0 }));
    this.showTicket = true;
    this.loadPublicTrackingLink(env);
  }
  closeTicket() {
    this.showTicket = false;
    this.ticketEnvio = null;
    this.ticketDetalles = [];
    this.publicTrackingUrl = null;
    this.publicTrackingQrUrl = null;
    this.publicTrackingLoading = false;
    this.publicTrackingError = null;
  }
  private buildPublicTrackingUrl(token: string, ticket: string): string {
    try { return `${window.location.origin}/tracking/publico/${encodeURIComponent(token)}?ticket_numero=${encodeURIComponent(ticket)}`; } catch { return `/tracking/publico/${encodeURIComponent(token)}?ticket_numero=${encodeURIComponent(ticket)}`; }
  }
  private setPublicTrackingUrl(url: string) {
    this.publicTrackingUrl = url;
    this.publicTrackingQrUrl = url ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}` : null;
  }
  loadPublicTrackingLink(envio: Envio | null) {
    this.publicTrackingUrl = null;
    this.publicTrackingQrUrl = null;
    const ticket = String((envio as any)?.ticket_numero || '').trim();
    if (!ticket) {
      this.publicTrackingError = 'No se pudo generar el enlace: ticket inválido';
      this.publicTrackingUrl = null;
      this.publicTrackingQrUrl = null;
      return;
    }
    this.publicTrackingLoading = true;
    this.publicTrackingError = null;
    const payload: EnvioTrackingPublicLinkRequest = { ticket_numero: ticket, expires_minutes: 60 };
    this.enviosSrv.getPublicLink(payload).subscribe({
      next: (res) => {
        this.publicTrackingLoading = false;
        let token = String((res as any)?.token || '').trim();
        if (!token) {
          try {
            const url = String((res as any)?.url || '').trim();
            if (url) {
              const parsed = new URL(url);
              token = String(parsed.searchParams.get('token') || '').trim();
            }
          } catch {}
        }
        if (!token) {
          this.publicTrackingError = 'No se pudo obtener el token del enlace público';
          this.publicTrackingUrl = null;
          this.publicTrackingQrUrl = null;
          return;
        }
        // const url = this.buildPublicTrackingUrl(token, ticket);
        const url = "https://tms.maudev.online/tracking/publico/buscar";
        this.setPublicTrackingUrl(url);
      },
      error: () => {
        this.publicTrackingLoading = false;
        this.publicTrackingError = 'No se pudo generar el enlace público';
        this.publicTrackingUrl = null;
        this.publicTrackingQrUrl = null;
      }
    });
  }
  copyPublicTrackingUrl() {
    const url = String(this.publicTrackingUrl || '').trim();
    if (!url) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => this.showNotif('Enlace copiado')).catch(() => this.showNotif('No se pudo copiar', 'error'));
    } else {
      this.showNotif('No se pudo copiar', 'error');
    }
  }
  // Comprobante modal
  showComprobante = false;
  hasComprobante = false;
  compView: any = { razon: "", ruc: "", docTitle: "", numero: "", fechaEmision: "", fechaPago: "", moneda: "PEN (S/)", formaPago: "-", clienteDocumento: "-" };
  compRows: Array<{ numero_item: number; cantidad: number; unidad: string; descripcion: any; v_unit: number; igv: number; importe: number }> = [];
  compTotals: { base: number; igv: number; total: number } = { base: 0, igv: 0, total: 0 };
  closeComprobante() {
    this.showComprobante = false;
    this.compView = { razon: "", ruc: "", docTitle: "", numero: "", fechaEmision: "", fechaPago: "", moneda: "PEN (S/)", formaPago: "-", clienteDocumento: "-" };
    this.compRows = [];
    this.compTotals = { base: 0, igv: 0, total: 0 };
  }
  private clearPrintMode() {
    try { document.body.classList.remove('print-ticket', 'print-comprobante'); } catch { }
  }
  private setPrintMode(mode: 'ticket' | 'comprobante') {
    this.clearPrintMode();
    try { document.body.classList.add(mode === 'ticket' ? 'print-ticket' : 'print-comprobante'); } catch { }
  }
  @HostListener('window:afterprint')
  onAfterPrint() { this.clearPrintMode(); }
  private escHtml(v: any): string {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  private printTicketWindow() {
    const env: any = this.ticketEnvio as any;
    const dets = Array.isArray(this.ticketDetalles) ? this.ticketDetalles : [];
    if (!env) return;
    const remitente = this.personaLabelById(env?.remitente) || env?.remitente || '-';
    const destinatario = this.personaLabelById(env?.destinatario) || env?.destinatario || '-';
    const origen = this.getPuntoNombre(env?.punto_origen_id);
    const destino = this.getPuntoNombre(env?.punto_destino_id);
    const fecha = this.utilSrv.formatFecha(env?.fecha_envio || '');
    const trackingCode = String(env?.id_tracking || '').trim();
    const qrData = String(this.publicTrackingUrl || '').trim() || trackingCode || String(env?.ticket_numero || '').trim();
    const qrSrc = qrData ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrData)}` : '';
    const rows = dets.map((d: any, i: number) => {
      const n = Number(d?.numero_item || i + 1);
      const c = Number(d?.cantidad || 0);
      const pu = Number(d?.precio_unitario || 0);
      const st = c * pu;
      return `<tr>
  <td>${n}</td>
  <td class="r">${this.format2(c)}</td>
  <td>${this.escHtml(d?.descripcion || '')}</td>
  <td class="r">${this.format2(pu)}</td>
  <td class="r">${this.format2(st)}</td>
</tr>`;
    }).join('');
    const total = this.format2((dets || []).reduce((s: number, d: any) => s + (Number(d?.cantidad) || 0) * (Number(d?.precio_unitario) || 0), 0));
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Ticket ${this.escHtml(env?.ticket_numero || env?.id || '')}</title>
  <style>
    @page { size: 80mm auto; margin: 3mm; }
    html, body { width: 80mm; margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; }
    .wrap { width: 74mm; margin: 0 auto; }
    .h { text-align: center; font-weight: 700; }
    .muted { color: #333; font-size: 10px; }
    .sep { border-top: 1px dashed #000; margin: 6px 0; }
    .row { margin: 2px 0; word-break: break-word; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th, td { padding: 2px 0; border-bottom: 1px dotted #999; vertical-align: top; }
    .r { text-align: right; white-space: nowrap; }
    .tot { margin-top: 4px; text-align: right; font-weight: 700; }
    .qr { margin-top: 6px; text-align: center; }
    .qr img { width: 120px; height: 120px; object-fit: contain; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="h">TICKET DE ENVIO</div>
    <div class="row muted">Ticket: ${this.escHtml(env?.ticket_numero || '-')}</div>
    <div class="row">Remitente: ${this.escHtml(remitente)}</div>
    <div class="row">Destinatario: ${this.escHtml(destinatario)}</div>
    <div class="row">Origen: ${this.escHtml(origen)}</div>
    <div class="row">Destino: ${this.escHtml(destino)}</div>
    <div class="row">Fecha envio: ${this.escHtml(fecha || '-')}</div>
    <div class="sep"></div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th class="r">Cant</th>
          <th>Desc</th>
          <th class="r">P.U.</th>
          <th class="r">Sub</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="tot">Total: ${total}</div>
    ${(trackingCode || qrSrc) ? `<div class="sep"></div><div class="row muted">Código de seguimiento:</div><div class="row">${this.escHtml(trackingCode || '-')}</div>` : ''}
    ${qrSrc ? `<div class="qr"><img src="${qrSrc}" alt="QR tracking"/></div>` : ''}
  </div>
  <script>
    (function () {
      var printed = false;
      function doPrintOnce() {
        if (printed) return;
        printed = true;
        window.print();
      }
      window.addEventListener('load', doPrintOnce, { once: true });
      setTimeout(doPrintOnce, 250);
      window.addEventListener('afterprint', function () { setTimeout(function () { window.close(); }, 120); }, { once: true });
    })();
  </script>
</body>
</html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }
  printTicket() {
    try {
      this.printTicketWindow();
    } catch { }
  }
  private printComprobante80mmWindow() {
    const v: any = this.compView || {};
    const rows = Array.isArray(this.compRows) ? this.compRows : [];
    const totals = this.compTotals || { base: 0, igv: 0, total: 0 };
    const detailRows = rows.map((r: any, i: number) => {
      const n = Number(r?.numero_item || i + 1);
      const c = Number(r?.cantidad || 0);
      const d = String(r?.descripcion || '');
      const u = Number(r?.v_unit || 0);
      const im = Number(r?.importe || 0);
      return `<tr>
  <td>${n}</td>
  <td class="r">${this.format2(c)}</td>
  <td>${this.escHtml(d)}</td>
  <td class="r">${this.format2(u)}</td>
  <td class="r">${this.format2(im)}</td>
</tr>`;
    }).join('');
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Comprobante ${this.escHtml(v?.numero || '')}</title>
  <style>
    @page { size: 80mm auto; margin: 3mm; }
    html, body { width: 80mm; margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; }
    .wrap { width: 74mm; margin: 0 auto; }
    .h { text-align: center; font-weight: 700; }
    .muted { color: #333; font-size: 10px; }
    .sep { border-top: 1px dashed #000; margin: 6px 0; }
    .row { margin: 2px 0; word-break: break-word; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th, td { padding: 2px 0; border-bottom: 1px dotted #999; vertical-align: top; }
    .r { text-align: right; white-space: nowrap; }
    .tot { margin-top: 4px; }
    .tot .line { display: flex; justify-content: space-between; }
    .tot .final { font-weight: 700; font-size: 12px; border-top: 1px dashed #000; padding-top: 3px; margin-top: 3px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="h">${this.escHtml(v?.docTitle || 'Comprobante')}</div>
    <div class="h">${this.escHtml(v?.numero || '-')}</div>
    <div class="sep"></div>
    <div class="row"><b>RUC:</b> ${this.escHtml(v?.ruc || '-')}</div>
    <div class="row"><b>Empresa:</b> ${this.escHtml(v?.razon || '-')}</div>
    <div class="row"><b>Cliente Doc:</b> ${this.escHtml(v?.clienteDocumento || '-')}</div>
    <div class="row"><b>Cliente:</b> ${this.escHtml(v?.clienteNombre || '-')}</div>
    <div class="row"><b>F. Emisión:</b> ${this.escHtml(v?.fechaEmision || '-')}</div>
    <div class="row"><b>F. Pago:</b> ${this.escHtml(v?.fechaPago || '-')}</div>
    <div class="row"><b>Forma Pago:</b> ${this.escHtml(v?.formaPago || '-')}</div>
    <div class="sep"></div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th class="r">Cant</th>
          <th>Descripción</th>
          <th class="r">V.U.</th>
          <th class="r">Imp</th>
        </tr>
      </thead>
      <tbody>${detailRows}</tbody>
    </table>
    <div class="tot">
      <div class="line"><span>Op. Gravadas</span><span>${this.format2(totals.base)}</span></div>
      ${Number(totals.igv || 0) > 0 ? `<div class="line"><span>IGV</span><span>${this.format2(totals.igv)}</span></div>` : ''}
      <div class="line final"><span>Total</span><span>${this.format2(totals.total)}</span></div>
    </div>
  </div>
  <script>
    (function () {
      var printed = false;
      function doPrintOnce() {
        if (printed) return;
        printed = true;
        window.print();
      }
      window.addEventListener('load', doPrintOnce, { once: true });
      setTimeout(doPrintOnce, 250);
      window.addEventListener('afterprint', function () { setTimeout(function () { window.close(); }, 120); }, { once: true });
    })();
  </script>
</body>
</html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }
  printComprobante() {
    try {
      this.printComprobante80mmWindow();
    } catch { }
  }

  private loadComprobanteForEnvio(envioId: number) {
    this.comprobantesSrv.getComprobanteEnvio(envioId).subscribe({
      next: (comp: any) => {
        const compHeader: any = comp && typeof comp === 'object' ? comp : null;
        const compId = Number((compHeader as any)?.id || 0);
        if (!compId) {
          this.showNotif('No se encontro comprobante para este envio', 'error');
          this.hasComprobante = false;
          return;
        }
        this.hasComprobante = true;
        this.detCompSrv.getDetalles(compId).subscribe({
          next: (list: any[]) => {
            const detalles = (list || []).map((d: any, i: number) => ({
              numero_item: Number(d?.numero_item ?? i + 1),
              cantidad: Number(d?.cantidad) || 0,
              descripcion: (d?.descripcion as any),
              precio_unitario: Number(d?.precio_unitario) || 0,
            }));
            this.openComprobanteWindow(compHeader, detalles);
          },
          error: () => {
            this.openComprobanteWindow(compHeader, []);
          }
        });
      },
      error: () => {
        this.showNotif('No se pudo cargar el comprobante', 'error');
        this.hasComprobante = false;
      }
    });
  }


  // Envío en edición/creación
  newEnvio: Partial<Envio> = {
    remitente: null as any,
    destinatario: null as any,
    entrega_domicilio: false,
    direccion_envio: '',
    estado_pago: false,
    clave_recojo: '',
    peso: null as any,
    fecha_envio: '',
    fecha_recepcion: '',
    tipo_contenido: false,
    guia: null as any,
    manifiesto: null as any,
    valida_restricciones: false,
    punto_origen_id: null as any,
    punto_destino_id: null as any,
  } as any;
  destinatarioCelular = '';
  confirmClaveRecojo = '';

  // Detalle de envío (creación)
  stagedDetalles: Array<{ cantidad: number; descripcion: any; precio_unitario: number }> = [];
  detallesLoading: boolean = false;
  newDet: { cantidad: number | null; descripcion: string; precio_unitario: number | null } = { cantidad: null, descripcion: '', precio_unitario: null };
  get stagedSubtotal(): number { return this.stagedDetalles.reduce((s, d) => s + (Number(d.cantidad) || 0) * (Number(d.precio_unitario) || 0), 0); }
  addDetalle() {
    const c = Number(this.newDet.cantidad);
    const p = Number(this.newDet.precio_unitario);
    const desc = (this.newDet.descripcion || '').toString().trim();
    if (!c || !p || !desc) return;
    this.stagedDetalles.push({ cantidad: c, precio_unitario: p, descripcion: desc });
    this.newDet = { cantidad: null, descripcion: '', precio_unitario: null };
  }
  removeDetalle(i: number) { this.stagedDetalles.splice(i, 1); }

  // Personas (autocomplete)
  personas: Persona[] = [];
  personasLoading = false;
  personasError: string | null = null;
  remitenteQuery = '';
  destinatarioQuery = '';
  showRemitenteOptions = false;
  showDestinatarioOptions = false;

  // Doc lookup (crear si no existe) - remitente/destinatario
  remitenteDocType: 'RUC' | 'DNI' | 'CE' | 'P' = 'DNI';
  remitenteDocNumber: string = '';
  remitenteNombre: string = '';
  remitenteApellido: string = '';
  destinatarioDocType: 'RUC' | 'DNI' | 'CE' | 'P' = 'DNI';
  destinatarioDocNumber: string = '';
  destinatarioNombre: string = '';
  destinatarioApellido: string = '';
  remLookupLoading = false; remLookupError: string | null = null;
  destLookupLoading = false; destLookupError: string | null = null;
  remitenteCredito: PersonaListItemResponse | null = null;
  remitenteCreditoLoading = false;
  remitenteCreditoError: string | null = null;

  // Comprobante (creaciÃ³n cuando pagado)
  compTipos: SerieComprobanteModel[] = [];
  payTipos: General[] = [];
  compTipoSel: SerieComprobanteModel | null = null;
  compTipoId: number | null = null;
  compSerie: string = '';
  compCorrelativo: number = 0;
  compNumero: string = '';
  compNumeroComprobante: string = '';
  compFormaPagoId: number | null = null;
  compFechaPago: string = this.utilSrv.formatFecha(new Date());
  compDocType: 'RUC' | 'DNI' = 'DNI';
  compDocNumber: string = '';
  compClienteId: number | null = null;
  compLookupLoading = false; compLookupError: string | null = null;
  get compImpuesto(): number { const total = this.stagedSubtotal || 0; return this.compTipoNombre().toLowerCase().includes('fact') ? +(total * 0.18).toFixed(2) : 0; }
  get compTotal(): number { return this.stagedSubtotal || 0; }
  get compTotalConImpuesto(): number { return this.compTipoNombre().toLowerCase().includes('fact') ? (this.compTotal + this.compImpuesto) : this.compTotal; }
  compTipoNombre(): string {
    const t = this.compTipoSel || this.compTipos.find(x => Number(this.normalizeTipoComprobante((x as any).tipo_comprobante_sunat)) === Number(this.compTipoId)) || null;
    const tipo = t ? this.normalizeTipoComprobante((t as any).tipo_comprobante_sunat) : '';
    if (tipo === '01') return 'Factura';
    if (tipo === '03') return 'Boleta';
    return '';
  }
  private pad6(n: number): string { const s = String(n || 0); return s.padStart(6, '0'); }
  private normalizeTipoComprobante(value: any): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    return raw.length === 1 ? `0${raw}` : raw;
  }
  private isFacturaTipo(value: any): boolean {
    return this.normalizeTipoComprobante(value) === '01';
  }
  compTipoLabel(t: SerieComprobanteModel): string {
    const tipo = this.normalizeTipoComprobante((t as any).tipo_comprobante_sunat);
    const nombre = tipo === '01' ? 'Factura' : (tipo === '03' ? 'Boleta' : 'Comprobante');
    return `${nombre} - ${t.serie}`;
  }
  private bumpComprobanteSerie() {
    const current = this.compTipoSel || this.compTipos.find(x => Number(this.normalizeTipoComprobante((x as any).tipo_comprobante_sunat)) === Number(this.compTipoId)) || null;
    if (!current) return;
    const nextCorr = (Number(current.correlativo || 0) || 0) + 1;
    const body: SerieComprobanteModel = { ...current, correlativo: nextCorr };
    this.serieSrv.updateSeries(Number(current.id), body).subscribe({
      next: () => {
        current.correlativo = nextCorr;
        if (this.compTipoSel && Number(this.compTipoSel.id) === Number(current.id)) {
          this.compCorrelativo = nextCorr;
          this.compNumero = this.pad6(this.compCorrelativo);
          this.compNumeroComprobante = this.compSerie ? `${this.compSerie}-${this.compNumero}` : '';
        }
      },
      error: () => { this.showNotif('Comprobante generado, pero no se pudo actualizar la serie', 'error'); }
    });
  }
  private compTipoSunat(): string {
    const t = this.compTipoSel || this.compTipos.find(x => Number(this.normalizeTipoComprobante((x as any).tipo_comprobante_sunat)) === Number(this.compTipoId)) || null;
    return t ? this.normalizeTipoComprobante((t as any).tipo_comprobante_sunat) : '';
  }
  private buildComprobantePayload(envioId: number, clienteId: number | null) {
    const tipoSunat = this.compTipoSunat();
    const totalIgv = tipoSunat === '01' ? 18 : 0;
    const fecha = this.currentDateTMS();
    return {
      tipo_comprobante_sunat: tipoSunat,
      numero_comprobante: this.compNumeroComprobante,
      forma_pago: this.compFormaPagoId || 0,
      precio_total: this.compTotalConImpuesto,
      fecha_comprobante: fecha,
      fecha_emision: fecha,
      impuesto: this.compImpuesto,
      total_igv: totalIgv,
      tipo_moneda: 'PEN',
      serie: this.compSerie,
      numero: this.compNumero,
      estado_comprobante: '',
      fecha_pago: this.compFechaPago || fecha,
      emisor: Number(localStorage.getItem('cia_id') || 0),
      cliente: clienteId,
      emisor_ruc: String(localStorage.getItem('ruc') || ''),
      cliente_documento: this.compDocNumber || '',
      envio_id: envioId
    } as any;
  }
  onCompTipoChange(selected?: any) {
    if (selected && typeof selected === 'object') {
      this.compTipoSel = selected as SerieComprobanteModel;
    } else if (selected != null) {
      this.compTipoId = Number(selected);
      this.compTipoSel = this.compTipos.find(x => Number(this.normalizeTipoComprobante((x as any).tipo_comprobante_sunat)) === this.compTipoId) || null;
    } else if (!this.compTipoSel && this.compTipoId != null) {
      this.compTipoSel = this.compTipos.find(x => Number(this.normalizeTipoComprobante((x as any).tipo_comprobante_sunat)) === Number(this.compTipoId)) || null;
    }
    const t: any = this.compTipoSel;
    const tipo = t ? this.normalizeTipoComprobante((t as any).tipo_comprobante_sunat) : '';
    this.compTipoId = Number(tipo || 0);
    this.compSerie = (t?.serie || '').toString();
    this.compCorrelativo = Number(t?.correlativo || 0);
    this.compNumero = this.pad6(this.compCorrelativo);
    this.compNumeroComprobante = this.compSerie ? `${this.compSerie}-${this.compNumero}` : '';
    this.compDocType = this.isFacturaTipo(tipo) ? 'RUC' : 'DNI';
    this.compDocNumber = '';
    this.compClienteId = null;
  }

  onOrigenChange(val: any) {
    try {
      const v = Number(val);
      if (v && Number(this.newEnvio.punto_destino_id) === v) {
        this.newEnvio.punto_destino_id = null as any;
      }
    } catch {}
  }
  onDestinoChange(val: any) {
    try {
      const v = Number(val);
      if (v && Number(this.newEnvio.punto_origen_id) === v) {
        this.newEnvio.punto_origen_id = null as any;
      }
    } catch {}
  }

  private normalizeDate(d: any): string {
    try {
      if (!d) return "";
      if (d instanceof Date) return d.toISOString().slice(0,10);
      const s = String(d);
      if (s.length >= 10) return s.slice(0,10);
      return s;
    } catch { return ""; }
  }

  // Nombres de puntos
  puntos: PuntoModel[] = [];
  puntosLoading = false;
  puntosError: string | null = null;
  getPuntoNombre(id: number | null | undefined): string {
    const p = (this.puntos || []).find(x => (x as any).id === Number(id));
    return p ? (p as any).nombre.toUpperCase() : (id != null ? String(id) : '-');
  }

  // Lista filtrada y paginaciÃ³n
  get filteredEnvios(): Envio[] {
    const term = (this.search || '').trim().toLowerCase();
    return (this.lista_envios || []).filter((e: any) => {
      const entregado = !!(e?.fecha_recepcion || e?.estado_entrega);
      if (this.entregaFilter === 'delivered' && !entregado) return false;
      if (this.entregaFilter === 'pending' && entregado) return false;
      if (!term) { if (this.origenFilterId && Number(e.punto_origen_id) !== Number(this.origenFilterId)) return false; if (this.destinoFilterId && Number(e.punto_destino_id) !== Number(this.destinoFilterId)) return false; return true; }
      const remit = (this.personaLabelById(e?.remitente) || '').toLowerCase();
      const dest = (this.personaLabelById(e?.destinatario) || '').toLowerCase();
      const values = [
        String(e.remitente ?? ''), String(e.destinatario ?? ''), remit, dest,
        String(e.peso ?? ''), String(e.fecha_envio ?? ''), String(e.punto_origen_id ?? ''), String(e.punto_destino_id ?? ''),
        String(e.ticket_numero ?? ''), String(e.guia ?? ''), String(e.manifiesto ?? ''), String(e.clave_recojo ?? ''),
      ].join(' ').toLowerCase();
      if (this.origenFilterId && Number(e.punto_origen_id) !== Number(this.origenFilterId)) return false; if (this.destinoFilterId && Number(e.punto_destino_id) !== Number(this.destinoFilterId)) return false; if (this.personaSearchTarget === 'remitente') return remit.includes(term); if (this.personaSearchTarget === 'destinatario') return dest.includes(term); return remit.includes(term) || dest.includes(term) || values.includes(term);
    });
  }
  get total(): number { return this.filteredEnvios.length; }
  get totalPages(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }
  get pageItems(): Envio[] { const start = (this.page - 1) * this.pageSize; return this.filteredEnvios.slice(start, start + this.pageSize); }
  get pageStart(): number { return this.total ? (this.page - 1) * this.pageSize + 1 : 0; }
  get pageEnd(): number { return Math.min(this.page * this.pageSize, this.total); }
  setPage(n: number) { this.page = Math.min(Math.max(1, n), this.totalPages); }
  onFilterChange() { this.page = 1; }
  onFechaFilterChange() {
    this.onFilterChange();
    this.loadEnvios();
  }
  clearFechaFilter() {
    if (!this.fechaFiltro) return;
    this.fechaFiltro = '';
    this.onFechaFilterChange();
  }
  resetFilters() { this.search = ''; this.entregaFilter = 'all'; this.fechaFiltro = ''; this.setPage(1); this.loadEnvios(); }

  // Autocomplete personas helpers
  get filteredRemitentes(): Persona[] { const q = (this.remitenteQuery || '').toLowerCase().trim(); const list = this.personas || []; if (!q) return list.slice(0, 10); return list.filter(p => this.personaLabel(p).toLowerCase().includes(q)).slice(0, 10); }
  get filteredDestinatarios(): Persona[] { const q = (this.destinatarioQuery || '').toLowerCase().trim(); const list = this.personas || []; if (!q) return list.slice(0, 10); return list.filter(p => this.personaLabel(p).toLowerCase().includes(q)).slice(0, 10); }
  personaLabel(p: Persona): string { const nombre = [p.nombre, p.apellido].filter(Boolean).join(' ').trim(); const razon = (p.razon_social || '').trim(); const base = (razon || nombre || '').trim(); const doc = (p.nro_documento || '').trim(); return [base, doc].filter(Boolean).join(' - '); }
  personaLabelById(id: any): string | null { const n = Number(id); if (!n) return null; const p = (this.personas || []).find(x => (x as any).id === n); return p ? this.personaLabel(p) : null; }
  personaCelularById(id: any): string | null { const n = Number(id); if (!n) return null; const p = (this.personas || []).find(x => (x as any).id === n); return p ? String((p as any).celular || '') : null; }
  private resetRemitenteCredito() { this.remitenteCredito = null; this.remitenteCreditoLoading = false; this.remitenteCreditoError = null; }
  private loadRemitenteCreditoByDoc(nro: string) {
    const doc = String(nro || '').trim();
    if (!doc) { this.resetRemitenteCredito(); return; }
    this.remitenteCreditoLoading = true;
    this.remitenteCreditoError = null;
    const query = `q=${encodeURIComponent(doc)}`;
    this.personasSrv.getPersonaComplete(query).subscribe({
      next: (res: any) => {
        const item = (res?.items || [])[0] || null;
        this.remitenteCredito = item;
        this.remitenteCreditoLoading = false;
      },
      error: () => {
        this.remitenteCreditoLoading = false;
        this.remitenteCredito = null;
        this.remitenteCreditoError = 'No se pudo validar el crédito del remitente';
      }
    });
  }
  private normalizePhone(value: string): string { return String(value || '').replace(/\D/g, ''); }
  canSendText(item: Envio): boolean {
    const cel = this.personaCelularById((item as any)?.destinatario) || '';
    return !!this.normalizePhone(cel);
  }
  canConfirmEntrega(item: Envio): boolean {
    if (!item) return false;
    if (!!(item as any)?.fecha_recepcion) return false;
    const estado = String((item as any)?.estado_envio || '').trim().toUpperCase();
    if (estado !== 'EN PROCESO DE ENTREGA') return false;
    const sedeId = this.getUserSedeId();
    if (sedeId <= 0) return false;
    return Number((item as any)?.punto_destino_id || 0) === sedeId;
  }
  sendEnvioText(item: Envio, ev?: Event) {
    try { ev?.preventDefault(); ev?.stopPropagation(); } catch {}
    const envioId = Number((item as any)?.id || 0);
    if (!envioId) return;
    const celRaw = this.personaCelularById((item as any)?.destinatario) || '';
    const digits = this.normalizePhone(celRaw);
    if (!digits) { this.showNotif('Destinatario sin celular', 'error'); return; }
    const to = (digits.length > 9 && digits.startsWith('51')) ? `+${digits}` : `+51${digits}`;
    const estado = String((item as any)?.estado_envio || '').trim() || '-';
    const tracking = String((item as any)?.id_tracking || '').trim() || '-';
    const msg = `Tienes un envío\nEstado envío: ${estado}\nCódigo de seguimiento: ${tracking}`;
    const body: MessageCreate = { to, message: msg, envio_id: envioId };
    this.messageSrv.sendText(body).subscribe({
      next: () => { this.showNotif('Mensaje enviado'); },
      error: () => { this.showNotif('No se pudo enviar el mensaje', 'error'); }
    });
  }
  private updateDestinatarioCelular(destinatarioId: number, celular: string, next: () => void) {
    if (!destinatarioId || !celular) { next(); return; }
    const current = this.personaCelularById(destinatarioId) || '';
    if (current === celular) { next(); return; }
    this.personasSrv.updatePersona(destinatarioId, { celular }).subscribe({
      next: (res: any) => {
        this.personas = (this.personas || []).map((p: any) => (Number(p.id) === destinatarioId ? { ...p, ...res } : p));
        next();
      },
      error: () => {
        this.showNotif('No se pudo actualizar el celular del destinatario', 'error');
        next();
      }
    });
  }

  private getUserSedeId(): number {
    try {
      const raw = localStorage.getItem('me');
      if (!raw) return 0;
      const me = JSON.parse(raw) as any;
      const sede = Array.isArray(me?.sedes) ? me.sedes[0] : null;
      return Number(sede?.id || 0);
    } catch {
      return 0;
    }
  }

  private getCurrentMe(): any | null {
    try {
      const raw = localStorage.getItem('me');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private useSedeEndpointByRole(): boolean {
    if (this.isAdminRole()) return false;
    const me = this.getCurrentMe();
    const roles = Array.isArray(me?.roles) ? me.roles : [];
    const roleNames = roles.map((r: any) =>
      String(
        r?.name ??
        r?.nombre ??
        r?.rol ??
        r?.role ??
        r
      ).toLowerCase().trim()
    );
    return roleNames.includes('operario') || roleNames.includes('admin_sede') || roleNames.includes('adm_sede');
  }

  private getRoleNames(): string[] {
    const me = this.getCurrentMe();
    const roles = Array.isArray(me?.roles) ? me.roles : [];
    return roles.map((r: any) =>
      String(
        r?.name ??
        r?.nombre ??
        r?.rol ??
        r?.role ??
        r
      ).toLowerCase().trim()
    );
  }

  private isAdminRole(): boolean {
    return this.getRoleNames().includes('admin');
  }

  private applyDefaultOrigen() {
    if (this.editing) return;
    if (Number((this.newEnvio as any)?.punto_origen_id || 0)) return;
    const sedeId = this.getUserSedeId();
    if (sedeId) { (this.newEnvio as any).punto_origen_id = sedeId; }
  }
  private pickTicketSerie(series: SerieComprobanteModel[]): SerieComprobanteModel | null {
    const sedeId = this.getUserSedeId();
    if (!sedeId) return null;
    return (series || []).find(s => {
      const sameSede = Number(s.sede_id) === sedeId;
      const tipo = (s as any).tipo_comprobante_sunat;
      const isTicketSerie = tipo == null || String(tipo).trim() === '';
      return sameSede && isTicketSerie;
    }) || null;
  }
  private buildTicketNumero(serie: SerieComprobanteModel): string {
    const correlativo = Number(serie.correlativo || 0);
    return `${serie.serie}-${correlativo}`;
  }

  private syncDestinatarioCelular() {
    const destId = Number((this.newEnvio as any)?.destinatario || 0);
    if (!destId || (this.destinatarioCelular || '').trim()) return;
    const celular = this.personaCelularById(destId) || '';
    if (celular) this.destinatarioCelular = celular;
  }
  selectRemitente(p: Persona) {
    (this.newEnvio as any).remitente = (p as any).id;
    this.remitenteQuery = this.personaLabel(p);
    this.showRemitenteOptions = false;
    this.remitenteDocType = ((p as any).tipo_documento || this.remitenteDocType) as any;
    this.remitenteDocNumber = String((p as any).nro_documento || this.remitenteDocNumber || '');
    this.remitenteNombre = String((p as any).nombre || '');
    this.remitenteApellido = String((p as any).apellido || '');
    this.loadRemitenteCreditoByDoc(String((p as any).nro_documento || ''));
  }
  selectDestinatario(p: Persona) {
    (this.newEnvio as any).destinatario = (p as any).id;
    this.destinatarioQuery = this.personaLabel(p);
    this.destinatarioDocType = ((p as any).tipo_documento || this.destinatarioDocType) as any;
    this.destinatarioDocNumber = String((p as any).nro_documento || this.destinatarioDocNumber || '');
    this.destinatarioNombre = String((p as any).nombre || '');
    this.destinatarioApellido = String((p as any).apellido || '');
    this.destinatarioCelular = String((p as any).celular || '');
    this.showDestinatarioOptions = false;
  }
  clearRemitente() {
    (this.newEnvio as any).remitente = null as any;
    this.remitenteQuery = '';
    this.remitenteNombre = '';
    this.remitenteApellido = '';
    this.resetRemitenteCredito();
  }
  clearDestinatario() {
    (this.newEnvio as any).destinatario = null as any;
    this.destinatarioQuery = '';
    this.destinatarioNombre = '';
    this.destinatarioApellido = '';
  }

  isSpecialDocType(type: any): boolean { return type === 'CE' || type === 'P'; }
  private buildPersonaFromRUC(data: any): Partial<Persona> { return { nombre: '', apellido: '', razon_social: (data?.razon_social || '').toString(), direccion: (data?.direccion || '').toString(), celular: '', email: '', nro_documento: (data?.numero_documento || '').toString(), tipo_documento: 'RUC' } as any; }
  private buildPersonaFromDNI(data: any): Partial<Persona> { const nombre = (data?.first_name || '').toString(); const ap1 = (data?.first_last_name || '').toString(); const ap2 = (data?.second_last_name || '').toString(); return { nombre, apellido: [ap1, ap2].filter(Boolean).join(' ').trim(), razon_social: '', direccion: '', celular: '', email: '', nro_documento: (data?.document_number || '').toString(), tipo_documento: 'DNI' } as any; }
  private buildPersonaFromSpecial(type: 'CE' | 'P', nroDocumento: string, nombre: string, apellido: string): Partial<Persona> {
    return {
      nombre: String(nombre || '').trim(),
      apellido: String(apellido || '').trim(),
      razon_social: '',
      direccion: '',
      celular: '',
      email: '',
      nro_documento: String(nroDocumento || '').trim(),
      tipo_documento: type
    } as any;
  }
  private isValidDoc(type: 'RUC' | 'DNI' | 'CE' | 'P', nro: string): boolean {
    if (type === 'CE' || type === 'P') return String(nro || '').trim().length > 0;
    const d = (nro || '').replace(/[^0-9]/g, '');
    return type === 'RUC' ? d.length === 11 : d.length === 8;
  }
  lookupRemitente() {
    this.remLookupError = null; const type = this.remitenteDocType; const nro = (this.remitenteDocNumber || '').trim();
    if (!type || !nro) { this.remLookupError = 'Ingrese tipo y numero'; return; }
    if (!this.isValidDoc(type, nro)) { this.remLookupError = (type === 'RUC' ? 'RUC debe tener 11 digitos' : 'DNI debe tener 8 digitos'); return; }
    const found = (this.personas || []).find(p => (p as any).nro_documento === nro && (p as any).tipo_documento === type);
    if (found) { this.selectRemitente(found); return; }
    if (this.isSpecialDocType(type)) {
      const nombre = String(this.remitenteNombre || '').trim();
      const apellido = String(this.remitenteApellido || '').trim();
      if (!nombre || !apellido) { this.remLookupError = 'Ingrese nombre y apellido'; return; }
      this.remLookupLoading = true;
      const body = this.buildPersonaFromSpecial(type as any, nro, nombre, apellido);
      this.personasSrv.createPersona(body).subscribe({
        next: (created: any) => { this.personas = [created as any, ...this.personas]; this.selectRemitente(created as any); this.remLookupLoading = false; },
        error: () => { this.remLookupLoading = false; this.remLookupError = 'No se pudo crear'; }
      });
      return;
    }
    this.remLookupLoading = true;
    if (type === 'RUC') {
      this.personasSrv.getDatosRUC(type, nro).subscribe({ next: (data: any) => { const body = this.buildPersonaFromRUC(data); if (!(body as any).nro_documento) { this.remLookupLoading = false; this.remLookupError = 'No encontrado'; return; } this.personasSrv.createPersona(body).subscribe({ next: (created: any) => { this.personas = [created as any, ...this.personas]; this.selectRemitente(created as any); this.remLookupLoading = false; }, error: () => { this.remLookupLoading = false; this.remLookupError = 'No se pudo crear'; } }); }, error: () => { this.remLookupLoading = false; this.remLookupError = 'No encontrado'; } });
    } else {
      this.personasSrv.getDatosDNI(type, nro).subscribe({ next: (data: any) => { const body = this.buildPersonaFromDNI(data); if (!(body as any).nro_documento) { this.remLookupLoading = false; this.remLookupError = 'No encontrado'; return; } this.personasSrv.createPersona(body).subscribe({ next: (created: any) => { this.personas = [created as any, ...this.personas]; this.selectRemitente(created as any); this.remLookupLoading = false; }, error: () => { this.remLookupLoading = false; this.remLookupError = 'No se pudo crear'; } }); }, error: () => { this.remLookupLoading = false; this.remLookupError = 'No encontrado'; } });
    }
  }
  lookupDestinatario() {
    this.destLookupError = null; const type = this.destinatarioDocType; const nro = (this.destinatarioDocNumber || '').trim();
    if (!type || !nro) { this.destLookupError = 'Ingrese tipo y numero'; return; }
    if (!this.isValidDoc(type, nro)) { this.destLookupError = (type === 'RUC' ? 'RUC debe tener 11 digitos' : 'DNI debe tener 8 digitos'); return; }
    const found = (this.personas || []).find(p => (p as any).nro_documento === nro && (p as any).tipo_documento === type);
    if (found) { this.selectDestinatario(found); return; }
    if (this.isSpecialDocType(type)) {
      const nombre = String(this.destinatarioNombre || '').trim();
      const apellido = String(this.destinatarioApellido || '').trim();
      if (!nombre || !apellido) { this.destLookupError = 'Ingrese nombre y apellido'; return; }
      this.destLookupLoading = true;
      const body = this.buildPersonaFromSpecial(type as any, nro, nombre, apellido);
      this.personasSrv.createPersona(body).subscribe({
        next: (created: any) => { this.personas = [created as any, ...this.personas]; this.selectDestinatario(created as any); this.destLookupLoading = false; },
        error: () => { this.destLookupLoading = false; this.destLookupError = 'No se pudo crear'; }
      });
      return;
    }
    this.destLookupLoading = true;
    if (type === 'RUC') {
      this.personasSrv.getDatosRUC(type, nro).subscribe({ next: (data: any) => { const body = this.buildPersonaFromRUC(data); if (!(body as any).nro_documento) { this.destLookupLoading = false; this.destLookupError = 'No encontrado'; return; } this.personasSrv.createPersona(body).subscribe({ next: (created: any) => { this.personas = [created as any, ...this.personas]; this.selectDestinatario(created as any); this.destLookupLoading = false; }, error: () => { this.destLookupLoading = false; this.destLookupError = 'No se pudo crear'; } }); }, error: () => { this.destLookupLoading = false; this.destLookupError = 'No encontrado'; } });
    } else {
      this.personasSrv.getDatosDNI(type, nro).subscribe({ next: (data: any) => { const body = this.buildPersonaFromDNI(data); if (!(body as any).nro_documento) { this.destLookupLoading = false; this.destLookupError = 'No encontrado'; return; } this.personasSrv.createPersona(body).subscribe({ next: (created: any) => { this.personas = [created as any, ...this.personas]; this.selectDestinatario(created as any); this.destLookupLoading = false; }, error: () => { this.destLookupLoading = false; this.destLookupError = 'No se pudo crear'; } }); }, error: () => { this.destLookupLoading = false; this.destLookupError = 'No encontrado'; } });
    }
  }

  lookupCliente() {
    this.compLookupError = null; const type = this.compDocType; const nro = (this.compDocNumber || '').trim();
    if (!type || !nro) { this.compLookupError = 'Ingrese tipo y numero'; return; }
    if (!this.isValidDoc(type, nro)) { this.compLookupError = (type === 'RUC' ? 'RUC debe tener 11 digitos' : 'DNI debe tener 8 digitos'); return; }
    const found = (this.personas || []).find(p => (p as any).nro_documento === nro && (p as any).tipo_documento === type);
    if (found) { this.compClienteId = (found as any).id; return; }
    this.compLookupLoading = true;
    if (type === 'RUC') {
      this.personasSrv.getDatosRUC(type, nro).subscribe({ next: (data: any) => { const body = this.buildPersonaFromRUC(data); if (!(body as any).nro_documento) { this.compLookupLoading = false; this.compLookupError = 'No encontrado'; return; } this.personasSrv.createPersona(body).subscribe({ next: (created: any) => { this.personas = [created as any, ...this.personas]; this.compClienteId = (created as any).id || null; this.compLookupLoading = false; }, error: () => { this.compLookupLoading = false; this.compLookupError = 'No se pudo crear'; } }); }, error: () => { this.compLookupLoading = false; this.compLookupError = 'No encontrado'; } });
    } else {
      this.personasSrv.getDatosDNI(type, nro).subscribe({ next: (data: any) => { const body = this.buildPersonaFromDNI(data); if (!(body as any).nro_documento) { this.compLookupLoading = false; this.compLookupError = 'No encontrado'; return; } this.personasSrv.createPersona(body).subscribe({ next: (created: any) => { this.personas = [created as any, ...this.personas]; this.compClienteId = (created as any).id || null; this.compLookupLoading = false; }, error: () => { this.compLookupLoading = false; this.compLookupError = 'No se pudo crear'; } }); }, error: () => { this.compLookupLoading = false; this.compLookupError = 'No encontrado'; } });
    }
  }
  get compValid(): boolean { return !!this.compTipoId && !!this.compFormaPagoId && !!this.compNumeroComprobante && (!!this.compDocNumber); }
  compClienteLabel(): string | null {
    const id = this.compClienteId;
    if (!id) return null;
    const p = (this.personas || []).find(x => Number((x as any).id) === Number(id));
    if (!p) return null;
    if (this.compDocType === 'DNI') {
      return [p.nombre, p.apellido].filter(Boolean).join(' ').trim() || null;
    }
    return (p.razon_social || '').toString().trim() || null;
  }

  currentDateTMS() {
    const fecha = new Date();
    const yyyy = fecha.getFullYear();
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    const dd = String(fecha.getDate()).padStart(2, '0');

    const resultado = `${yyyy}-${mm}-${dd}`;
    return resultado;
  }

  // Modal helpers
  openCreate() {
    this.editing = false; this.editingId = null;
    this.cleanEnvio();
    try { (this.newEnvio as any).fecha_envio = this.currentDateTMS(); } catch {}
    this.saveError = null; this.showCreate = true; this.remitenteQuery = ''; this.destinatarioQuery = ''; this.showRemitenteOptions = false; this.showDestinatarioOptions = false; this.stagedDetalles = []; this.newDet = { cantidad: null, descripcion: '', precio_unitario: null };
    this.confirmClaveRecojo = '';
    this.destinatarioCelular = '';
    this.compTipoId = null;
    this.compTipoSel = null;
    this.setDefaultComprobanteTipo();
    // Defaults for unified DNI/RUC lookup control
    this.remitenteDocType = 'DNI'; this.destinatarioDocType = 'DNI';
    this.remitenteDocNumber = ''; this.destinatarioDocNumber = '';
    this.remitenteNombre = ''; this.remitenteApellido = '';
    this.destinatarioNombre = ''; this.destinatarioApellido = '';
    this.resetRemitenteCredito();
    // Reset WhatsApp helpers
    this.sendWhatsapp = false; this.whatsappPhone = '';
    this.applyDefaultOrigen();
  }
  closeCreate() { this.showCreate = false; this.editing = false;}

  openEdit(item: Envio) {
    this.editing = true; this.editingId = (item as any).id ?? null;
    this.hasComprobante = false;

    this.newEnvio = {
  remitente: (item as any).remitente,
  destinatario: (item as any).destinatario,
  entrega_domicilio: !!(item as any).entrega_domicilio,
  direccion_envio: ((item as any).direccion_envio ?? '').toUpperCase() ?? '',
  estado_pago: (item as any).estado_pago,
  clave_recojo: (item as any).clave_recojo,
  peso: (item as any).peso,
      fecha_envio: this.normalizeDate((item as any).fecha_envio),
      fecha_recepcion: (item as any).fecha_recepcion,
      tipo_contenido: (item as any).tipo_contenido,
      guia: (item as any).guia,
      manifiesto: (item as any).manifiesto,
      valida_restricciones: (item as any).valida_restricciones,
      punto_origen_id: (item as any).punto_origen_id,
      punto_destino_id: (item as any).punto_destino_id,
      ticket_numero: (item as any).ticket_numero,
    } as any;
    const remitentePersona = (this.personas || []).find(p => Number((p as any).id) === Number((item as any).remitente));
    if (remitentePersona) {
      this.remitenteDocType = ((remitentePersona as any).tipo_documento || 'DNI') as any;
      this.remitenteDocNumber = String((remitentePersona as any).nro_documento || '');
      this.remitenteNombre = String((remitentePersona as any).nombre || '');
      this.remitenteApellido = String((remitentePersona as any).apellido || '');
      this.loadRemitenteCreditoByDoc(this.remitenteDocNumber);
    } else {
      this.remitenteDocType = 'DNI';
      this.remitenteDocNumber = '';
      this.remitenteNombre = '';
      this.remitenteApellido = '';
      this.resetRemitenteCredito();
    }
    const destinatarioPersona = (this.personas || []).find(p => Number((p as any).id) === Number((item as any).destinatario));
    if (destinatarioPersona) {
      this.destinatarioDocType = ((destinatarioPersona as any).tipo_documento || 'DNI') as any;
      this.destinatarioDocNumber = String((destinatarioPersona as any).nro_documento || '');
      this.destinatarioNombre = String((destinatarioPersona as any).nombre || '');
      this.destinatarioApellido = String((destinatarioPersona as any).apellido || '');
    } else {
      this.destinatarioDocType = 'DNI';
      this.destinatarioDocNumber = '';
      this.destinatarioNombre = '';
      this.destinatarioApellido = '';
    }
    this.saveError = null; this.remitenteQuery = this.personaLabelById((item as any).remitente) || ''; this.destinatarioQuery = this.personaLabelById((item as any).destinatario) || ''; this.showEdit = true;
    this.destinatarioCelular = this.personaCelularById((item as any).destinatario) || '';
    this.confirmClaveRecojo = String((item as any).clave_recojo || '');
    this.closeComprobante();
    if ((this.newEnvio as any).estado_pago) {
      const envioId = Number((item as any).id || 0);
      if (envioId) {
        this.loadComprobanteForEnvio(envioId);
      }
    }
    // Cargar el detalle del envío para mostrarlo en la edición
    try {
      const id = Number((item as any).id || 0);
      if (id) {
        this.detalleSrv.getDetallesEnvio(id).subscribe({
          next: (list: any[]) => {
            const mapped = (list || []).map((d: any) => ({
              cantidad: Number(d.cantidad) || 0,
              descripcion: d.descripcion as any,
              precio_unitario: Number(d.precio_unitario) || 0,
            }));
            let toSet = mapped;
            if (Array.isArray(list) && list.length && (!toSet || !toSet.length)) {
              toSet = (list || []).map((d: any) => ({
                cantidad: Number((d as any).cantidad ?? (d as any).qty ?? 0),
                descripcion: (d as any).descripcion ?? (d as any).description ?? '',
                precio_unitario: Number((d as any).precio_unitario ?? (d as any).precio ?? (d as any).price ?? 0),
              }));
            }
            console.log(toSet);
            this.stagedDetalles = toSet;
            console.log(this.stagedDetalles);
            console.log('detalles API', list, 'staged', this.stagedDetalles)
            try { this.cdr.detectChanges(); } catch {}
          },
          error: () => { this.detallesLoading = false; },
        });
      }
    } catch { }
  }
  closeEdit() { this.showEdit = false; this.editing = false;}

  get isValidEnvio(): boolean {
    const e: any = this.newEnvio;
    const remDocOk = this.isValidDoc(this.remitenteDocType as any, this.remitenteDocNumber);
    const destDocOk = this.isValidDoc(this.destinatarioDocType as any, this.destinatarioDocNumber);
    const remSpecialDataOk = !this.isSpecialDocType(this.remitenteDocType) || (!!String(this.remitenteNombre || '').trim() && !!String(this.remitenteApellido || '').trim());
    const destSpecialDataOk = !this.isSpecialDocType(this.destinatarioDocType) || (!!String(this.destinatarioNombre || '').trim() && !!String(this.destinatarioApellido || '').trim());
    const okRemitente = Number(e?.remitente) > 0 || (this.isSpecialDocType(this.remitenteDocType) && remDocOk && remSpecialDataOk);
    const okDestinatario = Number(e?.destinatario) > 0 || (this.isSpecialDocType(this.destinatarioDocType) && destDocOk && destSpecialDataOk);
    const okFormaPago = !e?.estado_pago || this.hasComprobante || !!this.compFormaPagoId;
    const okPeso = Number(e?.peso) > 0;
    const okFecha = String(e?.fecha_envio || "").trim().length > 0;
    const okOrigen = Number(e?.punto_origen_id) > 0;
    const okDestino = Number(e?.punto_destino_id) > 0;
    const lengthDetalle = this.stagedDetalles.length > 0;
    const clave = String(e?.clave_recojo || '');
    const okClave = !clave || clave === String(this.confirmClaveRecojo || '');
    return okRemitente && okDestinatario && remDocOk && destDocOk && remSpecialDataOk && destSpecialDataOk && okFormaPago && okPeso && okFecha && okOrigen && okDestino && lengthDetalle && okClave;
  }

  cleanEnvio() {
    this.newEnvio = {
      remitente: null as any,
      destinatario: null as any,
      entrega_domicilio: false,
      direccion_envio: '',
      estado_pago: false,
      clave_recojo: '',
      peso: null as any,
      fecha_envio: '',
      fecha_recepcion: '',
      tipo_contenido: false,
      //guia: null as any,
      manifiesto: null as any,
      valida_restricciones: false,
      punto_origen_id: null as any,
      punto_destino_id: null as any,
    };
    this.confirmClaveRecojo = '';
    this.destinatarioCelular = '';
    //this.stagedDetalles = [];
  }

  submitEnvio() {
    if (!this.isValidEnvio) return;
    if (!this.editing && this.requiresSpecialPersonCreation()) {
      this.createSpecialPersonsThenSubmit();
      return;
    }
    const e: any = this.newEnvio;
    if (e?.estado_pago && !this.hasComprobante && !this.compFormaPagoId) {
      this.saveError = 'Seleccione forma de pago para guardar el envio pagado';
      this.showNotif(this.saveError, 'error');
      return;
    }
    const doSubmit = (ticketSerie: SerieComprobanteModel | null) => {
    const ticketNumero = ticketSerie ? this.buildTicketNumero(ticketSerie) : (String(e.ticket_numero || '').trim() || null);
    const payload: any = {
      remitente: Number(e.remitente), destinatario: Number(e.destinatario), entrega_domicilio: !!e.entrega_domicilio, direccion_envio: String(e.direccion_envio || '').toUpperCase().trim(), estado_pago: !!e.estado_pago, clave_recojo: String(e.clave_recojo || '').trim(), peso: Number(e.peso) || 0, fecha_envio: String(e.fecha_envio || '').trim(), fecha_recepcion: String(e.fecha_recepcion || '').trim() || null, tipo_contenido: !!e.tipo_contenido, guia: e.guia != null ? Number(e.guia) : null, manifiesto: e.manifiesto != null ? Number(e.manifiesto) : null, valida_restricciones: !!e.valida_restricciones, punto_origen_id: Number(e.punto_origen_id), punto_destino_id: Number(e.punto_destino_id), ticket_numero: ticketNumero
    };
    this.saving = true; this.saveError = null;
    if (this.editing && this.editingId) {
      this.enviosSrv.updateEnvios(this.editingId, payload).subscribe({
        next: (res: any) => {
          const updated: Envio = { id: res?.id ?? this.editingId!, remitente: res?.remitente ?? payload.remitente, destinatario: res?.destinatario ?? payload.destinatario, estado_pago: res?.estado_pago ?? payload.estado_pago, clave_recojo: res?.clave_recojo ?? payload.clave_recojo, peso: res?.peso ?? payload.peso, fecha_envio: res?.fecha_envio ?? payload.fecha_envio, fecha_recepcion: res?.fecha_recepcion ?? payload.fecha_recepcion, tipo_contenido: res?.tipo_contenido ?? payload.tipo_contenido, guia: res?.guia ?? payload.guia, manifiesto: res?.manifiesto ?? payload.manifiesto, valida_restricciones: res?.valida_restricciones ?? payload.valida_restricciones, punto_origen_id: res?.punto_origen_id ?? payload.punto_origen_id, punto_destino_id: res?.punto_destino_id ?? payload.punto_destino_id, estado_entrega: res?.estado_entrega ?? payload.estado_entrega, entrega_domicilio: res?.entrega_domicilio ?? payload.entrega_domicilio, direccion_envio: res?.direccion_envio ?? payload.direccion_envio, ticket_numero: res?.ticket_numero ?? payload.ticket_numero, estado_whatsapp: res?.estado_whatsapp, estado_envio: res?.estado_envio, id_tracking: res?.id_tracking, usuario_crea: res?.usuario_crea, precio_envio: res?.precio_envio } as Envio;
          this.lista_envios = this.lista_envios.map(v => (v as any).id === this.editingId ? updated : v);
          this.saving = false; this.editing = false; this.editingId = null; this.onFilterChange();
          this.closeEdit(); this.showNotif('Env\u00edo actualizado');
        },
        error: () => { this.saving = false; this.saveError = 'No se pudo actualizar el env\u00edo'; this.showNotif(this.saveError as string, 'error'); },
      });
      return;
    }
    this.enviosSrv.createEnvios(payload).subscribe({
      next: (res: any) => {
        const newId = Number(res?.id);
        const updated: Envio = { id: newId || (Math.max(0, ...(this.lista_envios.map((x: any) => x.id).filter(Number))) + 1), remitente: res?.remitente ?? payload.remitente, destinatario: res?.destinatario ?? payload.destinatario, estado_pago: res?.estado_pago ?? payload.estado_pago, clave_recojo: res?.clave_recojo ?? payload.clave_recojo, peso: res?.peso ?? payload.peso, fecha_envio: res?.fecha_envio ?? payload.fecha_envio, fecha_recepcion: res?.fecha_recepcion ?? payload.fecha_recepcion, tipo_contenido: res?.tipo_contenido ?? payload.tipo_contenido, guia: res?.guia ?? payload.guia, manifiesto: res?.manifiesto ?? payload.manifiesto, valida_restricciones: res?.valida_restricciones ?? payload.valida_restricciones, punto_origen_id: res?.punto_origen_id ?? payload.punto_origen_id, punto_destino_id: res?.punto_destino_id ?? payload.punto_destino_id, estado_entrega: res?.estado_entrega ?? payload.estado_entrega, entrega_domicilio: res?.entrega_domicilio ?? payload.entrega_domicilio, direccion_envio: res?.direccion_envio ?? payload.direccion_envio, ticket_numero: res?.ticket_numero ?? payload.ticket_numero, estado_whatsapp: 'Pendiente', estado_envio: 'Recepción', id_tracking: res?.id_tracking, usuario_crea: res?.usuario_crea, precio_envio: res?.precio_envio } as Envio;
        const detalles = (this.stagedDetalles || []).map((d, i) => ({ id: 0, numero_item: i + 1, cantidad: Number(d.cantidad) || 0, descripcion: (d.descripcion as any), precio_unitario: Number(d.precio_unitario) || 0, envio_id: newId })) as DetalleEnvioCreate[];
        if (newId && detalles.length) {
          forkJoin(detalles.map(d => this.detalleSrv.createDetalleEnvio(d))).subscribe({ next: () => this.afterCreate(updated, newId, payload, ticketSerie), error: () => { this.saving = false; this.saveError = 'No se pudo crear el detalle del env\u00edo'; this.showNotif(this.saveError as string, 'error'); } });
        } else {
          this.afterCreate(updated, newId, payload, ticketSerie);
        }
      },
      error: () => { this.saving = false; this.saveError = 'No se pudo crear el env\u00edo'; this.showNotif(this.saveError as string, 'error'); },
    });
    this.cleanEnvio();
    };
    const destId = Number(e.destinatario || 0);
    const celular = String(this.destinatarioCelular || '').trim();
    this.updateDestinatarioCelular(destId, celular, () => {
      if (this.editing) {
        doSubmit(null);
        return;
      }
      this.serieSrv.getSeries().subscribe({
        next: (series: SerieComprobanteModel[]) => {
          const ticketSerie = this.pickTicketSerie(series || []);
          if (!ticketSerie) {
            this.showNotif('No se encontro serie de ticket para la sede', 'error');
            return;
          }
          doSubmit(ticketSerie);
        },
        error: () => {
          this.showNotif('No se pudo obtener la serie del ticket', 'error');
        }
      });
    });
  }

  private afterCreate(updated: Envio, newId: number, payload: any, ticketSerie: SerieComprobanteModel | null) {
    this.lista_envios = [updated, ...this.lista_envios];
    this.saving = false; this.editing = false; this.editingId = null; this.onFilterChange();
    if (ticketSerie) {
      const nextCorr = (Number(ticketSerie.correlativo || 0) || 0) + 1;
      const body: SerieComprobanteModel = { ...ticketSerie, correlativo: nextCorr };
      this.serieSrv.updateSeries(Number(ticketSerie.id), body).subscribe({
        next: () => {},
        error: () => { this.showNotif('Env\u00edo creado, pero no se pudo actualizar la serie del ticket', 'error'); }
      });
    }
    this.openTicketAfterCreate(updated, newId);
    if (payload.estado_pago) {
      // WhatsApp: enviar si se solicitó y estás pagado
      if (this.sendWhatsapp && payload.estado_pago && newId) {
        try {
          const digits = String(this.whatsappPhone || '').replace(/\D/g, '');
          if (digits) {
            const to = `+51${digits}`;
            const remit = this.personaLabelById(updated.remitente) || String(updated.remitente);
            const dest = this.personaLabelById(updated.destinatario) || String(updated.destinatario);
            const clave = String(updated.clave_recojo || '').trim();
            const msg = `${remit}/${dest}/${clave}`;
            const body: MessageCreate = { to, message: msg, envio_id: newId };
            this.messageSrv.sendText(body).subscribe({ next: () => {}, error: () => {} });
          }
        } catch {}
      }
      const tipoNombre = this.compTipoNombre().toLowerCase();
      const estado_comp = tipoNombre.includes('fact') ? 'F' : 'B';
      const numeroComprobante = this.compNumeroComprobante;
      this.withClienteForComprobante((clienteId) => {
        const body: any = { ...this.buildComprobantePayload(newId, clienteId), estado_comprobante: estado_comp };
        this.comprobantesSrv.createComprobantes(body).subscribe({
  next: (comp: any) => {
    const compHeader: any = comp && typeof comp === 'object' ? comp : body;
    const compId = Number((compHeader as any)?.id || 0);
    const detsBodies = (this.stagedDetalles || []).map((d, i) => ({ numero_item: i + 1, cantidad: Number(d.cantidad) || 0, descripcion: d.descripcion as any, precio_unitario: Number(d.precio_unitario) || 0, comprobante_id: compId }));
          try { this.openComprobanteWindow(compHeader, detsBodies); } catch {}
    const afterDetalles = () => {
      const cabBody: any = { tipo_movimiento: 'I', monto: this.compTotalConImpuesto, persona_id: null, placa: null, autorizado: true, manifiesto_id: null };
      this.movsSrv.createMovimientos(cabBody).subscribe({
        next: (cab: any) => {
          const cabId = Number((cab as any)?.id || 0);
          const finalize = () => { this.closeCreate(); this.showNotif('Comprobante generado'); };
          if (!cabId) { finalize(); return; }
          const descripcion = (this.stagedDetalles || []).map((x: any) => String(x.descripcion || '')).filter(Boolean).join(', ');
          const detMov: any = { tipo_comprobante_sunat: this.compTipoSunat(), numero_comprobante: numeroComprobante, descripcion, tipo_gasto: null, cabecera_id: cabId, monto: this.compTotalConImpuesto };
          this.detMovsSrv.createDetalles(detMov).subscribe({ next: () => finalize(), error: () => finalize() });
        },
        error: () => { this.closeCreate(); this.showNotif('Comprobante generado'); }
      });
    };
    if (compId && detsBodies.length) {
      forkJoin(detsBodies.map(x => this.detCompSrv.createDetalles(x))).subscribe({ next: () => afterDetalles(), error: () => afterDetalles() });
    } else { afterDetalles(); }
    this.bumpComprobanteSerie();
  },
  error: () => { this.closeCreate(); }
});
      });
    }
    this.showNotif('Env\u00edo creado');
  }

  private openTicketAfterCreate(updated: Envio, newId: number) {
    const fallback = () => {
      const mapped = (this.stagedDetalles || []).map((d, i) => ({
        numero_item: i + 1,
        cantidad: Number(d.cantidad) || 0,
        descripcion: d.descripcion,
        precio_unitario: Number(d.precio_unitario) || 0
      }));
      this.ticketEnvio = updated;
      this.ticketDetalles = mapped;
      this.closeCreate();
      this.showTicket = true;
      this.loadPublicTrackingLink(updated);
    };
    if (!newId) {
      fallback();
      return;
    }
    this.detalleSrv.getDetallesEnvio(newId).subscribe({
      next: (list: any[]) => {
        const mapped = (list || []).map((d: any, i: number) => ({
          numero_item: (d.numero_item ?? i + 1),
          cantidad: Number(d.cantidad) || 0,
          descripcion: (d.descripcion as any),
          precio_unitario: Number(d.precio_unitario) || 0
        }));
        this.ticketEnvio = updated;
        this.ticketDetalles = mapped;
        this.closeCreate();
        this.showTicket = true;
        this.loadPublicTrackingLink(updated);
      },
      error: () => fallback()
    });
  }

  // Entrega
  get entregaClaveOk(): boolean { const it: any = this.entregaItem as any; const stored = String((it?.clave_recojo ?? '')).trim(); return !!this.entregaItem && this.entregaClaveInput.trim() === stored; }
  openEntrega(item: Envio) {
    if (!this.canConfirmEntrega(item)) {
      this.showNotif('No puede confirmar entrega para este envio', 'error');
      return;
    }
    this.entregaItem = item; this.entregaClaveInput = ''; this.entregaError = null; const d = new Date(); const pad = (n: number) => String(n).padStart(2, '0'); this.entregaFecha = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (!this.entregaRef) { const cfg: OverlayConfig = { hasBackdrop: true, backdropClass: 'cdk-overlay-dark-backdrop', scrollStrategy: this.overlay.scrollStrategies.block(), positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(), }; this.entregaRef = this.overlay.create(cfg); this.entregaRef.backdropClick().subscribe(() => this.closeEntrega()); }
    if (this.entregaRef && this.entregaTpl) { if (!this.entregaRef.hasAttached()) { this.entregaRef.attach(new TemplatePortal(this.entregaTpl, this.vcr)); } }
    this.entregaOpen = true; this.cdr.detectChanges();
  }
  closeEntrega() { if (this.entregaRef?.hasAttached()) this.entregaRef.detach(); this.entregaOpen = false; this.entregaItem = null; this.entregaClaveInput = ''; this.entregaError = null; }
  submitEntrega() {
    if (!this.entregaItem || !this.entregaClaveOk) return; const id = Number((this.entregaItem as any).id); if (!id) return;
    // Si no estï¿½ pagado, cerrar modal y mostrar inline para generar comprobante
    if (!(this.entregaItem as any).estado_pago) {
      this.closeEntrega();
      this.compEnvioId = id;
      this.compInlineForEntrega = true;
      this.detalleSrv.getDetallesEnvio(id).subscribe({
        next: (list: any[]) => {
          this.stagedDetalles = (list || []).map((d: any) => ({ cantidad: Number(d.cantidad) || 0, descripcion: d.descripcion, precio_unitario: Number(d.precio_unitario) || 0 }));
        },
        error: () => { this.stagedDetalles = []; }
      });
      this.showNotif('El envío no está pagado. Genere un comprobante.', 'error');
      return;
    }
    this.entregaSaving = true; this.entregaError = null; (this.entregaItem as any).fecha_recepcion = this.entregaFecha; (this.entregaItem as any).estado_entrega = true;
    this.enviosSrv.updateEnvios(Number(id), this.entregaItem).subscribe({
      next: (res: any) => {
        const fecha = res?.fecha_recepcion ?? this.entregaFecha;
        this.lista_envios = (this.lista_envios || []).map((v: any) => v.id === id ? ({
          ...v,
          fecha_recepcion: fecha
        }) : v);
        this.entregaSaving = false;
        this.closeEntrega();
        this.showNotif('Entrega confirmada');
      }, error: () => {
        this.entregaSaving = false;
        this.entregaError = 'No se pudo registrar la entrega';
        this.showNotif(this.entregaError as string, 'error');
      },
    });
  }

  // Eliminar
  askDelete(item: Envio) { this.pendingDeleteId = (item as any).id ?? null; const label = `${(item as any).guia ?? ''}`.trim() || `${(item as any).id}`; this.pendingDeleteLabel = label as string; this.confirmMessage = `\u00bfEliminar env\u00edo ${this.pendingDeleteLabel}?`; this.confirmOpen = true; }
  onCancelDelete() { this.confirmOpen = false; this.pendingDeleteId = null; this.pendingDeleteLabel = ''; }
  onConfirmDelete() { const id = this.pendingDeleteId; if (!id) { this.onCancelDelete(); return; } this.saving = true; this.enviosSrv.deleteEnvios(id).subscribe({ next: () => { this.lista_envios = this.lista_envios.filter((v: any) => v.id !== id); this.saving = false; this.onFilterChange(); this.onCancelDelete(); this.showNotif('Env\u00edo eliminado'); }, error: () => { this.saving = false; this.saveError = 'No se pudo eliminar el env\u00edo'; this.onCancelDelete(); this.showNotif(this.saveError as string, 'error'); } }); }

  showNotif(msg: string, type: 'success' | 'error' = 'success') {
    this.notifType = type; this.notif = msg;
    try { setTimeout(() => { this.notif = null; }, 10000); } catch {}
  }

  onClickNuevo(ev?: Event) {
    try { ev?.preventDefault(); ev?.stopPropagation(); } catch {}
    try { this.showNotif("Click Nuevo"); } catch {}
    this.openCreate();
  }

  // Carga inicial
  loadCatalogos() {
    this.generalesSrv.getGenerales().subscribe({
      next: (list: General[]) => { const arr = list || []; this.payTipos = arr.filter((g: any) => (g.codigo_grupo || '') === 'PAY'); },
      error: () => { this.detallesLoading = false; },
    });
    this.loadComprobanteSeries();
  }
  private loadComprobanteSeries() {
    const sedeId = this.getUserSedeId();
    if (!sedeId) return;
    this.serieSrv.getSeries().subscribe({
      next: (list: SerieComprobanteModel[]) => {
        const filtered = (list || []).filter(s => {
          const sameSede = Number(s.sede_id) === sedeId;
          const tipo = this.normalizeTipoComprobante((s as any).tipo_comprobante_sunat);
          return sameSede && (tipo === '01' || tipo === '03');
        });
        this.compTipos = filtered;
        if (this.compTipos.length && !this.compTipoId) {
          this.setDefaultComprobanteTipo();
        }
      },
      error: () => { this.showNotif('No se pudieron cargar las series de comprobante', 'error'); }
    });
  }
  private setDefaultComprobanteTipo() {
    if (!this.compTipos.length) { this.compTipoSel = null; this.compTipoId = null; return; }
    const boleta = this.compTipos.find(t => this.normalizeTipoComprobante((t as any).tipo_comprobante_sunat) === '03') || this.compTipos[0];
    this.compTipoSel = boleta;
    this.onCompTipoChange(boleta);
  }

  loadEnvios() {
    this.loading = true; this.error = null;
    const sedeId = this.getUserSedeId();
    const fecha = this.normalizeDate(this.fechaFiltro);
    const hasFecha = fecha.length === 10;
    const isAdmin = this.isAdminRole();
    const useSedeEndpoint = this.useSedeEndpointByRole() && sedeId > 0;
    const request$ = isAdmin
      ? (hasFecha ? this.enviosSrv.getEnviosDate(fecha) : this.enviosSrv.getEnvios())
      : (useSedeEndpoint
        ? (hasFecha ? this.enviosSrv.getEnviosSedeDate(sedeId, fecha) : this.enviosSrv.getEnviosSede(sedeId))
        : (hasFecha ? this.enviosSrv.getEnviosDate(fecha) : this.enviosSrv.getEnvios()));

    request$.subscribe({
      next: (response) => { this.lista_envios = response || []; this.loading = false; const qpId = Number(this.route.snapshot.queryParamMap.get('id') || 0); if (qpId) { const it = (this.lista_envios || []).find((v: any) => Number((v as any).id) === qpId); if (it) { this.openEdit(it as any); } } },
      error: () => { this.loading = false; this.error = 'No se pudieron cargar los envíos'; },
    });
  }

  private requiresSpecialPersonCreation(): boolean {
    const e: any = this.newEnvio;
    const remNeed = this.isSpecialDocType(this.remitenteDocType) && Number(e?.remitente || 0) <= 0;
    const destNeed = this.isSpecialDocType(this.destinatarioDocType) && Number(e?.destinatario || 0) <= 0;
    return remNeed || destNeed;
  }

  private createSpecialPersonsThenSubmit() {
    this.resolveSpecialPersona('remitente', (okRemit) => {
      if (!okRemit) return;
      this.resolveSpecialPersona('destinatario', (okDest) => {
        if (!okDest) return;
        this.submitEnvio();
      });
    });
  }

  private resolveSpecialPersona(role: 'remitente' | 'destinatario', next: (ok: boolean) => void) {
    const isRem = role === 'remitente';
    const docType = (isRem ? this.remitenteDocType : this.destinatarioDocType) as any;
    if (!this.isSpecialDocType(docType)) { next(true); return; }

    const currentId = Number((this.newEnvio as any)?.[role] || 0);
    if (currentId > 0) { next(true); return; }

    const nro = String(isRem ? this.remitenteDocNumber : this.destinatarioDocNumber).trim();
    const nombre = String(isRem ? this.remitenteNombre : this.destinatarioNombre).trim();
    const apellido = String(isRem ? this.remitenteApellido : this.destinatarioApellido).trim();

    if (!nro || !nombre || !apellido) {
      const msg = `${isRem ? 'Remitente' : 'Destinatario'}: complete nombre, apellido y número de documento`;
      if (isRem) this.remLookupError = msg; else this.destLookupError = msg;
      this.showNotif(msg, 'error');
      next(false);
      return;
    }

    const found = (this.personas || []).find(p => (p as any).nro_documento === nro && (p as any).tipo_documento === docType);
    if (found) {
      if (isRem) this.selectRemitente(found); else this.selectDestinatario(found);
      next(true);
      return;
    }

    const body = this.buildPersonaFromSpecial(docType, nro, nombre, apellido);
    this.personasSrv.createPersona(body).subscribe({
      next: (created: any) => {
        this.personas = [created as any, ...this.personas];
        if (isRem) this.selectRemitente(created as any); else this.selectDestinatario(created as any);
        next(true);
      },
      error: () => {
        const msg = `No se pudo crear ${isRem ? 'el remitente' : 'el destinatario'} (${docType})`;
        if (isRem) this.remLookupError = msg; else this.destLookupError = msg;
        this.showNotif(msg, 'error');
        next(false);
      }
    });
  }
  loadPersonas() { this.personasLoading = true; this.personasError = null; this.personasSrv.getPersonas().subscribe({ next: (res: Persona[]) => { this.personas = res || []; this.personasLoading = false; this.syncDestinatarioCelular(); const remId = Number((this.newEnvio as any)?.remitente || 0); if (remId && !this.remitenteDocNumber) { const p = (this.personas || []).find(x => Number((x as any).id) === remId); if (p) { this.remitenteDocType = ((p as any).tipo_documento || 'DNI') as any; this.remitenteDocNumber = String((p as any).nro_documento || ''); this.loadRemitenteCreditoByDoc(this.remitenteDocNumber); } } }, error: () => { this.personasLoading = false; this.personasError = 'No se pudieron cargar personas'; }, }); }
  loadPuntos() {
    this.puntosLoading = true; this.puntosError = null;
    this.puntosSrv.getPuntos().subscribe({
      next: (res) => { this.puntos = res || []; this.puntosLoading = false; this.applyDefaultOrigen(); },
      error: () => { this.puntosLoading = false; this.puntosError = 'No se pudieron cargar los puntos'; },
    });
  }

  ngOnInit(): void {
    this.loadCatalogos();
    try { const vm = localStorage.getItem('envios.viewMode') as any; if (vm === 'table' || vm === 'cards') this.viewMode = vm; } catch { }
    this.loadEnvios(); this.loadPersonas(); this.loadPuntos();
  }
  // Generar comprobante desde el inline de entrega no pagada
  submitComprobanteEntrega() {
    const showPaidDetails = (id: number) => { try { const it = (this.lista_envios || []).find((v: any) => v.id === id) as any; this.ticketEnvio = it || null; this.detalleSrv.getDetallesEnvio(id).subscribe({ next: (list: any[]) => { this.ticketDetalles = (list||[]).map((d: any, i:number) => ({ numero_item: d.numero_item ?? i+1, cantidad: Number(d.cantidad)||0, descripcion: (d.descripcion as any), precio_unitario: Number(d.precio_unitario)||0 })); }, error: () => { this.ticketDetalles = []; } }); } catch {} };

    if (!this.compEnvioId) return;
    if (!this.compTipoId || !this.compFormaPagoId || !this.compNumeroComprobante || !this.compDocNumber) return;
    const envioId = this.compEnvioId;
    const tipoNombre = this.compTipoNombre().toLowerCase();
    const estado_comp = tipoNombre.includes('fact') ? 'F' : 'B';
    const numeroComprobante = this.compNumeroComprobante;
    this.withClienteForComprobante((clienteId) => {
      const body: any = { ...this.buildComprobantePayload(envioId, clienteId), estado_comprobante: estado_comp };
      this.comprobantesSrv.createComprobantes(body).subscribe({
      next: (comp: any) => {
        const compHeader: any = comp && typeof comp === 'object' ? comp : body;
        const compId = Number((compHeader as any)?.id || 0);
        const detsBodies = (this.stagedDetalles || []).map((d, i) => ({ numero_item: i + 1, cantidad: Number(d.cantidad) || 0, descripcion: d.descripcion as any, precio_unitario: Number(d.precio_unitario) || 0, comprobante_id: compId }));
          try { this.openComprobanteWindow(compHeader, detsBodies); } catch {}
        const afterDetalles = () => {
          const cabBody: any = { tipo_movimiento: 'I', monto: this.compTotalConImpuesto, persona_id: null, placa: null, autorizado: true, manifiesto_id: null };
          this.movsSrv.createMovimientos(cabBody).subscribe({
            next: (cab: any) => {
              const cabId = Number((cab as any)?.id || 0);
              // Aun si falla, marcar como pagado y refrescar
              const finalize = () => {
                this.compInlineForEntrega = false; this.compEnvioId = null;
                this.enviosSrv.updateEnvios(envioId, { estado_pago: true } as any).subscribe({ next: () => { this.lista_envios = (this.lista_envios || []).map((v: any) => v.id === envioId ? ({ ...v, estado_pago: true }) : v); try { this.onFilterChange(); } catch { } this.showNotif('Comprobante generado'); }, error: () => { this.lista_envios = (this.lista_envios || []).map((v: any) => v.id === envioId ? ({ ...v, estado_pago: true }) : v); try { this.onFilterChange(); } catch { } this.showNotif('Comprobante generado'); } });
              };
              if (!cabId) { finalize(); return; }
              const descripcion = (this.stagedDetalles || []).map((x: any) => String(x.descripcion || '')).filter(Boolean).join(', ');
              const detMov: any = { tipo_comprobante_sunat: this.compTipoSunat(), numero_comprobante: numeroComprobante, descripcion, tipo_gasto: null, cabecera_id: cabId, monto: this.compTotalConImpuesto };
              this.detMovsSrv.createDetalles(detMov).subscribe({ next: () => finalize(), error: () => finalize() });
            },
            error: () => {
              // No bloquear por error de movimiento
              this.compInlineForEntrega = false; this.compEnvioId = null;
              this.enviosSrv.updateEnvios(envioId, { estado_pago: true } as any).subscribe({ next: () => { this.lista_envios = (this.lista_envios || []).map((v: any) => v.id === envioId ? ({ ...v, estado_pago: true }) : v); try { this.onFilterChange(); } catch { } this.showNotif('Comprobante generado'); }, error: () => { this.lista_envios = (this.lista_envios || []).map((v: any) => v.id === envioId ? ({ ...v, estado_pago: true }) : v); try { this.onFilterChange(); } catch { } this.showNotif('Comprobante generado'); } });
            }
          });
        };
        if (compId && detsBodies.length) {
          forkJoin(detsBodies.map(x => this.detCompSrv.createDetalles(x))).subscribe({ next: () => afterDetalles(), error: () => afterDetalles() });
        } else { afterDetalles(); }
     this.bumpComprobanteSerie();
      },
      error: () => { this.showNotif('No se pudo generar el comprobante', 'error'); }
    });
    });
  }
  submitComprobanteEdicion() {
    if (!this.editingId) return;
    if (!this.compTipoId || !this.compFormaPagoId || !this.compNumeroComprobante || !this.compDocNumber) { this.showNotif("Complete el comprobante", 'error'); return; }
    const envioId = this.editingId;
    const tipoNombre = this.compTipoNombre().toLowerCase();
    const estado_comp = tipoNombre.includes('fact') ? 'F' : 'B';
    const numeroComprobante = this.compNumeroComprobante;
    this.withClienteForComprobante((clienteId) => {
      const body: any = { ...this.buildComprobantePayload(envioId, clienteId), estado_comprobante: estado_comp };
      this.comprobantesSrv.createComprobantes(body).subscribe({
      next: (comp: any) => {
        const compHeader: any = comp && typeof comp === 'object' ? comp : body;
        const compId = Number((compHeader as any)?.id || 0);
        const detsBodies = (this.stagedDetalles || []).map((d, i) => ({ numero_item: i + 1, cantidad: Number(d.cantidad) || 0, descripcion: d.descripcion as any, precio_unitario: Number(d.precio_unitario) || 0, comprobante_id: compId }));
        try { this.openComprobanteWindow(compHeader, detsBodies); } catch {}
        const afterDetalles = () => {
          const cabBody: any = { tipo_movimiento: 'I', monto: this.compTotalConImpuesto, persona_id: null, placa: null, autorizado: true, manifiesto_id: null };
          const finalize = () => {
            this.enviosSrv.updateEnvios(envioId, { estado_pago: true } as any).subscribe({ next: () => { this.lista_envios = (this.lista_envios || []).map((v: any) => v.id === envioId ? ({ ...v, estado_pago: true }) : v); try { this.onFilterChange(); } catch { } this.showNotif('Comprobante generado'); this.closeEdit(); }, error: () => { this.lista_envios = (this.lista_envios || []).map((v: any) => v.id === envioId ? ({ ...v, estado_pago: true }) : v); try { this.onFilterChange(); } catch { } this.showNotif('Comprobante generado'); this.closeEdit(); } });
          };
          this.movsSrv.createMovimientos(cabBody).subscribe({
            next: (cab: any) => {
              const cabId = Number((cab as any)?.id || 0);
              if (!cabId) { finalize(); return; }
              const descripcion = (this.stagedDetalles || []).map((x: any) => String(x.descripcion || '')).filter(Boolean).join(', ');
              const detMov: any = { tipo_comprobante_sunat: this.compTipoSunat(), numero_comprobante: numeroComprobante, descripcion, tipo_gasto: null, cabecera_id: cabId, monto: this.compTotalConImpuesto };
              this.detMovsSrv.createDetalles(detMov).subscribe({ next: () => finalize(), error: () => finalize() });
            },
            error: () => { finalize(); }
          });
        };
        if (compId && detsBodies.length) {
          forkJoin(detsBodies.map(x => this.detCompSrv.createDetalles(x))).subscribe({ next: () => afterDetalles(), error: () => afterDetalles() });
        } else { afterDetalles(); }
        this.bumpComprobanteSerie();
      },
      error: () => { this.showNotif('No se pudo generar el comprobante', 'error'); }
    });
    });
  }
  // Enfoque: de Remitente a Destinatario con Tab
  focusDestinatarioDoc(event: Event, input: HTMLInputElement): void {
    const e = event as KeyboardEvent; if (e.shiftKey) { return; }
    e.preventDefault();
    try { input.focus(); } catch {}
  }
}
