import jsPDF from 'jspdf';
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroPrinter, heroDocumentText, heroDocumentArrowDown } from '@ng-icons/heroicons/outline';
import { Comprobantes } from '../../../../core/services/comprobantes';
import { Envios } from '../../../../core/services/envios';
import { Clientes } from '../../../../core/services/clientes';
import { Personas } from '../../../../core/services/personas';
import { Generales } from '../../../../core/services/generales';
import { DetallesComprobante } from '../../../../core/services/detalles-comprobante';
import { Cliente, Comprobante, DetalleComprobante, Persona } from '../../../../core/mapped';
import { Utils } from '../../../../core/services/utils';
import { ComprobantePreview, ComprobantePreviewComponent } from '../../shared/comprobante-preview/comprobante-preview.component';

@Component({
  selector: 'feature-comprobantes',
  standalone: true,
  imports: [CommonModule, FormsModule, Utils, NgIconComponent, ComprobantePreviewComponent],
  templateUrl: './comprobantes-feature.html',
  providers: [provideIcons({ heroPrinter, heroDocumentText, heroDocumentArrowDown })],
})
export class ComprobantesFeature implements OnInit {
  private readonly publicTrackingSearchUrl = 'https://vigo.tmscargosoft.com/tracking/publico/buscar';
  isOperario = false;
  private readonly comprobantesSrv = inject(Comprobantes);
  private readonly enviosSrv = inject(Envios);
  private readonly detallesSrv = inject(DetallesComprobante);
  private readonly route = inject(ActivatedRoute);
  private readonly clientesSrv = inject(Clientes);
  private readonly personasSrv = inject(Personas);

  private readonly generalesSrv = inject(Generales);
  initialSelectId: number | null = null;
  initialEnvioId: number | null = null;

  lista: Comprobante[] = [];
  loading = false;
  error: string | null = null;

  search = '';
  page = 1;
  pageSize = 8;

  // Vista: 'cards' o 'grid'
  viewMode: 'cards' | 'grid' = 'cards';

  // Selección y detalle actual
  selected: Comprobante | null = null;
  comprobantePreview: ComprobantePreview | null = null;
  detalles: DetalleComprobante[] = [];
  detallesLoading = false;
  detallesError: string | null = null;
  sunatLoading = false;
  sunatError: string | null = null;
  sunatOk: string | null = null;
  sunatStatus: 'accepted' | 'pending' | null = null;
  sunatStatusLoading = false;
  sunatBulkLoading = false;
  sunatBulkOk: string | null = null;
  sunatBulkError: string | null = null;
  sunatBulkTotal = 0;
  sunatBulkDone = 0;

  // Catálogos
  generales: any[] = [];
  tiposComprobante: any[] = [];
  formasPago: any[] = [];
  clientes: Cliente[] = [];
  personas: Persona[] = [];
  private readonly envioInfoById = new Map<number, any>();
  private readonly envioLoading = new Set<number>();

  tipoNombre(id: string | null | undefined): string {
    if (id == null) return '';
    const f = (this.tiposComprobante || []).find((g: any) => Number(g.id) === Number(id));
    return (f as any)?.nombre ?? String(id);
  }
  formaNombre(id: number | null | undefined): string {
    if (id == null) return '';
    const f = (this.formasPago || []).find((g: any) => Number(g.id) === Number(id));
    return (f as any)?.nombre ?? String(id);
  }

