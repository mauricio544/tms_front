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
  EnvioListRead,
  CompaniaConfigRead
} from '../../../../core/mapped';
import { Utilitarios } from '../../../../core/services/utilitarios';
import { forkJoin } from 'rxjs';
import { SerieComprobante as SerieComprobanteService } from '../../../../core/services/serie-comprobante';
import { ComprobantePreview, ComprobantePreviewComponent } from '../../shared/comprobante-preview/comprobante-preview.component';
import { DeclaracionJuradaComponent, DeclaracionJuradaData } from '../../shared/declaracion-jurada/declaracion-jurada.component';

@Component({
  selector: 'feature-envios',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, UiAlertComponent, UiConfirmComponent, Utils, OverlayModule, PortalModule, NgIconComponent, ComprobantePreviewComponent, DeclaracionJuradaComponent],
  templateUrl: './envios.html',
  styleUrl: './envios.css',
  providers: [provideIcons({ heroPencil, heroNoSymbol })],
})
export class EnviosFeature implements OnInit {
  private readonly publicTrackingSearchUrl = 'https://vigo.tmscargosoft.com/tracking/publico/buscar';
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
  companiaLema = '';
  companiaConsideraciones = '';
  companiaCondiciones = '';

  // Vista (tarjetas/tabla) con persistencia
  viewMode: 'cards' | 'table' = 'cards';
  setViewMode(m: 'cards' | 'table') { this.viewMode = m; try { localStorage.setItem('envios.viewMode', m); } catch { } }

