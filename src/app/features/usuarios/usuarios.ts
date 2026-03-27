import { UiConfirmComponent } from '../../shared/ui/confirm/confirm';
import { UiAlertComponent } from '../../shared/ui/alert/alert';
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Users } from '../../../../core/services/users';
import { Personas } from '../../../../core/services/personas';
import { Puntos } from '../../../../core/services/puntos';
import { UserSede } from '../../../../core/services/user-sede';
import { Roles } from '../../../../core/services/roles';
import { Usuario, Persona, Puntos as Points, Rol, RolPermiso } from '../../../../core/mapped';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroUserCircle } from '@ng-icons/heroicons/outline';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'feature-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, UiAlertComponent, UiConfirmComponent, NgIconComponent],
    templateUrl: './usuarios.html',
    styleUrl: './usuarios.css',

  providers: [
    provideIcons({
      heroUserCircle,
    }),
  ],
})
export class UsuariosFeature implements OnInit {
  private readonly user = inject(Users);
  private readonly personasSvc = inject(Personas);
  private readonly puntosSvc = inject(Puntos);
  private readonly userSedeSvc = inject(UserSede);
  private readonly rolesSvc = inject(Roles);

  lista_usuarios: Usuario[] = [];
  personas: Persona[] = [];
  puntos: Points[] = [];
  roles: Array<{ info: Rol; permisos: RolPermiso[]; selected: boolean }> = [];
  rolesLoading = false;
  rolesError: string | null = null;
  pendingRoleIds: string[] = [];
  originalRoleCodes: string[] = [];
  originalPuntoId: number | null = null;
  loading = false;
  error: string | null = null;

  // // Filtros y paginaciÃ³n
  search = '';
  status: 'all' | 'active' | 'inactive' = 'all';
  page = 1;
  pageSize = 8;

  // Modal y guardado
  showModal = false;
  saving = false;
  saveError: string | null = null;
  // Confirmación eliminaciÃ³n
  confirmOpen = false;
  confirmTitle = 'Confirmar eliminación';
  confirmMessage = '';
  pendingDeleteId: number | null = null;
  pendingDeleteLabel: string = '';
  notif: string | null = null;
  notifType: 'success' | 'error' = 'success';
  editing = false;
  editingId: number | null = null;
  newUser = { email: '', is_active: true, person_id: null, punto_id: null, password: '', username: '' } as { email: string; is_active: boolean; person_id: number | null; punto_id: number | null; password: string; username: string };
  personQuery = '';
  showPersonOptions = false;

  personLabel(p: Persona): string {
    const razon = String((p as any)?.razon_social || '').trim();
    const nombre = String((p as any)?.nombre || '').trim();
    const apellido = String((p as any)?.apellido || '').trim();
    const base = razon || [nombre, apellido].filter(Boolean).join(' ');
    const doc = String((p as any)?.nro_documento || '').trim();
    return [base, doc].filter(Boolean).join(' - ').toUpperCase();
  }

  get filteredPersonas(): Persona[] {
    const q = String(this.personQuery || '').trim().toLowerCase();
    const list = this.personas || [];
    if (!q) return list.slice(0, 10);
    return list.filter((p: Persona) => this.personLabel(p).toLowerCase().includes(q)).slice(0, 10);
  }

  selectPersona(p: Persona): void {
    this.newUser.person_id = Number((p as any)?.id || 0) || null;
    this.personQuery = this.personLabel(p);
    this.showPersonOptions = false;
  }

  clearPersona(): void {
    this.newUser.person_id = null;
    this.personQuery = '';
    this.showPersonOptions = false;
  }

  private syncPersonQueryFromId(): void {
    const personId = Number((this.newUser as any)?.person_id || 0);
    if (!personId) {
      this.personQuery = '';
      return;
    }
    const found = (this.personas || []).find((p: any) => Number((p as any)?.id || 0) === personId);
    this.personQuery = found ? this.personLabel(found) : '';
  }

