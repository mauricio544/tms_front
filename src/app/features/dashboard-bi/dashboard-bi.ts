import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import {
  BIClienteTopItem,
  BIConductorRankingItem,
  BIEnviosPorDiaItem,
  BIResumenResponse,
  Puntos as Punto,
} from '../../../../core/mapped';
import {
  Bi,
  BIQueryParams,
  BIDashboardAlertaItem,
  BIDashboardDistribucionItem,
  BIDashboardKpisResponse,
  BIDashboardRutaFinanzasItem,
  BIDashboardTopClienteItem,
  BIDashboardTopRutaItem,
  BIDashboardTransporteItem,
  BIDashboardTrendPoint,
} from '../../../../core/services/bi';
import { Puntos } from '../../../../core/services/puntos';
import { AuthService } from '../../../../core/services/auth.service';
import { KpiCardComponent } from './components/kpi-card/kpi-card.component';
import { LineChartComponent, LinePoint } from './components/line-chart/line-chart.component';
import { DonutChartComponent, DonutItem } from './components/donut-chart/donut-chart.component';
import { RankingItem, RankingListComponent } from './components/ranking-list/ranking-list.component';
import { AlertsListComponent } from './components/alerts-list/alerts-list.component';

type DataState<T> = { loading: boolean; error: string | null; data: T };

@Component({
  selector: 'feature-dashboard-bi',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    KpiCardComponent,
    LineChartComponent,
    DonutChartComponent,
    RankingListComponent,
    AlertsListComponent,
  ],
  templateUrl: './dashboard-bi.html',
  styleUrl: './dashboard-bi.css',
})
export class DashboardBiFeature implements OnInit {
  private readonly biSrv = inject(Bi);
  private readonly puntosSrv = inject(Puntos);
  private readonly authSrv = inject(AuthService);

  fechaDesde = '';
  fechaHasta = '';
  sedeId: number | null = null;
  rutaMode: 'costo' | 'ingreso' = 'ingreso';
  globalError: string | null = null;

  readonly sedesState: DataState<Punto[]> = { loading: false, error: null, data: [] };
  readonly kpisState: DataState<BIDashboardKpisResponse | null> = { loading: false, error: null, data: null };
  readonly trendState: DataState<BIDashboardTrendPoint[]> = { loading: false, error: null, data: [] };
  readonly distribucionState: DataState<BIDashboardDistribucionItem[]> = { loading: false, error: null, data: [] };
  readonly rutasFinanzasState: DataState<BIDashboardRutaFinanzasItem[]> = { loading: false, error: null, data: [] };
  readonly transporteState: DataState<BIDashboardTransporteItem[]> = { loading: false, error: null, data: [] };
  readonly topClientesState: DataState<BIDashboardTopClienteItem[]> = { loading: false, error: null, data: [] };
  readonly topRutasState: DataState<BIDashboardTopRutaItem[]> = { loading: false, error: null, data: [] };
  readonly alertasState: DataState<BIDashboardAlertaItem[]> = { loading: false, error: null, data: [] };

  ngOnInit(): void {
    this.setRange(30);
    this.loadSedes();
    this.loadDashboard();
  }

  applyFilters() {
    this.loadDashboard();
  }

  clearFilters() {
    this.sedeId = null;
    this.setRange(30);
    this.loadDashboard();
  }

  setQuickRange(days: number) {
    this.setRange(days);
    this.loadDashboard();
  }

  get linePoints(): LinePoint[] {
    return (this.trendState.data || [])
      .slice()
      .sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')))
      .map((x) => ({ label: this.shortDate(x.fecha), value: Number(x.total_envios || 0) }));
  }

  get donutItems(): DonutItem[] {
    return (this.distribucionState.data || []).map((x) => ({
      label: x.sede_nombre || `Sede ${x.sede_id}`,
      value: Number(x.total_envios || 0),
    }));
  }

  get rutasFinanzasRanking(): RankingItem[] {
    const items = (this.rutasFinanzasState.data || []).slice(0, 8);
    return items.map((x) => ({
      label: x.ruta_nombre || `Ruta ${x.ruta_id || '-'}`,
      value: Number(this.rutaMode === 'costo' ? x.costo_total : x.ingreso_total || 0),
      helper: `Costo: S/ ${Number(x.costo_total || 0).toFixed(2)} · Ingreso: S/ ${Number(x.ingreso_total || 0).toFixed(2)}`,
    }));
  }

