import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiAlertComponent } from '../../shared/ui/alert/alert';
import { UiConfirmComponent } from '../../shared/ui/confirm/confirm';
import { Manifiestos } from '../../../../core/services/manifiestos';
import { Manifiesto } from '../../../../core/mapped';

import { Puntos } from '../../../../core/services/puntos';
import { Puntos as Points } from '../../../../core/mapped';
export type FormManifiesto = { conductor_id: number | null; codigo_punto_origen: number | null; codigo_punto_destino: number | null; serie: string; numero: string; };

@Component({
  selector: 'feature-manifiestos',
  standalone: true,
  imports: [CommonModule, FormsModule, UiAlertComponent, UiConfirmComponent],
  templateUrl: './manifiestos.html',
  styleUrl: './manifiestos.css',
})
export class ManifiestosFeature implements OnInit {
  private readonly manifiestosSrv = inject(Manifiestos);
  private readonly puntosSrv = inject(Puntos);

  // Datos
  lista_manifiestos: Manifiesto[] = [];
  loading = false;
  error: string | null = null;

  // Filtros y paginación
  search = '';
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

  // Notif
  notif: string | null = null;
  notifType: 'success' | 'error' = 'success';

  // Puntos
  puntos: Points[] = [];

  // Edición
  editing = false;
  editingId: number | null = null;
  newManifiesto: FormManifiesto = { conductor_id: null, codigo_punto_origen: null, codigo_punto_destino: null, serie: '', numero: '' };

  // Lista filtrada
  get filteredManifiestos(): Manifiesto[] {
    const term = this.search.trim().toLowerCase();
    return (this.lista_manifiestos || []).filter((m: any) => {
      if (!term) return true;
      const values = [
        String(m.conductor_id ?? ''),
        String(m.codigo_punto_origen ?? m.codigo_ounto_origen ?? ''),
        String(m.codigo_punto_destino ?? ''),
        String(m.serie ?? ''),
        String(m.numero ?? ''),
      ].join(' ').toLowerCase();
      return values.includes(term);
    });
  }

  // Paginación derivada
  get total(): number { return this.filteredManifiestos.length; }
  get totalPages(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }
  get pageItems(): Manifiesto[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredManifiestos.slice(start, start + this.pageSize);
  }
  get pageStart(): number { return this.total ? (this.page - 1) * this.pageSize + 1 : 0; }
  get pageEnd(): number { return Math.min(this.page * this.pageSize, this.total); }
  setPage(n: number) { this.page = Math.min(Math.max(1, n), this.totalPages); }
  onFilterChange() { this.page = 1; }

  // Modal helpers
  openModal() {
    this.editing = false;
    this.editingId = null;
    this.newManifiesto = { conductor_id: null, codigo_punto_origen: null, codigo_punto_destino: null, serie: '', numero: '' };
    this.saveError = null;
    this.showModal = true;
  }
  openEdit(item: Manifiesto) {
    this.editing = true;
    this.editingId = (item as any).id ?? null;
    this.newManifiesto = {
      conductor_id: (item as any).conductor_id ?? null,
      codigo_punto_origen: (item as any).codigo_punto_origen ?? (item as any).codigo_ounto_origen ?? null,
      codigo_punto_destino: (item as any).codigo_punto_destino ?? null,
      serie: (item as any).serie ?? '',
      numero: (item as any).numero ?? '',
    };
    this.saveError = null;
    this.showModal = true;
  }
  closeModal() { this.showModal = false; }

  get isValidManifiesto(): boolean {
    const m = this.newManifiesto;
    const okConductor = Number(m.conductor_id) > 0;
    const okOrigen = Number(m.codigo_punto_origen) > 0;
    const okDestino = Number(m.codigo_punto_destino) > 0;
    const okSerie = String(m.serie || '').trim().length > 0;
    const okNumero = String(m.numero || '').trim().length > 0;
    return okConductor && okOrigen && okDestino && okSerie && okNumero;
  }

