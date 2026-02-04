import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { Manifiesto, PublicLinkRequest, PublicLinkResponse, ManifiestoArrivedUpdate } from '../mapped';

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
}
