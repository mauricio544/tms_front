import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import {
  Manifiesto,
  PublicLinkRequest,
  PublicLinkResponse,
  ManifiestoArrivedUpdate,
  ManifiestoWithEnviosRead, ManifiestoGuiasSunatResumenRead
} from '../mapped';

@Injectable({
  providedIn: 'root',
})
export class Manifiestos {
  private readonly api = inject(ApiClientService);
  private readonly router = inject(Router);
  private readonly manifiesto: Manifiesto[] = [];

  getManifiestos(): Observable<Manifiesto[]> {
    return this.api.get('/envios/manifiestos');
  }

  createManifiestos(body: { conductor_id: number; codigo_punto_origen: number; codigo_punto_destino: number; serie: string; numero: string, copiloto_id: number, turno: string; fecha_traslado: string }): Observable<Manifiesto> {
    return this.api.post('/envios/manifiestos', body);
  }

  updateManifiestos(id: number, body: { conductor_id: number; codigo_punto_origen: number; codigo_punto_destino: number; serie: string; numero: string, copiloto_id: number; turno: string; fecha_traslado: string }): Observable<Manifiesto> {
    return this.api.patch(`/envios/manifiestos/${id}`, body);
  }

  deleteManifiestos(id: number): Observable<any> {
    return this.api.delete(`/envios/manifiestos/${id}`);
  }

  getPublicLink(payload: PublicLinkRequest): Observable<PublicLinkResponse> {
    return this.api.post(`/envios/manifiestos/en-transito/public-link`, payload);
  }

  // sólo si está autenticado
  updateManifiestosEstado(id: number, body: ManifiestoArrivedUpdate): Observable<Manifiesto> {
    return this.api.patch(`/envios/manifiestos/${id}/estado`, body);
  }

  getManifiestoPunto(punto_id: number): Observable<Manifiesto[]> {
    return this.api.get(`/envios/manifiestos/por-punto?punto_id=${punto_id}`);
  }

  getLastManifiesto(): Observable<any> {
    return this.api.get('/envios/manifiestos/ultimo-id');
  }
  // para marcar la llegada de un manifiesto en tránsito
  // sólo envíos y datos de un manifiesto en específico
  getManifiestoTransito(manifiesto_id: number): Observable<ManifiestoWithEnviosRead> {
    return this.api.get(`/envios/manifiestos/${manifiesto_id}/en-transito`);
  }

  // Resumen manifiesto y generación de guías lista de emitidas y no emitidas
  getManifiestoResumenGuias(manifiesto_id: number): Observable<ManifiestoGuiasSunatResumenRead> {
    return this.api.get(`/envios/manifiestos/${manifiesto_id}/guias-sunat/resumen`)
  }
}
