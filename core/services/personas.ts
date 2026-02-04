import {inject, Injectable} from '@angular/core';
import { Persona, DatosRUC, DatosDNI } from '../mapped';
import {ApiClientService} from './api-client.service';
import {Router} from '@angular/router';
import {Observable} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class Personas {
  private readonly api = inject(ApiClientService);
  private readonly router = inject(Router);
  private readonly persona: Persona[] = [];
  private newUrl: string = "";

  getPersonas(): Observable<Persona[]> {
    return this.api.get('/personas/')
  }

  createPersona(body: Partial<Persona>): Observable<Persona> {
    return this.api.post('/personas/', body);
  }

  updatePersona(id: number, body: Partial<Persona>): Observable<Persona> {
    return this.api.patch(`/personas/${id}`, body);
  }

  deletePersona(id: number): Observable<any> {
    return this.api.delete(`/personas/${id}`);
  }

  getDatosRUC(tipoDocumento: string, nroDocumento: string): Observable<DatosRUC> {
    this.newUrl = `https://tms-resources.vercel.app/api/datos?tipoDocumento=${tipoDocumento}&nroDocumento=${nroDocumento}`
    return this.api.getService(this.newUrl);
  }

  getDatosDNI(tipoDocumento: string, nroDocumento: string): Observable<DatosDNI> {
    this.newUrl = `https://tms-resources.vercel.app/api/datos?tipoDocumento=${tipoDocumento}&nroDocumento=${nroDocumento}`
    return this.api.getService(this.newUrl);
  }
}
