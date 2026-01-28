import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { ComprobanteDetraccionRead } from '../mapped';


@Injectable({
  providedIn: 'root',
})
export class ComprobanteDetraccion {
  private readonly api = inject(ApiClientService);

  getDetracciones(): Observable<ComprobanteDetraccionRead[]> {
    return this.api.get('/envios/comp/detracciones?')
  }
}

