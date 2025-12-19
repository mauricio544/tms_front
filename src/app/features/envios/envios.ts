import { Message } from '../../../../core/services/message';
import { Component, OnInit, inject, ChangeDetectorRef, ViewContainerRef, TemplateRef, ViewChild } from '@angular/core';
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
import { Envio, Persona, Puntos as PuntoModel, DetalleEnvioCreate, General, MessageCreate } from '../../../../core/mapped';
import { Utilitarios } from '../../../../core/services/utilitarios';
import { forkJoin } from 'rxjs';

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
  private readonly messageSrv = inject(Message);
  private readonly utilSrv = inject(Utilitarios);
  // Estado principal
  lista_envios: Envio[] = [];
  loading = false;
  error: string | null = null;

  // Vista (tarjetas/tabla) con persistencia
  viewMode: 'cards' | 'table' = 'cards';
  setViewMode(m: 'cards' | 'table') { this.viewMode = m; try { localStorage.setItem('envios.viewMode', m); } catch { } }

  // Filtros y paginación
  search = '';

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
    const f = (this.compTipos || []).find((g: any) => Number((g as any).id) === Number(id) || Number((g as any).codigo_principal) === Number(id));
    return (f as any)?.nombre ?? String(id);
  }
  private format2(n: any): string { try { return (Number(n)||0).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2}); } catch { return String(n); } }

  private openComprobanteWindow(header: any, detalles: Array<{ numero_item: number; cantidad: number; descripcion: any; precio_unitario: number }>) {
    const c: any = header || {};
    const d = Array.isArray(detalles) ? detalles : [];
    const tipoNombre = this.tipoNombreById(Number(c.tipo_comprobante)).toLowerCase();
    const docTitle = tipoNombre.includes('fact') ? 'Factura' : (tipoNombre.includes('bol') ? 'Boleta' : 'Comprobante');
    const numero = String(c.serie || '-') + '-' + String(c.numero || '-');
    const ruc = String(localStorage.getItem('ruc') || '');
    const razon = String(localStorage.getItem('razon_social') || '');
    const row = (x: any) => {
      const subtotal = (Number(x.cantidad)||0) * (Number(x.precio_unitario)||0);
      return '<tr>' +
        '<td>' + String(x.numero_item||'') + '</td>' +
        '<td>' + String(x.cantidad||'') + '</td>' +
        '<td>' + String(x.descripcion||'') + '</td>' +
        '<td class="right">' + this.format2(x.precio_unitario) + '</td>' +
        '<td class="right">' + this.format2(subtotal) + '</td>' +
      '</tr>';
    };
    const rows = d.map(row).join('');
    const impuesto = Number(c.impuesto || 0);
    const total = Number(c.precio_total || 0);
    const estilo = ' body{font-family:Arial,Helvetica,sans-serif;padding:20px;color:#0f172a} h1{font-size:18px;margin:0 0 10px} .muted{color:#64748b} .wrap{display:flex;justify-content:space-between;gap:16px;align-items:flex-start} .box{border:1px solid #e2e8f0;border-radius:8px;padding:10px;min-width:260px} .label{font-size:12px;color:#475569} .value{font-weight:600;color:#0f172a} .metaL{font-size:13px;line-height:1.4;margin:8px 0 16px} table{border-collapse:collapse;width:100%;font-size:12px} th,td{border:1px solid #e2e8f0;padding:6px;text-align:left} .right{text-align:right} tfoot td{border-top:1px solid #cbd5e1} .totals{width:100%;display:flex;justify-content:flex-end;margin-top:10px} .totals .box{min-width:240px} ';
    let totalsHtml = '';
    totalsHtml += '<div class="totals"><div class="box">';
    if (impuesto > 0) { totalsHtml += '<div class="row"><span class="label">Impuesto</span><span class="value" style="float:right">' + this.format2(impuesto) + '</span></div>'; }
    totalsHtml += '<div class="row"><span class="label">Total</span><span class="value" style="float:right">' + this.format2(total) + '</span></div>';
    totalsHtml += '</div></div>';
    const html = '<!doctype html><html><head><meta charset="utf-8"/>' +
      '<title>' + docTitle + ' ' + numero + '</title>' +
      '<style>' + estilo + '</style>' +
      '</head><body>' +
      '<div class="wrap">' +
        '<div class="left">' +
          '<h1>' + docTitle + '</h1>' +
          '<div class="metaL">' +
            '<div><span class="label">Emitido a:</span> <span class="value">' + String(c.cliente_documento || '-') + '</span></div>' +
            '<div><span class="label">Fecha comprobante:</span> <span class="value">' +  this.utilSrv.formatFecha(c.fecha_comprobante || '') + '</span></div>' +
            '<div><span class="label">Fecha pago:</span> <span class="value">' + this.utilSrv.formatFecha(c.fecha_pago || '') + '</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="box rightBox">' +
          '<div><span class="label">RUC:</span> <span class="value">' + (ruc || '-') + '</span></div>' +
          '<div><span class="label">Razón social:</span> <span class="value">' + (razon || '-') + '</span></div>' +
          '<div><span class="label">Número:</span> <span class="value">' + numero + '</span></div>' +
        '</div>' +
      '</div>' +
      '<table style="margin-top:12px"><thead><tr><th>Ítem</th><th>Cantidad</th><th>Descripción</th><th class="right">P. Unitario</th><th class="right">Subtotal</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
      totalsHtml +
      '<div style="margin-top:12px;text-align:right"><button onclick="window.print()">Imprimir</button></div>' +
      '</body></html>';
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
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
  openTicket(env: Envio, fromDetalles: Array<{ cantidad: number; descripcion: any; precio_unitario: number }> = []) {
    this.ticketEnvio = env;
    this.ticketDetalles = (fromDetalles || []).map((d, i) => ({ numero_item: i + 1, cantidad: Number(d.cantidad) || 0, descripcion: d.descripcion, precio_unitario: Number(d.precio_unitario) || 0 }));
    this.showTicket = true;
  }
  closeTicket() { this.showTicket = false; this.ticketEnvio = null; this.ticketDetalles = []; }
  printTicket() { try { window.print(); } catch { } }

  // Envío en edición/creación
  newEnvio: Partial<Envio> = {
    remitente: null as any,
    destinatario: null as any,
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
  remitenteDocType: 'RUC' | 'DNI' = 'DNI';
  remitenteDocNumber: string = '';
  destinatarioDocType: 'RUC' | 'DNI' = 'DNI';
  destinatarioDocNumber: string = '';
  remLookupLoading = false; remLookupError: string | null = null;
  destLookupLoading = false; destLookupError: string | null = null;

  // Comprobante (creaciÃ³n cuando pagado)
  compTipos: General[] = [];
  payTipos: General[] = [];
  compTipoSel: General | null = null;
  compTipoId: number | null = null;
  compSerie: string = '';
  compCorrelativo: number = 0;
  compNumero: string = '';
  compNumeroComprobante: string = '';
  compFormaPagoId: number | null = null;
  compFechaPago: string = '';
  compDocType: 'RUC' | 'DNI' = 'DNI';
  compDocNumber: string = '';
  compClienteId: number | null = null;
  compLookupLoading = false; compLookupError: string | null = null;
  get compImpuesto(): number { const total = this.stagedSubtotal || 0; return this.compTipoNombre().toLowerCase().includes('fact') ? +(total * 0.18).toFixed(2) : 0; }
  get compTotal(): number { return this.stagedSubtotal || 0; }
  get compTotalConImpuesto(): number { return this.compTipoNombre().toLowerCase().includes('fact') ? (this.compTotal + this.compImpuesto) : this.compTotal; }
  compTipoNombre(): string { const t = this.compTipoSel || this.compTipos.find(x => (x as any).codigo_principal === this.compTipoId) || null as any; return (t?.nombre || '').toString(); }
  private pad6(n: number): string { const s = String(n || 0); return s.padStart(6, '0'); }
  onCompTipoChange(selected?: any) {
    if (selected && typeof selected === 'object') {
      this.compTipoSel = selected as General;
      this.compTipoId = Number((this.compTipoSel as any).id || 0);
    } else if (selected != null) {
      this.compTipoId = Number(selected);
      this.compTipoSel = this.compTipos.find(x => Number((x as any).id) === this.compTipoId) || null as any;
    } else if (!this.compTipoSel && this.compTipoId != null) {
      this.compTipoSel = this.compTipos.find(x => Number((x as any).id) === Number(this.compTipoId)) || null as any;
    }
    const t: any = this.compTipoSel;
    this.compSerie = (t?.serie || '').toString();
    this.compCorrelativo = Number(t?.correlativo || 0);
    this.compNumero = this.pad6(this.compCorrelativo);
    this.compNumeroComprobante = `${this.compSerie}-${this.compNumero}`;
    const nombre = (t?.nombre || '').toString().toLowerCase();
    this.compDocType = nombre.includes('fact') ? 'RUC' : 'DNI';
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
    return p ? (p as any).nombre : (id != null ? String(id) : '-');
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
        String(e.guia ?? ''), String(e.manifiesto ?? ''), String(e.clave_recojo ?? ''),
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
  resetFilters() { this.search = ''; this.entregaFilter = 'all'; this.setPage(1); }

  // Autocomplete personas helpers
  get filteredRemitentes(): Persona[] { const q = (this.remitenteQuery || '').toLowerCase().trim(); const list = this.personas || []; if (!q) return list.slice(0, 10); return list.filter(p => this.personaLabel(p).toLowerCase().includes(q)).slice(0, 10); }
  get filteredDestinatarios(): Persona[] { const q = (this.destinatarioQuery || '').toLowerCase().trim(); const list = this.personas || []; if (!q) return list.slice(0, 10); return list.filter(p => this.personaLabel(p).toLowerCase().includes(q)).slice(0, 10); }
  personaLabel(p: Persona): string { const nombre = [p.nombre, p.apellido].filter(Boolean).join(' ').trim(); const razon = (p.razon_social || '').trim(); const base = (razon || nombre || '').trim(); const doc = (p.nro_documento || '').trim(); return [base, doc].filter(Boolean).join(' - '); }
  personaLabelById(id: any): string | null { const n = Number(id); if (!n) return null; const p = (this.personas || []).find(x => (x as any).id === n); return p ? this.personaLabel(p) : null; }
  selectRemitente(p: Persona) { (this.newEnvio as any).remitente = (p as any).id; this.remitenteQuery = this.personaLabel(p); this.showRemitenteOptions = false; }
  selectDestinatario(p: Persona) { (this.newEnvio as any).destinatario = (p as any).id; this.destinatarioQuery = this.personaLabel(p); this.showDestinatarioOptions = false; }
  clearRemitente() { (this.newEnvio as any).remitente = null as any; this.remitenteQuery = ''; }
  clearDestinatario() { (this.newEnvio as any).destinatario = null as any; this.destinatarioQuery = ''; }

  private buildPersonaFromRUC(data: any): Partial<Persona> { return { nombre: '', apellido: '', razon_social: (data?.razon_social || '').toString(), direccion: (data?.direccion || '').toString(), celular: '', email: '', nro_documento: (data?.numero_documento || '').toString(), tipo_documento: 'RUC' } as any; }
  private buildPersonaFromDNI(data: any): Partial<Persona> { const nombre = (data?.first_name || '').toString(); const ap1 = (data?.first_last_name || '').toString(); const ap2 = (data?.second_last_name || '').toString(); return { nombre, apellido: [ap1, ap2].filter(Boolean).join(' ').trim(), razon_social: '', direccion: '', celular: '', email: '', nro_documento: (data?.document_number || '').toString(), tipo_documento: 'DNI' } as any; }
  private isValidDoc(type: 'RUC' | 'DNI', nro: string): boolean { const d = (nro || '').replace(/[^0-9]/g, ''); return type === 'RUC' ? d.length === 11 : d.length === 8; }
  lookupRemitente() {
    this.remLookupError = null; const type = this.remitenteDocType; const nro = (this.remitenteDocNumber || '').trim();
    if (!type || !nro) { this.remLookupError = 'Ingrese tipo y numero'; return; }
    if (!this.isValidDoc(type, nro)) { this.remLookupError = (type === 'RUC' ? 'RUC debe tener 11 digitos' : 'DNI debe tener 8 digitos'); return; }
    const found = (this.personas || []).find(p => (p as any).nro_documento === nro && (p as any).tipo_documento === type);
    if (found) { this.selectRemitente(found); return; }
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

  // Modal helpers
  openCreate() {
    this.editing = false; this.editingId = null;

    try { (this.newEnvio as any).fecha_envio = new Date().toISOString().slice(0,10); } catch {}
    this.saveError = null; this.showCreate = true; this.remitenteQuery = ''; this.destinatarioQuery = ''; this.showRemitenteOptions = false; this.showDestinatarioOptions = false; this.stagedDetalles = []; this.newDet = { cantidad: null, descripcion: '', precio_unitario: null };
    // Defaults for unified DNI/RUC lookup control
    this.remitenteDocType = 'DNI'; this.destinatarioDocType = 'DNI';
    this.remitenteDocNumber = ''; this.destinatarioDocNumber = '';
    // Reset WhatsApp helpers
    this.sendWhatsapp = false; this.whatsappPhone = '';
  }
  closeCreate() { this.showCreate = false; }

  openEdit(item: Envio) {
    this.editing = true; this.editingId = (item as any).id ?? null;

    this.newEnvio = {
  remitente: (item as any).remitente,
  destinatario: (item as any).destinatario,
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
} as any;
    this.saveError = null; this.remitenteQuery = this.personaLabelById((item as any).remitente) || ''; this.destinatarioQuery = this.personaLabelById((item as any).destinatario) || ''; this.showEdit = true;
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
  closeEdit() { this.showEdit = false; }

  get isValidEnvio(): boolean {
    const e: any = this.newEnvio;
    const okRemitente = Number(e?.remitente) > 0;
    const okDestinatario = Number(e?.destinatario) > 0;
    const okPeso = Number(e?.peso) > 0;
    const okFecha = String(e?.fecha_envio || "").trim().length > 0;
    const okOrigen = Number(e?.punto_origen_id) > 0;
    const okDestino = Number(e?.punto_destino_id) > 0;
    return okRemitente && okDestinatario && okPeso && okFecha && okOrigen && okDestino;
  }

  submitEnvio() {
    if (!this.isValidEnvio) return;
    const e: any = this.newEnvio;
    const payload: any = {
      remitente: Number(e.remitente), destinatario: Number(e.destinatario), estado_pago: !!e.estado_pago, clave_recojo: String(e.clave_recojo || '').trim(), peso: Number(e.peso) || 0, fecha_envio: String(e.fecha_envio || '').trim(), fecha_recepcion: String(e.fecha_recepcion || '').trim() || null, tipo_contenido: !!e.tipo_contenido, guia: e.guia != null ? Number(e.guia) : null, manifiesto: e.manifiesto != null ? Number(e.manifiesto) : null, valida_restricciones: !!e.valida_restricciones, punto_origen_id: Number(e.punto_origen_id), punto_destino_id: Number(e.punto_destino_id)
    };
    this.saving = true; this.saveError = null;
    if (this.editing && this.editingId) {
      this.enviosSrv.updateEnvios(this.editingId, payload).subscribe({
        next: (res: any) => {
          const updated: Envio = { id: res?.id ?? this.editingId!, remitente: res?.remitente ?? payload.remitente, destinatario: res?.destinatario ?? payload.destinatario, estado_pago: res?.estado_pago ?? payload.estado_pago, clave_recojo: res?.clave_recojo ?? payload.clave_recojo, peso: res?.peso ?? payload.peso, fecha_envio: res?.fecha_envio ?? payload.fecha_envio, fecha_recepcion: res?.fecha_recepcion ?? payload.fecha_recepcion, tipo_contenido: res?.tipo_contenido ?? payload.tipo_contenido, guia: res?.guia ?? payload.guia, manifiesto: res?.manifiesto ?? payload.manifiesto, valida_restricciones: res?.valida_restricciones ?? payload.valida_restricciones, punto_origen_id: res?.punto_origen_id ?? payload.punto_origen_id, punto_destino_id: res?.punto_destino_id ?? payload.punto_destino_id, estado_entrega: res?.estado_entrega ?? payload.estado_entrega } as Envio;
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
        const updated: Envio = { id: newId || (Math.max(0, ...(this.lista_envios.map((x: any) => x.id).filter(Number))) + 1), remitente: res?.remitente ?? payload.remitente, destinatario: res?.destinatario ?? payload.destinatario, estado_pago: res?.estado_pago ?? payload.estado_pago, clave_recojo: res?.clave_recojo ?? payload.clave_recojo, peso: res?.peso ?? payload.peso, fecha_envio: res?.fecha_envio ?? payload.fecha_envio, fecha_recepcion: res?.fecha_recepcion ?? payload.fecha_recepcion, tipo_contenido: res?.tipo_contenido ?? payload.tipo_contenido, guia: res?.guia ?? payload.guia, manifiesto: res?.manifiesto ?? payload.manifiesto, valida_restricciones: res?.valida_restricciones ?? payload.valida_restricciones, punto_origen_id: res?.punto_origen_id ?? payload.punto_origen_id, punto_destino_id: res?.punto_destino_id ?? payload.punto_destino_id, estado_entrega: res?.estado_entrega ?? payload.estado_entrega } as Envio;
        const detalles = (this.stagedDetalles || []).map((d, i) => ({ id: 0, numero_item: i + 1, cantidad: Number(d.cantidad) || 0, descripcion: (d.descripcion as any), precio_unitario: Number(d.precio_unitario) || 0, envio_id: newId })) as DetalleEnvioCreate[];
        if (newId && detalles.length) {
          forkJoin(detalles.map(d => this.detalleSrv.createDetalleEnvio(d))).subscribe({ next: () => this.afterCreate(updated, newId, payload), error: () => { this.saving = false; this.saveError = 'No se pudo crear el detalle del env\u00edo'; this.showNotif(this.saveError as string, 'error'); } });
        } else {
          this.afterCreate(updated, newId, payload);
        }
      },
      error: () => { this.saving = false; this.saveError = 'No se pudo crear el env\u00edo'; this.showNotif(this.saveError as string, 'error'); },
    });
  }

  private afterCreate(updated: Envio, newId: number, payload: any) {
    this.lista_envios = [updated, ...this.lista_envios];
    this.saving = false; this.editing = false; this.editingId = null; this.onFilterChange();
    if (!payload.estado_pago) {
      if (newId) {
        this.detalleSrv.getDetallesEnvio(newId).subscribe({
          next: (list: any[]) => { const mapped = (list || []).map((d: any, i: number) => ({ numero_item: (d.numero_item ?? i + 1), cantidad: Number(d.cantidad) || 0, descripcion: (d.descripcion as any), precio_unitario: Number(d.precio_unitario) || 0 })); this.ticketEnvio = updated; this.ticketDetalles = mapped; this.closeCreate(); this.showTicket = true; },
          error: () => { const mapped = (this.stagedDetalles || []).map((d, i) => ({ numero_item: i + 1, cantidad: Number(d.cantidad) || 0, descripcion: d.descripcion, precio_unitario: Number(d.precio_unitario) || 0 })); this.ticketEnvio = updated; this.ticketDetalles = mapped; this.closeCreate(); this.showTicket = true; }
        });
      } else {
        const mapped = (this.stagedDetalles || []).map((d, i) => ({ numero_item: i + 1, cantidad: Number(d.cantidad) || 0, descripcion: d.descripcion, precio_unitario: Number(d.precio_unitario) || 0 })); this.ticketEnvio = updated; this.ticketDetalles = mapped; this.closeCreate(); this.showTicket = true;
      }
    } else {
      // WhatsApp: enviar si se solicitï¿½ y estï¿½ pagado
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
            this.messageSrv.sendMessage(body).subscribe({ next: () => {}, error: () => {} });
          }
        } catch {}
      }
      const ciaId = Number(localStorage.getItem('cia_id') || 0);
      const ruc = String(localStorage.getItem('ruc') || '');
      const tipoNombre = this.compTipoNombre().toLowerCase();
      const estado_comp = tipoNombre.includes('fact') ? 'F' : 'B';
      const body: any = { tipo_comprobante: this.compTipoId || 0, numero_comprobante: this.compNumeroComprobante, forma_pago: this.compFormaPagoId || 0, precio_total: this.compTotalConImpuesto, fecha_comprobante: new Date().toISOString().slice(0, 10), impuesto: this.compImpuesto, serie: this.compSerie, numero: this.compNumero, estado_comprobante: estado_comp, fecha_pago: this.compFechaPago || new Date().toISOString().slice(0, 10), emisor: ciaId, cliente: null, emisor_ruc: ruc, cliente_documento: this.compDocNumber || '', envio_id: newId };
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
          const detMov: any = { tipo_comprobante: this.compTipoId || 0, numero_comprobante: this.compNumeroComprobante, descripcion, tipo_gasto: null, cabecera_id: cabId, monto: this.compTotalConImpuesto };
          this.detMovsSrv.createDetalles(detMov).subscribe({ next: () => finalize(), error: () => finalize() });
        },
        error: () => { this.closeCreate(); this.showNotif('Comprobante generado'); }
      });
    };
    if (compId && detsBodies.length) {
      forkJoin(detsBodies.map(x => this.detCompSrv.createDetalles(x))).subscribe({ next: () => afterDetalles(), error: () => afterDetalles() });
    } else { afterDetalles(); }
    try {
      const t: any = this.compTipoSel || (this.compTipos || []).find((g: any) => Number((g as any).codigo_principal) === Number(this.compTipoId));
      const genId = Number((t as any)?.id || 0);
      const nextCorr = (Number((t as any)?.correlativo || 0) || Number(this.compCorrelativo||0)) + 1;
      if (genId) { this.generalesSrv.updateGenerales(genId, { correlativo: nextCorr } as any).subscribe({ next:()=>{}, error:()=>{} }); }
    } catch {}
  },
  error: () => { this.closeCreate(); }
});
    }
    this.showNotif('Env\u00edo creado');
  }

  // Entrega
  get entregaClaveOk(): boolean { const it: any = this.entregaItem as any; const stored = String((it?.clave_recojo ?? '')).trim(); return !!this.entregaItem && this.entregaClaveInput.trim() === stored; }
  openEntrega(item: Envio) {
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
      this.showNotif('El envÃ­o no estÃ¡ pagado. Genere un comprobante.', 'error');
      return;
    }
    this.entregaSaving = true; this.entregaError = null; (this.entregaItem as any).fecha_recepcion = this.entregaFecha; (this.entregaItem as any).estado_entrega = true;
    this.enviosSrv.updateEnvios(Number(id), this.entregaItem).subscribe({ next: (res: any) => { const fecha = res?.fecha_recepcion ?? this.entregaFecha; this.lista_envios = (this.lista_envios || []).map((v: any) => v.id === id ? ({ ...v, fecha_recepcion: fecha }) : v); this.entregaSaving = false; this.closeEntrega(); this.showNotif('Entrega confirmada'); }, error: () => { this.entregaSaving = false; this.entregaError = 'No se pudo registrar la entrega'; this.showNotif(this.entregaError as string, 'error'); }, });
  }

  // Eliminar
  askDelete(item: Envio) { this.pendingDeleteId = (item as any).id ?? null; const label = `${(item as any).guia ?? ''}`.trim() || `${(item as any).id}`; this.pendingDeleteLabel = label as string; this.confirmMessage = `\u00bfEliminar env\u00edo ${this.pendingDeleteLabel}?`; this.confirmOpen = true; }
  onCancelDelete() { this.confirmOpen = false; this.pendingDeleteId = null; this.pendingDeleteLabel = ''; }
  onConfirmDelete() { const id = this.pendingDeleteId; if (!id) { this.onCancelDelete(); return; } this.saving = true; this.enviosSrv.deleteEnvios(id).subscribe({ next: () => { this.lista_envios = this.lista_envios.filter((v: any) => v.id !== id); this.saving = false; this.onFilterChange(); this.onCancelDelete(); this.showNotif('Env\u00edo eliminado'); }, error: () => { this.saving = false; this.saveError = 'No se pudo eliminar el env\u00edo'; this.onCancelDelete(); this.showNotif(this.saveError as string, 'error'); } }); }

  showNotif(msg: string, type: 'success' | 'error' = 'success') {
    this.notifType = type; this.notif = msg;
    try { setTimeout(() => { this.notif = null; }, 3000); } catch {}
  }

  onClickNuevo(ev?: Event) {
    try { ev?.preventDefault(); ev?.stopPropagation(); } catch {}
    try { this.showNotif("Click Nuevo"); } catch {}
    this.openCreate();
  }

  // Carga inicial
  loadCatalogos() {
    this.generalesSrv.getGenerales().subscribe({
      next: (list: General[]) => { const arr = list || []; this.compTipos = arr.filter((g: any) => (g.codigo_grupo || '') === 'REC'); this.payTipos = arr.filter((g: any) => (g.codigo_grupo || '') === 'PAY'); if (this.compTipos.length && !this.compTipoId) { const def: any = this.compTipos[0]; this.compTipoSel = def; this.compTipoId = def.codigo_principal; this.onCompTipoChange(def); } },
      error: () => { this.detallesLoading = false; },
    });
  }

  loadEnvios() {
    this.loading = true; this.error = null;
    this.enviosSrv.getEnvios().subscribe({
      next: (response) => { this.lista_envios = response || []; this.loading = false; const qpId = Number(this.route.snapshot.queryParamMap.get('id') || 0); if (qpId) { const it = (this.lista_envios || []).find((v: any) => Number((v as any).id) === qpId); if (it) { this.openEdit(it as any); } } },
      error: () => { this.loading = false; this.error = 'No se pudieron cargar los envíos'; },
    });
  }
  loadPersonas() { this.personasLoading = true; this.personasError = null; this.personasSrv.getPersonas().subscribe({ next: (res: Persona[]) => { this.personas = res || []; this.personasLoading = false; }, error: () => { this.personasLoading = false; this.personasError = 'No se pudieron cargar personas'; }, }); }
  loadPuntos() { this.puntosLoading = true; this.puntosError = null; this.puntosSrv.getPuntos().subscribe({ next: (res) => { this.puntos = res || []; this.puntosLoading = false; }, error: () => { this.puntosLoading = false; this.puntosError = 'No se pudieron cargar los puntos'; }, }); }

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
    const ciaId = Number(localStorage.getItem('cia_id') || 0);
    const ruc = String(localStorage.getItem('ruc') || '');
    const tipoNombre = this.compTipoNombre().toLowerCase();
    const estado_comp = tipoNombre.includes('fact') ? 'F' : 'B';
    const body: any = { tipo_comprobante: this.compTipoId || 0, numero_comprobante: this.compNumeroComprobante, forma_pago: this.compFormaPagoId || 0, precio_total: this.compTotalConImpuesto, fecha_comprobante: new Date().toISOString().slice(0, 10), impuesto: this.compImpuesto, serie: this.compSerie, numero: this.compNumero, estado_comprobante: estado_comp, fecha_pago: this.compFechaPago || new Date().toISOString().slice(0, 10), emisor: ciaId, cliente: null, emisor_ruc: ruc, cliente_documento: this.compDocNumber || '', envio_id: envioId };
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
              const detMov: any = { tipo_comprobante: this.compTipoId || 0, numero_comprobante: this.compNumeroComprobante, descripcion, tipo_gasto: null, cabecera_id: cabId, monto: this.compTotalConImpuesto };
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
     try {
       const t: any = this.compTipoSel || (this.compTipos || []).find((g: any) => Number((g as any).codigo_principal) === Number(this.compTipoId));
       const genId = Number((t as any)?.id || 0);
       const nextCorr = (Number((t as any)?.correlativo || 0) || Number(this.compCorrelativo||0)) + 1;
       if (genId) { this.generalesSrv.updateGenerales(genId, { correlativo: nextCorr } as any).subscribe({ next:()=>{}, error:()=>{} }); }
     } catch {}
      try {
        const t: any = this.compTipoSel || (this.compTipos || []).find((g: any) => Number((g as any).codigo_principal) === Number(this.compTipoId));
        const genId = Number((t as any)?.id || 0);
        const nextCorr = (Number((t as any)?.correlativo || 0) || Number(this.compCorrelativo||0)) + 1;
        if (genId) { this.generalesSrv.updateGenerales(genId, { correlativo: nextCorr } as any).subscribe({ next:()=>{}, error:()=>{} }); }
      } catch {}
        try {
          const t: any = this.compTipoSel || (this.compTipos || []).find((g: any) => Number((g as any).codigo_principal) === Number(this.compTipoId));
          const genId = Number((t as any)?.id || 0);
          const nextCorr = (Number((t as any)?.correlativo || 0) || Number(this.compCorrelativo||0)) + 1;
          if (genId) { this.generalesSrv.updateGenerales(genId, { correlativo: nextCorr } as any).subscribe({ next:()=>{}, error:()=>{} }); }
        } catch {}
      },
      error: () => { this.showNotif('No se pudo generar el comprobante', 'error'); }
    });
  }
}


