  get subtotal(): number { return (this.detalles || []).reduce((acc, it: any) => acc + (Number(it.cantidad)||0)*(Number(it.precio_unitario)||0), 0); }
  get selectedIsFactura(): boolean {
    const c: any = this.selected;
    if (!c) return false;
    const name = this.tipoNombre(c.tipo_comprobante).toLowerCase();
    return name.includes('fact') || Number(c.impuesto || 0) > 0;
  }
  get selectedIgv(): number {
    if (!this.selectedIsFactura) return 0;
    return +(this.subtotal * 0.18).toFixed(2);
  }
  get selectedTotal(): number {
    const c: any = this.selected;
    if (!c) return 0;
    const total = Number(c.precio_total || 0);
    return total || (this.subtotal + this.selectedIgv);
  }
  clienteNombre(c: Comprobante | null): string {
    if (!c) return '-';
    const clienteId = Number((c as any).cliente || 0);
    let personaId = 0;
    if (clienteId) {
      const cli = (this.clientes || []).find(x => Number((x as any).id) === clienteId);
      personaId = Number((cli as any)?.persona_id || 0);
    }
    let persona = null as any;
    if (personaId) {
      persona = (this.personas || []).find(p => Number((p as any).id) === personaId) || null;
    } else {
      const doc = String((c as any).cliente_documento || '').trim();
      if (doc) persona = (this.personas || []).find(p => String((p as any).nro_documento || '').trim() === doc) || null;
    }
    if (!persona) return '-';
    const razon = String((persona as any).razon_social || '').trim();
    if (razon) return razon;
    const nombre = [persona.nombre, persona.apellido].filter(Boolean).join(' ').trim();
    return nombre || '-';
  }

  sunatEstadoLabel(c: Comprobante | null): string {
    const code = String((c as any)?.estado_cpe ?? '').trim().toUpperCase();
    if (code === 'A') return 'Aceptado';
    if (code === '' || code === 'P') return 'Pendiente';
    return '-';
  }

  sunatEstadoClass(c: Comprobante | null): string {
    const code = String((c as any)?.estado_cpe ?? '').trim().toUpperCase();
    if (code === 'A') return 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700';
    if (code === '' || code === 'P') return 'rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700';
    return 'text-xs text-slate-500';
  }

  tipoSunatLabel(c: Comprobante | null): string {
    const code = String((c as any)?.tipo_comprobante_sunat ?? '').trim();
    if (code === '01') return 'Factura';
    if (code === '03') return 'Boleta';
    return this.tipoNombre(code || (c as any)?.tipo_comprobante);
  }

  tipoSunatClass(c: Comprobante | null): string {
    const code = String((c as any)?.tipo_comprobante_sunat ?? '').trim();
    if (code === '01') return 'rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700';
    if (code === '03') return 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700';
    return 'text-xs text-slate-500';
  }

  isSunatAccepted(c: Comprobante | null): boolean {
    const code = String((c as any)?.estado_cpe ?? '').trim().toUpperCase();
    return code === 'A';
  }

  isAnulado(c: Comprobante | null): boolean {
    const estado = String((c as any)?.estado_comprobante ?? '').trim().toUpperCase();
    return estado === 'C';
  }

  hasSunatPendientes(): boolean {
    return (this.lista || []).some(c => {
      if (this.isAnulado(c)) return false;
      const code = String((c as any)?.estado_cpe ?? '').trim().toUpperCase();
      return code === '' || code === 'P';
    });
  }

  sunatBulkProgress(): number {
    if (!this.sunatBulkTotal) return 0;
    return Math.round((this.sunatBulkDone / this.sunatBulkTotal) * 100);
  }

  get filtered(): Comprobante[] {
    const term = (this.search || '').toLowerCase().trim();
    return (this.lista || []).filter((c: any) => {
      if (!term) return true;
      const values = [
        String(c.serie || ''),
        String(c.numero || ''),
        String(c.id || ''),
        String(c.fecha_comprobante || ''),
        String(c.tipo_comprobante || ''),
        String(c.forma_pago || '')
      ].join(' ').toLowerCase();
      return values.includes(term);
    });
  }

  get total(): number { return this.filtered.length; }
  get totalPages(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }
  get pageItems(): Comprobante[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filtered.slice(start, start + this.pageSize);
  }
  get pageStart(): number { return this.total ? (this.page - 1) * this.pageSize + 1 : 0; }
  get pageEnd(): number { return Math.min(this.page * this.pageSize, this.total); }
  setPage(n: number) { this.page = Math.min(Math.max(1, n), this.totalPages); }
  onFilterChange() { this.page = 1; }

  setView(mode: 'cards' | 'grid') { this.viewMode = mode; try { localStorage.setItem('comprobantes.viewMode', mode); } catch {} }

