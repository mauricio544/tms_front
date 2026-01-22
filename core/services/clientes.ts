import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { Cliente, ClienteCreate } from '../mapped';
import { AuthService } from './auth.service';
import {ClientesFeature} from '../../src/app/features/clientes/clientes';

@Injectable({
  providedIn: 'root',
})
export class Clientes {
  private readonly api = inject(ApiClientService);

  getClientes(): Observable<Cliente[]> {
    return this.api.get('/clientes');
  }

  createCliente(body: Partial<ClienteCreate>): Observable<Cliente> {
    return this.api.post('/clientes', body);
  }

  updateCliente(id: number, body: Partial<Cliente>): Observable<Cliente> {
    return this.api.patch(`/clientes/${id}`, body);
  }

  deleteCliente(id: number): Observable<any> {
    return this.api.delete(`/clientes/${id}`);
  }
}
