import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import {ManifiestoWithEnviosRead, ManifiestoArrivedUpdate, Manifiesto, EnvioTrackingPublicRead} from '../mapped';

@Injectable({
  providedIn: 'root',
})
export class Public {
  private readonly api = inject(ApiClientService);
  // endpoints públicos con autorización por token
  getManifiestosEnTransito(conductor_id: number, token: string): Observable<ManifiestoWithEnviosRead[]> {
    return this.api.get(`/public/conductores/${conductor_id}/manifiestos-en-transito?token=${token}`);
  }

  updateManiestoEstado(conductor_id: number, manifiesto_id: number, token: string, payload: ManifiestoArrivedUpdate): Observable<Manifiesto> {
    return this.api.patch(`/public/conductores/${conductor_id}/manifiestos/${manifiesto_id}/estado?token=${token}`, payload);
  }

  getEnvioTracking(ticket_numero: string, token: string): Observable<EnvioTrackingPublicRead> {
    const ticket = encodeURIComponent(String(ticket_numero || '').trim());
    const tok = encodeURIComponent(String(token || '').trim());
    return this.api.get(`/public/envios/tracking?ticket_numero=${ticket}&token=${tok}`);
  }

  getEnvioIdTracking(id_tracking: string): Observable<EnvioTrackingPublicRead> {
    return this.api.get(`/public/envios/tracking/publico/${id_tracking}`);
  }
}
