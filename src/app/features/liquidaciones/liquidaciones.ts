import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Envios } from '../../../../core/services/envios';
import { EnviosDiariosResumenPorUsuarioRead, EnviosDiariosAgrupadosRead, ComprobanteReporteRead } from '../../../../core/mapped';
import { Observable } from 'rxjs';

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
  isAdminSede = false;
  isAdmin = false;
  resumen: EnviosDiariosResumenPorUsuarioRead[] = [];
  totales: EnviosDiariosAgrupadosRead[] = [];
  fechaFiltro = '';
  loading = false;
  error: string | null = null;
  totalesLoading = false;
  totalesError: string | null = null;

  ngOnInit(): void {
    this.resolveRoleFlags();
    this.loadResumen();
    this.loadTotales();
  }

  loadResumen() {
    this.loading = true;
    this.error = null;
    const fecha = this.normalizedFechaFiltro();
    this.getResumenSourceByRole(fecha).subscribe({
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
    this.getTotalesSourceByRole(fecha).subscribe({
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
    this.fechaFiltro = this.normalizeFechaValue(value);
    this.loadResumen();
    this.loadTotales();
  }

  clearFechaFiltro(): void {
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
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (this.isAdminSede || this.isOperario) {
      this.printThermal80mm();
      return;
    }

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

  private getResumenSourceByRole(fecha?: string): Observable<EnviosDiariosResumenPorUsuarioRead[]> {
    if (this.isAdminSede) {
      return this.enviosSrv.getEnviosResumenByFechaSede(fecha, this.getUserSedeId() || undefined);
    }
    if (this.isOperario) {
      return this.enviosSrv.getEnviosResumenByFechaUsuario(fecha, this.getUserId() || undefined);
    }
    return this.enviosSrv.getEnviosResumenByFecha(fecha);
  }

  private getTotalesSourceByRole(fecha?: string): Observable<EnviosDiariosAgrupadosRead[]> {
    if (this.isAdminSede) {
      return this.enviosSrv.getEnviosTotalesByFechaSede(fecha, this.getUserSedeId() || undefined);
    }
    if (this.isOperario) {
      return this.enviosSrv.getEnviosTotalesByFechaUsuario(fecha, this.getUserId() || undefined);
    }
    return this.enviosSrv.getEnviosTotalesByFecha(fecha);
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

  private hasRole(...targetRoles: string[]): boolean {
    const roleNames = this.getRoleNames();
    return targetRoles.some((role) => roleNames.includes(role));
  }

  private resolveRoleFlags(): void {
    this.isAdminSede = this.hasRole('admin_sede', 'adm_sede');
    this.isOperario = !this.isAdminSede && this.hasRole('operario');
    this.isAdmin = !this.isAdminSede && !this.isOperario && this.hasRole('admin');
  }

  private getUserSedeId(): number {
    const me = this.getCurrentMe();
    const sede = Array.isArray(me?.sedes) ? me.sedes[0] : null;
    return Number(sede?.id || 0);
  }

  private getUserId(): number {
    const me = this.getCurrentMe();
    return Number(me?.id || me?.usuario_id || me?.user_id || me?.usuario?.id || 0);
  }

  private roleLabel(): string {
    if (this.isAdminSede) return 'ADMIN_SEDE';
    if (this.isOperario) return 'OPERARIO';
    return 'ADMIN';
  }

  private escHtml(value: any): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private formatMoney(value: any): string {
    const n = Number(value || 0);
    return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private companyLogoSrc(): string | null {
    const fromMe = (() => {
      try { return String(this.getCurrentMe()?.companies?.[0]?.logo || '').trim(); } catch { return ''; }
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

  private formatIsoDate(value: any): string {
    const s = String(value || '').trim();
    return s ? s.slice(0, 10) : '-';
  }

  private printThermal80mm(): void {
    const w = window.open('', '_blank');
    if (!w) return;
    const now = new Date();
    const printedAt = `${now.toLocaleDateString('es-PE')} ${now.toLocaleTimeString('es-PE')}`;
    const fecha = this.fechaFiltro || 'TODAS';
    const logo = this.companyLogoSrc();

    const resumenRows = (this.resumen || []).map((row: any) => `
      <div class="block">
        <div class="row"><b>Fecha:</b> ${this.escHtml(this.formatIsoDate(row?.fecha_creacion))}</div>
        <div class="row"><b>Usuario:</b> ${this.escHtml(row?.usuario_crea || '-')}</div>
        <div class="row"><b>Envios:</b> ${Number(row?.total_envios || 0)}</div>
        <div class="row"><b>Comprob.:</b> ${Number(row?.total_comprobantes || 0)}</div>
        <div class="row"><b>Monto:</b> S/ ${this.formatMoney(row?.total_monto_comprobantes)}</div>
      </div>
    `).join('');

    const totalesRows = (this.totales || []).map((row: any) => {
      const envios = Array.isArray(row?.envios) ? row.envios : [];
      const enviosHtml = envios.map((e: any) => `
        <div class="sub">
          <div class="row"><b>Envio:</b> ${this.escHtml(e?.envio?.id || '-')}</div>
          <div class="row"><b>Origen:</b> ${this.escHtml(e?.envio?.origen_nombre || '-')}</div>
          <div class="row"><b>Destino:</b> ${this.escHtml(e?.envio?.destino_nombre || '-')}</div>
          <div class="row"><b>Comprob.:</b> ${this.countComprobantes(e?.comprobantes)}</div>
          <div class="row"><b>Monto:</b> S/ ${this.formatMoney(this.totalComprobantes(e?.comprobantes))}</div>
        </div>
      `).join('');

      return `
        <div class="block">
          <div class="row"><b>Fecha:</b> ${this.escHtml(this.formatIsoDate(row?.fecha_creacion))}</div>
          <div class="row"><b>Usuario:</b> ${this.escHtml(row?.usuario_crea || '-')}</div>
          <div class="row"><b>Total envios:</b> ${Number(row?.total_envios || 0)}</div>
          ${enviosHtml || '<div class="sub">Sin detalle de envios.</div>'}
        </div>
      `;
    }).join('');

    const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Liquidaciones</title>
  <style>
    @page { size: 80mm auto; margin: 3mm; }
    html, body { width: 80mm; margin: 0; padding: 0; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.25; }
    .wrap { width: 74mm; margin: 0 auto; }
    .logo { text-align:center; margin-bottom: 4px; }
    .logo img { max-width: 34mm; max-height: 16mm; object-fit: contain; }
    .title { text-align:center; font-weight:700; letter-spacing:.2px; }
    .meta { margin: 1px 0; font-size: 10px; }
    .sep { border-top: 1px dashed #000; margin: 6px 0; }
    .section { font-weight:700; margin: 2px 0 4px; }
    .block { border-bottom: 1px dotted #999; padding: 3px 0; }
    .sub { margin-top: 3px; padding-top: 3px; border-top: 1px dashed #bbb; }
    .row { margin: 1px 0; word-break: break-word; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
</head>
<body>
  <div class="wrap">
    ${logo ? `<div class="logo"><img src="${this.escHtml(logo)}" alt="Logo"></div>` : ''}
    <div class="title">LIQUIDACIONES</div>
    <div class="meta">Rol: ${this.escHtml(this.roleLabel())}</div>
    <div class="meta">Fecha filtro: ${this.escHtml(fecha)}</div>
    <div class="meta">Impreso: ${this.escHtml(printedAt)}</div>
    <div class="sep"></div>
    <div class="section">Resumen</div>
    ${resumenRows || '<div class="block">Sin datos para mostrar.</div>'}
    <div class="block">
      <div class="row"><b>Total envios:</b> ${this.resumenTotalEnvios()}</div>
      <div class="row"><b>Total comprobantes:</b> ${this.resumenTotalComprobantes()}</div>
      <div class="row"><b>Monto total:</b> S/ ${this.formatMoney(this.resumenTotalMontoComprobantes())}</div>
    </div>
    <div class="sep"></div>
    <div class="section">Totales por dia</div>
    ${totalesRows || '<div class="block">Sin datos para mostrar.</div>'}
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
    w.document.open();
    w.document.write(html);
    w.document.close();
  }
}
