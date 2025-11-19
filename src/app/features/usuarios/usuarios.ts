import { UiConfirmComponent } from '../../shared/ui/confirm/confirm';
import { UiAlertComponent } from '../../shared/ui/alert/alert';
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Users } from '../../../../core/services/users';
import { Personas } from '../../../../core/services/personas';
import { Usuario, Persona } from '../../../../core/mapped';

@Component({
  selector: 'feature-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, UiAlertComponent, UiConfirmComponent],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.css',
})
export class UsuariosFeature implements OnInit {
  private readonly user = inject(Users);
  private readonly personasSvc = inject(Personas);

  lista_usuarios: Usuario[] = [];
  personas: Persona[] = [];
  loading = false;
  error: string | null = null;

  // // Filtros y paginación
  search = '';
  status: 'all' | 'active' | 'inactive' = 'all';
  page = 1;
  pageSize = 8;

  // Modal y guardado
  showModal = false;
  saving = false;
  saveError: string | null = null;
  // Confirmación eliminación
  confirmOpen = false;
  confirmTitle = 'Confirmar eliminación';
  confirmMessage = '';
  pendingDeleteId: number | null = null;
  pendingDeleteLabel: string = '';
  notif: string | null = null;
  notifType: 'success' | 'error' = 'success';
  editing = false;
  editingId: number | null = null;
  newUser = { email: '', is_active: true, person_id: null, password: '' } as { email: string; is_active: boolean; person_id: number | null; password: string };

  get isValidUser(): boolean {
    const emailOk = !!(this.newUser.email || '').trim();
    if (this.editing) return emailOk;
    const passOk = (this.newUser.password || '').length >= 6;
    return emailOk && passOk;
  }

  get filteredUsuarios(): Usuario[] {
    const term = this.search.trim().toLowerCase();
    return (this.lista_usuarios || []).filter((u) => {
      const okTerm = !term || (u.email || '').toLowerCase().includes(term);
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
    this.newUser = { email: '', is_active: true, person_id: null, password: '' } as any;
    this.saveError = null;
    this.showModal = true;
  }
  closeModal() { this.showModal = false; }

  openEdit(item: Usuario) {
    this.editing = true;
    this.editingId = (item as any).id ?? null;
    this.newUser = { email: (item as any).email, is_active: (item as any).is_active, person_id: (item as any).person_id, password: '' } as any;
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
    const payload: any = {
      email: this.newUser.email,
      person_id: (this.newUser as any).person_id ?? null,
      is_active: (this.newUser as any).is_active,
    };
    if ((this.newUser.password || '').length >= 6) { payload.password = this.newUser.password; }
    this.saving = true;
    this.saveError = null;
    const obs = this.editing && this.editingId ? this.user.updateUser(this.editingId as number, payload) : this.user.createUser(payload);
    obs.subscribe({
      next: (created: any) => {
        const wasEditing = this.editing;
        const added = { email: created?.email ?? payload.email, is_active: created?.is_active ?? true, person_id: created?.person_id ?? payload.person_id } as any as Usuario;
        if (wasEditing && this.editingId) {
          this.lista_usuarios = this.lista_usuarios.map(u => (u as any).id === this.editingId ? added : u);
        } else {
          this.lista_usuarios = [added, ...this.lista_usuarios];
        }
        this.saving = false;
        this.editing = false;
        this.editingId = null;
        this.onFilterChange();
        this.closeModal();
        this.showNotif(wasEditing ? 'Usuario actualizado' : 'Usuario creado');
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
    setTimeout(() => { this.notif = null; }, 3000);
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
  }

  loadPersonas() {
    this.personasSvc.getPersonas().subscribe({
      next: (res) => { this.personas = res || []; },
      error: () => { this.personas = []; },
    });
  }
}




