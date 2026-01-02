import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { Detalle, DetalleCreate, DetalleFull } from '../mapped';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class DetalleMovimientos {
  private readonly api = inject(ApiClientService);
  private readonly router = inject(Router);
  private readonly details: Detalle[] = [];
  private readonly auth = inject(AuthService);

  getDetalles(cabecera_id: number): Observable<Detalle[]> {
    return this.api.get(`/envios/movimientos/detalle/${cabecera_id}/list`);
  }

  getDetallesList(): Observable<Detalle[]> {
    return this.api.get('/envios/movimientos/detalle');
  }

  getDetallesListFull(): Observable<DetalleFull[]> {
    return this.api.get('/envios/movimientos/detalle/full');
  }

  getDetallesByFecha(fecha: string): Observable<DetalleFull[]> {
    return this.api.get(`/envios/movimientos/detalle/full/by-date?${fecha}`);
  }

  createDetalles(body: DetalleCreate): Observable<Detalle> {
    return this.api.post('/envios/movimientos/detalle', body);
  }

  updateDetalles(id: number, body: Detalle): Observable<Detalle> {
    return this.api.patch(`/envios/movimientos/detalle/${id}`, body);
  }

  deleteDetalles(id: number): Observable<any> {
    return this.api.delete(`/envios/movimientos/detalle/${id}`);
  }
}
