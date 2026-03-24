import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { UsuarioMe } from '../mapped';
import { environment } from '../../src/environments/environment.development';

export interface LoginRequest {
  username: string;
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
        username: payload.username,
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
          if (payload?.username) {
            this.storage(remember).setItem('auth_user', payload.username);
          }
        })
      );
  }

  logout(): void {
    this.clearAuthStorage(localStorage);
    this.clearAuthStorage(sessionStorage);
    localStorage.removeItem('cia_logo');
    this.router.navigateByUrl('/');
  }

  getToken(): string | null {
    const localToken = this.getValidTokenFromStorage(localStorage);
    if (localToken) return localToken;
    return this.getValidTokenFromStorage(sessionStorage);
  }

  getUserLabel(): string | null {
    const direct = localStorage.getItem('auth_user') || sessionStorage.getItem('auth_user');
    if (direct) return direct;
    const token = this.getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1] || '')) as any;
      return payload.name || payload.username || payload.sub || null;
    } catch {
      return null;
    }
  }

  getCompania(): string | null {
    const cia = localStorage.getItem('cia');
    return cia;
  }

  getCompaniaLogo(): string | null {
    let logo = (localStorage.getItem('cia_logo') || '').trim();
    if (!logo) {
      try {
        const raw = localStorage.getItem('me');
        const me = raw ? (JSON.parse(raw) as UsuarioMe) : null;
        logo = String(me?.companies?.[0]?.logo ?? '').trim();
        if (logo) {
          localStorage.setItem('cia_logo', logo);
        }
      } catch {
        logo = '';
      }
    }
    if (logo) return this.resolveLogoUrl(logo);
    return null;
  }

  private resolveLogoUrl(rawLogo: string): string {
    const value = rawLogo.trim();
    if (!value) return '';
    if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) {
      return value;
    }
    const base = (environment.apiUrl || '').replace(/\/+$/, '');
    const path = value.replace(/^\/+/, '');
    return `${base}/${path}`;
  }

  getCompaniaId(): number | null {
    const cia_id = parseInt(<string>localStorage.getItem('cia_id'));
    return cia_id;
  }

  isAuthenticated(): Observable<boolean> {
    return of(Boolean(this.getToken()));
  }

  me() {
    return this.api.get<UsuarioMe>('/auth/me')
  }

  private clearAuthStorage(storage: Storage): void {
    storage.removeItem('auth_token');
    storage.removeItem('refresh_token');
    storage.removeItem('auth_user');
  }

  private getValidTokenFromStorage(storage: Storage): string | null {
    const token = storage.getItem('auth_token');
    if (!token) return null;
    if (this.isTokenExpired(token)) {
      this.clearAuthStorage(storage);
      return null;
    }
    return token;
  }

  private isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      const payload = JSON.parse(atob(parts[1] || '')) as { exp?: number };
      if (typeof payload?.exp !== 'number') return false;
      const now = Math.floor(Date.now() / 1000);
      return now >= payload.exp;
    } catch {
      return false;
    }
  }
}
