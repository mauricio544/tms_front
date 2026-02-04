import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { Rol, RolPermiso } from '../mapped';

@Injectable({
  providedIn: 'root',
})
export class Roles {
  private readonly api = inject(ApiClientService);

  getRoles(): Observable<Rol[]> {
    return this.api.get('/admin/roles/');
  }

  getRolesPermisos(rol_id: number): Observable<RolPermiso[]> {
    return this.api.get(`/admin/roles/${rol_id}/permissions`);
  }
}