  select(c: Comprobante) {
    this.selected = c;
    this.ensureEnvioInfo(c);
    this.rebuildComprobantePreview();
    this.sunatOk = null;
    this.sunatError = null;
    this.sunatStatus = null;
    this.sunatStatusLoading = false;
    this.loadDetalles((c as any).id);
    this.loadSunatStatus((c as any).id);
  }

  private selectForExport(c: Comprobante, done: () => void) {
    this.selected = c;
    this.ensureEnvioInfo(c);
    this.rebuildComprobantePreview();
    const id = Number((c as any).id || 0);
    if (!id) { done(); return; }
    this.detallesLoading = true;
    this.detallesError = null;
    this.detallesSrv.getDetalles(id).subscribe({
      next: (res) => { this.detalles = res || []; this.detallesLoading = false; this.rebuildComprobantePreview(); done(); },
      error: () => { this.detalles = []; this.detallesLoading = false; this.rebuildComprobantePreview(); done(); }
    });
  }

  printRow(c: Comprobante) {
    if (this.isOperario || this.isAnulado(c)) return;
    this.selectForExport(c, () => this.printSelected());
  }

  exportCsvRow(c: Comprobante) {
    if (this.isOperario || this.isAnulado(c)) return;
    this.selectForExport(c, () => this.exportSelectedCSV());
  }

  exportPdfRow(c: Comprobante) {
    if (this.isOperario || this.isAnulado(c)) return;
    this.selectForExport(c, () => this.exportSelectedPDF());
  }

  generarSunatRow(c: Comprobante) {
    if (this.isOperario || this.isAnulado(c)) return;
    this.select(c);
    this.generarSunat();
  }

  load() {
    this.loading = true;
    this.error = null;
    const puntoId = this.getUserPuntoId();
    const source$ = this.useComprobantesPuntoEndpoint()
      ? this.comprobantesSrv.getComprobantesPunto(puntoId)
      : this.comprobantesSrv.getComprobantes();
    source$.subscribe({
      next: (res) => { this.lista = res || []; this.loading = false; this.trySelectById(); this.trySelectByEnvioId(); },
      error: () => { this.loading = false; this.error = 'No se pudieron cargar los comprobantes'; }
    });
  }


  private trySelectById() {
    if (!this.initialSelectId) return;
    const found = (this.lista || []).find((x: any) => Number((x as any).id) === Number(this.initialSelectId));
    if (found) { this.selected = found as any; this.ensureEnvioInfo(found as any); this.rebuildComprobantePreview(); this.loadDetalles((found as any).id); }
  }

  private trySelectByEnvioId() {
    if (!this.initialEnvioId) return;
    const found = (this.lista || []).find((x: any) => Number((x as any).envio_id) === Number(this.initialEnvioId));
    if (found) { this.selected = found as any; this.ensureEnvioInfo(found as any); this.rebuildComprobantePreview(); this.loadDetalles((found as any).id); }
  }

  loadDetalles(id: number) {
    this.detallesLoading = true;
    this.detallesError = null;
    this.detallesSrv.getDetalles(id).subscribe({
      next: (res) => { this.detalles = res || []; this.detallesLoading = false; this.rebuildComprobantePreview(); },
      error: () => { this.detallesLoading = false; this.detallesError = 'No se pudo cargar el detalle'; this.rebuildComprobantePreview(); }
    });
  }

