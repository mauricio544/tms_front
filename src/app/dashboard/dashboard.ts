import { Component } from '@angular/core';
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
  maestros: Item[] = [
    { key: 'clientes', title: 'Clientes', description: 'Alta y gestión de clientes', route: '/clientes', icon: 'heroUsers' },
    { key: 'vehiculos', title: 'Vehículos', description: 'Flota y documentos', route: '/vehiculos', icon: 'heroTruck' },
    { key: 'usuarios', title: 'Usuarios', description: 'Cuentas y permisos', route: '/usuarios', icon: 'heroUserCircle' },
    { key: 'personas', title: 'Personas', description: 'Contactos y referencias', route: '/personas', icon: 'heroIdentification' },
    { key: 'roles', title: 'Roles', description: 'Perfiles y autorizaciones', route: '/roles', icon: 'heroShieldCheck' },
    { key: 'rutas', title: 'Rutas', description: 'Origen, destino y tarifas', route: '/rutas', icon: 'heroMap' },
    { key: 'sedes', title: 'Sedes', description: 'Sucursales y bodegas', route: '/sedes', icon: 'heroBuildingOffice' },
  ];

  funcionalidades: Item[] = [
    { key: 'manifiestos', title: 'Manifiestos', description: 'Planificación de viajes', route: '/manifiestos', icon: 'heroClipboardDocumentList' },
    { key: 'envios', title: 'Envíos', description: 'Órdenes y tracking', route: '/envios', icon: 'heroCube' },
    { key: 'liquidaciones', title: 'Liquidaciones', description: 'Cierres y cobros', route: '/liquidaciones', icon: 'heroDocumentCheck' },
    { key: 'gastos', title: 'Gastos', description: 'Costos operativos', route: '/gastos', icon: 'heroCreditCard' },
    { key: 'reportes', title: 'Reportes', description: 'KPIs y análisis', route: '/reportes', icon: 'heroChartBar' },
  ];
}