  get transporteRanking(): RankingItem[] {
    return (this.transporteState.data || []).slice(0, 8).map((x) => ({
      label: x.unidad_label || `Unidad ${x.unidad_id || '-'}`,
      value: Number(x.total_envios || 0),
      helper: x.conductor_nombre ? `Conductor: ${x.conductor_nombre}` : '',
    }));
  }

  get topClientesRanking(): RankingItem[] {
    return (this.topClientesState.data || []).slice(0, 5).map((x) => ({
      label: x.cliente_nombre || `Cliente ${x.cliente_id}`,
      value: Number(x.total_envios || 0),
      helper: `Monto: S/ ${Number(x.monto_total || 0).toFixed(2)}`,
    }));
  }

  get topRutasRanking(): RankingItem[] {
    return (this.topRutasState.data || []).slice(0, 5).map((x) => ({
      label: x.ruta_nombre || `Ruta ${x.ruta_id || '-'}`,
      value: Number(x.total_envios || 0),
      helper: `Monto: S/ ${Number(x.monto_total || 0).toFixed(2)}`,
    }));
  }

  get kpiTotalEnvios(): number { return Number((this.kpisState.data as any)?.total_envios || 0); }
  get kpiFinalizados(): number { return Number((this.kpisState.data as any)?.envios_finalizados || 0); }
  get kpiPendientes(): number { return Number((this.kpisState.data as any)?.envios_pendientes || 0); }
  get kpiIncidencia(): number { return Number((this.kpisState.data as any)?.envios_incidencia || 0); }
  get kpiCumplimiento(): number { return Number((this.kpisState.data as any)?.cumplimiento_pct || 0); }
  get kpiCosto(): number { return Number((this.kpisState.data as any)?.costo_total || 0); }
  get kpiIngreso(): number { return Number((this.kpisState.data as any)?.ingreso_total || 0); }
  get kpiTicket(): number { return Number((this.kpisState.data as any)?.ticket_promedio || 0); }

  private companyId(): number {
    return Number(this.authSrv.getCompaniaId() || 0);
  }

