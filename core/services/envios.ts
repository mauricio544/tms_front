import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { EnvioCreate, Envio, Resumen, ManifiestoResumen } from '../mapped';
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
}
