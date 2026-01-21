import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { UsuarioSede } from '../mapped';

@Injectable({
  providedIn: 'root',
})
export class UserSede {
  private readonly api = inject(ApiClientService);
  private readonly usuario_sede: UsuarioSede[] = [];

  createUsuarioSede(body: UsuarioSede): Observable<UsuarioSede> {
    return this.api.post('/envios/usuarios-sede', body);
  }

  updateUsuarioSede(body: UsuarioSede): Observable<UsuarioSede> {
    return this.api.post('/envios/usuarios-sede', body);
  }
}