  // Filtros y paginación
  search = '';
  fechaFiltro = '';
  pagosDestinoPreset: 'last7' | 'lastMonth' | 'custom' = 'last7';
  pagosDestinoInicio = '';
  pagosDestinoFin = '';
  pagosDestino: Envio[] = [];
  pagosDestinoLoading = false;
  pagosDestinoError: string | null = null;
  showPagosDestinoPanel = false;
  private exactSearchTimer: any = null;
  private exactSearchInFlight = false;
  private exactSearchTried = new Set<string>();

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
    const ticket = String(e.ticket_numero || e.id || '-').trim();
    const tracking = String(publicUrl || '').trim() || this.trackingUrl(e.id);
    const qr = tracking ? `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(tracking)}` : '';
    const labels = dets.map((d, i) => {
      const desc = this.escHtml(String(d.descripcion || ''));
      const qty = Math.max(1, Number(d.cantidad || 0));
      const perUnit = Array.from({ length: qty }).map((_, unitIdx) => `<div class="label">
  <div class="title">ETIQUETA ENVIO</div>
  <div class="id">Ticket: ${this.escHtml(ticket)} · ${i + 1}.${unitIdx + 1}</div>
  <div class="sep"></div>
  <div class="row"><span class="k">Item</span><span class="v">${i + 1}</span></div>
  <div class="row"><span class="k">Cantidad</span><span class="v">1</span></div>
  <div class="route-block">
    <div class="route-label">Origen</div>
    <div class="route-origin">${this.escHtml(origen)}</div>
    <div class="route-label">Destino</div>
    <div class="route-destination">${this.escHtml(destino)}</div>
  </div>
  <div class="detail-block">
    <div class="detail-label">Detalle del envio</div>
    <div class="detail-value">${desc}</div>
  </div>
  <div class="qr-wrap">
    ${qr ? `<img src="${qr}" alt="QR" />` : ''}
  </div>
</div>`).join('');
      return perUnit;
    }).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Etiquetas Envio ${this.escHtml(ticket)}</title>
<style>
  @page { size: 80mm auto; margin: 2.5mm; }
  html,body{width:80mm;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#000;font-size:11px;line-height:1.25;}
  .sheet{width:74mm;margin:0 auto;display:flex;flex-direction:column;gap:1.5mm;}
  .label{width:74mm;box-sizing:border-box;border:0.5px solid #000;border-radius:1mm;padding:2mm;break-inside:avoid;page-break-inside:avoid;}
  .title{font-size:12px;font-weight:700;line-height:1.2;color:#000;}
  .id{margin-top:1mm;font-size:10px;color:#000;line-height:1.2;}
  .sep{border-top:1px solid #000;margin:1.3mm 0;}
  .row{display:flex;gap:2mm;font-size:11px;line-height:1.22;margin:0.7mm 0;}
  .k{color:#000;min-width:18mm;}
  .v{font-weight:600;word-break:break-word;flex:1;}
  .route-block{margin:1.6mm 0;padding:1.6mm 0;border-top:1px dashed #000;border-bottom:1px dashed #000;}
  .route-label{font-size:9px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;margin-top:0.8mm;}
  .route-label:first-child{margin-top:0;}
  .route-origin{font-size:12px;font-weight:600;line-height:1.15;word-break:break-word;}
  .route-destination{font-size:24px;font-weight:800;line-height:1.05;word-break:break-word;}
  .detail-block{margin-top:1.5mm;}
  .detail-label{font-size:9px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;}
  .detail-value{margin-top:0.7mm;font-size:12px;font-weight:700;line-height:1.18;word-break:break-word;}
  .qr-wrap{display:flex;justify-content:center;margin-top:1.2mm;}
  .qr-wrap img{width:30mm;height:30mm;object-fit:contain;image-rendering:crisp-edges;}
  @media print { .sheet{width:74mm;} .label{page-break-inside:avoid;} *{-webkit-print-color-adjust:exact; print-color-adjust:exact;} }
</style>
</head><body>
  <div class="sheet">${labels}</div>
  <script>window.addEventListener('load',()=>{window.print(); setTimeout(()=>window.close(),300)});</script>
</body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open(); w.document.write(html); w.document.close();
  }

  printEtiquetas() {
    this.printEtiquetasFor(this.ticketEnvio, this.ticketDetalles, this.publicTrackingUrl);
  }

  private mapTicketDetalles(list: any[]): Array<{ numero_item: number; cantidad: number; descripcion: any; precio_unitario: number; precio_total?: number }> {
    return (list || []).map((d: any, i: number) => ({
      numero_item: Number(d?.numero_item ?? i + 1),
      cantidad: Number(d?.cantidad) || 0,
      descripcion: d?.descripcion,
      precio_unitario: Number(d?.precio_unitario) || 0,
      precio_total: Number(d?.precio_total ?? d?.valor_unitario) || 0
    }));
  }

  reprintTicket(item: Envio) {
    const envioId = Number((item as any)?.id || 0);
    const doPrint = (list: any[]) => {
      this.ticketEnvio = item;
      this.ticketDetalles = this.mapTicketDetalles(list || []);
      this.publicTrackingUrl = this.publicTrackingSearchUrl;
      this.publicTrackingQrUrl = this.publicTrackingUrl
        ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(this.publicTrackingUrl)}`
        : null;
      this.publicTrackingLoading = false;
      this.publicTrackingError = null;
      try { this.printTicketWindow(); } catch {}
    };
    if (!envioId) {
      doPrint([]);
      return;
    }
    this.detalleSrv.getDetallesEnvio(envioId).subscribe({
      next: (list: any[]) => { doPrint(list || []); },
      error: () => { doPrint([]); }
    });
  }

  reprintComprobante(item: Envio) {
    const envioId = Number((item as any)?.id || 0);
    if (!envioId) {
      this.showNotif('No se pudo identificar el envio', 'error');
      return;
    }
    if (!(item as any)?.estado_pago) {
      this.showNotif('Solo se puede reimprimir comprobante de envios pagados', 'error');
      return;
    }
    this.loadComprobanteForEnvio(envioId);
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

  private getCompaniaIdFromStorage(): number {
    return Number(localStorage.getItem('ciaId') || 0)
      || Number(localStorage.getItem('cia_id') || 0)
      || Number(localStorage.getItem('cia') || 0);
  }

  private loadCompaniaConfig() {
    const ciaId = this.getCompaniaIdFromStorage();
    if (!ciaId) return;
    this.enviosSrv.getCondicionesCia(ciaId).subscribe({
      next: (cfg: CompaniaConfigRead) => {
        this.companiaLema = String((cfg as any)?.lema || '').trim();
        this.companiaConsideraciones = String((cfg as any)?.consideraciones || '').trim();
        this.companiaCondiciones = String((cfg as any)?.condiciones || '').trim();
      },
      error: () => {
        this.companiaLema = '';
        this.companiaConsideraciones = '';
        this.companiaCondiciones = '';
      }
    });
  }
  private openComprobanteWindow(header: any, detalles: Array<{ numero_item: number; cantidad: number; descripcion: any; precio_unitario: number; precio_total?: number; valor_unitario?: number }>) {
    const c: any = header || {};
    const d = Array.isArray(detalles) ? detalles : []; const fallback = (!d || d.length===0) ? (this.stagedDetalles||[]).map((x:any,i:number)=>({ numero_item: i+1, cantidad: Number((x as any).cantidad)||0, descripcion: (x as any).descripcion, precio_unitario: Number((x as any).precio_unitario)||0, precio_total: this.getDetalleTotal(x) })) : d;
    const tipoKey = this.normalizeTipoComprobante(c?.tipo_comprobante_sunat ?? c?.tipo_comprobante);
    const tipoNombre = (tipoKey ? this.tipoNombreById(Number(tipoKey)) : '').toLowerCase();
    const docTitle = tipoNombre.includes('fact') ? 'Factura' : (tipoNombre.includes('bol') ? 'Boleta' : 'Comprobante');
    const numero = String(c.serie || '-') + '-' + String(c.numero || '-');
    const ruc = String(localStorage.getItem('ruc') || '');
    const razon = String(localStorage.getItem('razon_social') || '');
    const isFactura = tipoKey ? this.isFacturaTipo(tipoKey) : (this.tipoNombreById(Number(c.tipo_comprobante)).toLowerCase().includes("fact"));
            const row = (x: any) => {
      const lineTotal = this.getDetalleTotal(x);
      const igvL = isFactura ? this.extractIgvFromTotal(lineTotal) : 0;
      const base = isFactura ? this.baseFromTotal(lineTotal) : lineTotal;
      const importe = lineTotal;
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
      const lineTotal = this.getDetalleTotal(x);
      const igv = isFactura ? this.extractIgvFromTotal(lineTotal) : 0;
      const base = isFactura ? this.baseFromTotal(lineTotal) : lineTotal;
      const valorUnitario = cantidad > 0 ? +(base / cantidad).toFixed(6) : 0;
      const importe = lineTotal;
      return { numero_item: (Number((x as any).numero_item) || (i+1)), cantidad, unidad: "NIU", descripcion: (x as any).descripcion, v_unit: valorUnitario, igv, importe };
    });
    const totalTotal = compRows.reduce((s,r)=>s + Number(r.importe || 0), 0);
    const igvTotal = isFactura ? this.extractIgvFromTotal(totalTotal) : 0;
    const baseTotal = isFactura ? this.baseFromTotal(totalTotal) : totalTotal;
    this.compRows = compRows;
    this.compTotals = { base: baseTotal, igv: igvTotal, total: totalTotal };
    this.compView = {
      razon,
      ruc,
      docTitle,
      numero,
      fechaEmision,
      fechaPago,
      moneda: "PEN (S/)",
      formaPago: this.formaPagoLabel(c?.forma_pago),
      clienteDocumento,
      clienteNombre
    };
    this.comprobantePreview = this.toComprobantePreview(c, fallback, clienteNombre, tipoKey);
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
  ticketDetalles: Array<{ numero_item: number; cantidad: number; descripcion: any; precio_unitario: number; precio_total?: number }> = [];
  get ticketTotal(): number { return (this.ticketDetalles || []).reduce((s, d) => s + this.getDetalleTotal(d), 0); }
  publicTrackingUrl: string | null = null;
  publicTrackingQrUrl: string | null = null;
  publicTrackingLoading = false;
  publicTrackingError: string | null = null;
  openTicket(env: Envio, fromDetalles: Array<{ cantidad: number; descripcion: any; precio_unitario: number; precio_total?: number }> = []) {
    this.ticketEnvio = env;
    this.ticketDetalles = (fromDetalles || []).map((d, i) => ({ numero_item: i + 1, cantidad: Number(d.cantidad) || 0, descripcion: d.descripcion, precio_unitario: Number(d.precio_unitario) || 0, precio_total: this.getDetalleTotal(d) }));
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
      this.setPublicTrackingUrl(this.publicTrackingSearchUrl);
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
        const url = this.publicTrackingSearchUrl;
        this.setPublicTrackingUrl(url);
      },
      error: () => {
        this.publicTrackingLoading = false;
        this.publicTrackingError = 'No se pudo generar el enlace público, se usó el enlace general.';
        this.setPublicTrackingUrl(this.publicTrackingSearchUrl);
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
  showDeclaracion = false;
  declaracionData: DeclaracionJuradaData | null = null;
  hasComprobante = false;
  comprobantePreview: ComprobantePreview | null = null;
  compView: any = { razon: "", ruc: "", docTitle: "", numero: "", fechaEmision: "", fechaPago: "", moneda: "PEN (S/)", formaPago: "-", clienteDocumento: "-" };
  compRows: Array<{ numero_item: number; cantidad: number; unidad: string; descripcion: any; v_unit: number; igv: number; importe: number }> = [];
  compTotals: { base: number; igv: number; total: number } = { base: 0, igv: 0, total: 0 };
  closeComprobante() {
    this.showComprobante = false;
    this.comprobantePreview = null;
    this.compView = { razon: "", ruc: "", docTitle: "", numero: "", fechaEmision: "", fechaPago: "", moneda: "PEN (S/)", formaPago: "-", clienteDocumento: "-" };
    this.compRows = [];
    this.compTotals = { base: 0, igv: 0, total: 0 };
  }
  openDeclaracion(item?: Envio) {
    const envio: any = item || null;
    const remitenteId = Number((envio as any)?.remitente || 0);
    const remitente: any = remitenteId
      ? (this.personas || []).find((p: any) => Number((p as any)?.id || 0) === remitenteId)
      : null;
    const remitenteNombre = remitente
      ? [String((remitente as any)?.nombre || '').trim(), String((remitente as any)?.apellido || '').trim()].filter(Boolean).join(' ').trim() || String((remitente as any)?.razon_social || '').trim()
      : String(this.personaLabelById(remitenteId) || '').split(' - ')[0].trim();
    const remitenteDoc = String((remitente as any)?.nro_documento || '').trim();
    const remitenteDomicilio = String((remitente as any)?.direccion || '').trim();
    this.declaracionData = {
      remitenteNombre: remitenteNombre || '',
      remitenteDoc: remitenteDoc || '',
      remitenteDomicilio: remitenteDomicilio || '',
      itemsDescripcion: '',
    };
    this.showDeclaracion = true;
    const envioId = Number((envio as any)?.id || 0);
    if (!envioId) return;
    this.detalleSrv.getDetallesEnvio(envioId).subscribe({
      next: (list: any[]) => {
        const items = (list || [])
          .map((d: any) => `${Number((d as any)?.cantidad || 0)} ${String((d as any)?.descripcion || '').trim()}`.trim())
          .filter(Boolean)
          .join('; ');
        this.declaracionData = {
          ...(this.declaracionData || {}),
          itemsDescripcion: items || '',
        };
      },
      error: () => {}
    });
  }
  closeDeclaracion() {
    this.showDeclaracion = false;
    this.declaracionData = null;
  }
  private toComprobantePreview(
    c: any,
    detalles: Array<{ numero_item: number; cantidad: number; descripcion: any; precio_unitario: number }>,
    clienteNombre: string,
    tipoKey: string
  ): ComprobantePreview {
    const isFactura = this.isFacturaTipo(tipoKey);
    const items = (detalles || []).map((d, i) => {
      const cantidad = Number(d?.cantidad || 0);
      const precio = Number(d?.precio_unitario || 0);
      const lineTotal = this.getDetalleTotal(d);
      const igv = isFactura ? this.extractIgvFromTotal(lineTotal) : 0;
      const base = isFactura ? this.baseFromTotal(lineTotal) : lineTotal;
      const valorUnitario = cantidad > 0 ? +(base / cantidad).toFixed(6) : 0;
      return {
        numeroItem: Number(d?.numero_item || i + 1),
        descripcion: String(d?.descripcion || ''),
        cantidad,
        unidadMedida: 'NIU',
        precioUnitario: precio,
        valorUnitario: valorUnitario,
        igv,
        totalLinea: lineTotal,
      };
    });
    const env: any = this.ticketEnvio || null;
    const ciaLogo = String(localStorage.getItem('cia_logo') || '').trim();
    const envioIdNum = Number(env?.id || c?.envio_id || 0);
    const envFromList: any = envioIdNum > 0
      ? (this.lista_envios || []).find((x: any) => Number((x as any)?.id || 0) === envioIdNum)
      : null;
    const refEnv: any = env || envFromList || null;
    const ticketNumero = String(
      env?.ticket_numero ||
      (this.newEnvio as any)?.ticket_numero ||
      c?.ticket_numero ||
      c?.envio_ticket_numero ||
      envFromList?.ticket_numero ||
      ''
    ).trim();
    const codigoEnvio = ticketNumero || '-';
    const codigoSeguimiento = String(
      env?.id_tracking ||
      c?.id_tracking ||
      envFromList?.id_tracking ||
      ''
    ).trim();
    const estado = String(c?.estado_cpe || '').toUpperCase();
    const estadoCpe = estado === 'A' ? 'aceptado' : (estado === 'R' ? 'rechazado' : 'pendiente');
    const creadoPor = String(
      refEnv?.usuario_crea ||
      c?.usuario_crea ||
      c?.envio_usuario_crea ||
      ''
    ).trim();
    return {
      tipo: tipoKey || String(c?.tipo_comprobante_sunat || c?.tipo_comprobante || ''),
      ambiente: 'produccion',
      creadoPor: creadoPor || undefined,
      serie: String(c?.serie || '-'),
      numero: String(c?.numero || '-'),
      fechaEmision: String(c?.fecha_comprobante || ''),
      moneda: 'PEN',
      formaPago: this.formaPagoLabel(c?.forma_pago),
      logoUrl: ciaLogo || undefined,
      lema: this.companiaLema || undefined,
      consideraciones: this.companiaConsideraciones || undefined,
      condiciones: this.companiaCondiciones || undefined,
      emisor: {
        razonSocial: String(localStorage.getItem('razon_social') || ''),
        nombreComercial: String(localStorage.getItem('nombre_comercial') || ''),
        ruc: String(localStorage.getItem('ruc') || ''),
        direccion: String(localStorage.getItem('direccion_fiscal') || ''),
        telefono: String(localStorage.getItem('telefono') || ''),
        correo: String(localStorage.getItem('correo') || ''),
      },
      cliente: {
        nombre: clienteNombre || '-',
        tipoDocumento: isFactura ? 'RUC' : 'DNI',
        numeroDocumento: String(c?.cliente_documento || '-'),
      },
      referencia: refEnv ? {
        envioId: codigoEnvio,
        tracking: codigoSeguimiento,
        origen: this.getPuntoNombre(refEnv?.punto_origen_id),
        destino: this.getPuntoNombre(refEnv?.punto_destino_id),
        destinoDireccion: this.getPuntoDireccion(refEnv?.punto_destino_id),
        remitente: this.personaLabelById(refEnv?.remitente) || String(refEnv?.remitente || ''),
        destinatario: this.personaLabelById(refEnv?.destinatario) || String(refEnv?.destinatario || ''),
        guiaReferencia: String(refEnv?.guia_referencia || c?.guia_referencia || c?.envio_guia_referencia || '').trim(),
      } : ((ticketNumero || codigoSeguimiento) ? {
        envioId: codigoEnvio,
        tracking: codigoSeguimiento,
        guiaReferencia: String(c?.guia_referencia || c?.envio_guia_referencia || '').trim(),
      } : undefined),
      items,
      totales: {
        gravadas: isFactura ? this.baseFromTotal(Number(this.compTotals.total || 0)) : Number(this.compTotals.base || 0),
        igv: Number(this.compTotals.igv || 0),
        total: Number(this.compTotals.total || 0),
      },
      sunat: {
        hash: String(c?.hash_sunat || ''),
        qr: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(this.publicTrackingSearchUrl)}`,
        codigo: String(c?.sunat_cod || ''),
        mensaje: String(c?.sunat_msg || ''),
        ticket: String(c?.sunat_ticket || ''),
        fechaEnvio: String(c?.sunat_fecha_envio || ''),
        fechaRespuesta: String(c?.sunat_fecha_respuesta || ''),
        estadoCpe: estadoCpe as any,
      },
      leyendas: [],
      observaciones: [],
    };
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
  companyLogoSrc(): string | null {
    const fromMe = (() => {
      try {
        const rawMe = localStorage.getItem('me');
        if (!rawMe) return '';
        const me = JSON.parse(rawMe) as any;
        return String(me?.companies?.[0]?.logo || '').trim();
      } catch {
        return '';
      }
    })();
    const raw = String(
      localStorage.getItem('cia_logo') ||
      localStorage.getItem('company_logo') ||
      localStorage.getItem('logo') ||
      fromMe ||
      ''
    ).trim();
    if (!raw || raw.toLowerCase() === 'null' || raw.toLowerCase() === 'undefined') return null;
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:image')) return raw;
    if (raw.startsWith('/')) {
      try { return `${window.location.origin}${raw}`; } catch { return raw; }
    }
    return `data:image/png;base64,${raw}`;
  }
  private printTicketWindow() {
    const env: any = this.ticketEnvio as any;
    const dets = Array.isArray(this.ticketDetalles) ? this.ticketDetalles : [];
    if (!env) return;
    const remitente = this.personaLabelById(env?.remitente) || env?.remitente || '-';
    const destinatario = this.personaLabelById(env?.destinatario) || env?.destinatario || '-';
    const creadoPor = String(env?.usuario_crea || '').trim();
    const origen = this.getPuntoNombre(env?.punto_origen_id);
    const destino = this.getPuntoNombre(env?.punto_destino_id);
    const destinoDireccion = this.getPuntoDireccion(env?.punto_destino_id);
    const fecha = this.utilSrv.formatFecha(env?.fecha_envio || '');
    const trackingCode = String(env?.id_tracking || '').trim();
    const qrData = String(this.publicTrackingUrl || '').trim() || trackingCode || String(env?.ticket_numero || '').trim();
    const qrSrc = qrData ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrData)}` : '';
    const logo = this.companyLogoSrc();
    const lema = String(this.companiaLema || '').trim();
    const consideraciones = String(this.companiaConsideraciones || '').trim();
    const condiciones = String(this.companiaCondiciones || '').trim();
    const rows = dets.map((d: any, i: number) => {
      const n = Number(d?.numero_item || i + 1);
      const c = Number(d?.cantidad || 0);
      const pu = Number(d?.precio_unitario || 0);
      const st = this.getDetalleTotal(d);
      return `<tr>
  <td>${n}</td>
  <td class="r">${this.format2(c)}</td>
  <td>${this.escHtml(d?.descripcion || '')}</td>
  <td class="r">${this.format2(pu)}</td>
  <td class="r">${this.format2(st)}</td>
</tr>`;
    }).join('');
    const total = this.format2((dets || []).reduce((s: number, d: any) => s + this.getDetalleTotal(d), 0));
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Ticket ${this.escHtml(env?.ticket_numero || env?.id || '')}</title>
  <style>
    @page { size: 80mm auto; margin: 3mm; }
    html, body { width: 80mm; margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; }
    .wrap { width: 74mm; margin: 0 auto; }
    .logo { text-align:center; margin: 0 0 4px; }
    .logo img { max-width: 34mm; max-height: 16mm; object-fit: contain; }
    .h { text-align: center; font-weight: 700; }
    .muted { color: #333; font-size: 10px; }
    .sep { border-top: 1px dashed #000; margin: 6px 0; }
    .row { margin: 2px 0; word-break: break-word; }
    .row-lg { font-size: 12.5px; }
    .row-ticket { font-size: 16px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th, td { padding: 2px 0; border-bottom: 1px dotted #999; vertical-align: top; }
    .r { text-align: right; white-space: nowrap; }
    .tot { margin-top: 4px; text-align: right; font-weight: 700; font-size: 13px; }
    .qr { margin-top: 6px; text-align: center; }
    .qr img { width: 120px; height: 120px; object-fit: contain; }
  </style>
</head>
<body>
  <div class="wrap">
    ${logo ? `<div class="logo"><img src="${this.escHtml(logo)}" alt="Logo"/></div>` : ''}
    ${lema ? `<div class="row muted" style="text-align:center;">${this.escHtml(lema)}</div>` : ''}
    <div class="h">TICKET DE ENVIO</div>
    <div class="row row-ticket"><b>Ticket:</b> ${this.escHtml(env?.ticket_numero || '-')}</div>
    <div class="row">Remitente: ${this.escHtml(remitente)}</div>
    <div class="row">Destinatario: ${this.escHtml(destinatario)}</div>
    <div class="row row-lg"><b>Origen:</b> ${this.escHtml(origen)}</div>
    <div class="row row-lg"><b>Destino:</b> ${this.escHtml(destino)}</div>
    <div class="row"><b>Dirección destino:</b> ${this.escHtml(destinoDireccion)}</div>
    <div class="row">Fecha envio: ${this.escHtml(fecha || '-')}</div>
    ${creadoPor ? `<div class="row"><b>Creado por:</b> ${this.escHtml(creadoPor)}</div>` : ''}
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
    ${(trackingCode || qrSrc) ? `<div class="sep"></div><div class="row muted" style="font-weight:700;">Código de seguimiento:</div><div class="row" style="font-weight:700;">${this.escHtml(trackingCode || '-')}</div>` : ''}
    ${consideraciones ? `<div class="row">${this.escHtml(consideraciones)}</div>` : ''}
    <div class="row"><b>Condiciones del servicio de encomiendas</b></div>
    ${condiciones ? `<div class="row">${this.escHtml(condiciones)}</div>` : ''}
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
    const preview: any = this.comprobantePreview || null;
    const rawQr = String(preview?.sunat?.qr || '').trim();
    const qrSrc = rawQr
      ? (rawQr.startsWith('http://') || rawQr.startsWith('https://') || rawQr.startsWith('data:image')
        ? rawQr
        : `data:image/png;base64,${rawQr}`)
      : '';
    const envioTicket = String(preview?.referencia?.envioId || '').trim();
    const trackingCode = String(preview?.referencia?.tracking || '').trim();
    const origen = String(preview?.referencia?.origen || '').trim();
    const destino = String(preview?.referencia?.destino || '').trim();
    const destinoDireccion = String(preview?.referencia?.destinoDireccion || '').trim();
    const remitente = String(preview?.referencia?.remitente || '').trim();
    const destinatario = String(preview?.referencia?.destinatario || '').trim();
    const guiaReferencia = String(preview?.referencia?.guiaReferencia || '').trim();
    const creadoPor = String(preview?.creadoPor || '').trim();
    const logo = this.companyLogoSrc();
    const lema = String(preview?.lema || this.companiaLema || '').trim();
    const consideraciones = String(preview?.consideraciones || this.companiaConsideraciones || '').trim();
    const condiciones = String(preview?.condiciones || this.companiaCondiciones || '').trim();
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
    @page { size: 80mm auto; margin: 2.5mm; }
    html, body { width: 80mm; margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; line-height: 1.24; }
    .wrap { width: 74mm; margin: 0 auto; }
    .logo { text-align:center; margin: 0 0 4px; }
    .logo img { max-width: 34mm; max-height: 16mm; object-fit: contain; }
    .h { text-align: center; font-weight: 700; }
    .hnum { font-size: 16px; }
    .muted { color: #000; font-size: 10px; }
    .sep { border-top: 1px solid #000; margin: 5px 0; }
    .row { margin: 2px 0; word-break: break-word; }
    .row-lg { font-size: 12.5px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th, td { padding: 2px 0; border-bottom: 0.5px solid #000; vertical-align: top; }
    .r { text-align: right; white-space: nowrap; }
    .tot { margin-top: 4px; }
    .tot .line { display: flex; justify-content: space-between; }
    .tot .final { font-weight: 700; font-size: 13px; border-top: 1px solid #000; padding-top: 3px; margin-top: 3px; }
    .qr { margin-top: 6px; text-align: center; }
    .qr img { width: 30mm; height: 30mm; object-fit: contain; image-rendering: crisp-edges; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
</head>
<body>
  <div class="wrap">
    ${logo ? `<div class="logo"><img src="${this.escHtml(logo)}" alt="Logo"/></div>` : ''}
    ${lema ? `<div class="row muted" style="text-align:center;">${this.escHtml(lema)}</div>` : ''}
    <div class="h">${this.escHtml(v?.docTitle || 'Comprobante')}</div>
    <div class="h hnum">${this.escHtml(v?.numero || '-')}</div>
    <div class="sep"></div>
    <div class="row"><b>RUC:</b> ${this.escHtml(v?.ruc || '-')}</div>
    <div class="row"><b>Empresa:</b> ${this.escHtml(v?.razon || '-')}</div>
    <div class="row"><b>Cliente Doc:</b> ${this.escHtml(v?.clienteDocumento || '-')}</div>
    <div class="row"><b>Cliente:</b> ${this.escHtml(v?.clienteNombre || '-')}</div>
    ${envioTicket ? `<div class="row row-lg"><b>Ticket:</b> ${this.escHtml(envioTicket)}</div>` : ''}
    ${remitente ? `<div class="row"><b>Remitente:</b> ${this.escHtml(remitente)}</div>` : ''}
    ${destinatario ? `<div class="row"><b>Destinatario:</b> ${this.escHtml(destinatario)}</div>` : ''}
    ${origen ? `<div class="row row-lg"><b>Origen:</b> ${this.escHtml(origen)}</div>` : ''}
    ${destino ? `<div class="row row-lg"><b>Destino:</b> ${this.escHtml(destino)}</div>` : ''}
    ${destinoDireccion ? `<div class="row"><b>Dirección destino:</b> ${this.escHtml(destinoDireccion)}</div>` : ''}
    ${guiaReferencia ? `<div class="row"><b>Guía de remisión de referencia:</b> <b>${this.escHtml(guiaReferencia)}</b></div>` : ''}
    ${creadoPor ? `<div class="row"><b>Creado por:</b> ${this.escHtml(creadoPor)}</div>` : ''}
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
    ${(trackingCode || qrSrc) ? `<div class="sep"></div><div class="row muted" style="font-weight:700;">Código de seguimiento:</div><div class="row" style="font-weight:700;">${this.escHtml(trackingCode || '-')}</div>` : ''}
    ${consideraciones ? `<div class="row">${this.escHtml(consideraciones)}</div>` : ''}
    <div class="row"><b>Condiciones del servicio de encomiendas</b></div>
    ${condiciones ? `<div class="row">${this.escHtml(condiciones)}</div>` : ''}
    ${qrSrc ? `<div class="qr"><img src="${this.escHtml(qrSrc)}" alt="QR comprobante"/></div>` : ''}
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
              precio_total: Number(d?.precio_total ?? d?.valor_unitario) || 0,
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
  tieneGuiaReferencia = false;
  guiaReferenciaSerie = '';
  guiaReferenciaNumero = '';

  // Detalle de envío (creación)
  stagedDetalles: Array<{ cantidad: number; descripcion: any; precio_unitario: number; precio_total: number }> = [];
  detallesLoading: boolean = false;
  newDet: { cantidad: number | null; descripcion: string; precio_unitario: number | null; precio_total: number | null } = { cantidad: null, descripcion: '', precio_unitario: null, precio_total: null };
  get stagedSubtotal(): number { return this.stagedDetalles.reduce((s, d) => s + this.getDetalleTotal(d), 0); }
  private getDetalleTotal(det: any): number {
    const explicit = det?.precio_total ?? det?.valor_unitario;
    if (explicit !== null && explicit !== undefined && explicit !== '') {
      const total = Number(explicit);
      if (Number.isFinite(total) && total >= 0) return total;
    }
    return (Number(det?.cantidad) || 0) * (Number(det?.precio_unitario) || 0);
  }
  private round2(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
  onNewDetCantidadChange() {
    const c = Number(this.newDet.cantidad);
    if (!(c > 0)) return;
    const pu = Number(this.newDet.precio_unitario);
    const pt = Number(this.newDet.precio_total);
    if (Number.isFinite(pu) && pu >= 0) {
      this.newDet.precio_total = this.round2(c * pu);
      return;
    }
    if (Number.isFinite(pt) && pt >= 0) {
      this.newDet.precio_unitario = this.round2(pt / c);
    }
  }
  onNewDetPrecioUnitarioChange() {
    const c = Number(this.newDet.cantidad);
    const pu = Number(this.newDet.precio_unitario);
    if (!(c > 0) || !Number.isFinite(pu) || pu < 0) return;
    this.newDet.precio_total = this.round2(c * pu);
  }
  onNewDetPrecioTotalChange() {
    const c = Number(this.newDet.cantidad);
    const pt = Number(this.newDet.precio_total);
    if (!(c > 0) || !Number.isFinite(pt) || pt < 0) return;
    this.newDet.precio_unitario = this.round2(pt / c);
  }
  addDetalle() {
    const c = Number(this.newDet.cantidad);
    const p = Number(this.newDet.precio_unitario);
    const pt = Number(this.newDet.precio_total);
    const desc = (this.newDet.descripcion || '').toString().trim();
    if (!c || !p || !desc) return;
    this.stagedDetalles.push({ cantidad: c, precio_unitario: p, precio_total: this.round2(Number.isFinite(pt) ? pt : c * p), descripcion: desc });
    this.newDet = { cantidad: null, descripcion: '', precio_unitario: null, precio_total: null };
  }
  removeDetalle(i: number) { this.stagedDetalles.splice(i, 1); }

  onTieneGuiaReferenciaChange(checked: boolean) {
    if (checked) return;
    this.guiaReferenciaSerie = '';
    this.guiaReferenciaNumero = '';
  }
  private applyGuiaReferenciaToForm(guiaReferencia: any) {
    const raw = String(guiaReferencia || '').trim();
    if (!raw) {
      this.tieneGuiaReferencia = false;
      this.guiaReferenciaSerie = '';
      this.guiaReferenciaNumero = '';
      return;
    }
    const idx = raw.indexOf('-');
    if (idx < 0) {
      this.tieneGuiaReferencia = true;
      this.guiaReferenciaSerie = raw;
      this.guiaReferenciaNumero = '';
      return;
    }
    this.tieneGuiaReferencia = true;
    this.guiaReferenciaSerie = raw.slice(0, idx).trim();
    this.guiaReferenciaNumero = raw.slice(idx + 1).trim();
  }
  private buildGuiaReferenciaForPayload() {
    if (!this.tieneGuiaReferencia) return null;
    const serie = String(this.guiaReferenciaSerie || '').trim();
    const numero = String(this.guiaReferenciaNumero || '').trim();
    if (!serie || !numero) return null;
    return `${serie}-${numero}`;
  }

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
  private specialDocNotFoundRem = false;
  private specialDocNotFoundDest = false;
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
  get compImpuesto(): number {
    const total = this.stagedSubtotal || 0;
    return this.compTipoNombre().toLowerCase().includes('fact') ? this.extractIgvFromTotal(total) : 0;
  }
  get compTotal(): number { return this.stagedSubtotal || 0; }
  get compTotalConImpuesto(): number { return this.compTotal; }
  compTipoNombre(): string {
    const t = this.compTipoSel || this.compTipos.find(x => Number(this.normalizeTipoComprobante((x as any).tipo_comprobante_sunat)) === Number(this.compTipoId)) || null;
    const tipo = t ? this.normalizeTipoComprobante((t as any).tipo_comprobante_sunat) : '';
    if (tipo === '01') return 'Factura';
    if (tipo === '03') return 'Boleta';
    return '';
  }
  private pad6(n: number): string { const s = String(n || 0); return s.padStart(8, '0'); }
  private normalizeTipoComprobante(value: any): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    return raw.length === 1 ? `0${raw}` : raw;
  }
  private isFacturaTipo(value: any): boolean {
    return this.normalizeTipoComprobante(value) === '01';
  }
  private extractIgvFromTotal(total: number): number {
    const amount = Number(total || 0);
    if (amount <= 0) return 0;
    return +((amount * 18) / 118).toFixed(2);
  }
  private baseFromTotal(total: number): number {
    const amount = Number(total || 0);
    if (amount <= 0) return 0;
    const igv = this.extractIgvFromTotal(amount);
    return +(amount - igv).toFixed(2);
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
  getPuntoDireccion(id: number | null | undefined): string {
    const p = (this.puntos || []).find(x => (x as any).id === Number(id));
    const dir = String((p as any)?.direccion || '').trim();
    return dir || '-';
  }

  // Lista filtrada y paginaciÃ³n
  get filteredEnvios(): Envio[] {
    const term = (this.search || '').trim().toLowerCase();
    const filtered = (this.lista_envios || []).filter((e: any) => {
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
    return filtered.sort((a: any, b: any) => this.compareTicketDesc(a, b));
  }
  get total(): number { return this.filteredEnvios.length; }
  get totalPages(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }
  get pageItems(): Envio[] { const start = (this.page - 1) * this.pageSize; return this.filteredEnvios.slice(start, start + this.pageSize); }
  get pageStart(): number { return this.total ? (this.page - 1) * this.pageSize + 1 : 0; }
  get pageEnd(): number { return Math.min(this.page * this.pageSize, this.total); }
  setPage(n: number) { this.page = Math.min(Math.max(1, n), this.totalPages); }
  onFilterChange() {
    this.page = 1;
    this.scheduleExactSearchFallback();
  }
  onFechaFilterChange() {
    this.onFilterChange();
    this.loadEnvios();
  }
  private formaPagoLabel(value: any): string {
    const id = Number(value || 0);
    const found = (this.payTipos || []).find((p: any) => Number((p as any)?.id || 0) === id);
    if (found) return String((found as any)?.nombre || '-');
    const text = String(value || '').trim();
    return text || '-';
  }
  clearFechaFilter() {
    if (!this.fechaFiltro) return;
    this.fechaFiltro = '';
    this.onFechaFilterChange();
  }

  isAdminUser(): boolean {
    try {
      const roles = this.getRoleNames();
      const hasAdminRole = roles.some((r) => {
        const v = String(r || '').toLowerCase().trim();
        if (!v) return false;
        if (v === 'admin' || v === 'super_admin' || v === 'administrador') return true;
        if (v.includes('admin') && !v.includes('sede')) return true;
        return false;
      });
      if (hasAdminRole) return true;
      const me = this.getCurrentMe() as any;
      if (me?.is_superuser || me?.superuser || me?.is_admin || me?.admin) return true;
      // Fallback funcional: en este módulo admin = no operario/admin_sede
      return !this.useSedeEndpointByRole();
    } catch {
      return false;
    }
  }

  private ymdFromDate(value: Date): string {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private initPagosDestinoControl(): void {
    if (!this.isAdminUser()) return;
    this.applyPagosDestinoPreset(this.pagosDestinoPreset, false);
    this.loadPagosDestino();
  }

  onPagosDestinoPresetChange(value: string): void {
    const preset = (value === 'lastMonth' || value === 'custom') ? value : 'last7';
    this.applyPagosDestinoPreset(preset as any, true);
  }

  private applyPagosDestinoPreset(preset: 'last7' | 'lastMonth' | 'custom', autoLoad: boolean): void {
    this.pagosDestinoPreset = preset;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (preset === 'last7') {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      this.pagosDestinoInicio = this.ymdFromDate(start);
      this.pagosDestinoFin = this.ymdFromDate(today);
      if (autoLoad) this.loadPagosDestino();
      return;
    }
    if (preset === 'lastMonth') {
      const firstCurrent = new Date(today.getFullYear(), today.getMonth(), 1);
      const firstPrev = new Date(firstCurrent.getFullYear(), firstCurrent.getMonth() - 1, 1);
      const lastPrev = new Date(firstCurrent.getFullYear(), firstCurrent.getMonth(), 0);
      this.pagosDestinoInicio = this.ymdFromDate(firstPrev);
      this.pagosDestinoFin = this.ymdFromDate(lastPrev);
      if (autoLoad) this.loadPagosDestino();
      return;
    }
    if (!this.pagosDestinoInicio) this.pagosDestinoInicio = this.ymdFromDate(today);
    if (!this.pagosDestinoFin) this.pagosDestinoFin = this.ymdFromDate(today);
  }

  onPagosDestinoInicioChange(value: string): void {
    this.pagosDestinoInicio = /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim()) ? String(value || '').trim() : '';
  }

  onPagosDestinoFinChange(value: string): void {
    this.pagosDestinoFin = /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim()) ? String(value || '').trim() : '';
  }

  get pagosDestinoRangeValid(): boolean {
    if (!this.pagosDestinoInicio || !this.pagosDestinoFin) return false;
    return this.pagosDestinoInicio <= this.pagosDestinoFin;
  }

  loadPagosDestino(): void {
    if (!this.isAdminUser()) return;
    if (!this.pagosDestinoRangeValid) {
      this.pagosDestinoError = 'Seleccione un rango de fechas válido';
      this.pagosDestino = [];
      return;
    }
    this.pagosDestinoLoading = true;
    this.pagosDestinoError = null;
    this.enviosSrv.getEnviosPagosDestino(this.pagosDestinoInicio, this.pagosDestinoFin).subscribe({
      next: (res: Envio[]) => {
        const list = (res || []) as Envio[];
        this.pagosDestino = list.sort((a: any, b: any) => String((b as any)?.fecha_cobro_destino || '').localeCompare(String((a as any)?.fecha_cobro_destino || '')));
        this.pagosDestinoLoading = false;
      },
      error: () => {
        this.pagosDestino = [];
        this.pagosDestinoLoading = false;
        this.pagosDestinoError = 'No se pudo cargar pagos destino por rango';
      }
    });
  }

  togglePagosDestinoPanel(): void {
    if (!this.isAdminUser()) return;
    this.showPagosDestinoPanel = !this.showPagosDestinoPanel;
    if (this.showPagosDestinoPanel && !this.pagosDestino.length && !this.pagosDestinoLoading) {
      this.loadPagosDestino();
    }
  }
  private scheduleExactSearchFallback() {
    try {
      if (this.exactSearchTimer) {
        clearTimeout(this.exactSearchTimer);
        this.exactSearchTimer = null;
      }
    } catch {}
    const term = String(this.search || '').trim();
    if (!term || term.length < 2) return;
    this.exactSearchTimer = setTimeout(() => this.runExactSearchFallback(term), 300);
  }

  private runExactSearchFallback(termRaw: string) {
    const term = String(termRaw || '').trim();
    if (!term || term.length < 2) return;
    const key = term.toUpperCase();
    if (this.exactSearchInFlight) return;
    if (this.exactSearchTried.has(key)) return;
    if (this.hasLocalSearchMatch(term)) return;
    this.exactSearchInFlight = true;
    this.enviosSrv.getEnviosExacto(term).subscribe({
      next: (res: Envio[]) => {
        const incoming = (res || []) as Envio[];
        if (incoming.length) {
          const byId = new Map<number, Envio>();
          for (const e of (this.lista_envios || [])) byId.set(Number((e as any)?.id || 0), e);
          for (const e of incoming) {
            const id = Number((e as any)?.id || 0);
            if (id > 0) byId.set(id, e);
          }
          this.lista_envios = Array.from(byId.values()).sort((a: any, b: any) => this.compareTicketDesc(a, b));
        } else {
          this.exactSearchTried.add(key);
        }
        this.exactSearchInFlight = false;
      },
      error: () => {
        this.exactSearchInFlight = false;
      }
    });
  }

  private hasLocalSearchMatch(termRaw: string): boolean {
    const term = String(termRaw || '').trim().toLowerCase();
    if (!term) return true;
    return (this.lista_envios || []).some((e: any) => {
      const remit = (this.personaLabelById(e?.remitente) || '').toLowerCase();
      const dest = (this.personaLabelById(e?.destinatario) || '').toLowerCase();
      const values = [
        String(e.remitente ?? ''), String(e.destinatario ?? ''), remit, dest,
        String(e.peso ?? ''), String(e.fecha_envio ?? ''), String(e.punto_origen_id ?? ''), String(e.punto_destino_id ?? ''),
        String(e.ticket_numero ?? ''), String(e.guia ?? ''), String(e.manifiesto ?? ''), String(e.clave_recojo ?? ''),
        String(e.estado_envio ?? ''), String(e.id_tracking ?? ''), String(e.usuario_crea ?? '')
      ].join(' ').toLowerCase();
      if (this.personaSearchTarget === 'remitente') return remit.includes(term);
      if (this.personaSearchTarget === 'destinatario') return dest.includes(term);
      return remit.includes(term) || dest.includes(term) || values.includes(term);
    });
  }
  resetFilters() { this.search = ''; this.entregaFilter = 'all'; this.fechaFiltro = ''; this.setPage(1); this.loadEnvios(); }
  private compareTicketDesc(a: any, b: any): number {
    const ta = String(a?.ticket_numero || '').trim().toUpperCase();
    const tb = String(b?.ticket_numero || '').trim().toUpperCase();
    if (!ta && !tb) return (Number(b?.id || 0) - Number(a?.id || 0));
    if (!ta) return 1;
    if (!tb) return -1;
    const byTicket = tb.localeCompare(ta, 'es', { numeric: true, sensitivity: 'base' });
    if (byTicket !== 0) return byTicket;
    return (Number(b?.id || 0) - Number(a?.id || 0));
  }

  // Autocomplete personas helpers
  get filteredRemitentes(): Persona[] { const q = (this.remitenteQuery || '').toLowerCase().trim(); const list = this.personas || []; if (!q) return list.slice(0, 10); return list.filter(p => this.personaLabel(p).toLowerCase().includes(q)).slice(0, 10); }
  get filteredDestinatarios(): Persona[] { const q = (this.destinatarioQuery || '').toLowerCase().trim(); const list = this.personas || []; if (!q) return list.slice(0, 10); return list.filter(p => this.personaLabel(p).toLowerCase().includes(q)).slice(0, 10); }
  personaLabel(p: Persona): string { const nombre = [p.nombre, p.apellido].filter(Boolean).join(' ').trim(); const razon = (p.razon_social || '').trim(); const base = (razon || nombre || '').trim(); const doc = (p.nro_documento || '').trim(); return [base, doc].filter(Boolean).join(' - '); }
  personaLabelById(id: any): string | null { const n = Number(id); if (!n) return null; const p = (this.personas || []).find(x => (x as any).id === n); return p ? this.personaLabel(p) : null; }
  personaCelularById(id: any): string | null { const n = Number(id); if (!n) return null; const p = (this.personas || []).find(x => (x as any).id === n); return p ? String((p as any).celular || '') : null; }
  private resetRemitenteCredito() { this.remitenteCredito = null; this.remitenteCreditoLoading = false; this.remitenteCreditoError = null; }
  private hasCreditoFields(item: any): boolean {
    if (!item || typeof item !== 'object') return false;
    return Object.prototype.hasOwnProperty.call(item, 'tiene_credito')
      || Object.prototype.hasOwnProperty.call(item, 'limite_credito')
      || Object.prototype.hasOwnProperty.call(item, 'fecha_credito');
  }
  private loadRemitenteCreditoByDoc(nro: string) {
    const doc = String(nro || '').trim();
    if (!doc) { this.resetRemitenteCredito(); return; }
    this.remitenteCreditoLoading = true;
    this.remitenteCreditoError = null;
    const query = `q=${encodeURIComponent(doc)}`;
    this.personasSrv.getPersonaComplete(query).subscribe({
      next: (res: any) => {
        const item = (res?.items || [])[0] || null;
        this.remitenteCredito = this.hasCreditoFields(item) ? item : null;
        this.remitenteCreditoError = null;
        this.remitenteCreditoLoading = false;
      },
      error: (err: any) => {
        this.remitenteCreditoLoading = false;
        this.remitenteCredito = null;
        const status = Number((err as any)?.status || 0);
        // Si no existe data de crédito, ocultar mensaje de error.
        if (status === 404 || status === 400 || status === 422) {
          this.remitenteCreditoError = null;
          return;
        }
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
    const roleSet = new Set<string>();
    const pushRole = (value: any) => {
      const v = String(value ?? '').toLowerCase().trim();
      if (v) roleSet.add(v);
    };

    const roles = Array.isArray(me?.roles) ? me.roles : [];
    roles.forEach((r: any) => {
      pushRole(r?.name);
      pushRole(r?.nombre);
      pushRole(r?.rol);
      pushRole(r?.role);
      pushRole(r);
    });

    // Algunos backends exponen el rol principal fuera de roles[].
    pushRole(me?.rol);
    pushRole(me?.role);
    pushRole(me?.tipo_usuario);
    pushRole(me?.tipoUsuario);
    pushRole(me?.user?.rol);
    pushRole(me?.user?.role);

    return Array.from(roleSet);
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
    const bySede = (series || []).filter(s => Number(s.sede_id) === sedeId);
    if (!bySede.length) return null;

    const byNullTipo = bySede.find((s: any) => {
      const tipo = (s as any)?.tipo_comprobante_sunat;
      return tipo == null || String(tipo).trim() === '';
    });
    if (byNullTipo) return byNullTipo;

    const byTkSerie = bySede.find((s: any) =>
      String((s as any)?.serie || '').trim().toUpperCase().startsWith('TK')
    );
    return byTkSerie || null;
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
    this.remitenteDocType = this.normalizeDocTypeOr((p as any).tipo_documento, this.remitenteDocType as any);
    this.remitenteDocNumber = String((p as any).nro_documento || this.remitenteDocNumber || '');
    this.remitenteNombre = String((p as any).nombre || '');
    this.remitenteApellido = String((p as any).apellido || '');
    this.specialDocNotFoundRem = false;
    this.remLookupError = null;
    this.loadRemitenteCreditoByDoc(String((p as any).nro_documento || ''));
  }
  selectDestinatario(p: Persona) {
    (this.newEnvio as any).destinatario = (p as any).id;
    this.destinatarioQuery = this.personaLabel(p);
    this.destinatarioDocType = this.normalizeDocTypeOr((p as any).tipo_documento, this.destinatarioDocType as any);
    this.destinatarioDocNumber = String((p as any).nro_documento || this.destinatarioDocNumber || '');
    this.destinatarioNombre = String((p as any).nombre || '');
    this.destinatarioApellido = String((p as any).apellido || '');
    this.destinatarioCelular = String((p as any).celular || '');
    this.specialDocNotFoundDest = false;
    this.destLookupError = null;
    this.showDestinatarioOptions = false;
  }
  clearRemitente() {
    (this.newEnvio as any).remitente = null as any;
    this.remitenteQuery = '';
    this.remitenteNombre = '';
    this.remitenteApellido = '';
    this.specialDocNotFoundRem = false;
    this.resetRemitenteCredito();
  }
  clearDestinatario() {
    (this.newEnvio as any).destinatario = null as any;
    this.destinatarioQuery = '';
    this.destinatarioNombre = '';
    this.destinatarioApellido = '';
    this.specialDocNotFoundDest = false;
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
    return d.length >= 8;
  }
  private docMinLengthError(): string {
    return 'El número de documento debe tener al menos 8 dígitos';
  }
  private normalizeDocType(value: any): 'RUC' | 'DNI' | 'CE' | 'P' | '' {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) return '';
    if (raw === 'RUC') return 'RUC';
    if (raw === 'DNI') return 'DNI';
    if (raw === 'CE' || raw.includes('CARN')) return 'CE';
    if (raw === 'P' || raw.includes('PASAP')) return 'P';
    return '' as any;
  }
  private normalizeDocTypeOr(value: any, fallback: 'RUC' | 'DNI' | 'CE' | 'P' = 'DNI'): 'RUC' | 'DNI' | 'CE' | 'P' {
    return this.normalizeDocType(value) || fallback;
  }
  private isSameDocType(requested: any, candidate: any): boolean {
    const req = this.normalizeDocType(requested);
    const cand = this.normalizeDocType(candidate);
    return !!req && !!cand && req === cand;
  }
  private findPersonaByDoc(list: Persona[] | any[], type: 'RUC' | 'DNI' | 'CE' | 'P', nro: string): Persona | null {
    const target = String(nro || '').trim();
    const found = (list || []).find((p: any) =>
      String((p as any)?.nro_documento || '').trim() === target &&
      this.isSameDocType(type, (p as any)?.tipo_documento)
    );
    return (found || null) as any;
  }
  private fetchPersonaByDocumento(type: 'RUC' | 'DNI' | 'CE' | 'P', nro: string, next: (persona: Persona | null) => void) {
    this.personasSrv.getPersonaComplete({ tipo_documento: type, nro_documento: nro }).subscribe({
      next: (res: any) => {
        const items = (res?.items || []) as any[];
        const item = items.find((p: any) =>
          String((p as any)?.nro_documento || '').trim() === String(nro || '').trim() &&
          this.isSameDocType(type, (p as any)?.tipo_documento)
        ) || items.find((p: any) =>
          String((p as any)?.nro_documento || '').trim() === String(nro || '').trim()
        ) || items[0] || null;
        if (!item) { next(null); return; }
        const persona: Persona = {
          id: Number((item as any)?.id || 0),
          nombre: String((item as any)?.nombre || ''),
          apellido: String((item as any)?.apellido || ''),
          direccion: String((item as any)?.direccion || ''),
          razon_social: String((item as any)?.razon_social || ''),
          celular: String((item as any)?.celular || ''),
          email: String((item as any)?.email || ''),
          nro_documento: String((item as any)?.nro_documento || nro),
          tipo_documento: String((item as any)?.tipo_documento || type),
        };
        next(persona);
      },
      error: () => { next(null); }
    });
  }
  lookupRemitente() {
    this.remLookupError = null; const type = this.remitenteDocType; const nro = (this.remitenteDocNumber || '').trim();
    if (!type || !nro) { this.remLookupError = 'Ingrese tipo y numero'; return; }
    if (!this.isValidDoc(type, nro)) { this.remLookupError = this.docMinLengthError(); return; }
    const found = this.findPersonaByDoc(this.personas, type as any, nro);
    if (found) { this.selectRemitente(found); return; }
    this.remLookupLoading = true;
    this.fetchPersonaByDocumento(type, nro, (persona) => {
      if (persona && Number((persona as any).id || 0) > 0) {
        const existingLocal = (this.personas || []).find(p => Number((p as any).id) === Number((persona as any).id));
        const selected = existingLocal || persona;
        if (!existingLocal) this.personas = [selected as any, ...this.personas];
        this.selectRemitente(selected as any);
        this.remLookupLoading = false;
        return;
      }
      if (this.isSpecialDocType(type)) {
        this.specialDocNotFoundRem = true;
        this.remLookupLoading = false;
        this.remLookupError = 'No se encontró el documento. Complete nombre y apellido para registrarlo.';
        return;
      }
      if (type === 'RUC') {
        this.personasSrv.getDatosRUC(type, nro).subscribe({ next: (data: any) => { const body = this.buildPersonaFromRUC(data); if (!(body as any).nro_documento) { this.remLookupLoading = false; this.remLookupError = 'No encontrado'; return; } this.personasSrv.createPersona(body).subscribe({ next: (created: any) => { this.personas = [created as any, ...this.personas]; this.selectRemitente(created as any); this.remLookupLoading = false; }, error: () => { this.remLookupLoading = false; this.remLookupError = 'No se pudo crear'; } }); }, error: () => { this.remLookupLoading = false; this.remLookupError = 'No encontrado'; } });
      } else {
        this.personasSrv.getDatosDNI(type, nro).subscribe({ next: (data: any) => { const body = this.buildPersonaFromDNI(data); if (!(body as any).nro_documento) { this.remLookupLoading = false; this.remLookupError = 'No encontrado'; return; } this.personasSrv.createPersona(body).subscribe({ next: (created: any) => { this.personas = [created as any, ...this.personas]; this.selectRemitente(created as any); this.remLookupLoading = false; }, error: () => { this.remLookupLoading = false; this.remLookupError = 'No se pudo crear'; } }); }, error: () => { this.remLookupLoading = false; this.remLookupError = 'No encontrado'; } });
      }
    });
  }
  lookupDestinatario() {
    this.destLookupError = null; const type = this.destinatarioDocType; const nro = (this.destinatarioDocNumber || '').trim();
    if (!type || !nro) { this.destLookupError = 'Ingrese tipo y numero'; return; }
    if (!this.isValidDoc(type, nro)) { this.destLookupError = this.docMinLengthError(); return; }
    const found = this.findPersonaByDoc(this.personas, type as any, nro);
    if (found) { this.selectDestinatario(found); return; }
    this.destLookupLoading = true;
    this.fetchPersonaByDocumento(type, nro, (persona) => {
      if (persona && Number((persona as any).id || 0) > 0) {
        const existingLocal = (this.personas || []).find(p => Number((p as any).id) === Number((persona as any).id));
        const selected = existingLocal || persona;
        if (!existingLocal) this.personas = [selected as any, ...this.personas];
        this.selectDestinatario(selected as any);
        this.destLookupLoading = false;
        return;
      }
      if (this.isSpecialDocType(type)) {
        this.specialDocNotFoundDest = true;
        this.destLookupLoading = false;
        this.destLookupError = 'No se encontró el documento. Complete nombre y apellido para registrarlo.';
        return;
      }
      if (type === 'RUC') {
        this.personasSrv.getDatosRUC(type, nro).subscribe({ next: (data: any) => { const body = this.buildPersonaFromRUC(data); if (!(body as any).nro_documento) { this.destLookupLoading = false; this.destLookupError = 'No encontrado'; return; } this.personasSrv.createPersona(body).subscribe({ next: (created: any) => { this.personas = [created as any, ...this.personas]; this.selectDestinatario(created as any); this.destLookupLoading = false; }, error: () => { this.destLookupLoading = false; this.destLookupError = 'No se pudo crear'; } }); }, error: () => { this.destLookupLoading = false; this.destLookupError = 'No encontrado'; } });
      } else {
        this.personasSrv.getDatosDNI(type, nro).subscribe({ next: (data: any) => { const body = this.buildPersonaFromDNI(data); if (!(body as any).nro_documento) { this.destLookupLoading = false; this.destLookupError = 'No encontrado'; return; } this.personasSrv.createPersona(body).subscribe({ next: (created: any) => { this.personas = [created as any, ...this.personas]; this.selectDestinatario(created as any); this.destLookupLoading = false; }, error: () => { this.destLookupLoading = false; this.destLookupError = 'No se pudo crear'; } }); }, error: () => { this.destLookupLoading = false; this.destLookupError = 'No encontrado'; } });
      }
    });
  }

  lookupCliente() {
    this.compLookupError = null; const type = this.compDocType; const nro = (this.compDocNumber || '').trim();
    if (!type || !nro) { this.compLookupError = 'Ingrese tipo y numero'; return; }
    if (!this.isValidDoc(type, nro)) { this.compLookupError = this.docMinLengthError(); return; }
    const found = (this.personas || []).find(p => (p as any).nro_documento === nro && (p as any).tipo_documento === type);
    if (found) { this.compClienteId = (found as any).id; return; }
    this.compLookupLoading = true;
    if (type === 'RUC') {
      this.personasSrv.getDatosRUC(type, nro).subscribe({ next: (data: any) => { const body = this.buildPersonaFromRUC(data); if (!(body as any).nro_documento) { this.compLookupLoading = false; this.compLookupError = 'No encontrado'; return; } this.personasSrv.createPersona(body).subscribe({ next: (created: any) => { this.personas = [created as any, ...this.personas]; this.compClienteId = (created as any).id || null; this.compLookupLoading = false; }, error: () => { this.compLookupLoading = false; this.compLookupError = 'No se pudo crear'; } }); }, error: () => { this.compLookupLoading = false; this.compLookupError = 'No encontrado'; } });
    } else {
      this.personasSrv.getDatosDNI(type, nro).subscribe({ next: (data: any) => { const body = this.buildPersonaFromDNI(data); if (!(body as any).nro_documento) { this.compLookupLoading = false; this.compLookupError = 'No encontrado'; return; } this.personasSrv.createPersona(body).subscribe({ next: (created: any) => { this.personas = [created as any, ...this.personas]; this.compClienteId = (created as any).id || null; this.compLookupLoading = false; }, error: () => { this.compLookupLoading = false; this.compLookupError = 'No se pudo crear'; } }); }, error: () => { this.compLookupLoading = false; this.compLookupError = 'No encontrado'; } });
    }
  }

  onSpecialApellidoEnter(role: 'remitente' | 'destinatario'): void {
    if (role === 'remitente') {
      if (this.isSpecialDocType(this.remitenteDocType)) this.tryCreateSpecialPersonaFromInputs('remitente');
      return;
    }
    if (this.isSpecialDocType(this.destinatarioDocType)) this.tryCreateSpecialPersonaFromInputs('destinatario');
  }

  onSpecialApellidoBlur(role: 'remitente' | 'destinatario'): void {
    if (role === 'remitente') {
      if (!this.isSpecialDocType(this.remitenteDocType)) return;
      if (String(this.remitenteNombre || '').trim() && String(this.remitenteApellido || '').trim()) {
        this.remLookupError = null;
      }
      this.tryCreateSpecialPersonaFromInputs('remitente');
      return;
    }
    if (!this.isSpecialDocType(this.destinatarioDocType)) return;
    if (String(this.destinatarioNombre || '').trim() && String(this.destinatarioApellido || '').trim()) {
      this.destLookupError = null;
    }
    this.tryCreateSpecialPersonaFromInputs('destinatario');
  }

  private tryCreateSpecialPersonaFromInputs(role: 'remitente' | 'destinatario'): void {
    const isRem = role === 'remitente';
    const docType = (isRem ? this.remitenteDocType : this.destinatarioDocType) as any;
    if (!this.isSpecialDocType(docType)) return;
    const currentId = Number((this.newEnvio as any)?.[role] || 0);
    if (currentId > 0) return;

    const nro = String(isRem ? this.remitenteDocNumber : this.destinatarioDocNumber).trim();
    const nombre = String(isRem ? this.remitenteNombre : this.destinatarioNombre).trim();
    const apellido = String(isRem ? this.remitenteApellido : this.destinatarioApellido).trim();
    if (!nro || !nombre || !apellido) return;

    const foundLocal = this.findPersonaByDoc(this.personas, docType, nro);
    if (foundLocal) {
      if (isRem) this.selectRemitente(foundLocal); else this.selectDestinatario(foundLocal);
      return;
    }

    const isLoading = isRem ? this.remLookupLoading : this.destLookupLoading;
    if (isLoading) return;
    if (isRem) this.remLookupLoading = true; else this.destLookupLoading = true;

    const createNow = () => {
      const body = this.buildPersonaFromSpecial(docType, nro, nombre, apellido);
      this.personasSrv.createPersona(body).subscribe({
        next: (created: any) => {
          this.personas = [created as any, ...this.personas];
          if (isRem) {
            this.specialDocNotFoundRem = false;
            this.remLookupLoading = false;
            this.selectRemitente(created as any);
          } else {
            this.specialDocNotFoundDest = false;
            this.destLookupLoading = false;
            this.selectDestinatario(created as any);
          }
        },
        error: () => {
          if (isRem) {
            this.remLookupLoading = false;
            this.remLookupError = 'No se pudo crear el remitente especial';
          } else {
            this.destLookupLoading = false;
            this.destLookupError = 'No se pudo crear el destinatario especial';
          }
        }
      });
    };

    const notFoundFlag = isRem ? this.specialDocNotFoundRem : this.specialDocNotFoundDest;
    if (notFoundFlag) {
      createNow();
      return;
    }

    this.fetchPersonaByDocumento(docType, nro, (persona) => {
      if (persona && Number((persona as any).id || 0) > 0) {
        const existingLocal = (this.personas || []).find(p => Number((p as any).id) === Number((persona as any).id));
        const selected = existingLocal || persona;
        if (!existingLocal) this.personas = [selected as any, ...this.personas];
        if (isRem) {
          this.remLookupLoading = false;
          this.selectRemitente(selected as any);
        } else {
          this.destLookupLoading = false;
          this.selectDestinatario(selected as any);
        }
        return;
      }
      createNow();
    });
  }

  get compValid(): boolean {
    return !!this.compTipoId && !!this.compFormaPagoId && !!this.compNumeroComprobante && this.isValidDoc(this.compDocType as any, this.compDocNumber);
  }
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
    this.saveError = null; this.showCreate = true; this.remitenteQuery = ''; this.destinatarioQuery = ''; this.showRemitenteOptions = false; this.showDestinatarioOptions = false; this.stagedDetalles = []; this.newDet = { cantidad: null, descripcion: '', precio_unitario: null, precio_total: null };
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
    this.tieneGuiaReferencia = false;
    this.guiaReferenciaSerie = '';
    this.guiaReferenciaNumero = '';
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
      guia_referencia: String((item as any).guia_referencia || '').trim() || null,
    } as any;
    this.applyGuiaReferenciaToForm((item as any).guia_referencia);
    const remitentePersona = (this.personas || []).find(p => Number((p as any).id) === Number((item as any).remitente));
    if (remitentePersona) {
      this.remitenteDocType = this.normalizeDocTypeOr((remitentePersona as any).tipo_documento, 'DNI');
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
      this.destinatarioDocType = this.normalizeDocTypeOr((destinatarioPersona as any).tipo_documento, 'DNI');
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
              precio_total: Number((d as any).precio_total ?? (d as any).valor_unitario) || 0,
            }));
            let toSet = mapped;
            if (Array.isArray(list) && list.length && (!toSet || !toSet.length)) {
              toSet = (list || []).map((d: any) => ({
                cantidad: Number((d as any).cantidad ?? (d as any).qty ?? 0),
                descripcion: (d as any).descripcion ?? (d as any).description ?? '',
                precio_unitario: Number((d as any).precio_unitario ?? (d as any).precio ?? (d as any).price ?? 0),
                precio_total: Number((d as any).precio_total ?? (d as any).valor_unitario) || 0,
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
    const remNeedsSpecialData = this.isSpecialDocType(this.remitenteDocType) && Number(e?.remitente || 0) <= 0;
    const destNeedsSpecialData = this.isSpecialDocType(this.destinatarioDocType) && Number(e?.destinatario || 0) <= 0;
    const remSpecialDataOk = !remNeedsSpecialData || (!!String(this.remitenteNombre || '').trim() && !!String(this.remitenteApellido || '').trim());
    const destSpecialDataOk = !destNeedsSpecialData || (!!String(this.destinatarioNombre || '').trim() && !!String(this.destinatarioApellido || '').trim());
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
    const okGuiaReferencia = !this.tieneGuiaReferencia || (!!String(this.guiaReferenciaSerie || '').trim() && !!String(this.guiaReferenciaNumero || '').trim());
    return okRemitente && okDestinatario && remDocOk && destDocOk && remSpecialDataOk && destSpecialDataOk && okFormaPago && okPeso && okFecha && okOrigen && okDestino && lengthDetalle && okClave && okGuiaReferencia;
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
    this.tieneGuiaReferencia = false;
    this.guiaReferenciaSerie = '';
    this.guiaReferenciaNumero = '';
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
    const guiaReferencia = this.buildGuiaReferenciaForPayload();
    const ticketNumero = ticketSerie ? this.buildTicketNumero(ticketSerie) : (String(e.ticket_numero || '').trim() || null);
    const estadoPago = !!e.estado_pago;
    const pagoDestino = estadoPago ? false : true;
    const payload: any = {
      remitente: Number(e.remitente), destinatario: Number(e.destinatario), entrega_domicilio: !!e.entrega_domicilio, direccion_envio: String(e.direccion_envio || '').toUpperCase().trim(), estado_pago: estadoPago, pago_destino: pagoDestino, guia_referencia: guiaReferencia, clave_recojo: String(e.clave_recojo || '').trim(), peso: Number(e.peso) || 0, fecha_envio: String(e.fecha_envio || '').trim(), fecha_recepcion: String(e.fecha_recepcion || '').trim() || null, tipo_contenido: !!e.tipo_contenido, guia: e.guia != null ? Number(e.guia) : null, manifiesto: e.manifiesto != null ? Number(e.manifiesto) : null, valida_restricciones: !!e.valida_restricciones, punto_origen_id: Number(e.punto_origen_id), punto_destino_id: Number(e.punto_destino_id), ticket_numero: ticketNumero, placa_vehiculo: String(e.placa_vehiculo || '').trim() || null
    };
    this.saving = true; this.saveError = null;
    if (this.editing && this.editingId) {
      this.enviosSrv.updateEnvios(this.editingId, payload).subscribe({
        next: (res: any) => {
          const updated: Envio = { id: res?.id ?? this.editingId!, remitente: res?.remitente ?? payload.remitente, destinatario: res?.destinatario ?? payload.destinatario, estado_pago: res?.estado_pago ?? payload.estado_pago, pago_destino: res?.pago_destino ?? payload.pago_destino, guia_referencia: res?.guia_referencia ?? payload.guia_referencia, clave_recojo: res?.clave_recojo ?? payload.clave_recojo, peso: res?.peso ?? payload.peso, fecha_envio: res?.fecha_envio ?? payload.fecha_envio, fecha_recepcion: res?.fecha_recepcion ?? payload.fecha_recepcion, tipo_contenido: res?.tipo_contenido ?? payload.tipo_contenido, guia: res?.guia ?? payload.guia, manifiesto: res?.manifiesto ?? payload.manifiesto, valida_restricciones: res?.valida_restricciones ?? payload.valida_restricciones, punto_origen_id: res?.punto_origen_id ?? payload.punto_origen_id, punto_destino_id: res?.punto_destino_id ?? payload.punto_destino_id, estado_entrega: res?.estado_entrega ?? payload.estado_entrega, entrega_domicilio: res?.entrega_domicilio ?? payload.entrega_domicilio, direccion_envio: res?.direccion_envio ?? payload.direccion_envio, ticket_numero: res?.ticket_numero ?? payload.ticket_numero, estado_whatsapp: res?.estado_whatsapp, estado_envio: res?.estado_envio, id_tracking: res?.id_tracking, usuario_crea: res?.usuario_crea, precio_envio: res?.precio_envio, placa_vehiculo: res?.placa_vehiculo ?? payload.placa_vehiculo } as Envio;
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
        const updated: Envio = { id: newId || (Math.max(0, ...(this.lista_envios.map((x: any) => x.id).filter(Number))) + 1), remitente: res?.remitente ?? payload.remitente, destinatario: res?.destinatario ?? payload.destinatario, estado_pago: res?.estado_pago ?? payload.estado_pago, pago_destino: res?.pago_destino ?? payload.pago_destino, guia_referencia: res?.guia_referencia ?? payload.guia_referencia, clave_recojo: res?.clave_recojo ?? payload.clave_recojo, peso: res?.peso ?? payload.peso, fecha_envio: res?.fecha_envio ?? payload.fecha_envio, fecha_recepcion: res?.fecha_recepcion ?? payload.fecha_recepcion, tipo_contenido: res?.tipo_contenido ?? payload.tipo_contenido, guia: res?.guia ?? payload.guia, manifiesto: res?.manifiesto ?? payload.manifiesto, valida_restricciones: res?.valida_restricciones ?? payload.valida_restricciones, punto_origen_id: res?.punto_origen_id ?? payload.punto_origen_id, punto_destino_id: res?.punto_destino_id ?? payload.punto_destino_id, estado_entrega: res?.estado_entrega ?? payload.estado_entrega, entrega_domicilio: res?.entrega_domicilio ?? payload.entrega_domicilio, direccion_envio: res?.direccion_envio ?? payload.direccion_envio, ticket_numero: res?.ticket_numero ?? payload.ticket_numero, estado_whatsapp: 'Pendiente', estado_envio: 'Recepción', id_tracking: res?.id_tracking, usuario_crea: res?.usuario_crea, precio_envio: res?.precio_envio, placa_vehiculo: res?.placa_vehiculo ?? payload.placa_vehiculo } as Envio;
        const detalles = (this.stagedDetalles || []).map((d, i) => ({ id: 0, numero_item: i + 1, cantidad: Number(d.cantidad) || 0, descripcion: (d.descripcion as any), precio_unitario: Number(d.precio_unitario) || 0, precio_total: this.getDetalleTotal(d), envio_id: newId })) as DetalleEnvioCreate[];
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
    if (payload.estado_pago) {
      this.closeTicket();
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
    const detsBodies = (this.stagedDetalles || []).map((d, i) => ({ numero_item: i + 1, cantidad: Number(d.cantidad) || 0, descripcion: d.descripcion as any, precio_unitario: Number(d.precio_unitario) || 0, valor_unitario: this.getDetalleTotal(d), comprobante_id: compId }));
          try { this.openComprobanteWindow(compHeader, detsBodies); } catch {}
    const afterDetalles = () => {
      const cabBody: any = { tipo_movimiento: 'I', monto: this.compTotalConImpuesto, persona_id: null, placa: null, autorizado: true, manifiesto_id: null, fecha_movimiento: this.currentDateTMS() };
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
    } else {
      this.openTicketAfterCreate(updated, newId);
    }
    this.showNotif('Env\u00edo creado');
  }

  private openTicketAfterCreate(updated: Envio, newId: number) {
    const fallback = () => {
      const mapped = (this.stagedDetalles || []).map((d, i) => ({
        numero_item: i + 1,
        cantidad: Number(d.cantidad) || 0,
        descripcion: d.descripcion,
        precio_unitario: Number(d.precio_unitario) || 0,
        precio_total: this.getDetalleTotal(d)
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
          precio_unitario: Number(d.precio_unitario) || 0,
          precio_total: Number((d as any).precio_total ?? (d as any).valor_unitario) || 0
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
          this.stagedDetalles = (list || []).map((d: any) => ({ cantidad: Number(d.cantidad) || 0, descripcion: d.descripcion, precio_unitario: Number(d.precio_unitario) || 0, precio_total: this.getDetalleTotal(d) }));
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
      next: (response) => { this.lista_envios = response || []; this.exactSearchTried.clear(); this.loading = false; this.scheduleExactSearchFallback(); const qpId = Number(this.route.snapshot.queryParamMap.get('id') || 0); if (qpId) { const it = (this.lista_envios || []).find((v: any) => Number((v as any).id) === qpId); if (it) { this.openEdit(it as any); } } },
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

    const found = this.findPersonaByDoc(this.personas, docType as any, nro);
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
  loadPersonas() { this.personasLoading = true; this.personasError = null; this.personasSrv.getPersonas().subscribe({ next: (res: Persona[]) => { this.personas = res || []; this.personasLoading = false; this.syncDestinatarioCelular(); const remId = Number((this.newEnvio as any)?.remitente || 0); if (remId && !this.remitenteDocNumber) { const p = (this.personas || []).find(x => Number((x as any).id) === remId); if (p) { this.remitenteDocType = this.normalizeDocTypeOr((p as any).tipo_documento, 'DNI'); this.remitenteDocNumber = String((p as any).nro_documento || ''); this.loadRemitenteCreditoByDoc(this.remitenteDocNumber); } } }, error: () => { this.personasLoading = false; this.personasError = 'No se pudieron cargar personas'; }, }); }
  loadPuntos() {
    this.puntosLoading = true; this.puntosError = null;
    this.puntosSrv.getPuntos().subscribe({
      next: (res) => { this.puntos = res || []; this.puntosLoading = false; this.applyDefaultOrigen(); },
      error: () => { this.puntosLoading = false; this.puntosError = 'No se pudieron cargar los puntos'; },
    });
  }

  ngOnInit(): void {
    this.loadCatalogos();
    this.loadCompaniaConfig();
    try { const vm = localStorage.getItem('envios.viewMode') as any; if (vm === 'table' || vm === 'cards') this.viewMode = vm; } catch { }
    this.initPagosDestinoControl();
    this.loadEnvios(); this.loadPersonas(); this.loadPuntos();
  }
  // Generar comprobante desde el inline de entrega no pagada
  submitComprobanteEntrega() {
    const showPaidDetails = (id: number) => { try { const it = (this.lista_envios || []).find((v: any) => v.id === id) as any; this.ticketEnvio = it || null; this.detalleSrv.getDetallesEnvio(id).subscribe({ next: (list: any[]) => { this.ticketDetalles = (list||[]).map((d: any, i:number) => ({ numero_item: d.numero_item ?? i+1, cantidad: Number(d.cantidad)||0, descripcion: (d.descripcion as any), precio_unitario: Number(d.precio_unitario)||0, precio_total: Number(d?.precio_total ?? d?.valor_unitario) || 0 })); }, error: () => { this.ticketDetalles = []; } }); } catch {} };

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
        const detsBodies = (this.stagedDetalles || []).map((d, i) => ({ numero_item: i + 1, cantidad: Number(d.cantidad) || 0, descripcion: d.descripcion as any, precio_unitario: Number(d.precio_unitario) || 0, valor_unitario: this.getDetalleTotal(d), comprobante_id: compId }));
          try { this.openComprobanteWindow(compHeader, detsBodies); } catch {}
        const afterDetalles = () => {
          const cabBody: any = { tipo_movimiento: 'I', monto: this.compTotalConImpuesto, persona_id: null, placa: null, autorizado: true, manifiesto_id: null, fecha_movimiento: this.currentDateTMS() };
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
        const detsBodies = (this.stagedDetalles || []).map((d, i) => ({ numero_item: i + 1, cantidad: Number(d.cantidad) || 0, descripcion: d.descripcion as any, precio_unitario: Number(d.precio_unitario) || 0, valor_unitario: this.getDetalleTotal(d), comprobante_id: compId }));
        try { this.openComprobanteWindow(compHeader, detsBodies); } catch {}
        const afterDetalles = () => {
          const cabBody: any = { tipo_movimiento: 'I', monto: this.compTotalConImpuesto, persona_id: null, placa: null, autorizado: true, manifiesto_id: null, fecha_movimiento: this.currentDateTMS() };
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
