import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

function getRoleNames(): string[] {
  try {
    const raw = localStorage.getItem('me');
    if (!raw) return [];
    const me = JSON.parse(raw) as any;
    const roles = Array.isArray(me?.roles) ? me.roles : [];
    return roles.map((r: any) => String(r?.name ?? r?.nombre ?? r?.rol ?? r?.role ?? r).toLowerCase().trim());
  } catch {
    return [];
  }
}

function hasRole(role: string): boolean {
  return getRoleNames().includes(role);
}

export const maestrosGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const isAdminSede = hasRole('admin_sede');
  const isOperario = hasRole('operario') && !isAdminSede;
  const path = String(route.routeConfig?.path ?? '').toLowerCase().trim();
  const maestrosPermitidos = new Set(['conductores', 'personas']);

  if (isOperario) {
    if (!maestrosPermitidos.has(path)) {
      router.navigateByUrl('/envios');
      return false;
    }
    return true;
  }

  if (isAdminSede) {
    if (!maestrosPermitidos.has(path)) {
      router.navigateByUrl('/dashboard');
      return false;
    }
  }

  return true;
};
