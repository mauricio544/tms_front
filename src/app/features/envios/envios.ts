import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { UiAlertComponent } from '../../shared/ui/alert/alert';
import { UiConfirmComponent } from '../../shared/ui/confirm/confirm';
import { Envios } from '../../../../core/services/envios';
import { Personas } from '../../../../core/services/personas';
import { Puntos as PuntosService } from '../../../../core/services/puntos';
import { Envio, Persona, Puntos as PuntoModel } from '../../../../core/mapped';
import { ComprobantesModalComponent } from '../comprobantes/comprobantes';

@Component({
  selector: 'feature-envios',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, UiAlertComponent, UiConfirmComponent, ComprobantesModalComponent],
  templateUrl: './envios.html',
  styleUrl: './envios.css',
})
export class EnviosFeature implements OnInit {
  private readonly enviosSrv = inject(Envios);
  private readonly personasSrv = inject(Personas);
  private readonly puntosSrv = inject(PuntosService);

  // Estado principal
  lista_envios: Envio[] = [];
  loading = false;
  error: string | null = null;

  // Filtros y paginación
  search = '';
  page = 1;
  pageSize = 8;

  // Modal nuevo/editar
  showModal = false;
  saving = false;
  saveError: string | null = null;

  // Confirmación de eliminación
  confirmOpen = false;
  confirmTitle = 'Confirmar eliminación';
  confirmMessage = '';
  pendingDeleteId: number | null = null;
  pendingDeleteLabel = '';

  // Notificaciones
  notif: string | null = null;
  notifType: 'success' | 'error' = 'success';

  // Edición
  editing = false;
  editingId: number | null = null;

  // Envío en edición/creación
  newEnvio: Partial<Envio> = {
    remitente: null as any,
    destinatario: null as any,
    estado_pago: false,
    clave_recojo: '',
    peso: null as any,
    fecha_envio: '',
    fecha_recepcion: '',
    tipo_contenido: false,
    guia: null as any,
    manifiesto: null as any,
    valida_restricciones: false,
    punto_origen_id: null as any,
    punto_destino_id: null as any,
    comprobante_id: null as any,
  } as any;

  // Personas (autocomplete remitente/destinatario)
  personas: Persona[] = [];
  personasLoading = false;
  personasError: string | null = null;
  remitenteQuery = '';
  destinatarioQuery = '';
  showRemitenteOptions = false;
  showDestinatarioOptions = false;

  // Puntos (origen/destino)
  puntos: PuntoModel[] = [];
  puntosLoading = false;
  puntosError: string | null = null;

  // Nombres de puntos
  getPuntoNombre(id: number | null | undefined): string {
    const p = (this.puntos || []).find(x => (x as any).id === Number(id));
    return p ? (p as any).nombre : (id != null ? String(id) : '-');
  }

  // Lista filtrada y paginación
  get filteredEnvios(): Envio[] {
    const term = (this.search || '').trim().toLowerCase();
    return (this.lista_envios || []).filter((e: any) => {
      if (!term) return true;
      const values = [
        String(e.remitente ?? ''),
        String(e.destinatario ?? ''),
        String(e.peso ?? ''),
        String(e.fecha_envio ?? ''),
        String(e.punto_origen_id ?? ''),
        String(e.punto_destino_id ?? ''),
        String(e.guia ?? ''),
        String(e.manifiesto ?? ''),
        String(e.clave_recojo ?? ''),
      ].join(' ').toLowerCase();
      return values.includes(term);
    });
  }
  get total(): number { return this.filteredEnvios.length; }
  get totalPages(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }
  get pageItems(): Envio[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredEnvios.slice(start, start + this.pageSize);
  }
  get pageStart(): number { return this.total ? (this.page - 1) * this.pageSize + 1 : 0; }
  get pageEnd(): number { return Math.min(this.page * this.pageSize, this.total); }
  setPage(n: number) { this.page = Math.min(Math.max(1, n), this.totalPages); }
  onFilterChange() { this.page = 1; }

