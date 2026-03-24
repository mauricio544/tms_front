import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import {
  BIClienteTopItem,
  BIConductorRankingItem,
  BIEnviosPorDiaItem,
  BIResumenResponse,
} from '../mapped';

@Injectable({
  providedIn: 'root',
})
export class Bi {
  private readonly api = inject(ApiClientService);

  getResumen(params: BIQueryParams): Observable<BIResumenResponse> {
    return this.api.get('/bi/resumen', params);
  }

  getEnviosDia(params: BIQueryParams): Observable<BIEnviosPorDiaItem[]> {
    return this.api.get('/bi/envios/por-dia', params);
  }

  getClientesTop(params: BIQueryParams): Observable<BIClienteTopItem[]> {
    return this.api.get('/bi/clientes/top', params);
  }

  getRankingConductores(params: BIQueryParams): Observable<BIConductorRankingItem[]> {
    return this.api.get('/bi/conductores/ranking', params);
  }

  // Endpoints específicos para dashboard gerencial BI
  getDashboardKpis(params: BIQueryParams): Observable<BIDashboardKpisResponse> {
    return this.api.get('/bi/dashboard/kpis', params);
  }

  getDashboardEnviosTrend(params: BIQueryParams): Observable<BIDashboardTrendPoint[]> {
    return this.api.get('/bi/dashboard/envios-trend', params);
  }

  getDashboardDistribucionSede(params: BIQueryParams): Observable<BIDashboardDistribucionItem[]> {
    return this.api.get('/bi/dashboard/distribucion-sede', params);
  }

  getDashboardRutaFinanzas(params: BIQueryParams): Observable<BIDashboardRutaFinanzasItem[]> {
    return this.api.get('/bi/dashboard/ruta-finanzas', params);
  }

  getDashboardTransporteUnidad(params: BIQueryParams): Observable<BIDashboardTransporteItem[]> {
    return this.api.get('/bi/dashboard/transporte-unidad', params);
  }

  getDashboardTopClientes(params: BIQueryParams): Observable<BIDashboardTopClienteItem[]> {
    return this.api.get('/bi/dashboard/top-clientes', params);
  }

  getDashboardTopRutas(params: BIQueryParams): Observable<BIDashboardTopRutaItem[]> {
    return this.api.get('/bi/dashboard/top-rutas', params);
  }

  getDashboardAlertas(params: BIQueryParams): Observable<BIDashboardAlertaItem[]> {
    return this.api.get('/bi/dashboard/alertas', params);
  }
}

export interface BIQueryParams {
  empresa_id: number;
  sede_id?: number | null;
  fecha_desde?: string | null;
  fecha_hasta?: string | null;
}

export interface BIDashboardKpisResponse {
  empresa_id: number;
  sede_id?: number | null;
  fecha_desde: string;
  fecha_hasta: string;
  total_envios: number;
  envios_finalizados: number;
  envios_pendientes: number;
  envios_incidencia: number;
  cumplimiento_pct: number;
  costo_total: number;
  ingreso_total: number;
  ticket_promedio: number;
}

export interface BIDashboardTrendPoint {
  fecha: string;
  total_envios: number;
}

export interface BIDashboardDistribucionItem {
  sede_id: number;
  sede_nombre: string;
  total_envios: number;
}

export interface BIDashboardRutaFinanzasItem {
  ruta_id?: number | null;
  ruta_nombre: string;
  costo_total: number;
  ingreso_total: number;
}

export interface BIDashboardTransporteItem {
  unidad_id?: number | null;
  unidad_label: string;
  conductor_id?: number | null;
  conductor_nombre?: string | null;
  total_envios: number;
}

export interface BIDashboardTopClienteItem {
  cliente_id: number;
  cliente_nombre?: string | null;
  total_envios: number;
  monto_total: number;
}

export interface BIDashboardTopRutaItem {
  ruta_id?: number | null;
  ruta_nombre: string;
  total_envios: number;
  monto_total: number;
}

export interface BIDashboardAlertaItem {
  tipo: string;
  severidad: 'alta' | 'media' | 'baja';
  total: number;
  detalle?: string | null;
}
