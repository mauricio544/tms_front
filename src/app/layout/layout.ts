import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroSquares2x2,
  heroBars3,
  heroXMark,
  heroUsers,
  heroTruck,
  heroUserCircle,
  heroIdentification,
  heroShieldCheck,
  heroMap,
  heroBuildingOffice,
  heroClipboardDocumentList,
  heroCube,
  heroDocumentCheck,
  heroCreditCard,
  heroChartBar,
  heroHome,
  heroTicket,
  heroChevronDoubleLeft,
  heroChevronDoubleRight,
} from '@ng-icons/heroicons/outline';
import { AuthService } from '../../../core/services/auth.service';

interface Crumb { label: string; url: string; }
interface NavItem { label: string; route: string; icon: string; }

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, NgIconComponent],
  providers: [
    provideIcons({
      heroSquares2x2,
      heroBars3,
      heroXMark,
      heroUsers,
      heroTruck,
      heroUserCircle,
      heroIdentification,
      heroShieldCheck,
      heroMap,
      heroBuildingOffice,
      heroClipboardDocumentList,
      heroCube,
      heroDocumentCheck,
      heroCreditCard,
      heroChartBar,
      heroHome,
      heroTicket,
      heroChevronDoubleLeft,
      heroChevronDoubleRight
    }),
  ],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class LayoutComponent {
  private static readonly SIDEBAR_MINI_KEY = 'layout.sidebar.mini';
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  crumbs: Crumb[] = [];
  isMobileMenuOpen = false;
  isSidebarMini = false;
  readonly isAdminSede = this.hasRole('admin_sede');
  readonly isOperario = this.hasRole('operario') && !this.isAdminSede;
  readonly isAdminZona = this.hasRole('admin_zona');

  get userLabel(): string {
    return this.auth.getUserLabel() || 'Usuario';
  }

  get ciaLogo(): string | null {
    return this.auth.getCompaniaLogo();
  }

  get cia(): string {
    return this.auth.getCompania() || 'Compañía';
  }

  onLogout() {
    this.auth.logout();
  }

  get homeRoute(): string {
    if (this.isAdminZona) return '/gastos';
    return this.isOperario ? '/envios' : '/dashboard';
  }

  get maestrosVisible(): NavItem[] {
    if (this.isAdminZona) {
      return [];
    }
    if (this.isOperario) {
      return this.maestros.filter((m) => m.route === '/conductores' || m.route === '/personas');
    }
    if (this.isAdminSede) {
      return this.maestros.filter((m) => m.route === '/conductores' || m.route === '/personas');
    }
    return this.maestros;
  }
  get funcionalidadesVisible(): NavItem[] {
    if (this.isAdminZona) {
      return this.funcionalidades.filter((f) =>
        f.route === '/liquidaciones' ||
        f.route === '/gastos' ||
        f.route === '/comprobantes'
      );
    }
    if (this.isOperario) {
      return this.funcionalidades.filter((f) =>
        f.route !== '/reportes' &&
        f.route !== '/bi' &&
        f.route !== '/comprobantes' &&
        f.route !== '/gastos'
      );
    }
    return this.funcionalidades;
  }

  maestros: NavItem[] = [
    /*{ label: 'Clientes', route: '/clientes', icon: 'heroUsers' },*/
    { label: 'Vehículos', route: '/vehiculos', icon: 'heroTruck' },
    { label: 'Usuarios', route: '/usuarios', icon: 'heroUserCircle' },
    { label: 'Personas', route: '/personas', icon: 'heroIdentification' },
    /*{ label: 'Roles', route: '/roles', icon: 'heroShieldCheck' },*/ //TODO: ocualtar por el momwnto
    { label: 'Sedes', route: '/puntos', icon: 'heroMap' },
    /*{ label: 'Sedes', route: '/sedes', icon: 'heroBuildingOffice' },*/
    { label: 'Conductores', route: '/conductores', icon: 'heroUserCircle' },
  ] ;

  funcionalidades: NavItem[] = [
    { label: 'Manifiestos', route: '/manifiestos', icon: 'heroClipboardDocumentList' },
    { label: 'Envíos', route: '/envios', icon: 'heroCube' },
    { label: 'Liquidaciones', route: '/liquidaciones', icon: 'heroDocumentCheck' },
    { label: 'Movimientos', route: '/gastos', icon: 'heroCreditCard' },
    { label: 'Reportes', route: '/reportes', icon: 'heroChartBar' },
    /*{ label: 'BI Dashboard', route: '/bi', icon: 'heroChartBar' },*/
    { label: 'Comprobantes', route: '/comprobantes', icon: 'heroTicket' },
  ];

  constructor() {
    this.isSidebarMini = this.readSidebarMiniState();

    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.crumbs = this.buildBreadcrumbs(this.route.root);
        // Close mobile menu on navigation to avoid stale open drawer
        this.isMobileMenuOpen = false;
      });
  }

  private buildBreadcrumbs(route: ActivatedRoute, url: string = '', crumbs: Crumb[] = []): Crumb[] {
    const child = route.firstChild;
    if (!child) return crumbs;

    const routeURL = child.snapshot.url.map(segment => segment.path).join('/');
    if (routeURL) {
      url += "/";
    }

    const label = child.snapshot.data['breadcrumb'] as string | undefined;
    if (label) {
      crumbs.push({ label, url });
    }

    return this.buildBreadcrumbs(child, url, crumbs);
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu() {
    this.isMobileMenuOpen = false;
  }

  toggleSidebarMini() {
    this.isSidebarMini = !this.isSidebarMini;
    this.saveSidebarMiniState(this.isSidebarMini);
  }

  private readSidebarMiniState(): boolean {
    try {
      return localStorage.getItem(LayoutComponent.SIDEBAR_MINI_KEY) === '1';
    } catch {
      return false;
    }
  }

  private saveSidebarMiniState(isMini: boolean): void {
    try {
      localStorage.setItem(LayoutComponent.SIDEBAR_MINI_KEY, isMini ? '1' : '0');
    } catch {
      // Ignore storage failures (private mode, disabled storage, etc.)
    }
  }

  private hasRole(targetRole: string): boolean {
    try {
      const raw = localStorage.getItem('me');
      if (!raw) return false;
      const me = JSON.parse(raw) as any;
      const roles = Array.isArray(me?.roles) ? me.roles : [];
      return roles.some((r: any) => {
        const roleName = String(r?.name ?? r?.nombre ?? r?.rol ?? r?.role ?? r).toLowerCase().trim();
        return roleName === targetRole;
      });
    } catch {
      return false;
    }
  }
}


