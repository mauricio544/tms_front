import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Envios } from '../../../../core/services/envios';
import { DetalleMovimientos } from '../../../../core/services/detalle-movimientos';
import { Envio, DetalleFull as Detalle } from '../../../../core/mapped';

@Component({
  selector: 'feature-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportes.html',
  styleUrl: './reportes.css',
  styleUrl: './reportes.css',
})
export class ReportesFeature implements OnInit {
  fromDate: string = '';
  toDate: string = '';
  private readonly enviosSrv = inject(Envios);
  private readonly detalleSrv = inject(DetalleMovimientos);

  loading = false;
  error: string | null = null;

  envios: Envio[] = [];
  movimientos: Detalle[] = [];

  ngOnInit(): void {
    this.load();
  }

  load() {
    this.loading = true;
    this.error = null;
    let enviosLoaded = false, movsLoaded = false;
    const done = () => { if (enviosLoaded && movsLoaded) this.loading = false; };
    this.enviosSrv.getEnvios().subscribe({
      next: (res) => { this.envios = res || []; enviosLoaded = true; done(); },
      error: () => { this.error = 'No se pudieron cargar los envíos'; enviosLoaded = true; done(); }
    });
    this.detalleSrv.getDetallesListFull().subscribe({
      next: (res) => { this.movimientos = res || []; movsLoaded = true; done(); },
      error: () => { this.error = (this.error || ''); this.error += (this.error? ' • ' : '') + 'No se pudieron cargar los movimientos'; movsLoaded = true; done(); }
    });
  }

  // KPIs envíos
  get filteredEnvios(): Envio[] {
    const fd = this.fromDate ? new Date(this.fromDate) : null;
    const td = this.toDate ? new Date(this.toDate) : null;
    return (this.envios || []).filter((e: any) => {
      const d = e?.fecha_envio ? new Date(e.fecha_envio) : null;
      if (fd && (!d || d < fd)) return false;
      if (td && (!d || d > td)) return false;
      return true;
    });
  }
  get kpiEntregados(): number { return this.filteredEnvios.filter((e:any)=> !!(e?.fecha_recepcion || e?.estado_entrega)).length; }
  get kpiNoEntregados(): number {
    return (this.envios || []).filter((e:any) => !(e?.fecha_recepcion || e?.estado_entrega)).length;
  }
  get kpiPagados(): number {
    return (this.envios || []).filter((e:any) => !!e?.estado_pago).length;
  }
  get kpiNoPagados(): number {
    return (this.envios || []).filter((e:any) => !e?.estado_pago).length;
  }

  // KPIs movimientos
  get totalIngresos(): number {
    return (this.movimientos || []).reduce((acc: number, it: any) => acc + (((it?.cabecera?.tipo_movimiento || '') === 'I') ? Number(it?.monto || 0) : 0), 0);
  }
  get totalEgresos(): number {
    return (this.movimientos || []).reduce((acc: number, it: any) => acc + (((it?.cabecera?.tipo_movimiento || '') === 'E') ? Number(it?.monto || 0) : 0), 0);
  }
  get totalNeto(): number { return this.totalIngresos - this.totalEgresos; }
}

  // Export CSV del resumen
  exportCSV() {
    const esc = (v:any)=> '"' + String(v ?? '').replace(/"/g,'""') + '"';
    const lines: string[] = [];
    lines.push(['KPI','Valor'].map(esc).join(','));
    lines.push(['Entregados', this.kpiEntregados].map(esc).join(','));
    lines.push(['No entregados', this.kpiNoEntregados].map(esc).join(','));
    lines.push(['Pagados', this.kpiPagados].map(esc).join(','));
    lines.push(['No pagados', this.kpiNoPagados].map(esc).join(','));
    lines.push('');
    lines.push(['Resumen','Monto'].map(esc).join(','));
    lines.push(['Ingresos', this.totalIngresos.toFixed(2)].map(esc).join(','));
    lines.push(['Egresos', this.totalEgresos.toFixed(2)].map(esc).join(','));
    lines.push(['Neto', this.totalNeto.toFixed(2)].map(esc).join(','));
    const blob = new Blob([lines.join('\r\n')], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href=url; a.download='reporte_kpis.csv'; document.body.appendChild(a); a.click();
    setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  }

