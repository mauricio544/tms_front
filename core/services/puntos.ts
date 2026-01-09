import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import {Puntos as Points} from '../mapped';

@Injectable({
  providedIn: 'root',
})
export class Puntos {
  private readonly api = inject(ApiClientService);
  private readonly router = inject(Router);
  private readonly puntos: Points[] = [];

  getPuntos(): Observable<Points[]> {
    return this.api.get('/envios/puntos');
  }

  createPuntos(body: {nombre: string}): Observable<Points> {
    return this.api.post('/envios/puntos', body);
  }

  updatePuntos(id: number, body: {nombre?: string}): Observable<Points> {
    return this.api.patch(`/envios/puntos/${id}`, body);
  }

  deletePuntos(id:number): Observable<any> {
    return this.api.delete(`/envios/puntos/${id}`);
  }
}
