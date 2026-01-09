import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { Cabecera, CabeceraCreate } from '../mapped';
import { AuthService } from './auth.service';


@Injectable({
  providedIn: 'root',
})
export class Movimientos {
  private readonly api = inject(ApiClientService);
  private readonly router = inject(Router);
  private readonly moves: Cabecera[] = [];
  private readonly auth = inject(AuthService);

  getMovimientos(): Observable<Cabecera[]> {
    return this.api.get('/envios/movimientos/cabecera');
  }

  createMovimientos(body: CabeceraCreate): Observable<Cabecera> {
    return this.api.post('/envios/movimientos/cabecera', body);
  }

  updateMovimientos(id: number, body: Cabecera): Observable<Cabecera> {
    return this.api.patch(`/envios/movimientos/cabecera/${id}`, body);
  }

  deleteMovimientos(id: number): Observable<any> {
    return this.api.delete(`/envios/movimientos/cabecera/${id}`);
  }
}
