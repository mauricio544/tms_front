import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { Usuario } from '../mapped';

@Injectable({ providedIn: 'root' })
export class Users {
  private readonly api = inject(ApiClientService);
  private readonly router = inject(Router);
  private readonly usuario: Usuario[] = [];

  getUsuarios(): Observable<Usuario[]> {
    return this.api.get('/users/');
  }

  createUser(body: { email: string; password: string; person_id: number | null }): Observable<Usuario> {
    return this.api.post('/users/', body);
  }

  updateUser(id: number, body: { email?: string; password?: string | null; person_id?: number | null; is_active?: boolean }): Observable<Usuario> {
    return this.api.patch(`/users/${id}/`, body);
  }

  deleteUser(id: number): Observable<any> {
    return this.api.delete(`/users/${id}/`);
  }
}
