import jsPDF from 'jspdf';
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Comprobantes } from '../../../../core/services/comprobantes';
import { Clientes } from '../../../../core/services/clientes';
import { Personas } from '../../../../core/services/personas';
import { Generales } from '../../../../core/services/generales';
import { DetallesComprobante } from '../../../../core/services/detalles-comprobante';
import { Cliente, Comprobante, DetalleComprobante, Persona } from '../../../../core/mapped';
import { Utils } from '../../../../core/services/utils';

@Component({
  selector: 'feature-comprobantes',
  standalone: true,
  imports: [CommonModule, FormsModule, Utils],
  templateUrl: './comprobantes-feature.html',
})
export class ComprobantesFeature implements OnInit {
  private readonly comprobantesSrv = inject(Comprobantes);
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
  detalles: DetalleComprobante[] = [];
  detallesLoading = false;
  detallesError: string | null = null;
  sunatLoading = false;
  sunatError: string | null = null;
  sunatOk: string | null = null;
  sunatStatus: 'accepted' | 'pending' | null = null;
  sunatStatusLoading = false;

  // Catálogos
  generales: any[] = [];
  tiposComprobante: any[] = [];
  formasPago: any[] = [];
  clientes: Cliente[] = [];
  personas: Persona[] = [];

  tipoNombre(id: number | null | undefined): string {
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
    this.sunatOk = null;
    this.sunatError = null;
    this.sunatStatus = null;
    this.sunatStatusLoading = false;
    this.loadDetalles((c as any).id);
    this.loadSunatStatus((c as any).id);
  }

  load() {
    this.loading = true;
    this.error = null;
    this.comprobantesSrv.getComprobantes().subscribe({
      next: (res) => { this.lista = res || []; this.loading = false; this.trySelectById(); this.trySelectByEnvioId(); },
      error: () => { this.loading = false; this.error = 'No se pudieron cargar los comprobantes'; }
    });
  }


  private trySelectById() {
    if (!this.initialSelectId) return;
    const found = (this.lista || []).find((x: any) => Number((x as any).id) === Number(this.initialSelectId));
    if (found) { this.selected = found as any; this.loadDetalles((found as any).id); }
  }

  private trySelectByEnvioId() {
    if (!this.initialEnvioId) return;
    const found = (this.lista || []).find((x: any) => Number((x as any).envio_id) === Number(this.initialEnvioId));
    if (found) { this.selected = found as any; this.loadDetalles((found as any).id); }
  }

  loadDetalles(id: number) {
    this.detallesLoading = true;
    this.detallesError = null;
    this.detallesSrv.getDetalles(id).subscribe({
      next: (res) => { this.detalles = res || []; this.detallesLoading = false; },
      error: () => { this.detallesLoading = false; this.detallesError = 'No se pudo cargar el detalle'; }
    });
  }

