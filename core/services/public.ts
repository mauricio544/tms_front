import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { ManifiestoWithEnviosRead, ManifiestoArrivedUpdate, Manifiesto } from '../mapped';

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
}
