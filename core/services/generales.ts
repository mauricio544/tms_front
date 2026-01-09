import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { GeneralUpdate, General } from '../mapped';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class Generales {
  private readonly api = inject(ApiClientService);
  private readonly router = inject(Router);
  private readonly general: General[] = [];
  private readonly auth = inject(AuthService);

  getGenerales(): Observable<General[]> {
    return this.api.get('/envios/catalogo/general');
  }

  updateGenerales(id: number, body: GeneralUpdate): Observable<General> {
    return this.api.patch(`/envios/catalogo/general/${id}`, body);
  }
}
