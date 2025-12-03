import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { Dashboard } from './dashboard/dashboard';
import { authGuard } from '../../core/guards/auth.guard';
import { LayoutComponent } from './layout/layout';

// Feature components
import { ClientesFeature } from './features/clientes/clientes';
import { VehiculosFeature } from './features/vehiculos/vehiculos';
import { UsuariosFeature } from './features/usuarios/usuarios';
import { PersonasFeature } from './features/personas/personas';
import { RolesFeature } from './features/roles/roles';
import { RutasFeature } from './features/rutas/rutas';
import { ManifiestosFeature } from './features/manifiestos/manifiestos';
import { Conductores } from './features/conductores/conductores';
import { EnviosFeature } from './features/envios/envios';
import { LiquidacionesFeature } from './features/liquidaciones/liquidaciones';
import { GastosFeature } from './features/gastos/gastos';

import { ComprobantesFeature } from './features/comprobantes/comprobantes-feature';
import { SedesFeature } from './features/sedes/sedes';
import { ReportesFeature } from './features/reportes/reportes';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: LoginComponent },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: Dashboard, data: { breadcrumb: 'Dashboard' } },
      { path: 'conductores', component: Conductores, data: { breadcrumb: 'Conductores' } },
      // Maestros
      { path: 'clientes', component: ClientesFeature, data: { breadcrumb: 'Clientes' } },
      { path: 'vehiculos', component: VehiculosFeature, data: { breadcrumb: 'Vehículos' } },
      { path: 'usuarios', component: UsuariosFeature, data: { breadcrumb: 'Usuarios' } },
      { path: 'personas', component: PersonasFeature, data: { breadcrumb: 'Personas' } },
      { path: 'roles', component: RolesFeature, data: { breadcrumb: 'Roles' } },
      { path: 'puntos', component: RutasFeature, data: { breadcrumb: 'Puntos' } },
      { path: 'sedes', component: SedesFeature, data: { breadcrumb: 'Sedes' } },
      // Funcionalidades
      { path: 'manifiestos', component: ManifiestosFeature, data: { breadcrumb: 'Manifiestos' } },
      { path: 'envios', component: EnviosFeature, data: { breadcrumb: 'Envíos' } },
      { path: 'envios/nuevo', component: EnviosFeature, data: { breadcrumb: 'Nuevo Envío' } },
      { path: 'envios/:id/editar', component: EnviosFeature, data: { breadcrumb: 'Editar Envío' } },
      { path: 'liquidaciones', component: LiquidacionesFeature, data: { breadcrumb: 'Liquidaciones' } },
      { path: 'gastos', component: GastosFeature, data: { breadcrumb: 'Gastos' } },
      { path: 'comprobantes', component: ComprobantesFeature, data: { breadcrumb: 'Comprobantes' } },
      { path: 'reportes', component: ReportesFeature, data: { breadcrumb: 'Reportes' } },
    ],
  },
  { path: '**', redirectTo: '' },
];
