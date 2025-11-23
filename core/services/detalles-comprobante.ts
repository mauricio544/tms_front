import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import {DetalleComprobante, DetalleComprobanteCreate} from '../mapped';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class DetallesComprobante {
  private readonly api = inject(ApiClientService);
  private readonly router = inject(Router);
  private readonly detalle: DetalleComprobante[] = [];
  private readonly auth = inject(AuthService);

  getDetalles(id: number): Observable<DetalleComprobante[]> {
    return this.api.get(`/envios/detalles-comprobante/${id}/items`);
  }

  createDetalles( body: Partial<DetalleComprobanteCreate>): Observable<DetalleComprobante> {
    return this.api.post('/envios/detalles-comprobante', body);
  }

  updateDetalles(id: number, body: Partial<DetalleComprobante>): Observable<DetalleComprobante> {
    return this.api.patch(`/envios/detalles-comprobante/${id}`, body);
  }

  deleteDetalles(id: number): Observable<any> {
    return this.api.delete(`/envios/detalles-comprobante/${id}`);
  }
}
