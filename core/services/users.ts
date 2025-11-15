import {inject, Injectable} from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import { ApiClientService } from './api-client.service';
import {Usuario} from '../mapped';

@Injectable({
  providedIn: 'root',
})
export class Users {
  private readonly api = inject(ApiClientService);
  private readonly router = inject(Router);
  private readonly usuario: Usuario[] = [];

  getUsuarios(): Observable<Usuario[]> {
    return this.api.get('/users/');
  }
}
