import { CanActivateChildFn, Router } from '@angular/router';
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

export const roleAccessGuard: CanActivateChildFn = (childRoute) => {
  const router = inject(Router);
  const roles = getRoleNames();
  const isAdminZona = roles.includes('admin_zona');
  if (!isAdminZona) return true;

  const path = String(childRoute.routeConfig?.path ?? '').toLowerCase().trim();
  const allowedPaths = new Set(['gastos', 'liquidaciones', 'comprobantes']);
  if (allowedPaths.has(path)) return true;

  router.navigateByUrl('/gastos');
  return false;
};
