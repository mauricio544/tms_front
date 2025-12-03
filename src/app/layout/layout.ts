import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroSquares2x2,
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
      heroTicket
    }),
  ],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class LayoutComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  crumbs: Crumb[] = [];

  get userLabel(): string {
    return this.auth.getUserLabel() || 'Usuario';
  }

  get cia(): string {
    return this.auth.getCompania() || 'Compa��a';
  }

  onLogout() {
    this.auth.logout();
  }

  maestros: NavItem[] = [
    { label: 'Clientes', route: '/clientes', icon: 'heroUsers' },
    { label: 'Vehículos', route: '/vehiculos', icon: 'heroTruck' },
    { label: 'Usuarios', route: '/usuarios', icon: 'heroUserCircle' },
    { label: 'Personas', route: '/personas', icon: 'heroIdentification' },
    { label: 'Roles', route: '/roles', icon: 'heroShieldCheck' },
    { label: 'Puntos', route: '/puntos', icon: 'heroMap' },
    { label: 'Sedes', route: '/sedes', icon: 'heroBuildingOffice' },
    { label: 'Conductores', route: '/conductores', icon: 'heroUserCircle' },
  ] ;

  funcionalidades: NavItem[] = [
    { label: 'Manifiestos', route: '/manifiestos', icon: 'heroClipboardDocumentList' },
    { label: 'Envíos', route: '/envios', icon: 'heroCube' },
    { label: 'Liquidaciones', route: '/liquidaciones', icon: 'heroDocumentCheck' },
    { label: 'Movimientos', route: '/gastos', icon: 'heroCreditCard' },
    { label: 'Reportes', route: '/reportes', icon: 'heroChartBar' },
    { label: 'Comprobantes', route: '/comprobantes', icon: 'heroTicket' },
  ];

  constructor() {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.crumbs = this.buildBreadcrumbs(this.route.root);
      });
  }

  private buildBreadcrumbs(route: ActivatedRoute, url: string = '', crumbs: Crumb[] = []): Crumb[] {
    const child = route.firstChild;
    if (!child) return crumbs;

    const routeURL = child.snapshot.url.map(segment => segment.path).join('/');
    if (routeURL) {
      url += `/${routeURL}`;
    }

    const label = child.snapshot.data['breadcrumb'] as string | undefined;
    if (label) {
      crumbs.push({ label, url });
    }

    return this.buildBreadcrumbs(child, url, crumbs);
  }
}



