import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiConfirmComponent } from '../../shared/ui/confirm/confirm';
import { UiAlertComponent } from '../../shared/ui/alert/alert';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroUserCircle } from '@ng-icons/heroicons/outline';
import { Conductores as ConductoresService } from '../../../../core/services/conductores';
import { Personas } from '../../../../core/services/personas';
import { Conductor, Persona } from '../../../../core/mapped';

@Component({
  selector: 'feature-conductores',
  standalone: true,
  imports: [CommonModule, FormsModule, UiAlertComponent, UiConfirmComponent, NgIconComponent],

    templateUrl: './conductores.html',
    styleUrl: './conductores.css',

  providers: [
    provideIcons({
      heroUserCircle,
    }),
  ],
})
export class Conductores implements OnInit {
  private readonly conductoresSvc = inject(ConductoresService);
  private readonly personasSvc = inject(Personas);

  lista_conductores: Conductor[] = [];
  personas: Persona[] = [];
  loading = false;
  error: string | null = null;

  // Filtros y paginacion
  search = '';
  page = 1;
  pageSize = 8;

  // Modal y guardado
  showModal = false;
  saving = false;
  saveError: string | null = null;
  // Confirmacion eliminacion
  confirmOpen = false;
  confirmTitle = 'Confirmar eliminacion';
  confirmMessage = '';
  pendingDeleteId: number | null = null;
  pendingDeleteLabel: string = '';
  // Notificacion
  notif: string | null = null;
  notifType: 'success' | 'error' = 'success';

  // Edicion
  editing = false;
  editingId: number | null = null;

  newConductor: Partial<Conductor> = {
    licencia: '',
    tipo_licencia: '',
    persona_id: null as any,
  } as any;

  // Lista filtrada / paginacion
  get filteredConductores(): Conductor[] {
    const term = this.search.trim().toLowerCase();
    return (this.lista_conductores || []).filter((c) => {
      if (!term) return true;
      const persona = this.personas.find(p => (p as any).id === (c as any).persona_id);
      const personaLabel = persona ? `${persona.nombre || ''} ${persona.apellido || ''} ${persona.razon_social || ''}`.trim() : '';
      const values = [
        c.licencia || '',
        c.tipo_licencia || '',
        String(c.persona_id ?? ''),
        personaLabel,
      ].join(' ').toLowerCase();
      return values.includes(term);
    });
  }

  get total(): number {
    return this.filteredConductores.length;
  }

