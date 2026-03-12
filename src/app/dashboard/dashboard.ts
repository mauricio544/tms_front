import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
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
} from '@ng-icons/heroicons/outline';
import { AuthService } from '../../../core/services/auth.service';

interface Item {
  key: string;
  title: string;
  description: string;
  route?: string;
  icon: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, NgIconComponent],
  providers: [
    provideIcons({
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
    }),
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private readonly auth = inject(AuthService);

  readonly isAdminSede = this.hasRole('admin_sede');
  readonly isOperario = this.hasRole('operario') && !this.isAdminSede;

  get ciaLogo(): string | null {
    return this.auth.getCompaniaLogo();
  }

  get cia(): string {
    return this.auth.getCompania() || 'Compañía';
  }

  maestros: Item[] = [
    /*{ key: 'clientes', title: 'Clientes', description: 'Alta y gestión de clientes', route: '/clientes', icon: 'heroUsers' },*/
    { key: 'vehiculos', title: 'Vehículos', description: 'Flota y documentos', route: '/vehiculos', icon: 'heroTruck' },
    { key: 'usuarios', title: 'Usuarios', description: 'Cuentas y permisos', route: '/usuarios', icon: 'heroUserCircle' },
    { key: 'personas', title: 'Personas', description: 'Contactos y referencias', route: '/personas', icon: 'heroIdentification' },
    /*{ key: 'roles', title: 'Roles', description: 'Perfiles y autorizaciones', route: '/roles', icon: 'heroShieldCheck' },*/
    { key: 'rutas', title: 'Sedes', description: 'Origen, destino y tarifas', route: '/puntos', icon: 'heroMap' },
    /*{ key: 'sedes', title: 'Sedes', description: 'Sucursales y bodegas', route: '/sedes', icon: 'heroBuildingOffice' },*/
    { key: 'conductores', title: 'Conductores', description: 'Licencias y asignacion', route: '/conductores', icon: 'heroUserCircle' },
  ];

  funcionalidades: Item[] = [
    { key: 'manifiestos', title: 'Manifiestos', description: 'Planificación de viajes', route: '/manifiestos', icon: 'heroClipboardDocumentList' },
    { key: 'envios', title: 'Envíos', description: 'Órdenes y tracking', route: '/envios', icon: 'heroCube' },
    { key: 'liquidaciones', title: 'Liquidaciones', description: 'Cierres y cobros', route: '/liquidaciones', icon: 'heroDocumentCheck' },
    { key: 'gastos', title: 'Movimientos', description: 'Ingresos / Egresos', route: '/gastos', icon: 'heroCreditCard' },
    { key: 'reportes', title: 'Reportes', description: 'KPIs y análisis', route: '/reportes', icon: 'heroChartBar' },
    { key: 'comprobantes', title: 'Comprobantes', description: 'Comprobantes Emitidos', route: '/comprobantes', icon: 'heroTicket' },
  ];

  get maestrosVisible(): Item[] {
    if (this.isOperario) {
      return this.maestros.filter((m) => m.key === 'conductores' || m.key === 'personas');
    }
    if (this.isAdminSede) {
      return this.maestros.filter((m) => m.key === 'conductores' || m.key === 'personas');
    }
    return this.maestros;
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