  get isValidUser(): boolean {
    const username = !!(this.newUser.username|| '').trim();
    if (this.editing) return username;
    const passOk = (this.newUser.password || '').length >= 6;
    const personOk = (this.newUser.person_id) !== null;
    const puntoOk = (this.newUser.punto_id) !== null;
    return username && passOk && personOk && puntoOk;
  }

  get filteredUsuarios(): Usuario[] {
    const term = this.search.trim().toLowerCase();
    return (this.lista_usuarios || []).filter((u) => {
      const okTerm = !term || String((u as any).username || '').toLowerCase().includes(term);
      const okStatus =
        this.status === 'all' ||
        (this.status === 'active' && (u as any).is_active) ||
        (this.status === 'inactive' && !(u as any).is_active);
      return okTerm && okStatus;
    });
  }

  get total(): number { return this.filteredUsuarios.length; }
  get totalPages(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }
  get pageItems(): Usuario[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredUsuarios.slice(start, start + this.pageSize);
  }
  get pageStart(): number { return this.total ? (this.page - 1) * this.pageSize + 1 : 0; }
  get pageEnd(): number { return Math.min(this.page * this.pageSize, this.total); }
  setPage(n: number) { this.page = Math.min(Math.max(1, n), this.totalPages); }
  onFilterChange() { this.page = 1; }

  openModal() {
    this.editing = false;
    this.editingId = null;
    this.newUser = { email: '', is_active: true, person_id: null, punto_id: null, password: '' , username: '' } as any;
    this.personQuery = '';
    this.showPersonOptions = false;
    this.pendingRoleIds = [];
    this.originalRoleCodes = [];
    this.originalPuntoId = null;
    this.resetRolesSelection();
    this.saveError = null;
    this.showModal = true;
  }
  closeModal() { this.showModal = false; }

  openEdit(item: Usuario) {
    console.log(item);
    this.editing = true;
    this.editingId = (item as any).id ?? null;
    const sedes = ((item as any).sedes || []) as any[];
    const puntoId = sedes.length ? Number((sedes[0] as any)?.id || 0) : null;
    this.originalPuntoId = puntoId || null;
    this.newUser = { email: (item as any).email, is_active: (item as any).is_active, person_id: (item as any).person_id, punto_id: puntoId || null, password: '', username: (item as any).username } as any;
    this.syncPersonQueryFromId();
    this.showPersonOptions = false;
    const rawRoles = ((item as any).roles || []) as any[];
    this.pendingRoleIds = rawRoles
      .map((r: any) => this.roleCodeFromAny(r))
      .filter(Boolean);
    this.originalRoleCodes = [...this.pendingRoleIds];
    this.applyRoleSelection();
    this.saveError = null;
    this.showModal = true;
  }

  askDelete(item: Usuario) {
    this.pendingDeleteId = (item as any).id ?? null;
    this.pendingDeleteLabel = (item as any).email || '';
    this.confirmMessage = `¿Eliminar usuario ${this.pendingDeleteLabel}?`;
    this.confirmOpen = true;
  }

  onCancelDelete() {
    this.confirmOpen = false;
    this.pendingDeleteId = null;
    this.pendingDeleteLabel = '';
  }

  onConfirmDelete() {
    const id = this.pendingDeleteId;
    if (!id) { this.onCancelDelete(); return; }
    this.saving = true;
    this.user.deleteUser(id).subscribe({
      next: () => {
        this.lista_usuarios = this.lista_usuarios.filter(u => (u as any).id !== id);
        this.saving = false;
        this.onFilterChange();
        this.onCancelDelete();
        this.showNotif('Usuario eliminado');
      },
      error: () => {
        this.saving = false;
        this.saveError = 'No se pudo eliminar el usuario';
        this.onCancelDelete();
        this.showNotif(this.saveError as string, 'error');
      }
    });
  }


