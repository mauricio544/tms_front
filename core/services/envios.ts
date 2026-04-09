import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import {
  EnvioCreate,
  Envio,
  Resumen,
  ManifiestoResumen,
  PublicLinkResponse,
  EnvioTrackingPublicLinkRequest,
  EnviosDiariosAgrupadosRead,
  EnviosDiariosResumenPorUsuarioRead,
  EnvioListRead, CompaniaConfigRead, ResumenSedeDetalleRead
} from '../mapped';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class Envios {
  private readonly api = inject(ApiClientService);
  private readonly router = inject(Router);
  private readonly senders: Envio[] = [];
  private readonly auth = inject(AuthService);

  getEnvios(): Observable<Envio[]> {
    return this.api.get('/envios/');
  }

  getEnviosDate(fecha: string): Observable<Envio[]> {
    return this.api.get(`/envios/?fecha=${fecha}`);
  }

  getEnviosExacto(ticket_numero: string): Observable<Envio[]> {
    return this.api.get(`/envios/?ticket_numero=${ticket_numero}`);
  }

  getEnviosPuntos(origen_id: number, destino_id: number): Observable<Envio[]> {
    return this.api.get(`/envios/por-origen-destino?origen_id=${origen_id}&destino_id=${destino_id}`)
  }

  getEnvio(id: number): Observable<Envio> {
    return this.api.get(`/envios/${id}`);
  }

  getEnviosManifiesto(id: number): Observable<Envio[]> {
    return this.api.get(`/envios/lista/${id}/envios`);
  }

  createEnvios(body: Partial<EnvioCreate>): Observable<Envio> {
    return this.api.post('/envios/', body);
  }

  updateEnvios(id:number, body: Partial<Envio>): Observable<Envio> {
    return this.api.patch(`/envios/${id}`, body);
  }

  deleteEnvios(id: number): Observable<any> {
    return this.api.delete(`/envios/${id}`);
  }

  getResumen(): Observable<Resumen[]> {
    return this.api.get('/envios/reporte-guias')
  }

  getResumenManifiesto(): Observable<ManifiestoResumen[]> {
    return this.api.get('/envios/reporte-manifiestos')
  }

  getPublicLink(body: EnvioTrackingPublicLinkRequest): Observable<PublicLinkResponse> {
    return this.api.post('/envios/tracking/public-link', body);
  }

  getEnviosTotales(): Observable<EnviosDiariosAgrupadosRead[]> {
    return this.api.get('/envios/reporte-envios-dia-agrupado');
  }
  // admin
  getEnviosTotalesByFecha(fecha?: string): Observable<EnviosDiariosAgrupadosRead[]> {
    const query = fecha ? `?fecha=${encodeURIComponent(fecha)}` : '';
    return this.api.get(`/envios/reporte-envios-dia-agrupado${query}`);
  }
  // admin sede
  getEnviosTotalesByFechaSede(fecha?: string, sede_id?: number): Observable<EnviosDiariosAgrupadosRead[]> {
    const query = fecha ? `&fecha=${encodeURIComponent(fecha)}` : '';
    return this.api.get(`/envios/reporte-envios-dia-agrupado/liquidaciones-por-sede?sede_id=${sede_id}${query}`);
  }
  // admin zona
  getEnviosTotalesByFechaZona(fecha?: string, zona_id?: number): Observable<EnviosDiariosAgrupadosRead[]> {
    const query = fecha ? `&fecha=${encodeURIComponent(fecha)}` : '';
    return this.api.get(`/envios/reporte-envios-dia-agrupado/por-zona?zona_id=${zona_id}${query}`);
  }

  // operario
  getEnviosTotalesByFechaUsuario(fecha?: string, usuario_id?: number): Observable<EnviosDiariosAgrupadosRead[]> {
    const query = fecha ? `&fecha=${encodeURIComponent(fecha)}` : '';
    return this.api.get(`/envios/reporte-envios-dia-agrupado/liquidaciones-por-usuario?usuario_id=${usuario_id}${query}`);
  }

  getEnviosResumen(): Observable<EnviosDiariosResumenPorUsuarioRead[]> {
    return this.api.get('/envios/reporte-envios-dia-resumen');
  }

  // admin
  getEnviosResumenByFecha(fecha?: string): Observable<EnviosDiariosResumenPorUsuarioRead[]> {
    const query = fecha ? `?fecha=${encodeURIComponent(fecha)}` : '';
    return this.api.get(`/envios/reporte-envios-dia-resumen${query}`);
  }

  // admin sede
  getEnviosResumenByFechaSede(fecha?: string, sede_id?: number): Observable<EnviosDiariosResumenPorUsuarioRead[]> {
    const query = fecha ? `&fecha=${encodeURIComponent(fecha)}` : '';
    return this.api.get(`/envios/reporte-envios-dia-resumen/liquidaciones-por-sede?sede_id=${sede_id}${query}`);
  }
  // admin_zona
  getEnviosResumenByFechaZona(fecha?: string, zona_id?: number): Observable<EnviosDiariosResumenPorUsuarioRead[]> {
    const query = fecha ? `&fecha=${encodeURIComponent(fecha)}` : '';
    return this.api.get(`/envios/reporte-envios-dia-resumen/por-zona?zona_id=${zona_id}${query}`);
  }

  // operario
  getEnviosResumenByFechaUsuario(fecha?: string, usuario_id?: number): Observable<EnviosDiariosResumenPorUsuarioRead[]> {
    const query = fecha ? `&fecha=${encodeURIComponent(fecha)}` : '';
    return this.api.get(`/envios/reporte-envios-dia-resumen/liquidaciones-por-usuario?usuario_id=${usuario_id}${query}`);
  }

  getEnviosSede(punto_id: number): Observable<Envio[]> {
    return this.api.get(`/envios/por-punto?punto_id=${punto_id}`);
  }

  getEnviosSedeDate(punto_id: number, fecha: string): Observable<Envio[]> {
    return this.api.get(`/envios/por-punto?punto_id=${punto_id}&fecha=${fecha}`);
  }

  getCondicionesCia(compania_id: number): Observable<CompaniaConfigRead> {
    return this.api.get(`/envios/compania-config/${compania_id}`);
  }

  //envios con pago destino
  getEnviosPagosDestino(fecha_inicio: string, fecha_fin: string): Observable<Envio[]> {
    return this.api.get(`/envios/pago-destino/rango?fecha_inicio=${fecha_inicio}&fecha_fin=${fecha_fin}`);
  }

  //totales resumen agrupado por sede
  getTotalesGenerales(fecha: string): Observable<ResumenSedeDetalleRead> {
    return this.api.get(`/envios/reporte-envios-dia-resumen/detalle-por-sede?fecha=${fecha}`);
  }
  // totales resumen agrupado por zona
  getTotalesGeneralesByFechaZona(fecha?: string, zona_id?: number): Observable<ResumenSedeDetalleRead> {
    const query = fecha ? `&fecha=${encodeURIComponent(fecha)}` : '';
    return this.api.get(`/envios/reporte-envios-dia-resumen/detalle-por-zona?zona_id=${zona_id}${query}`);
  }
}
