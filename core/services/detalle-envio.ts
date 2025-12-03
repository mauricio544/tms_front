import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import {Detalle, DetalleEnvio as Detail, DetalleEnvioCreate} from '../mapped';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class DetalleEnvio {
  private readonly api = inject(ApiClientService);
  private readonly router = inject(Router);
  private readonly details: Detail[] = [];
  private readonly auth = inject(AuthService);

  getDetallesEnvio(envio_id: number): Observable<Detail[]> {
    return this.api.get(`/envios/lista/${envio_id}/detalle`);
  }

  createDetalleEnvio(body: DetalleEnvioCreate): Observable<Detail> {
    return this.api.post('/envios/detalle-envio/save', body);
  }
}