  getNombre(p: any): string {
    return `${p.nombre ?? ''} ${p.apellido ?? ''}`.trim() || p.razon_social;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get pageItems(): Conductor[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredConductores.slice(start, start + this.pageSize);
  }

  get pageStart(): number {
    return this.total ? (this.page - 1) * this.pageSize + 1 : 0;
  }

  get pageEnd(): number {
    return Math.min(this.page * this.pageSize, this.total);
  }

  setPage(n: number) {
    this.page = Math.min(Math.max(1, n), this.totalPages);
  }

  onFilterChange() {
    this.page = 1;
  }

  // Modal helpers
  openModal() {
    this.editing = false;
    this.editingId = null;
    this.newConductor = {licencia: '', tipo_licencia: '', persona_id: null as any} as any;
    this.saveError = null;
    this.showModal = true;
  }

  openEdit(item: Conductor) {
    this.editing = true;
    this.editingId = (item as any).id ?? null;
    this.newConductor = {
      licencia: item.licencia,
      tipo_licencia: item.tipo_licencia,
      persona_id: (item as any).persona_id,
    } as any;
    this.saveError = null;
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  get isValidConductor(): boolean {
    const c = this.newConductor as any;
    return !!(c.licencia || '').trim() && !!(c.tipo_licencia || '').trim() && !!c.persona_id;
  }

  submitNewConductor() {
    if (!this.isValidConductor) return;
    const c = this.newConductor as any;
    const payload = {
      licencia: (c.licencia || '').trim(),
      tipo_licencia: (c.tipo_licencia || '').trim(),
      persona_id: Number(c.persona_id),
      compania_id: 0, // se asigna en el service
    } as any;
    this.saving = true;
    this.saveError = null;
    const obs = this.editing && this.editingId
      ? this.conductoresSvc.updateConductores(this.editingId as number, payload)
      : this.conductoresSvc.createConductores(payload);
    obs.subscribe({
      next: (res: any) => {
        const updated = {
          id: res?.id ?? (this.editingId ?? Math.max(0, ...(this.lista_conductores.map((x: any) => x.id).filter((n: any) => Number(n)))) + 1),
          licencia: res?.licencia ?? payload.licencia,
          tipo_licencia: res?.tipo_licencia ?? payload.tipo_licencia,
          persona_id: res?.persona_id ?? payload.persona_id,
          compania_id: res?.compania_id ?? payload.compania_id,
        } as Conductor;
        if (this.editing && this.editingId) {
          this.lista_conductores = this.lista_conductores.map(v => (v as any).id === this.editingId ? updated : v);
        } else {
          this.lista_conductores = [updated, ...this.lista_conductores];
        }
        const wasEditing = this.editing;
        this.saving = false;
        this.editing = false;
        this.editingId = null;
        this.onFilterChange();
        this.closeModal();
        this.showNotif(wasEditing ? 'Conductor actualizado' : 'Conductor creado');
      },
      error: () => {
        this.saving = false;
        this.saveError = this.editing ? 'No se pudo actualizar el conductor' : 'No se pudo crear el conductor';
        this.showNotif(this.saveError as string, 'error');
      },
    });
  }

  askDelete(item: Conductor) {
    this.pendingDeleteId = (item as any).id ?? null;
    const persona = this.personas.find(p => (p as any).id === (item as any).persona_id);
    const label = persona ? ((persona.nombre || persona.razon_social || '') as string) : (item.licencia || 'conductor');
    this.pendingDeleteLabel = label as string;
    this.confirmMessage = `¿Eliminar conductor ${this.pendingDeleteLabel}?`;
    this.confirmOpen = true;
  }

  onCancelDelete() {
    this.confirmOpen = false;
    this.pendingDeleteId = null;
    this.pendingDeleteLabel = '';
  }

  onConfirmDelete() {
    const id = this.pendingDeleteId;
    if (!id) {
      this.onCancelDelete();
      return;
    }
    this.saving = true;
    this.conductoresSvc.deleteConductores(id).subscribe({
      next: () => {
        this.lista_conductores = this.lista_conductores.filter((v: any) => v.id !== id);
        this.saving = false;
        this.onFilterChange();
        this.onCancelDelete();
        this.showNotif('Conductor eliminado');
      },
      error: () => {
        this.saving = false;
        this.saveError = 'No se pudo eliminar el conductor';
        this.onCancelDelete();
        this.showNotif(this.saveError as string, 'error');
      }
    })
  }

  showNotif(msg: string, type: 'success' | 'error' = 'success') {
    this.notifType = type;
    this.notif = msg;
    setTimeout(() => {
      this.notif = null;
    }, 3000);
  }

  loadConductores() {
    this.loading = true;
    this.error = null;
    this.conductoresSvc.getConductores().subscribe({
      next: (response) => {
        this.lista_conductores = response || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'No se pudieron cargar los conductores';
      },
    });
  }

  loadPersonas() {
    this.personasSvc.getPersonas().subscribe({
      next: (res) => {
        this.personas = res || [];
      },
      error: () => {
        this.personas = [];
      },
    });
  }

  ngOnInit(): void {
    this.loadConductores();
    this.loadPersonas();
  }

  personaName(id: number | null | undefined): string {
    const p = this.personas.find(pp => (pp as any).id === id);
    if (!p) return '';
    const full = `${p.nombre || ''} ${p.apellido || ''}`.trim();
    return full || p.razon_social || '';
  }
}







