import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Puntos } from '../../../../core/services/puntos';
import { Bi } from '../../../../core/services/bi';
import { AuthService } from '../../../../core/services/auth.service';
import { BIClienteTopItem, BIConductorRankingItem, BIEnviosPorDiaItem, BIResumenResponse, Puntos as Punto } from '../../../../core/mapped';

type DataState<T> = {
  loading: boolean;
  error: string | null;
  data: T;
};

type BiQueryParams = {
  empresa_id: number;
  sede_id?: number | null;
  fecha_desde?: string | null;
  fecha_hasta?: string | null;
};

@Component({
  selector: 'feature-bi-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bi-dashboard.html',
  styleUrl: './bi-dashboard.css',
})
export class BiDashboardFeature implements OnInit {
  private readonly biSrv = inject(Bi);
  private readonly puntosSrv = inject(Puntos);
  private readonly authSrv = inject(AuthService);

  fechaDesde = '';
  fechaHasta = '';
  sedeId: number | null = null;
  globalError: string | null = null;

  readonly sedesState: DataState<Punto[]> = { loading: false, error: null, data: [] };
  readonly resumenState: DataState<BIResumenResponse | null> = { loading: false, error: null, data: null };
  readonly enviosDiaState: DataState<BIEnviosPorDiaItem[]> = { loading: false, error: null, data: [] };
  readonly clientesTopState: DataState<BIClienteTopItem[]> = { loading: false, error: null, data: [] };
  readonly conductoresState: DataState<BIConductorRankingItem[]> = { loading: false, error: null, data: [] };

  ngOnInit(): void {
    this.setDefaultRange(30);
    this.loadSedes();
    this.loadDashboard();
  }

  applyFilters() {
    this.loadDashboard();
  }

  resetFilters() {
    this.setDefaultRange(30);
    this.sedeId = null;
    this.loadDashboard();
  }

  quickRange(days: number) {
    this.setDefaultRange(days);
    this.loadDashboard();
  }

  get totalEnvios(): number {
    return Number((this.resumenState.data as any)?.total_envios || 0);
  }

  get ingresosNetos(): number {
    return Number((this.resumenState.data as any)?.ingresos_netos || 0);
  }

  get tiempoPromedioText(): string {
    const r: any = this.resumenState.data || {};
    const candidates = [
      r?.tiempo_promedio_entrega_horas,
      r?.tiempo_promedio_horas,
      r?.tiempo_promedio,
    ];
    for (const value of candidates) {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) return `${n.toFixed(1)} h`;
    }
    return '--';
  }

  get enviosDiaSerie(): BIEnviosPorDiaItem[] {
    return (this.enviosDiaState.data || [])
      .slice()
      .sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')));
  }

  get lineChartPoints(): string {
    const width = 100;
    const height = 100;
    const series = this.enviosDiaSerie;
    if (!series.length) return '';
    const maxY = this.lineChartMaxY;
    return series.map((row, idx) => {
      const x = series.length === 1 ? 50 : (idx / (series.length - 1)) * width;
      const y = height - ((Number(row.total_envios || 0) / maxY) * height);
      return `${x},${y}`;
    }).join(' ');
  }

  get lineChartMaxY(): number {
    const series = this.enviosDiaSerie;
    return Math.max(...series.map((x) => Number(x.total_envios || 0)), 1);
  }

  get lastEnviosDiaRows(): BIEnviosPorDiaItem[] {
    return this.enviosDiaSerie.slice(-6);
  }

  get clientesTopRows(): BIClienteTopItem[] {
    return (this.clientesTopState.data || []).slice(0, 8);
  }

  get clientesMaxMonto(): number {
    return Math.max(...(this.clientesTopRows.map((x) => Number(x.monto_total || 0))), 1);
  }

  clienteBarPct(item: BIClienteTopItem): number {
    const max = this.clientesMaxMonto;
    return Math.round((Number(item?.monto_total || 0) / max) * 100);
  }

  get conductoresRows(): BIConductorRankingItem[] {
    return (this.conductoresState.data || []).slice(0, 8);
  }

  formatDateLabel(value: string | null | undefined): string {
    const raw = String(value || '').trim();
    if (!raw) return '-';
    const parts = raw.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return raw;
  }

  private companyId(): number {
    return Number(this.authSrv.getCompaniaId() || 0);
  }

  private buildParams(): BiQueryParams {
    const empresaId = this.companyId();
    return {
      empresa_id: empresaId,
      sede_id: this.sedeId || null,
      fecha_desde: this.fechaDesde || null,
      fecha_hasta: this.fechaHasta || null,
    };
  }

  private setDefaultRange(days: number) {
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - Math.max(1, days) + 1);
    this.fechaDesde = this.toInputDate(from);
    this.fechaHasta = this.toInputDate(now);
  }

  private toInputDate(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  private loadSedes() {
    this.sedesState.loading = true;
    this.sedesState.error = null;
    this.puntosSrv.getPuntos().subscribe({
      next: (res) => {
        this.sedesState.loading = false;
        this.sedesState.data = res || [];
      },
      error: () => {
        this.sedesState.loading = false;
        this.sedesState.error = 'No se pudieron cargar las sedes';
        this.sedesState.data = [];
      },
    });
  }

  private loadDashboard() {
    const empresaId = this.companyId();
    if (!empresaId) {
      this.globalError = 'No se encontró empresa para consultar BI.';
      return;
    }
    this.globalError = null;
    const params = this.buildParams();

    this.resumenState.loading = true;
    this.resumenState.error = null;
    this.biSrv.getResumen(params).subscribe({
      next: (res) => {
        this.resumenState.loading = false;
        this.resumenState.data = res || null;
      },
      error: () => {
        this.resumenState.loading = false;
        this.resumenState.error = 'No se pudo cargar el resumen BI';
        this.resumenState.data = null;
      },
    });

    this.enviosDiaState.loading = true;
    this.enviosDiaState.error = null;
    this.biSrv.getEnviosDia(params).subscribe({
      next: (res) => {
        this.enviosDiaState.loading = false;
        this.enviosDiaState.data = res || [];
      },
      error: () => {
        this.enviosDiaState.loading = false;
        this.enviosDiaState.error = 'No se pudo cargar envíos por día';
        this.enviosDiaState.data = [];
      },
    });

    this.clientesTopState.loading = true;
    this.clientesTopState.error = null;
    this.biSrv.getClientesTop(params).subscribe({
      next: (res) => {
        this.clientesTopState.loading = false;
        this.clientesTopState.data = res || [];
      },
      error: () => {
        this.clientesTopState.loading = false;
        this.clientesTopState.error = 'No se pudo cargar el ranking de clientes';
        this.clientesTopState.data = [];
      },
    });

    this.conductoresState.loading = true;
    this.conductoresState.error = null;
    this.biSrv.getRankingConductores(params).subscribe({
      next: (res) => {
        this.conductoresState.loading = false;
        this.conductoresState.data = res || [];
      },
      error: () => {
        this.conductoresState.loading = false;
        this.conductoresState.error = 'No se pudo cargar el ranking de conductores';
        this.conductoresState.data = [];
      },
    });
  }
}