  private rebuildComprobantePreview() {
    const c: any = this.selected;
    if (!c) { this.comprobantePreview = null; return; }
    this.ensureEnvioInfo(c);
    const items = (this.detalles || []).map((it: any, i: number) => {
      const cantidad = Number(it?.cantidad || 0);
      const precio = Number(it?.precio_unitario || 0);
      const base = cantidad * precio;
      const igv = this.selectedIsFactura ? +(base * 0.18).toFixed(2) : 0;
      return {
        numeroItem: Number(it?.numero_item || i + 1),
        descripcion: String(it?.descripcion || ''),
        cantidad,
        unidadMedida: 'UND',
        precioUnitario: precio,
        valorUnitario: precio,
        igv,
        totalLinea: base + igv,
      };
    });
    const estadoRaw = String(c?.estado_cpe || '').trim().toUpperCase();
    const estadoCpe = estadoRaw === 'A' ? 'aceptado' : (estadoRaw === 'R' ? 'rechazado' : 'pendiente');
    this.comprobantePreview = {
      tipo: String(c?.tipo_comprobante_sunat || c?.tipo_comprobante || ''),
      ambiente: 'produccion',
      serie: String(c?.serie || '-'),
      numero: String(c?.numero || '-'),
      fechaEmision: String(c?.fecha_comprobante || ''),
      moneda: String(c?.tipo_moneda || 'PEN'),
      formaPago: this.formaNombre(c?.forma_pago),
      logoUrl: this.companyLogoSrc() || undefined,
      emisor: {
        razonSocial: String(localStorage.getItem('razon_social') || ''),
        nombreComercial: String(localStorage.getItem('nombre_comercial') || ''),
        ruc: String(localStorage.getItem('ruc') || ''),
        direccion: String(localStorage.getItem('direccion_fiscal') || ''),
        telefono: String(localStorage.getItem('telefono') || ''),
        correo: String(localStorage.getItem('correo') || ''),
      },
      cliente: {
        nombre: this.clienteNombre(c),
        tipoDocumento: this.selectedIsFactura ? 'RUC' : 'DNI',
        numeroDocumento: String(c?.cliente_documento || '-'),
      },
      referencia: {
        envioId: this.codigoEnvio(c),
        tracking: this.codigoSeguimiento(c),
      },
      items,
      totales: {
        gravadas: this.subtotal,
        igv: this.selectedIgv,
        total: this.selectedTotal,
      },
      sunat: {
        hash: String(c?.hash_sunat || c?.sunat_hash || ''),
        qr: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(this.publicTrackingSearchUrl)}`,
        codigo: String(c?.sunat_cod || c?.codigo_sunat || ''),
        mensaje: String(c?.sunat_msg || c?.mensaje_sunat || ''),
        ticket: String(c?.sunat_ticket || c?.ticket_sunat || ''),
        fechaEnvio: String(c?.sunat_fecha_envio || c?.fecha_envio_sunat || ''),
        fechaRespuesta: String(c?.sunat_fecha_respuesta || c?.fecha_respuesta_sunat || ''),
        estadoCpe: estadoCpe as any,
      },
      leyendas: [],
      observaciones: [],
    };
  }

  ngOnInit(): void { try { const saved = (localStorage.getItem('comprobantes.viewMode') || '').toLowerCase(); if (saved === 'grid' || saved === 'cards') this.viewMode = saved as any; } catch {}
    this.isOperario = this.hasOperarioRole();
    // Leer id de comprobante por query param para auto-selección
        this.route.queryParamMap.subscribe(pm => {
      const idStr = pm.get('id');
      this.initialSelectId = idStr ? Number(idStr) : null;
      const envioStr = pm.get('envio_id');
      this.initialEnvioId = envioStr ? Number(envioStr) : null;
      if (this.lista && this.lista.length) { this.trySelectById(); this.trySelectByEnvioId(); }
    });
    // Cargar catálogos para nombres legibles
    this.generalesSrv.getGenerales().subscribe({
      next: (gs: any[]) => {
        this.generales = gs || [];
        this.tiposComprobante = (this.generales || []).filter((g: any) => Number(g.codigo_principal) === 1);
        this.formasPago = (this.generales || []).filter((g: any) => Number(g.codigo_principal) === 3);
      },
      error: () => { /* no-op */ }
    });
    this.clientesSrv.getClientes().subscribe({ next: (list: Cliente[]) => { this.clientes = list || []; }, error: () => { /* no-op */ } });
    this.personasSrv.getPersonas().subscribe({ next: (list: Persona[]) => { this.personas = list || []; }, error: () => { /* no-op */ } });
    this.load();
  }

  // Utilidad para formato e impresión/exportación
  private format(n: number): string {
    try { return (Number(n)||0).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2}); } catch { return String(n); }
  }
  private companyLogoSrc(): string {
    const raw = String(localStorage.getItem('cia_logo') || '').trim();
    if (!raw) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:image')) return raw;
    return `data:image/png;base64,${raw}`;
  }
  codigoEnvio(c: Comprobante | null): string {
    if (!c) return '-';
    const envioIdNum = Number((c as any)?.envio_id || 0);
    const cache = envioIdNum > 0 ? this.envioInfoById.get(envioIdNum) : null;
    const ticket = String((c as any)?.ticket_numero || cache?.ticket_numero || '').trim();
    if (ticket) return ticket;
    const envioId = String((c as any)?.envio_id || '').trim();
    return envioId || '-';
  }
  codigoSeguimiento(c: Comprobante | null): string {
    if (!c) return '';
    const envioIdNum = Number((c as any)?.envio_id || 0);
    const cache = envioIdNum > 0 ? this.envioInfoById.get(envioIdNum) : null;
    return String((c as any)?.id_tracking || cache?.id_tracking || '').trim();
  }
  private ensureEnvioInfo(c: Comprobante | any) {
    const envioId = Number((c as any)?.envio_id || 0);
    if (!envioId || this.envioInfoById.has(envioId) || this.envioLoading.has(envioId)) return;
    this.envioLoading.add(envioId);
    this.enviosSrv.getEnvio(envioId).subscribe({
      next: (envio: any) => {
        this.envioInfoById.set(envioId, envio || {});
        this.envioLoading.delete(envioId);
        if (Number((this.selected as any)?.envio_id || 0) === envioId) {
          this.rebuildComprobantePreview();
        }
      },
      error: () => { this.envioLoading.delete(envioId); }
    });
  }

  printSelected() {
    if (this.isOperario) return;
    const c: any = this.selected; const d: any[] = (this.detalles || []);
    if (!c || this.isAnulado(c as any)) return;
    const title = `Comprobante ${c.serie||'-'}-${c.numero||'-'}`;
    const isFactura = (this.tipoNombre(c.tipo_comprobante || 0).toLowerCase().includes('fact')) || Number(c.impuesto || 0) > 0;
    const rows = d.map(x => {
      const base = (Number(x.cantidad)||0) * (Number(x.precio_unitario)||0);
      const igv = isFactura ? base * 0.18 : 0;
      const total = base + igv;
      return `<tr><td>${x.numero_item||''}</td><td class="r">${x.cantidad||''}</td><td>${x.descripcion||''}</td><td class="r">${this.format(x.precio_unitario)}</td><td class="r">${this.format(total)}</td></tr>`;
    }).join('');
    const subtotal = this.subtotal;
    const igvTotal = this.selectedIgv;
    const totalFinal = this.selectedTotal;
    const logo = this.companyLogoSrc();
    const codigoEnvio = this.codigoEnvio(c);
    const tracking = this.codigoSeguimiento(c);
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title>
<style>
  @page { size: 80mm auto; margin: 2.5mm; }
  html,body{width:80mm;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#000;font-size:11px;line-height:1.24}
  .wrap{width:74mm;margin:0 auto;padding:1mm}
  .c{text-align:center}.r{text-align:right}.muted{color:#000}
  .sep{border-top:1px solid #000;margin:5px 0}
  .logo{display:block;max-height:16mm;max-width:40mm;margin:0 auto 4px;object-fit:contain;image-rendering:crisp-edges}
  table{width:100%;border-collapse:collapse;font-size:10px}
  th,td{padding:2px 0;border-bottom:0.5px solid #000;vertical-align:top}
  .tot{margin-top:6px}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style>
</head><body>
  <div class="wrap">
    ${logo ? `<img src="${logo}" alt="Logo" class="logo">` : ''}
    <div class="c"><b>${String(localStorage.getItem('razon_social') || '')}</b></div>
    <div class="c">RUC: ${String(localStorage.getItem('ruc') || '-')}</div>
    <div class="c"><b>${this.tipoSunatLabel(c).toUpperCase()} ELECTRONICA</b></div>
    <div class="c"><b>${c.serie || '-'}-${c.numero || '-'}</b></div>
    <div class="sep"></div>
    <div><span class="muted">Cliente:</span> ${this.clienteNombre(c)}</div>
    <div><span class="muted">RUC/DNI:</span> ${c.cliente_documento || '-'}</div>
    <div><span class="muted">Emisión:</span> ${c.fecha_comprobante || ''}</div>
    <div><span class="muted">Forma pago:</span> ${this.formaNombre(c.forma_pago)}</div>
    <div><span class="muted">Código envío:</span> ${codigoEnvio}</div>
    ${tracking ? `<div><span class="muted">Código de seguimiento:</span> ${tracking}</div>` : ''}
    <div class="sep"></div>
    <table>
      <thead><tr><th>#</th><th class="r">Cant</th><th>Descripción</th><th class="r">V.U.</th><th class="r">Imp</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="tot">
      <div class="r"><span class="muted">Op. Gravadas:</span> ${this.format(subtotal)}</div>
      ${isFactura ? `<div class="r"><span class="muted">IGV:</span> ${this.format(igvTotal)}</div>` : ''}
      <div class="r"><b>Total: ${this.format(totalFinal)}</b></div>
    </div>
  </div>
  <script>window.addEventListener('load',()=>{window.print(); setTimeout(()=>window.close(),300)});</script>
</body></html>`;
    const w = window.open('', '_blank'); if(!w) return; w.document.open(); w.document.write(html); w.document.close();
  }

  exportSelectedCSV() {
    if (this.isOperario) return;
    const c: any = this.selected; const d: any[] = (this.detalles || []);
    if (!c || this.isAnulado(c as any)) return;
    const esc = (v:any)=> '"' + String(v ?? '').replace(/"/g,'""') + '"';
    const lines: string[] = [];
    lines.push('Comprobante,' + esc(`${c.serie||'-'}-${c.numero||'-'}`));
    lines.push('Fecha,' + esc(c.fecha_comprobante));
    lines.push('Tipo,' + esc(this.tipoNombre(c.tipo_comprobante)));
    lines.push('Forma de pago,' + esc(this.formaNombre(c.forma_pago)));
    lines.push('Código envío,' + esc(this.codigoEnvio(c)));
    lines.push('Impuesto,' + esc(c.impuesto));
    lines.push('Total,' + esc(c.precio_total));
    lines.push('');
    lines.push(['Ítem','Cantidad','Descripción','P. Unitario','Subtotal'].map(esc).join(','));
    d.forEach((x:any)=>{ const subtotal=(Number(x.cantidad)||0)*(Number(x.precio_unitario)||0); lines.push([x.numero_item,x.cantidad,x.descripcion,x.precio_unitario,subtotal].map(esc).join(',')); });
    const csv = lines.join('\r\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`comprobante_${c.serie||''}-${c.numero||''}.csv`;
    document.body.appendChild(a); a.click(); setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  }

  exportSelectedPDF() {
    if (this.isOperario) return;
    const c: any = this.selected; const d: any[] = (this.detalles || []);
    if (!c || this.isAnulado(c as any)) return;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const marginX = 40, marginY = 40, line = 16; let y = marginY;
    const addLine = (text: string, bold=false) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.text(text, marginX, y); y += line; };

    // Header
    doc.setFontSize(14); addLine(`Comprobante ${c.serie||'-'}-${c.numero||'-'}`, true);
    doc.setFontSize(10);
    const codigoEnvio = this.codigoEnvio(c);
    addLine(`Fecha: ${c.fecha_comprobante||''}`);
    addLine(`Código envío: ${codigoEnvio}`);
    addLine(`Tipo: ${c.tipo_comprobante||''}   Forma de pago: ${c.forma_pago||''}`);
    addLine(`Impuesto: ${Number(c.impuesto||0).toFixed(2)}   Total: ${Number(c.precio_total||0).toFixed(2)}`);

    // Table header
    y += 8; doc.setFont('helvetica','bold');
    doc.text('Ítem', marginX, y);
    doc.text('Cantidad', marginX+60, y);
    doc.text('Descripción', marginX+140, y);
    doc.text('P. Unitario', marginX+360, y);
    doc.text('Subtotal', marginX+460, y);
    y += 8; doc.setLineWidth(0.5); doc.line(marginX, y, marginX+520, y); y += 14; doc.setFont('helvetica','normal');

    // Rows
    const drawRow = (it:any) => {
      const subtotal = (Number(it.cantidad)||0)*(Number(it.precio_unitario)||0);
      // Basic page break
      if (y > 780) { doc.addPage(); y = marginY; }
      doc.text(String(it.numero_item ?? ''), marginX, y);
      doc.text(String(it.cantidad ?? ''), marginX+60, y);
      doc.text(String(it.descripcion ?? ''), marginX+140, y, { maxWidth: 200 });
      doc.text(Number(it.precio_unitario||0).toFixed(2), marginX+360, y, { align: 'left' });
      doc.text(Number(subtotal).toFixed(2), marginX+460, y, { align: 'left' });
      y += 14;
    };
    d.forEach(drawRow);

    // Footer total
    y += 10; if (y > 780) { doc.addPage(); y = marginY; }
    doc.setFont('helvetica','bold');
    doc.text(`Total: ${Number(c.precio_total||0).toFixed(2)}`, marginX+460, y);

    const filename = `comprobante_${c.serie||''}-${c.numero||''}.pdf`;
    doc.save(filename);
  }

  loadSunatStatus(id: number) {
    if (!id) return;
    this.sunatStatusLoading = true;
    this.comprobantesSrv.getDatosComprobanteSunat(id).subscribe({
      next: (res: any) => {
        const code = String((res as any)?.sunat_cod ?? '');
        this.sunatStatus = code === '0' ? 'accepted' : 'pending';
        const estadoCpe = this.sunatStatus === 'accepted' ? 'A' : 'P';
        const listItem = (this.lista || []).find(x => Number((x as any).id) === Number(id));
        if (listItem) (listItem as any).estado_cpe = estadoCpe;
        if (this.selected && Number((this.selected as any).id) === Number(id)) {
          (this.selected as any).estado_cpe = estadoCpe;
        }
        this.sunatStatusLoading = false;
      },
      error: () => {
        this.sunatStatus = 'pending';
        const listItem = (this.lista || []).find(x => Number((x as any).id) === Number(id));
        if (listItem) (listItem as any).estado_cpe = 'P';
        if (this.selected && Number((this.selected as any).id) === Number(id)) {
          (this.selected as any).estado_cpe = 'P';
        }
        this.sunatStatusLoading = false;
      }
    });
  }

  generarSunat() {
    if (this.isOperario) return;
    const c: any = this.selected;
    if (!c?.id || this.sunatLoading || this.isAnulado(c as any)) return;
    const codigo = '0';
    const mensaje = 'aceptado';
    this.sunatLoading = true;
    this.sunatError = null;
    this.sunatOk = null;
    this.comprobantesSrv.simularSunat(Number(c.id), String(codigo), String(mensaje)).subscribe({
      next: (res: any) => {
        this.sunatLoading = false;
        this.sunatOk = `SUNAT: ${codigo} - ${mensaje}`;
        this.loadSunatStatus(Number(c.id));
      },
      error: () => {
        this.sunatLoading = false;
        this.sunatError = 'No se pudo generar SUNAT';
      }
    });
  }

  enviarSunat() {
    if (this.isOperario) return;
    const c: any = this.selected;
    if (!c?.id || this.sunatLoading || this.isAnulado(c as any)) return;
    const id = Number(c.id);
    this.sunatLoading = true;
    this.sunatError = null;
    this.sunatOk = null;
    this.comprobantesSrv.sendSunat(id).subscribe({
      next: (res: any) => {
        this.sunatLoading = false;
        const cod = String((res as any)?.sunat_cod ?? '').trim();
        this.sunatOk = cod ? `SUNAT: ${cod}` : 'Comprobante enviado a SUNAT';
        this.loadSunatStatus(id);
      },
      error: () => {
        this.sunatLoading = false;
        this.sunatError = 'No se pudo enviar a SUNAT';
      }
    });
  }

  enviarSunatRow(c: Comprobante) {
    if (this.isOperario || this.isAnulado(c)) return;
    const id = Number((c as any)?.id || 0);
    if (!id || this.sunatLoading) return;
    this.sunatLoading = true;
    this.sunatError = null;
    this.sunatOk = null;
    this.comprobantesSrv.sendSunat(id).subscribe({
      next: (res: any) => {
        this.sunatLoading = false;
        const cod = String((res as any)?.sunat_cod ?? '').trim();
        this.sunatOk = cod ? `SUNAT: ${cod}` : 'Comprobante enviado a SUNAT';
        this.loadSunatStatus(id);
      },
      error: () => {
        this.sunatLoading = false;
        this.sunatError = 'No se pudo enviar a SUNAT';
      }
    });
  }

  generarSunatPendientes() {
    if (this.isOperario) return;
    if (this.sunatBulkLoading) return;
    const pendientes = (this.lista || []).filter(c => {
      if (this.isAnulado(c)) return false;
      const code = String((c as any)?.estado_cpe ?? '').trim().toUpperCase();
      return code === '' || code === 'P';
    });
    if (!pendientes.length) {
      this.sunatBulkOk = 'No hay comprobantes pendientes';
      this.sunatBulkError = null;
      this.sunatBulkTotal = 0;
      this.sunatBulkDone = 0;
      return;
    }
    this.sunatBulkLoading = true;
    this.sunatBulkOk = null;
    this.sunatBulkError = null;
    this.sunatBulkTotal = pendientes.length;
    this.sunatBulkDone = 0;
    const codigo = '0';
    const mensaje = 'aceptado';
    let index = 0;
    let errors = 0;
    const runNext = () => {
      if (index >= pendientes.length) {
        this.sunatBulkLoading = false;
        this.sunatBulkOk = `SUNAT generado para ${pendientes.length - errors} comprobante(s)`;
        if (errors) this.sunatBulkError = `Falló en ${errors} comprobante(s)`;
        return;
      }
      const c: any = pendientes[index++];
      this.comprobantesSrv.simularSunat(Number(c.id), String(codigo), String(mensaje)).subscribe({
        next: () => {
          c.estado_cpe = 'A';
          if (this.selected && Number((this.selected as any).id) === Number(c.id)) {
            this.sunatStatus = 'accepted';
          }
          this.sunatBulkDone += 1;
          runNext();
        },
        error: () => {
          errors += 1;
          this.sunatBulkDone += 1;
          runNext();
        }
      });
    };
    runNext();
  }

  private hasOperarioRole(): boolean {
    try {
      const raw = localStorage.getItem('me');
      if (!raw) return false;
      const me = JSON.parse(raw) as any;
      const roles = Array.isArray(me?.roles) ? me.roles : [];
      const roleNames = roles.map((r: any) => String(r?.name ?? r?.nombre ?? r?.rol ?? r?.role ?? r).toLowerCase().trim());
      return roleNames.includes('operario') && !roleNames.includes('admin_sede');
    } catch {
      return false;
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

  private getRoleNames(): string[] {
    const me = this.getCurrentMe();
    const roles = Array.isArray(me?.roles) ? me.roles : [];
    return roles.map((r: any) => String(r?.name ?? r?.nombre ?? r?.rol ?? r?.role ?? r).toLowerCase().trim());
  }

  private getUserPuntoId(): number {
    const me = this.getCurrentMe();
    const sede = Array.isArray(me?.sedes) ? me.sedes[0] : null;
    return Number(sede?.id || 0);
  }

  private useComprobantesPuntoEndpoint(): boolean {
    const puntoId = this.getUserPuntoId();
    if (puntoId <= 0) return false;
    const roles = this.getRoleNames();
    return roles.includes('operario') || roles.includes('admin_sede') || roles.includes('adm_sede');
  }
}
