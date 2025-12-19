import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { Conductor } from '../mapped';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class Conductores {
  private readonly api = inject(ApiClientService);
  private readonly router = inject(Router);
  private readonly drivers: Conductor[] = [];
  private readonly auth = inject(AuthService);

  getConductores(): Observable<Conductor[]> {
    const cia_id = this.auth.getCompaniaId();
    return this.api.get(`/conductores/cia/${cia_id}`);
  }

  createConductores(body: {licencia: string; tipo_licencia: string; persona_id: number; compania_id: number}): Observable<Conductor> {
    body.compania_id = <number>this.auth.getCompaniaId();
    return this.api.post('/conductores', body);
  }

  updateConductores(id: number, body: {licencia: string; tipo_licencia: string; persona_id: number; compania_id: number}): Observable<Conductor> {
    body.compania_id = <number>this.auth.getCompaniaId();
    return this.api.patch(`/conductores/${id}`, body);
  }

  deleteConductores(id: number): Observable<any> {
    return this.api.delete(`/conductores/${id}`);
  }
}
