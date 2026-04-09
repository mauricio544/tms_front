import {inject, Injectable} from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ApiClientService } from './api-client.service';
import {Observable} from 'rxjs';
import {PrintPayloadResponse} from '../mapped';

@Injectable({
  providedIn: 'root',
})
export class Printing {
  private readonly api = inject(ApiClientService);
  private readonly http = inject(HttpClient);
  private readonly previewUrl = 'http://127.0.0.1:8137/preview';
  private readonly printUrl = 'http://127.0.0.1:8137/print';

  getPayload(envio_id: number): Observable<PrintPayloadResponse> {
    return this.api.get(`/printing/documents/ticket/${envio_id}/payload`);
  }

  private localAgentHeaders(): HttpHeaders {
    return new HttpHeaders({
      'X-API-Key': 'change-me',
      'Content-Type': 'application/json',
    });
  }

  private withThermalPrinterTarget(payload: PrintPayloadResponse): PrintPayloadResponse {
    return {
      ...payload,
      printer_target: 'POS-80-Series',
    };
  }

  preview(payload: PrintPayloadResponse): Observable<any> {
    return this.http.post(this.previewUrl, this.withThermalPrinterTarget(payload), { headers: this.localAgentHeaders(), observe: 'body' as const });
  }

  print(payload: PrintPayloadResponse): Observable<any> {
    return this.http.post(this.printUrl, this.withThermalPrinterTarget(payload), { headers: this.localAgentHeaders(), observe: 'body' as const });
  }
}
