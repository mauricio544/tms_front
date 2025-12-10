import { Component, inject, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiConfirmComponent } from '../../shared/ui/confirm/confirm';
import { UiAlertComponent } from '../../shared/ui/alert/alert';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroUserCircle } from '@ng-icons/heroicons/outline';
import { Personas } from '../../../../core/services/personas';
import { Persona } from '../../../../core/mapped';

@Component({
  selector: 'feature-personas',
  standalone: true,
  imports: [CommonModule, FormsModule, UiAlertComponent, UiConfirmComponent, NgIconComponent],
    templateUrl: './personas.html',
    styleUrl: './personas.css',
  
  providers: [
    provideIcons({
      heroUserCircle,
    }),
  ],
})
export class PersonasFeature implements OnInit {
  @ViewChild('docInput') docInput!: ElementRef<HTMLInputElement>;
  private readonly persona = inject(Personas);

  // Datos
  lista_personas: Persona[] = [];
  loading = false;
  error: string | null = null;

  // Filtros y paginaci�n
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
  notif: string | null = null;
  notifType: 'success' | 'error' = 'success';
  newPersona: Partial<Persona> = {
    nombre: '', apellido: '', email: '', celular: '',
    tipo_documento: 'DNI', nro_documento: '', razon_social: '', direccion: ''
  } as any;

  // Edición
  editing = false;
  editingId: number | null = null;
  private lastLookup: { tipo: string; nro: string } = { tipo: '', nro: '' };

  // Lista filtrada
  get filteredPersonas(): Persona[] {
    const term = this.search.trim().toLowerCase();
    return (this.lista_personas || []).filter((p) => {
      if (!term) return true;
      const values = [
        p.nombre || '', p.apellido || '', p.razon_social || '', p.email || '',
        p.nro_documento || '', p.tipo_documento || '', p.celular || '', p.direccion || '',
      ].join(' ').toLowerCase();
      return values.includes(term);
    });
  }

  // Derivados de paginaci�n
  get total(): number { return this.filteredPersonas.length; }
  get totalPages(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }
  get pageItems(): Persona[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredPersonas.slice(start, start + this.pageSize);
  }
  get pageStart(): number { return this.total ? (this.page - 1) * this.pageSize + 1 : 0; }
  get pageEnd(): number { return Math.min(this.page * this.pageSize, this.total); }
  setPage(n: number) { this.page = Math.min(Math.max(1, n), this.totalPages); }
  onFilterChange() { this.page = 1; }

  // Documento helpers (DNI/RUC)
  onDocNumberChange(value: string) {
    const tipo = (this.newPersona as any).tipo_documento;
    if (tipo === 'RUC') {
      const digits = (value || '').replace(/[^0-9]/g, '').slice(0, 11);
      (this.newPersona as any).nro_documento = digits;
      if (digits.length === 11 && (this.lastLookup.tipo !== 'RUC' || this.lastLookup.nro !== digits)) {
        this.lastLookup = { tipo: 'RUC', nro: digits };
        this.loadDatosRUC();
      }
    } else if (tipo === 'DNI') {
      const digits = (value || '').replace(/[^0-9]/g, '').slice(0, 12);
      (this.newPersona as any).nro_documento = digits;
      if (digits.length === 8 && (this.lastLookup.tipo !== 'DNI' || this.lastLookup.nro !== digits)) {
        this.lastLookup = { tipo: 'DNI', nro: digits };
        this.loadDatosDNI();
      }
    } else {
      (this.newPersona as any).nro_documento = value ?? '';
    }
  }

  onTipoDocumentoChange(value: string) {
    (this.newPersona as any).tipo_documento = value as any;
    const cleaned = String(((this.newPersona as any).nro_documento || '') as string).replace(/\s+/g, '');
    (this.newPersona as any).nro_documento = cleaned;
    this.lastLookup = { tipo: '', nro: '' };
    if (value === 'RUC') {
      this.onDocNumberChange(cleaned);
      setTimeout(() => { try { this.docInput?.nativeElement?.focus(); } catch {} }, 0);
    }
  }

  // Modal helpers
  openModal() {
    this.editing = false;
    this.editingId = null;
    this.newPersona = {
      nombre: '', apellido: '', email: '', celular: '',
      tipo_documento: 'DNI', nro_documento: '', razon_social: '', direccion: ''
    } as any;
    this.lastLookup = { tipo: '', nro: '' };
    this.saveError = null;
    this.showModal = true;
  }

