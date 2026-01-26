import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { SerieComprobante as SC} from '../mapped';

@Injectable({
  providedIn: 'root',
})
export class SerieComprobante {
  private readonly api = inject(ApiClientService);

  getSeries(): Observable<SC[]> {
    return this.api.get('/envios/series-comprobante');
  }

  updateSeries(id_serie: number, body: SC): Observable<SC> {
    return this.api.patch(`/envios/series-comprobante/${id_serie}`, body);
  }
}