  // Autocomplete personas
  get filteredRemitentes(): Persona[] {
    const q = (this.remitenteQuery || '').toLowerCase().trim();
    const list = this.personas || [];
    if (!q) return list.slice(0, 10);
    return list.filter(p => this.personaLabel(p).toLowerCase().includes(q)).slice(0, 10);
  }
  get filteredDestinatarios(): Persona[] {
    const q = (this.destinatarioQuery || '').toLowerCase().trim();
    const list = this.personas || [];
    if (!q) return list.slice(0, 10);
    return list.filter(p => this.personaLabel(p).toLowerCase().includes(q)).slice(0, 10);
  }
  personaLabel(p: Persona): string {
    const nombre = [p.nombre, p.apellido].filter(Boolean).join(' ').trim();
    const razon = (p.razon_social || '').trim();
    const base = (razon || nombre || '').trim();
    const doc = (p.nro_documento || '').trim();
    return [base, doc].filter(Boolean).join(' · ');
  }
  selectRemitente(p: Persona) {
    (this.newEnvio as any).remitente = (p as any).id;
    this.remitenteQuery = this.personaLabel(p);
    this.showRemitenteOptions = false;
  }
  selectDestinatario(p: Persona) {
    (this.newEnvio as any).destinatario = (p as any).id;
    this.destinatarioQuery = this.personaLabel(p);
    this.showDestinatarioOptions = false;
  }
  clearRemitente() { (this.newEnvio as any).remitente = null as any; this.remitenteQuery = ''; }
  clearDestinatario() { (this.newEnvio as any).destinatario = null as any; this.destinatarioQuery = ''; }

  // Comprobante modal
  showComprobanteModal = false;
  openComprobanteModal() { this.showComprobanteModal = true; }
  closeComprobanteModal() { this.showComprobanteModal = false; }
  onComprobanteSaved(id: number) {
    (this.newEnvio as any).comprobante_id = id;
    this.showComprobanteModal = false;
    this.showNotif('Comprobante generado');
  }

  // Modal helpers
  openModal() {
    this.editing = false;
    this.editingId = null;
    this.newEnvio = {
      remitente: null as any,
      destinatario: null as any,
      estado_pago: false,
      clave_recojo: '',
      peso: null as any,
      fecha_envio: '',
      fecha_recepcion: '',
      tipo_contenido: false,
      guia: null as any,
      manifiesto: null as any,
      valida_restricciones: false,
      punto_origen_id: null as any,
      punto_destino_id: null as any,
      comprobante_id: null as any,
    } as any;
    this.saveError = null;
    this.showModal = true;
    this.remitenteQuery = '';
    this.destinatarioQuery = '';
    this.showRemitenteOptions = false;
    this.showDestinatarioOptions = false;
  }

  openEdit(item: Envio) {
    this.editing = true;
    this.editingId = (item as any).id ?? null;
    this.newEnvio = {
      remitente: (item as any).remitente,
      destinatario: (item as any).destinatario,
      estado_pago: (item as any).estado_pago,
      clave_recojo: (item as any).clave_recojo,
      peso: (item as any).peso,
      fecha_envio: (item as any).fecha_envio,
      fecha_recepcion: (item as any).fecha_recepcion,
      tipo_contenido: (item as any).tipo_contenido,
      guia: (item as any).guia,
      manifiesto: (item as any).manifiesto,
      valida_restricciones: (item as any).valida_restricciones,
      punto_origen_id: (item as any).punto_origen_id,
      punto_destino_id: (item as any).punto_destino_id,
      comprobante_id: (item as any).comprobante_id,
    } as any;
    this.saveError = null;
    this.showModal = true;
    this.remitenteQuery = this.personaLabelById((item as any).remitente) || '';
    this.destinatarioQuery = this.personaLabelById((item as any).destinatario) || '';
  }
  private personaLabelById(id: number): string | null {
    const p = (this.personas || []).find(x => (x as any).id === Number(id));
    return p ? this.personaLabel(p) : null;
  }

  closeModal() { this.showModal = false; }

  get isValidEnvio(): boolean {
    const e: any = this.newEnvio;
    const okRemitente = Number(e.remitente) > 0;
    const okDestinatario = Number(e.destinatario) > 0;
    const okPeso = Number(e.peso) > 0;
    const okFecha = String(e.fecha_envio || '').trim().length > 0;
    const okOrigen = Number(e.punto_origen_id) > 0;
    const okDestino = Number(e.punto_destino_id) > 0;
    return okRemitente && okDestinatario && okPeso && okFecha && okOrigen && okDestino;
  }

