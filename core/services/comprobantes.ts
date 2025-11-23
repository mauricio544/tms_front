import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import {Comprobante, ComprobanteCreate} from '../mapped';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class Comprobantes {
  private readonly api = inject(ApiClientService);
  private readonly router = inject(Router);
  private readonly recibo: Comprobante[] = [];
  private readonly auth = inject(AuthService);

  getComprobantes(): Observable<Comprobante[]> {
    return this.api.get('/envios/comprobantes');
  }

  createComprobantes(body: Partial<ComprobanteCreate>): Observable<Comprobante> {
    return this.api.post('/envios/comprobantes', body);
  }

  updateComprobantes(id: number, body: Partial<Comprobante>): Observable<Comprobante> {
    return this.api.patch(`/envios/comprobantes/${id}`, body);
  }

  deleteComprobantes(id: number): Observable<any> {
    return this.api.delete(`/envios/comprobantes/${id}`);
  }
}
