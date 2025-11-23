import jsPDF from 'jspdf';
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Comprobantes } from '../../../../core/services/comprobantes';
import { DetallesComprobante } from '../../../../core/services/detalles-comprobante';
import { Comprobante, DetalleComprobante } from '../../../../core/mapped';

@Component({
  selector: 'feature-comprobantes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './comprobantes-feature.html',
})
export class ComprobantesFeature implements OnInit {
  private readonly comprobantesSrv = inject(Comprobantes);
  private readonly detallesSrv = inject(DetallesComprobante);
  private readonly route = inject(ActivatedRoute);
  initialSelectId: number | null = null;

  lista: Comprobante[] = [];
  loading = false;
  error: string | null = null;

  search = '';
  page = 1;
  pageSize = 8;

  // Selección y detalle actual
  selected: Comprobante | null = null;
  detalles: DetalleComprobante[] = [];
  detallesLoading = false;
  detallesError: string | null = null;

  

  

  get subtotal(): number { return (this.detalles || []).reduce((acc, it: any) => acc + (Number(it.cantidad)||0)*(Number(it.precio_unitario)||0), 0); }

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

  select(c: Comprobante) {
    this.selected = c;
    this.loadDetalles((c as any).id);
  }

  load() {
    this.loading = true;
    this.error = null;
    this.comprobantesSrv.getComprobantes().subscribe({
      next: (res) => { this.lista = res || []; this.loading = false; this.trySelectById(); },
      error: () => { this.loading = false; this.error = 'No se pudieron cargar los comprobantes'; }
    });
  }


  private trySelectById() {
    if (!this.initialSelectId) return;
    const found = (this.lista || []).find((x: any) => Number((x as any).id) === Number(this.initialSelectId));
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

  ngOnInit(): void {
    // Leer id de comprobante por query param para auto-selección
    this.route.queryParamMap.subscribe(pm => {
      const idStr = pm.get('id');
      this.initialSelectId = idStr ? Number(idStr) : null;
      if (this.lista && this.lista.length) { this.trySelectById(); }
    });
    this.load();
  }

  // Utilidad para formato e impresión/exportación
  private format(n: number): string {
    try { return (Number(n)||0).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2}); } catch { return String(n); }
  }

  printSelected() {
    const c: any = this.selected; const d: any[] = (this.detalles || []);
    if (!c) return;
    const title = `Comprobante ${c.serie||'-'}-${c.numero||'-'}`;
    const rows = d.map(x => `<tr><td>${x.numero_item||''}</td><td>${x.cantidad||''}</td><td>${x.descripcion||''}</td><td class="right">${this.format(x.precio_unitario)}</td><td class="right">${this.format((Number(x.cantidad)||0)*(Number(x.precio_unitario)||0))}</td></tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title>
<style> body{font-family:Arial,Helvetica,sans-serif;padding:20px;color:#0f172a;} h1{font-size:18px;margin:0 0 6px;} table{border-collapse:collapse;width:100%;font-size:12px;} th,td{border:1px solid #e2e8f0;padding:6px;text-align:left;} .meta{margin:10px 0 16px;font-size:13px;} .right{text-align:right;} .muted{color:#64748b;} </style>
</head><body>
  <h1>${title}</h1>
  <div class="meta">
    <div><span class="muted">Fecha:</span> ${c.fecha_comprobante||''}</div>
    <div><span class="muted">Tipo:</span> ${c.tipo_comprobante||''} &nbsp; <span class="muted">Forma de pago:</span> ${c.forma_pago||''}</div>
    <div><span class="muted">Impuesto:</span> ${this.format(c.impuesto)}</div>
    <div><span class="muted">Total:</span> <b>${this.format(c.precio_total)}</b></div>
  </div>
  <table><thead><tr><th>Ítem</th><th>Cantidad</th><th>Descripción</th><th class="right">P. Unitario</th><th class="right">Subtotal</th></tr></thead>
  <tbody>${rows}</tbody></table>
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
    lines.push('Tipo,' + esc(c.tipo_comprobante));
    lines.push('Forma de pago,' + esc(c.forma_pago));
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
}