  submitNewUser() {
    if (!this.isValidUser) return;
    const ciaId = Number(localStorage.getItem('cia_id') || 0);
    const tipoAcceso = this.hasSelectedRoles() ? 'user_write' : 'user_read';
    const selectedRoleId = this.getSelectedRoleId();
    const payload: any = {
      email: null,
      username: this.newUser.username,
      person_id: (this.newUser as any).person_id ?? null,
      is_active: (this.newUser as any).is_active,
      company_id: ciaId || null,
    };
    if (!this.editing) {
      payload.permission_type = tipoAcceso;
    }
    payload.role_id = selectedRoleId;
    if ((this.newUser.password || '').length >= 6) { payload.password = this.newUser.password; } else if (this.editing) { payload.password = null; }
    this.saving = true;
    this.saveError = null;
    const obs = this.editing && this.editingId ? this.user.updateUser(this.editingId as number, payload) : this.user.createUser(payload);
    obs.subscribe({
      next: (created: any) => {
        const wasEditing = this.editing;
        const createdId = (created?.id ?? (wasEditing ? this.editingId : null)) as number;
        const current = wasEditing && this.editingId
          ? (this.lista_usuarios || []).find(u => (u as any).id === this.editingId)
          : null;
        const currentSedes = (current as any)?.sedes || [];
        const puntoId = this.newUser.punto_id ?? null;
        const sedes = ((created as any)?.sedes && (created as any).sedes.length)
          ? (created as any).sedes
          : (puntoId ? [{ id: puntoId }] : currentSedes);
        const added = {
          id: createdId,
          email: created?.email ?? payload.email,
          is_active: created?.is_active ?? true,
          person_id: created?.person_id ?? payload.person_id,
          username: created?.username ?? payload?.username,
          sedes,
        } as any as Usuario;
        if (wasEditing && this.editingId) {
          this.lista_usuarios = this.lista_usuarios.map(u => (u as any).id === this.editingId ? added : u);
        } else {
          this.lista_usuarios = [added, ...this.lista_usuarios];
        }
        this.saving = false;
        this.editing = false;
        this.editingId = null;
        this.onFilterChange();
        const finish = () => {
          this.closeModal();
          this.showNotif(wasEditing ? 'Usuario actualizado' : 'Usuario creado');
        };
        const selectedCodes = this.getSelectedRoleCodes();
        const companyId = Number(localStorage.getItem('cia_id') || 0);
        const syncRoles = () => {
          if (!createdId || !companyId) { finish(); return; }
          const toAssign = selectedCodes.filter(c => !this.originalRoleCodes.includes(c));
          const toRemove = this.originalRoleCodes.filter(c => !selectedCodes.includes(c));
          const calls = [
            ...toAssign.map(code => this.user.assignRoles(createdId, companyId, code as any)),
            ...toRemove.map(code => this.user.deleteRoles(createdId, companyId, code as any)),
          ];
          if (!calls.length) { finish(); return; }
          forkJoin(calls).subscribe({
            next: () => finish(),
            error: () => { this.showNotif('Usuario actualizado, pero no se pudieron sincronizar roles', 'error'); finish(); },
          });
        };
        const assignRolesForCreate = () => {
          if (!createdId || !companyId || !selectedCodes.length) { finish(); return; }
          forkJoin(selectedCodes.map(code => this.user.assignRoles(createdId, companyId, code as any))).subscribe({
            next: () => finish(),
            error: () => { this.showNotif('Usuario creado, pero no se pudieron asignar roles', 'error'); finish(); },
          });
        };
        if (wasEditing) {
          const newPunto = Number(this.newUser.punto_id || 0);
          const oldPunto = Number(this.originalPuntoId || 0);
          if (createdId && newPunto && newPunto !== oldPunto) {
            this.userSedeSvc.updateUsuarioSede({ usuario_id: createdId, punto_id: newPunto }).subscribe({
              next: () => syncRoles(),
              error: () => { this.showNotif('Usuario actualizado, pero no se pudo actualizar la sede', 'error'); syncRoles(); },
            });
          } else {
            syncRoles();
          }
          return;
        }
        if (!wasEditing && createdId && this.newUser.punto_id) {
          this.userSedeSvc.createUsuarioSede({ usuario_id: createdId, punto_id: Number(this.newUser.punto_id) }).subscribe({
            next: () => assignRolesForCreate(),
            error: () => {
              this.showNotif('Usuario creado, pero no se pudo asignar el punto', 'error');
              assignRolesForCreate();
            },
          });
        } else {
          assignRolesForCreate();
        }
      },
      error: () => {
        this.saving = false;
        this.saveError = this.editing ? 'No se pudo actualizar el usuario' : 'No se pudo crear el usuario';
        this.showNotif(this.saveError as string, 'error');
      },
    });
  }

