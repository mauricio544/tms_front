import { Injectable, inject } from '@angular/core';
import { ApiClientService } from './api-client.service';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { Vehiculo } from '../mapped';

@Injectable({
  providedIn: 'root',
})
export class Vehiculos {
  private readonly api = inject(ApiClientService);
  private readonly router = inject(Router);
  private readonly vehiculo: Vehiculo[] = [];

  getVehiculos(): Observable<Vehiculo[]> {
    return this.api.get('/vehiculos/');
  }

  createVehiculo(body: Partial<Vehiculo>): Observable<Vehiculo> {
    return this.api.post('/vehiculos/', body);
  }

  updateVehiculo(id: number, body: Partial<Vehiculo>): Observable<Vehiculo> {
    return this.api.patch(`/vehiculos/${id}/`, body);
  }

  deleteVehiculo(id: number): Observable<any> {
    return this.api.delete(`/vehiculos/${id}/`);
  }
}