  openEdit(item: Persona) {
    this.editing = true;
    this.editingId = (item as any).id ?? null;
    this.newPersona = {
      nombre: item.nombre,
      apellido: item.apellido,
      email: item.email,
      celular: item.celular,
      tipo_documento: (item as any).tipo_documento,
      nro_documento: (item as any).nro_documento,
      razon_social: (item as any).razon_social,
      direccion: (item as any).direccion,
    } as any;
    this.saveError = null;
    this.showModal = true;
  }

  closeModal() { this.showModal = false; }

  // Crear / Actualizar
  submitNewPersona() {
    const np = this.newPersona as any;
    if (!np) return;
    if (np.tipo_documento === 'RUC' && ((np.nro_documento || '').length < 11 || !(np.razon_social || '').trim())) return;
    const payload = {
      nombre: np.nombre || '',
      apellido: np.apellido || '',
      direccion: np.direccion || '',
      razon_social: np.razon_social || '',
      celular: np.celular || '',
      email: np.email || '',
      nro_documento: np.nro_documento || '',
      tipo_documento: np.tipo_documento || '',
    };
    this.saving = true;
    this.saveError = null;
    const obs = this.editing && this.editingId
      ? this.persona.updatePersona(this.editingId as number, payload)
      : this.persona.createPersona(payload);
    obs.subscribe({
      next: (res: any) => {
        const updated = (res || payload) as Persona;
        if (this.editing && this.editingId) {
          this.lista_personas = this.lista_personas.map(p => (p as any).id === this.editingId ? updated : p);
        } else {
          this.lista_personas = [updated, ...this.lista_personas];
        }
        const wasEditing = this.editing;
        this.saving = false;
        this.editing = false;
        this.editingId = null;
        this.onFilterChange();
        this.closeModal();
        this.showNotif(wasEditing ? 'Persona actualizada' : 'Persona creada');
      },
      error: () => {
        this.saving = false;
        this.saveError = this.editing ? 'No se pudo actualizar la persona' : 'No se pudo crear la persona';
        this.showNotif(this.saveError as string, 'error');
      },
    });
  }

  // Confirmación de eliminación
  askDelete(item: Persona) {
    this.pendingDeleteId = (item as any).id ?? null;
    const nombre = (item as any)?.nombre || (item as any)?.razon_social || (item as any)?.email || '';
    this.pendingDeleteLabel = nombre;
    this.confirmMessage = `¿Eliminar persona ${this.pendingDeleteLabel}?`;
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
    this.persona.deletePersona(id).subscribe({
      next: () => {
        this.lista_personas = this.lista_personas.filter(p => (p as any).id !== id);
        this.saving = false;
        this.onFilterChange();
        this.onCancelDelete();
        this.showNotif('Persona eliminada');
      },
      error: () => {
        this.saving = false;
        this.saveError = 'No se pudo eliminar la persona';
        this.onCancelDelete();
        this.showNotif(this.saveError as string, 'error');
      }
    });
  }

  // Enriquecimiento por API
  loadDatosRUC(){
    this.persona.getDatosRUC((this.newPersona as any).tipo_documento, (this.newPersona as any).nro_documento).subscribe({
      next: (response: any) => {
        (this.newPersona as any).razon_social = (response?.razonSocial || response?.razon_social) || (this.newPersona as any).razon_social;
        (this.newPersona as any).direccion = (response?.direccion || (this.newPersona as any).direccion);
      },
      error: (err) => { console.log(err); }
    })
  }

  loadDatosDNI(){
    this.persona.getDatosDNI((this.newPersona as any).tipo_documento, (this.newPersona as any).nro_documento).subscribe({
      next: (response: any) => {
        const nombres = (response?.nombres || response?.first_name) || '';
        const apP = (response?.apellidoPaterno || response?.first_last_name) || '';
        const apM = (response?.apellidoMaterno || response?.second_last_name) || '';
        (this.newPersona as any).nombre = nombres || (this.newPersona as any).nombre;
        (this.newPersona as any).apellido = ((apP + ' ' + apM).trim()) || (this.newPersona as any).apellido;
      },
      error: (err) => { console.log(err); }
    })
  }

  showNotif(msg: string, type: 'success' | 'error' = 'success') {
    this.notifType = type;
    this.notif = msg;
    setTimeout(() => { this.notif = null; }, 3000);
  }

  // Carga desde backend
  loadPersonas() {
    this.loading = true;
    this.error = null;
    this.persona.getPersonas().subscribe({
      next: (response) => { this.lista_personas = response || []; this.loading = false; },
      error: () => { this.loading = false; this.error = 'No se pudieron cargar las personas'; },
    });
  }

  ngOnInit() { this.loadPersonas(); }
}



