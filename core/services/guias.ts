import {inject, Injectable} from '@angular/core';
import { ApiClientService } from './api-client.service';
import { DespachoRead, DespachoCreate, Guia, GuiaCreate, ItemGuia, ItemGuiaCreate, GuiaTramaFinal } from '../mapped';
import {Observable} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class Guias {
  private readonly api = inject(ApiClientService);
  // Despachos
  getDespachos(): Observable<DespachoRead> {
    return this.api.get('/guias/despachos');
  }

  getDespachoManifiesto(manifiesto_id: number): Observable<DespachoRead[]> {
    return this.api.get(`/guias/despachos/${manifiesto_id}/by_manifiesto`);
  }

  createDespacho(body: Partial<DespachoCreate>): Observable<DespachoRead> {
    return this.api.post('/guias/despachos', body);
  }

  updateDespacho(id: number, body: Partial<DespachoCreate>): Observable<DespachoRead> {
    return this.api.patch(`/guias/despachos/${id}`, body);
  }
  //Guías
  getGuias(): Observable<Guia[]> {
    return this.api.get(`/guias/guias`);
  }

  getGuiasByDespacho(despacho_id: number): Observable<Guia[]> {
    return this.api.get(`/guias/despachos/${despacho_id}/guias`);
  }

  createGuia(body: Partial<GuiaCreate>): Observable<Guia> {
    return this.api.post(`/guias/guias`, body);
  }

  updateGuia(id: number, body: Partial<GuiaCreate>): Observable<Guia> {
    return this.api.patch(`/guias/guias/${id}`, body);
  }
  //Items del despacho
  getItemsDespacho(despacho_id: number): Observable<ItemGuia[]> {
    return this.api.get(`/guias/despachos/${despacho_id}/items`);
  }

  createItemDespacho(body: Partial<ItemGuiaCreate>): Observable<ItemGuia> {
    return this.api.post('/guias/items', body);
  }

  updateItemDespacho(id: number, body: Partial<ItemGuiaCreate>): Observable<ItemGuia> {
    return this.api.patch(`/guias/items/${id}`, body);
  }

  getTramaGuia(envio_id: number): Observable<GuiaTramaFinal> {
    return this.api.get(`/guias/remision/${envio_id}/trama`);
  }
}