  submitManifiesto() {
    if (!this.isValidManifiesto) return;
    const m = this.newManifiesto;
    const payload = {
      conductor_id: Number(m.conductor_id),
      codigo_punto_origen: Number(m.codigo_punto_origen),
      codigo_punto_destino: Number(m.codigo_punto_destino),
      serie: String(m.serie || '').trim(),
      numero: String(m.numero || '').trim(),
    };
    this.saving = true;
    this.saveError = null;
    const obs = this.editing && this.editingId
      ? this.manifiestosSrv.updateManifiestos(this.editingId, payload)
      : this.manifiestosSrv.createManifiestos(payload);
    obs.subscribe({
      next: (res: any) => {
        const updated: any = {
          id: res?.id ?? (this.editingId ?? Math.max(0, ...(this.lista_manifiestos.map((x:any)=>x.id).filter(Number))) + 1),
          conductor_id: res?.conductor_id ?? payload.conductor_id,
          codigo_ounto_origen: res?.codigo_punto_origen ?? payload.codigo_punto_origen, // compat con mapped
          codigo_punto_destino: res?.codigo_punto_destino ?? payload.codigo_punto_destino,
          serie: res?.serie ?? payload.serie,
          numero: res?.numero ?? payload.numero,
        };
        if (this.editing && this.editingId) {
          this.lista_manifiestos = this.lista_manifiestos.map((mm:any) => mm.id === this.editingId ? updated : mm);
        } else {
          this.lista_manifiestos = [updated, ...this.lista_manifiestos];
        }
        const wasEditing = this.editing;
        this.saving = false;
        this.editing = false;
        this.editingId = null;
        this.onFilterChange();
        this.closeModal();
        this.showNotif(wasEditing ? 'Manifiesto actualizado' : 'Manifiesto creado');
      },
      error: () => {
        this.saving = false;
        this.saveError = this.editing ? 'No se pudo actualizar' : 'No se pudo crear el manifiesto';
        this.showNotif('No se pudo crear/actualizar el manifiesto', 'error');
      }
    });
  }

  askDelete(item: Manifiesto) {
    this.pendingDeleteId = (item as any).id ?? null;
    this.pendingDeleteLabel = `${(item as any).serie || ''}-${(item as any).numero || ''}`;
    this.confirmMessage = `¿Eliminar manifiesto ${this.pendingDeleteLabel}?`;
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
    this.manifiestosSrv.deleteManifiestos(id).subscribe({
      next: () => {
        this.lista_manifiestos = this.lista_manifiestos.filter((mm:any) => mm.id !== id);
        this.saving = false;
        this.onFilterChange();
        this.onCancelDelete();
        this.showNotif('Manifiesto eliminado');
      },
      error: () => {
        this.saving = false;
        this.saveError = 'No se pudo eliminar el manifiesto';
        this.onCancelDelete();
        this.showNotif('No se pudo eliminar el manifiesto', 'error');
      }
    });
  }

  showNotif(msg: string, type: 'success' | 'error' = 'success') {
    this.notifType = type;
    this.notif = msg;
    setTimeout(() => { this.notif = null; }, 3000);
  }

  loadManifiestos() {
    this.loading = true;
    this.error = null;
    this.manifiestosSrv.getManifiestos().subscribe({
      next: (response) => { this.lista_manifiestos = (response as any) || []; this.loading = false; },
      error: () => { this.loading = false; this.error = 'No se pudieron cargar los manifiestos'; },
    });
  }

  safeOrigen(item: any): number | null {
    return (item?.codigo_punto_origen ?? item?.codigo_ounto_origen) ?? null;
  }
  safeDestino(item: any): number | null {
    return item?.codigo_punto_destino ?? null;
  }

  loadPuntos() {
    this.puntosSrv.getPuntos().subscribe({
      next: (res: Points[]) => { this.puntos = res || []; },
      error: () => { /* noop */ },
    });
  }

  nameFrom(id: number | null): string {
    if (!id) return '';
    const f = (this.puntos || []).find((p:any) => p.id === id);
    return (f as any)?.nombre || String(id);
  }

  ngOnInit(): void {
    this.loadManifiestos();
    this.loadPuntos();
  }
}


