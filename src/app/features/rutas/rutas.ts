import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiAlertComponent } from '../../shared/ui/alert/alert';
import { UiConfirmComponent } from '../../shared/ui/confirm/confirm';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroMapPin } from '@ng-icons/heroicons/outline';
import { Puntos } from '../../../../core/services/puntos';
import { Puntos as Points } from '../../../../core/mapped';
@Component({
  selector: 'feature-rutas',
  standalone: true,
  imports: [CommonModule, FormsModule, UiAlertComponent, UiConfirmComponent, NgIconComponent],
  templateUrl: './rutas.html',
  styleUrl: './rutas.css',
  providers: [
    provideIcons({
      heroMapPin,
    }),
  ],
})
export class RutasFeature implements OnInit {
  private readonly puntosSrv = inject(Puntos);

  lista_puntos: Points[] = [];
  loading = false;
  error: string | null = null;

  search = '';
  page = 1;
  pageSize = 8;

  showModal = false;
  saving = false;
  saveError: string | null = null;
  showErrors = false;

  confirmOpen = false;
  confirmTitle = 'Confirmar eliminación';
  confirmMessage = '';
  pendingDeleteId: number | null = null;
  pendingDeleteLabel: string = '';

  notif: string | null = null;
  notifType: 'success' | 'error' = 'success';

  editing = false;
  editingId: number | null = null;
  newPunto: Partial<Points> = { nombre: '' };

  get filteredPuntos(): Points[] {
    const term = this.search.trim().toLowerCase();
    return (this.lista_puntos || []).filter((p) => !term || (p.nombre || '').toLowerCase().includes(term));
  }

  get total(): number { return this.filteredPuntos.length; }
  get totalPages(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }
  get pageItems(): Points[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredPuntos.slice(start, start + this.pageSize);
  }
  get pageStart(): number { return this.total ? (this.page - 1) * this.pageSize + 1 : 0; }
  get pageEnd(): number { return Math.min(this.page * this.pageSize, this.total); }
  setPage(n: number) { this.page = Math.min(Math.max(1, n), this.totalPages); }
  onFilterChange() { this.page = 1; }

  openModal() {
    this.editing = false;
    this.editingId = null;
    this.newPunto = { nombre: '', direccion: '' };
    this.saveError = null;
    this.showErrors = false;
    this.showModal = true;
  }
  openEdit(item: Points) {
    this.editing = true;
    this.editingId = (item as any).id ?? null;
    this.newPunto = { nombre: item.nombre, direccion: item.direccion };
    this.saveError = null;
    this.showErrors = false;
    this.showModal = true;
  }
  closeModal() { this.showModal = false; }

  get isValidPunto(): boolean {
    const nombre = String((this.newPunto as any).nombre || '').trim();
    return nombre.length > 0;
  }

  submitPunto() {
    this.showErrors = true;
    if (!this.isValidPunto) return;
    const payload = { nombre: String((this.newPunto as any).nombre || '').trim(), direccion: String((this.newPunto as any).direccion || '').trim() };
    this.saving = true;
    this.saveError = null;
    const obs = this.editing && this.editingId
      ? this.puntosSrv.updatePuntos(this.editingId, payload)
      : this.puntosSrv.createPuntos(payload);
    obs.subscribe({
      next: (res: any) => {
        const updated: Points = {
          id: res?.id ?? (this.editingId ?? Math.max(0, ...(this.lista_puntos.map(x=>x.id).filter(Number))) + 1),
          nombre: res?.nombre ?? payload.nombre,
          direccion: res?.direccion ?? payload.direccion,
        } as any;
        if (this.editing && this.editingId) {
          this.lista_puntos = this.lista_puntos.map(p => (p as any).id === this.editingId ? updated : p);
        } else {
          this.lista_puntos = [updated, ...this.lista_puntos];
        }
        const wasEditing = this.editing;
        this.saving = false;
        this.editing = false;
        this.editingId = null;
        this.onFilterChange();
        this.closeModal();
        this.showNotif(wasEditing ? 'Punto actualizado' : 'Punto creado');
      },
      error: () => {
        this.saving = false;
        this.saveError = this.editing ? 'No se pudo actualizar' : 'No se pudo crear el punto';
        this.showNotif('No se pudo crear/actualizar el punto', 'error');
      }
    });
  }

  askDelete(item: Points) {
    this.pendingDeleteId = (item as any).id ?? null;
    this.pendingDeleteLabel = item.nombre || '';
    this.confirmMessage = `¿Eliminar punto ${this.pendingDeleteLabel}?`;
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
    this.puntosSrv.deletePuntos(id).subscribe({
      next: () => {
        this.lista_puntos = this.lista_puntos.filter(p => (p as any).id !== id);
        this.saving = false;
        this.onFilterChange();
        this.onCancelDelete();
        this.showNotif('Punto eliminado');
      },
      error: () => {
        this.saving = false;
        this.saveError = 'No se pudo eliminar el punto';
        this.onCancelDelete();
        this.showNotif('No se pudo eliminar el punto', 'error');
      }
    });
  }

  showNotif(msg: string, type: 'success' | 'error' = 'success') {
    this.notifType = type;
    this.notif = msg;
    setTimeout(() => { this.notif = null; }, 3000);
  }

  loadPuntos() {
    this.loading = true;
    this.error = null;
    this.puntosSrv.getPuntos().subscribe({
      next: (response) => { this.lista_puntos = response || []; this.loading = false; },
      error: () => { this.loading = false; this.error = 'No se pudieron cargar los puntos'; },
    });
  }

  ngOnInit(): void {
    this.loadPuntos();
  }
}