  submitEnvio() {
    if (!this.isValidEnvio) return;
    const e: any = this.newEnvio;
    const payload: any = {
      remitente: Number(e.remitente),
      destinatario: Number(e.destinatario),
      estado_pago: !!e.estado_pago,
      clave_recojo: String(e.clave_recojo || '').trim(),
      peso: Number(e.peso) || 0,
      fecha_envio: String(e.fecha_envio || '').trim(),
      fecha_recepcion: String(e.fecha_recepcion || '').trim() || null,
      tipo_contenido: !!e.tipo_contenido,
      guia: e.guia != null ? Number(e.guia) : null,
      manifiesto: e.manifiesto != null ? Number(e.manifiesto) : null,
      valida_restricciones: !!e.valida_restricciones,
      punto_origen_id: Number(e.punto_origen_id),
      punto_destino_id: Number(e.punto_destino_id),
      comprobante_id: e.comprobante_id != null ? Number(e.comprobante_id) : null,
    };
    this.saving = true;
    this.saveError = null;
    const obs = this.editing && this.editingId ? this.enviosSrv.updateEnvios(this.editingId, payload) : this.enviosSrv.createEnvios(payload);
    obs.subscribe({
      next: (res: any) => {
        const updated: Envio = {
          id: res?.id ?? (this.editingId ?? Math.max(0, ...(this.lista_envios.map((x:any)=>x.id).filter(Number))) + 1),
          remitente: res?.remitente ?? payload.remitente,
          destinatario: res?.destinatario ?? payload.destinatario,
          estado_pago: res?.estado_pago ?? payload.estado_pago,
          clave_recojo: res?.clave_recojo ?? payload.clave_recojo,
          peso: res?.peso ?? payload.peso,
          fecha_envio: res?.fecha_envio ?? payload.fecha_envio,
          fecha_recepcion: res?.fecha_recepcion ?? payload.fecha_recepcion,
          tipo_contenido: res?.tipo_contenido ?? payload.tipo_contenido,
          guia: res?.guia ?? payload.guia,
          manifiesto: res?.manifiesto ?? payload.manifiesto,
          valida_restricciones: res?.valida_restricciones ?? payload.valida_restricciones,
          punto_origen_id: res?.punto_origen_id ?? payload.punto_origen_id,
          punto_destino_id: res?.punto_destino_id ?? payload.punto_destino_id,
          comprobante_id: res?.comprobante_id ?? payload.comprobante_id,
        } as Envio;
        if (this.editing && this.editingId) {
          this.lista_envios = this.lista_envios.map(v => (v as any).id === this.editingId ? updated : v);
        } else {
          this.lista_envios = [updated, ...this.lista_envios];
        }
        const wasEditing = this.editing;
        this.saving = false;
        this.editing = false;
        this.editingId = null;
        this.onFilterChange();
        this.closeModal();
        this.showNotif(wasEditing ? 'Envío actualizado' : 'Envío creado');
      },
      error: () => {
        this.saving = false;
        this.saveError = this.editing ? 'No se pudo actualizar el envío' : 'No se pudo crear el envío';
        this.showNotif(this.saveError as string, 'error');
      },
    });
  }

  askDelete(item: Envio) {
    this.pendingDeleteId = (item as any).id ?? null;
    const label = `${(item as any).guia ?? ''}`.trim() || `#${(item as any).id}`;
    this.pendingDeleteLabel = label as string;
    this.confirmMessage = `¿Eliminar envío ${this.pendingDeleteLabel}?`;
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
    this.enviosSrv.deleteEnvios(id).subscribe({
      next: () => {
        this.lista_envios = this.lista_envios.filter((v:any) => v.id !== id);
        this.saving = false;
        this.onFilterChange();
        this.onCancelDelete();
        this.showNotif('Envío eliminado');
      },
      error: () => {
        this.saving = false;
        this.saveError = 'No se pudo eliminar el envío';
        this.onCancelDelete();
        this.showNotif(this.saveError as string, 'error');
      }
    });
  }

  showNotif(msg: string, type: 'success' | 'error' = 'success') {
    this.notifType = type;
    this.notif = msg;
    setTimeout(() => { this.notif = null; }, 3000);
  }

  loadEnvios() {
    this.loading = true;
    this.error = null;
    this.enviosSrv.getEnvios().subscribe({
      next: (response) => { this.lista_envios = response || []; this.loading = false; },
      error: () => { this.loading = false; this.error = 'No se pudieron cargar los envíos'; },
    });
  }

  loadPersonas() {
    this.personasLoading = true;
    this.personasError = null;
    this.personasSrv.getPersonas().subscribe({
      next: (res: Persona[]) => { this.personas = res || []; this.personasLoading = false; },
      error: () => { this.personasLoading = false; this.personasError = 'No se pudieron cargar personas'; },
    });
  }

  loadPuntos() {
    this.puntosLoading = true;
    this.puntosError = null;
    this.puntosSrv.getPuntos().subscribe({
      next: (res) => { this.puntos = res || []; this.puntosLoading = false; },
      error: () => { this.puntosLoading = false; this.puntosError = 'No se pudieron cargar los puntos'; },
    });
  }

  ngOnInit(): void {
    this.loadEnvios();
    this.loadPersonas();
    this.loadPuntos();
  }
}