  private setRange(days: number) {
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

  private shortDate(value: string | null | undefined): string {
    const raw = String(value || '');
    const parts = raw.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return raw || '-';
  }

  private buildParams(): BIQueryParams {
    return {
      empresa_id: this.companyId(),
      sede_id: this.sedeId || null,
      fecha_desde: this.fechaDesde || null,
      fecha_hasta: this.fechaHasta || null,
    };
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
        this.sedesState.error = 'No se pudieron cargar sedes';
        this.sedesState.data = [];
      },
    });
  }

  private loadDashboard() {
    const empresaId = this.companyId();
    if (!empresaId) {
      this.globalError = 'No se encontró empresa_id para consultar BI.';
      return;
    }
    this.globalError = null;
    const params = this.buildParams();

    this.loadKpis(params);
    this.loadTrend(params);
    this.loadDistribucion(params);
    this.loadRutaFinanzas(params);
    this.loadTransporte(params);
    this.loadTopClientes(params);
    this.loadTopRutas(params);
    this.loadAlertas(params);
  }

  private loadKpis(params: BIQueryParams) {
    this.kpisState.loading = true;
    this.kpisState.error = null;
    this.biSrv.getDashboardKpis(params)
      .pipe(catchError(() => this.biSrv.getResumen(params).pipe(
        catchError(() => of(null as BIResumenResponse | null))
      )))
      .subscribe((res: any) => {
        this.kpisState.loading = false;
        if (!res) {
          this.kpisState.error = 'No se pudo cargar KPIs';
          this.kpisState.data = null;
          return;
        }
        this.kpisState.data = {
          empresa_id: Number(res?.empresa_id || params.empresa_id),
          sede_id: res?.sede_id ?? params.sede_id ?? null,
          fecha_desde: String(res?.fecha_desde || params.fecha_desde || ''),
          fecha_hasta: String(res?.fecha_hasta || params.fecha_hasta || ''),
          total_envios: Number(res?.total_envios || 0),
          envios_finalizados: Number(res?.envios_finalizados ?? res?.total_envios_entregados ?? 0),
          envios_pendientes: Number(res?.envios_pendientes ?? Math.max(0, Number(res?.total_envios || 0) - Number(res?.total_envios_entregados || 0))),
          envios_incidencia: Number(res?.envios_incidencia || 0),
          cumplimiento_pct: Number(res?.cumplimiento_pct ?? (Number(res?.total_envios || 0) > 0 ? (Number(res?.total_envios_entregados || 0) / Number(res?.total_envios || 1)) * 100 : 0)),
          costo_total: Number(res?.costo_total || 0),
          ingreso_total: Number(res?.ingreso_total ?? res?.ingresos_netos ?? 0),
          ticket_promedio: Number(res?.ticket_promedio ?? (Number(res?.total_envios || 0) > 0 ? Number(res?.ingreso_total ?? res?.ingresos_netos ?? 0) / Number(res?.total_envios || 1) : 0)),
        };
      });
  }

  private loadTrend(params: BIQueryParams) {
    this.trendState.loading = true;
    this.trendState.error = null;
    this.biSrv.getDashboardEnviosTrend(params)
      .pipe(catchError(() => this.biSrv.getEnviosDia(params).pipe(
        catchError(() => of([] as BIEnviosPorDiaItem[]))
      )))
      .subscribe((res: any[]) => {
        this.trendState.loading = false;
        this.trendState.data = (res || []).map((x: any) => ({
          fecha: String(x?.fecha || ''),
          total_envios: Number(x?.total_envios || 0),
        }));
        if (!this.trendState.data.length) this.trendState.error = null;
      });
  }

  private loadDistribucion(params: BIQueryParams) {
    this.distribucionState.loading = true;
    this.distribucionState.error = null;
    this.biSrv.getDashboardDistribucionSede(params)
      .pipe(catchError(() => of([] as BIDashboardDistribucionItem[])))
      .subscribe((res) => {
        this.distribucionState.loading = false;
        this.distribucionState.data = res || [];
      });
  }

  private loadRutaFinanzas(params: BIQueryParams) {
    this.rutasFinanzasState.loading = true;
    this.rutasFinanzasState.error = null;
    this.biSrv.getDashboardRutaFinanzas(params)
      .pipe(catchError(() => of([] as BIDashboardRutaFinanzasItem[])))
      .subscribe((res) => {
        this.rutasFinanzasState.loading = false;
        this.rutasFinanzasState.data = res || [];
      });
  }

  private loadTransporte(params: BIQueryParams) {
    this.transporteState.loading = true;
    this.transporteState.error = null;
    this.biSrv.getDashboardTransporteUnidad(params)
      .pipe(catchError(() => this.biSrv.getRankingConductores(params).pipe(
        catchError(() => of([] as BIConductorRankingItem[]))
      )))
      .subscribe((res: any[]) => {
        this.transporteState.loading = false;
        this.transporteState.data = (res || []).map((x: any) => ({
          unidad_id: x?.unidad_id ?? null,
          unidad_label: String(x?.unidad_label || `Conductor ${x?.conductor_id || '-'}`),
          conductor_id: x?.conductor_id ?? null,
          conductor_nombre: x?.conductor_nombre ?? null,
          total_envios: Number(x?.total_envios || 0),
        }));
      });
  }

  private loadTopClientes(params: BIQueryParams) {
    this.topClientesState.loading = true;
    this.topClientesState.error = null;
    this.biSrv.getDashboardTopClientes(params)
      .pipe(catchError(() => this.biSrv.getClientesTop(params).pipe(
        catchError(() => of([] as BIClienteTopItem[]))
      )))
      .subscribe((res: any[]) => {
        this.topClientesState.loading = false;
        this.topClientesState.data = (res || []).map((x: any) => ({
          cliente_id: Number(x?.cliente_id || 0),
          cliente_nombre: x?.cliente_nombre ?? null,
          total_envios: Number(x?.total_envios ?? x?.total_comprobantes ?? 0),
          monto_total: Number(x?.monto_total || 0),
        }));
      });
  }

  private loadTopRutas(params: BIQueryParams) {
    this.topRutasState.loading = true;
    this.topRutasState.error = null;
    this.biSrv.getDashboardTopRutas(params)
      .pipe(catchError(() => of([] as BIDashboardTopRutaItem[])))
      .subscribe((res) => {
        this.topRutasState.loading = false;
        this.topRutasState.data = res || [];
      });
  }

  private loadAlertas(params: BIQueryParams) {
    this.alertasState.loading = true;
    this.alertasState.error = null;
    this.biSrv.getDashboardAlertas(params)
      .pipe(catchError(() => of([] as BIDashboardAlertaItem[])))
      .subscribe((res) => {
        this.alertasState.loading = false;
        this.alertasState.data = res || [];
      });
  }
}
