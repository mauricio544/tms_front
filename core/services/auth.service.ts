import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { UsuarioMe } from '../mapped';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token?: string;
  token?: string;
  token_type?: string;
  refresh_token?: string;
  [key: string]: unknown;
}

export interface UserRead {
   id: number; email: string; is_active: boolean; person_id: number | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClientService);
  private readonly router = inject(Router);

  private storage(remember: boolean) {
    return remember ? localStorage : sessionStorage;
  }

  login(payload: LoginRequest, remember = true): Observable<LoginResponse> {
    return this.api
      .post<LoginResponse>('/auth/login', {
        email: payload.email,
        username: payload.email,
        password: payload.password,
      })
      .pipe(
        tap((res) => {
          const token = (res.access_token || (res as any).token) as string | undefined;
          if (token) {
            this.storage(remember).setItem('auth_token', token);
          }
          const refresh = res.refresh_token as string | undefined;
          if (refresh) {
            this.storage(remember).setItem('refresh_token', refresh);
          }
          if (payload?.email) {
            this.storage(remember).setItem('auth_user', payload.email);
          }
        })
      );
  }

  logout(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('auth_user');
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('refresh_token');
    sessionStorage.removeItem('auth_user');
    this.router.navigateByUrl('/');
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  }

  getUserLabel(): string | null {
    const direct = localStorage.getItem('auth_user') || sessionStorage.getItem('auth_user');
    if (direct) return direct;
    const token = this.getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1] || '')) as any;
      return payload.name || payload.email || payload.sub || null;
    } catch {
      return null;
    }
  }

  getCompania(): string | null {
    const cia = localStorage.getItem('cia');
    return cia;
  }

  isAuthenticated(): Observable<boolean> {
    return of(Boolean(this.getToken()));
  }

  me() {
    return this.api.get<UsuarioMe>('/auth/me')
  }
}
