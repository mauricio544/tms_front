import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import {EnvioCreate, Envio} from '../mapped';
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
    return this.api.get('/envios');
  }

  createEnvios(body: Partial<EnvioCreate>): Observable<Envio> {
    return this.api.post('/envios', body);
  }

  updateEnvios(id:number, body: Partial<Envio>): Observable<Envio> {
    return this.api.patch(`/envios/${id}`, body);
  }

  deleteEnvios(id: number): Observable<any> {
    return this.api.delete(`/envios/${id}`);
  }
}
