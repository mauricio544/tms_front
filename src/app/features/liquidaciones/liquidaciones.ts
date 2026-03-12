import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Envios } from '../../../../core/services/envios';
import { EnviosDiariosResumenPorUsuarioRead, EnviosDiariosAgrupadosRead, ComprobanteReporteRead } from '../../../../core/mapped';

@Component({
  selector: 'feature-liquidaciones',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './liquidaciones.html',
  styleUrl: './liquidaciones.css',
})
export class LiquidacionesFeature implements OnInit {
  private readonly enviosSrv = inject(Envios);
  isOperario = false;
  resumen: EnviosDiariosResumenPorUsuarioRead[] = [];
  totales: EnviosDiariosAgrupadosRead[] = [];
  fechaFiltro = '';
  loading = false;
  error: string | null = null;
  totalesLoading = false;
  totalesError: string | null = null;

  ngOnInit(): void {
    this.isOperario = this.hasOperarioRole();
    this.loadResumen();
    this.loadTotales();
  }

  loadResumen() {
    this.loading = true;
    this.error = null;
    const fecha = this.normalizedFechaFiltro();
    this.enviosSrv.getEnviosResumenByFecha(fecha).subscribe({
      next: (res) => {
        const list = (res || []) as EnviosDiariosResumenPorUsuarioRead[];
        this.resumen = list.sort((a, b) => String(b.fecha_creacion).localeCompare(String(a.fecha_creacion)));
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'No se pudo cargar el resumen de envios';
      }
    });
  }

  loadTotales() {
    this.totalesLoading = true;
    this.totalesError = null;
    const fecha = this.normalizedFechaFiltro();
    this.enviosSrv.getEnviosTotalesByFecha(fecha).subscribe({
      next: (res) => {
        const list = (res || []) as EnviosDiariosAgrupadosRead[];
        this.totales = list.sort((a, b) => String(b.fecha_creacion).localeCompare(String(a.fecha_creacion)));
        this.totalesLoading = false;
      },
      error: () => {
        this.totalesLoading = false;
        this.totalesError = 'No se pudo cargar el total de envios por dia';
      }
    });
  }

  countComprobantes(list: ComprobanteReporteRead[] | null | undefined): number {
    return Array.isArray(list) ? list.length : 0;
  }

  totalComprobantes(list: ComprobanteReporteRead[] | null | undefined): number {
    if (!Array.isArray(list)) return 0;
    return list.reduce((sum, item) => sum + (Number((item as any)?.precio_total) || 0), 0);
  }

  resumenTotalEnvios(): number {
    return (this.resumen || []).reduce((sum, row: any) => sum + (Number(row?.total_envios) || 0), 0);
  }

  resumenTotalComprobantes(): number {
    return (this.resumen || []).reduce((sum, row: any) => sum + (Number(row?.total_comprobantes) || 0), 0);
  }

  resumenTotalMontoComprobantes(): number {
    return (this.resumen || []).reduce((sum, row: any) => sum + (Number(row?.total_monto_comprobantes) || 0), 0);
  }

  totalesDetalleEnvios(list: any[] | null | undefined): number {
    if (!Array.isArray(list)) return 0;
    return list.reduce((sum, item) => sum + (Number(item?.total_envios) || 0), 0);
  }

  totalesDetalleComprobantes(list: any[] | null | undefined): number {
    if (!Array.isArray(list)) return 0;
    return list.reduce((sum, item) => sum + this.countComprobantes(item?.comprobantes), 0);
  }

  totalesDetalleMontoComprobantes(list: any[] | null | undefined): number {
    if (!Array.isArray(list)) return 0;
    return list.reduce((sum, item) => sum + this.totalComprobantes(item?.comprobantes), 0);
  }

  comprobanteLabels(list: ComprobanteReporteRead[] | null | undefined): string {
    if (!Array.isArray(list) || !list.length) return '-';
    return list.map((c: any) => {
      const serie = String(c?.serie || '').trim();
      const numero = String(c?.numero || '').trim();
      const full = String(c?.numero_comprobante || '').trim();
      if (serie && numero) return `${serie}-${numero}`;
      return full || String(c?.id || '').trim() || '-';
    }).filter(Boolean).join(', ');
  }

  onFechaFiltroChange(value: string): void {
    if (this.isOperario) return;
    this.fechaFiltro = this.normalizeFechaValue(value);
    this.loadResumen();
    this.loadTotales();
  }

  clearFechaFiltro(): void {
    if (this.isOperario) return;
    this.fechaFiltro = '';
    this.loadResumen();
    this.loadTotales();
  }

  private normalizeFechaValue(value: string): string {
    const v = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
  }

  private normalizedFechaFiltro(): string | undefined {
    return this.fechaFiltro || undefined;
  }

  printGrillas(): void {
    if (this.isOperario) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const resumenGrid = document.getElementById('liquidaciones-resumen-grid');
    const totalesGrid = document.getElementById('liquidaciones-totales-grid');
    if (!resumenGrid || !totalesGrid) return;

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) return;

    const now = new Date();
    const printedAt = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;

    printWindow.document.write(`
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Liquidaciones</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #0f172a; }
            h1 { margin: 0 0 6px 0; font-size: 22px; }
            h2 { margin: 24px 0 8px 0; font-size: 18px; }
            p { margin: 0 0 12px 0; color: #475569; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; font-size: 12px; vertical-align: top; }
            th { background: #f8fafc; font-weight: 600; }
          </style>
        </head>
        <body>
          <h1>Liquidaciones</h1>
          <p>Impreso: ${printedAt}</p>
          ${resumenGrid.outerHTML}
          ${totalesGrid.outerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
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
}