  showNotif(msg: string, type: 'success' | 'error' = 'success') {
    this.notifType = type;
    this.notif = msg;
    setTimeout(() => { this.notif = null; }, 10000);
  }

  loadUsuarios() {
    this.loading = true;
    this.error = null;
    this.user.getUsuarios().subscribe({
      next: (response) => { this.lista_usuarios = response || []; this.loading = false; },
      error: () => { this.loading = false; this.error = 'No se pudieron cargar los usuarios'; },
    });
  }

  ngOnInit(): void {
    this.loadUsuarios();
    this.loadPersonas();
    this.loadPuntos();
    this.loadRoles();
  }

  loadPersonas() {
    this.personasSvc.getPersonas().subscribe({
      next: (res) => { this.personas = res || []; this.syncPersonQueryFromId(); },
      error: () => { this.personas = []; },
    });
  }

  loadPuntos() {
    this.puntosSvc.getPuntos().subscribe({
      next: (res) => { this.puntos = res || []; },
      error: () => { this.puntos = []; },
    });
  }

  loadRoles() {
    this.rolesLoading = true;
    this.rolesError = null;
    this.rolesSvc.getRoles().subscribe({
      next: (roles) => {
        const list = roles || [];
        if (!list.length) { this.roles = []; this.rolesLoading = false; return; }
        forkJoin(list.map(r => this.rolesSvc.getRolesPermisos(r.id))).subscribe({
          next: (permisosList) => {
            this.roles = list.map((r, idx) => ({
              info: r,
              permisos: (permisosList[idx] || []),
              selected: false,
            }));
            this.applyRoleSelection();
            this.rolesLoading = false;
          },
          error: () => { this.rolesLoading = false; this.rolesError = 'No se pudieron cargar los permisos'; },
        });
      },
      error: () => { this.rolesLoading = false; this.rolesError = 'No se pudieron cargar los roles'; },
    });
  }

  resetRolesSelection() {
    this.roles = (this.roles || []).map(r => ({
      ...r,
      selected: false,
    }));
  }

  getSelectedRoleCodes(): string[] {
    return (this.roles || [])
      .filter(r => r.selected)
      .map(r => String(r.info.code || r.info.id));
  }

  applyRoleSelection() {
    if (!this.pendingRoleIds.length || !this.roles.length) return;
    const selected = String(this.pendingRoleIds[0] || '').trim().toLowerCase();
    this.roles = (this.roles || []).map(r => ({ ...r, selected: String(r.info.code || r.info.id || '').trim().toLowerCase() === selected }));
  }

  selectSingleRole(role: { info: Rol; permisos: RolPermiso[]; selected: boolean }) {
    const key = String(role.info.code || role.info.id || '').trim().toLowerCase();
    this.roles = (this.roles || []).map((r) => ({
      ...r,
      selected: String(r.info.code || r.info.id || '').trim().toLowerCase() === key,
    }));
  }

  hasSelectedRoles(): boolean {
    return (this.roles || []).some(r => r.selected);
  }

  private getSelectedRoleId(): number | null {
    const selected = (this.roles || []).find((r) => r.selected);
    const id = Number(selected?.info?.id || 0);
    return id || null;
  }

  private roleCodeFromAny(value: any): string {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
    return String(value?.code ?? value?.codigo ?? value?.name ?? value?.nombre ?? value?.id ?? '').trim();
  }

  getUserRoleName(item: any): string {
    const roles = Array.isArray(item?.roles) ? item.roles : [];
    if (!roles.length) return '-';
    const role = roles[0];
    if (typeof role === 'string' || typeof role === 'number') {
      return String(role).trim() || '-';
    }
    return String(role?.nombre ?? role?.name ?? role?.code ?? role?.codigo ?? role?.id ?? '-').trim() || '-';
  }
}