  ngOnInit(): void { try { const saved = (localStorage.getItem('comprobantes.viewMode') || '').toLowerCase(); if (saved === 'grid' || saved === 'cards') this.viewMode = saved as any; } catch {}
    // Leer id de comprobante por query param para auto-selecci�n
        this.route.queryParamMap.subscribe(pm => {
      const idStr = pm.get('id');
      this.initialSelectId = idStr ? Number(idStr) : null;
      const envioStr = pm.get('envio_id');
      this.initialEnvioId = envioStr ? Number(envioStr) : null;
      if (this.lista && this.lista.length) { this.trySelectById(); this.trySelectByEnvioId(); }
    });
    // Cargar cat�logos para nombres legibles
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

  // Utilidad para formato e impresi�n/exportaci�n
  private format(n: number): string {
    try { return (Number(n)||0).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2}); } catch { return String(n); }
  }

  printSelected() {
    const c: any = this.selected; const d: any[] = (this.detalles || []);
    if (!c) return;
    const title = `Comprobante ${c.serie||'-'}-${c.numero||'-'}`;
    const isFactura = (this.tipoNombre(c.tipo_comprobante || 0).toLowerCase().includes('fact')) || Number(c.impuesto || 0) > 0;
    const rows = d.map(x => {
      const base = (Number(x.cantidad)||0) * (Number(x.precio_unitario)||0);
      const igv = isFactura ? base * 0.18 : 0;
      const total = base + igv;
      return `<tr>
  <td class="center">${x.numero_item||''}</td>
  <td class="center">${x.cantidad||''}</td>
  <td class="center">UND</td>
  <td>${x.descripcion||''}</td>
  <td class="right">${this.format(x.precio_unitario)}</td>
  <td class="right">${this.format(igv)}</td>
  <td class="right">${this.format(total)}</td>
</tr>`;
    }).join('');
    const subtotal = this.subtotal;
    const igvTotal = this.selectedIgv;
    const totalFinal = this.selectedTotal;
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;padding:20px;color:#0f172a;}
  h1{font-size:18px;margin:0 0 6px;}
  table{border-collapse:collapse;width:100%;font-size:12px;}
  th,td{border:1px solid #e2e8f0;padding:6px;text-align:left;vertical-align:top;}
  .meta{margin:10px 0 16px;font-size:13px;}
  .right{text-align:right;}
  .center{text-align:center;}
  .muted{color:#64748b;}
  .box{border:1px solid #e2e8f0;padding:8px;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  .totals{width:240px;border:1px solid #e2e8f0;padding:8px;margin-left:auto;}
</style>
</head><body>
  <h1>${title}</h1>
  <div class="grid meta">
    <div class="box">
      <div><b>Datos del cliente</b></div>
      <div><span class="muted">Señor(es):</span> ${this.clienteNombre(c)}</div>
      <div><span class="muted">RUC/DNI:</span> ${c.cliente_documento || '-'}</div>
      <div><span class="muted">Dirección:</span> -</div>
    </div>
    <div class="box">
      <div><b>Datos del comprobante</b></div>
      <div><span class="muted">Fecha emisión:</span> ${c.fecha_comprobante||''}</div>
      <div><span class="muted">Forma de pago:</span> ${this.formaNombre(c.forma_pago)}</div>
      <div><span class="muted">Tipo:</span> ${this.tipoNombre(c.tipo_comprobante)}</div>
      <div><span class="muted">Impuesto:</span> ${this.format(c.impuesto)}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th class="center">Ítem</th>
        <th class="center">Cant.</th>
        <th class="center">Und.</th>
        <th>Descripción</th>
        <th class="right">V. Unit</th>
        <th class="right">IGV</th>
        <th class="right">Importe</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals meta">
    <div class="right"><span class="muted">Op. Gravadas:</span> ${this.format(subtotal)}</div>
    ${isFactura ? `<div class="right"><span class="muted">IGV (18%):</span> ${this.format(igvTotal)}</div>` : ''}
    <div class="right"><b>Total: ${this.format(totalFinal)}</b></div>
  </div>
  <script>window.addEventListener('load',()=>{window.print(); setTimeout(()=>window.close(),300)});</script>
</body></html>`;
    const w = window.open('', '_blank'); if(!w) return; w.document.open(); w.document.write(html); w.document.close();
  }

  exportSelectedCSV() {
    const c: any = this.selected; const d: any[] = (this.detalles || []);
    if (!c) return;
    const esc = (v:any)=> '"' + String(v ?? '').replace(/"/g,'""') + '"';
    const lines: string[] = [];
    lines.push('Comprobante,' + esc(`${c.serie||'-'}-${c.numero||'-'}`));
    lines.push('Fecha,' + esc(c.fecha_comprobante));
    lines.push('Tipo,' + esc(this.tipoNombre(c.tipo_comprobante)));
    lines.push('Forma de pago,' + esc(this.formaNombre(c.forma_pago)));
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
    const c: any = this.selected; const d: any[] = (this.detalles || []);
    if (!c) return;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const marginX = 40, marginY = 40, line = 16; let y = marginY;
    const addLine = (text: string, bold=false) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.text(text, marginX, y); y += line; };

    // Header
    doc.setFontSize(14); addLine(`Comprobante ${c.serie||'-'}-${c.numero||'-'}`, true);
    doc.setFontSize(10);
    addLine(`Fecha: ${c.fecha_comprobante||''}`);
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
        this.sunatStatusLoading = false;
      },
      error: () => {
        this.sunatStatus = 'pending';
        this.sunatStatusLoading = false;
      }
    });
  }

  generarSunat() {
    const c: any = this.selected;
    if (!c?.id || this.sunatLoading) return;
    const codigo = '0';
    const mensaje = 'aceptado';
    this.sunatLoading = true;
    this.sunatError = null;
    this.sunatOk = null;
    this.comprobantesSrv.simularSunat(Number(c.id), String(codigo), String(mensaje)).subscribe({
      next: (res: any) => {
        this.sunatLoading = false;
        this.sunatOk = `SUNAT: ${codigo} - ${mensaje}`;
      },
      error: () => {
        this.sunatLoading = false;
        this.sunatError = 'No se pudo generar SUNAT';
      }
    });
  }
}






