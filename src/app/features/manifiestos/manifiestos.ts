import { Component, OnInit, inject } from '@angular/core';
import jsPDF from 'jspdf';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiAlertComponent } from '../../shared/ui/alert/alert';
import { UiConfirmComponent } from '../../shared/ui/confirm/confirm';
import { Manifiestos } from '../../../../core/services/manifiestos';
import { Envios } from '../../../../core/services/envios';
import { Puntos } from '../../../../core/services/puntos';
import { Conductores as ConductoresService } from '../../../../core/services/conductores';
import { Manifiesto, Envio, Puntos as Points, Persona, DetalleComprobante, DespachoRead, Guia, ItemGuia, ItemGuiaCreate } from '../../../../core/mapped';
import { Conductor } from '../../../../core/mapped';
import { Personas } from '../../../../core/services/personas';
import { DetallesComprobante } from '../../../../core/services/detalles-comprobante';
import { DetalleEnvio } from '../../../../core/services/detalle-envio';
import { forkJoin, of } from 'rxjs';
import { RouterLink } from '@angular/router';
import { Utilitarios } from '../../../../core/services/utilitarios';
import { Guias } from '../../../../core/services/guias';
import { AuthService } from '../../../../core/services/auth.service';
import {Utils} from '../../../../core/services/utils';

export type FormManifiesto = { conductor_id: number | null; codigo_punto_origen: number | null; codigo_punto_destino: number | null; serie: string; numero: string; copiloto_id: number | null, turno: string | null, placa: string | null, fecha_traslado: string | null };

@Component({
  selector: 'feature-manifiestos',
  standalone: true,
  imports: [CommonModule, FormsModule, UiAlertComponent, UiConfirmComponent, RouterLink, Utils],
  templateUrl: './manifiestos.html',
  styleUrl: './manifiestos.css',
})
export class ManifiestosFeature implements OnInit {
  private readonly manifiestosSrv = inject(Manifiestos);
  private readonly puntosSrv = inject(Puntos);
  private readonly conductoresSrv = inject(ConductoresService);
  private readonly enviosSrv = inject(Envios);
  private readonly personasSrv = inject(Personas);
  private readonly detCompSrv = inject(DetallesComprobante);
  private readonly detEnvSrv = inject(DetalleEnvio);
  private readonly utilSrv = inject(Utilitarios);
  private readonly guiasSrv = inject(Guias);
  private readonly authSrv = inject(AuthService);

  // Datos
  lista_manifiestos: Manifiesto[] = [];
  loading = false;
  error: string | null = null;

  // Filtros y paginaciï¿½n
  search = '';
  page = 1;
  pageSize = 8;

  // Filtros adicionales
  filterOrigenId: number | null = null;
  filterDestinoId: number | null = null;

  // Vista: 'cards' o 'grid'
  viewMode: 'cards' | 'grid' = 'cards';

  // Modal y guardado
  showModal = false;
  saving = false;
  saveError: string | null = null;

  // ConfirmaciÃ³n eliminacion
  confirmOpen = false;
  confirmTitle = 'Confirmar eliminaciÃ³n';
  confirmMessage = '';
  pendingDeleteId: number | null = null;
  pendingDeleteLabel: string = '';

  // Notificaciones
  notif: string | null = null;
  notifType: 'success' | 'error' = 'success';

  // Puntos y conductores
  puntos: Points[] = [];
  conductores: Conductor[] = [];
  personas: Persona[] = [];

  // EdiciÃ³n
  editing = false;
  editingId: number | null = null;

  // Ver envï¿½os por manifiesto
  showEnviosModal = false;
  enviosLoading = false;
  enviosError: string | null = null;
  enviosLista: Envio[] = [];
  enviosManifiestoId: number | null = null;
  enviosConductorId: number | null = null;
  enviosOrigenId: number | null = null;
  enviosDestinoId: number | null = null;

  // Aï¿½adir envï¿½os a manifiesto
  showAddEnviosModal = false;
  addEnviosLoading = false;
  addEnviosError: string | null = null;
  addEnviosLista: Envio[] = [];
  addManifiestoId: number | null = null;
  addConductorId: number | null = null;
  addOrigenId: number | null = null;
  addDestinoId: number | null = null;
  addSearch = '';
  get filteredAddEnvios(): Envio[] {
    const term = (this.addSearch || '').trim().toLowerCase();
    const list = (this.addEnviosLista || []).slice();
    if (!term) return list;
    return list.filter((e: any) => {
      const txt = [e?.id, e?.guia, e?.remitente, e?.destinatario, e?.peso, e?.fecha_envio]
        .map(x => String(x ?? '')).join(' ').toLowerCase();
      return txt.includes(term);
    });
  }

  // Lista filtrada
  get filteredManifiestos(): Manifiesto[] {
    const term = this.search.trim().toLowerCase();
    return (this.lista_manifiestos || []).filter((m: any) => {     const values = [
        String(m.conductor_id ?? ''),
        String(m.codigo_punto_origen ?? ''),
        String(m.codigo_punto_destino ?? ''),
        String(m.serie ?? ''),
        String(m.numero ?? ''),
      ].join(' ').toLowerCase();
      const okTerm = !term || values.includes(term);
      const okOrigen = !this.filterOrigenId || Number(m.codigo_punto_origen) === Number(this.filterOrigenId);
      const okDestino = !this.filterDestinoId || Number(m.codigo_punto_destino) === Number(this.filterDestinoId);
      return okTerm && okOrigen && okDestino;
    });
  }

  // Paginaciòn derivada
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

  newManifiesto: FormManifiesto = { conductor_id: null, codigo_punto_origen: null, codigo_punto_destino: null, serie: '', numero: '' , copiloto_id: null, turno: '', placa: '', fecha_traslado: '' };

  // Modal helpers
  openModal() {
    this.editing = false;
    this.editingId = null;
    this.newManifiesto = { conductor_id: null, codigo_punto_origen: null, codigo_punto_destino: null, serie: '', numero: '' , copiloto_id: null, turno: '', placa: '', fecha_traslado: this.utilSrv.formatFecha(new Date() || "") };
    this.saveError = null;
    this.showModal = true;
  }
  openEdit(item: Manifiesto) {
    this.editing = true;
    this.editingId = (item as any).id ?? null;
    this.newManifiesto = {
      conductor_id: (item as any).conductor_id ?? null,
      copiloto_id: (item as any)?.copiloto_id ?? null,
      turno: (item as any)?.turno ?? '',
      placa: (item as any)?.placa ?? '',
      fecha_traslado: this.utilSrv.formatFecha((item as any)?.fecha_traslado) ?? '',
      codigo_punto_origen: (item as any).codigo_punto_origen ?? null,
      codigo_punto_destino: (item as any).codigo_punto_destino ?? null,
      serie: (item as any).serie ?? '',
      numero: (item as any).numero ?? '',
    };
    console.log(this.newManifiesto);
    this.saveError = null;
    this.showModal = true;
  }
  closeModal() { this.showModal = false; }

  get isValidManifiesto(): boolean {
    const m = this.newManifiesto;
    const okConductor = Number(m.conductor_id) > 0;
    const okCopiloto = Number(m.copiloto_id) > 0;
    const okOrigen = Number(m?.codigo_punto_origen) > 0;
    const okDestino = Number(m.codigo_punto_destino) > 0;
    const okSerie = String(m.serie || '').trim().length > 0;
    const okNumero = String(m.numero || '').trim().length > 0;
    const okTurno = String(m.turno || '') !== null;
    const okPlaca = String(m.placa || '').trim().length > 0;
    return okConductor && okOrigen && okDestino && okSerie && okNumero && okCopiloto && okTurno && okPlaca;
  }

  submitManifiesto() {
    if (!this.isValidManifiesto) return;
    const m = this.newManifiesto;
    const payload = {
      conductor_id: Number(m.conductor_id),
      copiloto_id: Number(m.copiloto_id),
      turno: String(m.turno),
      placa: String(m.placa),
      fecha_traslado: String(this.utilSrv.formatFecha(m.fecha_traslado || "")),
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
          copiloto_id: res?.copiloto_id ?? payload.copiloto_id,
          turno: res?.turno ?? payload.turno,
          placa: res?.placa ?? payload.placa,
          fecha_traslado: this.utilSrv.formatFecha(new Date() || ""),
          codigo_punto_origen: res?.codigo_punto_origen ?? payload.codigo_punto_origen,
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
        if (!wasEditing) {
          this.attachEnviosByDestino(updated);
        }
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

  private attachEnviosByDestino(item: Manifiesto) {
    const mid = Number((item as any)?.id);
    const destinoId = Number((item as any)?.codigo_punto_destino);
    if (!mid || !destinoId) return;
    this.enviosSrv.getEnvios().subscribe({
      next: (res) => {
        const all = (res || []) as any[];
        const toAttach = all.filter((e: any) => e?.manifiesto == null && Number(e?.punto_destino_id) === destinoId);
        if (!toAttach.length) return;
        const calls = toAttach.map((e: any) => this.enviosSrv.updateEnvios(Number(e.id), { manifiesto: mid } as any));
        forkJoin(calls).subscribe({
          next: () => {
            this.showNotif('Envios agregados al manifiesto');
          },
          error: () => {
            this.showNotif('No se pudieron agregar los envios', 'error');
          }
        });
      },
      error: () => {
        this.showNotif('No se pudieron cargar los envios', 'error');
      }
    });
  }

  askDelete(item: Manifiesto) {
    this.pendingDeleteId = (item as any).id ?? null;
    this.pendingDeleteLabel = `${(item as any).serie || ''}-${(item as any).numero || ''}`;
    this.confirmMessage = `Â¿Eliminar manifiesto ${this.pendingDeleteLabel}?`;
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
        this.saveError = 'No se pudo Eliminar el manifiesto';
        this.onCancelDelete();
        this.showNotif('No se pudo Eliminar el manifiesto', 'error');
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
    return item?.codigo_punto_origen ?? null;
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
    return (f as any)?.nombre.toUpperCase() || String(id);
  }

  loadConductores() {
    this.conductoresSrv.getConductores().subscribe({
      next: (res) => { this.conductores = res || []; },
      error: () => { this.conductores = []; },
    });
  }
  loadPersonas() {
    this.personasSrv.getPersonas().subscribe({
      next: (res) => { this.personas = res || []; },
      error: () => { this.personas = []; },
    });
  }

  conductorLabel(id: number | null | undefined): string {
    if (!id) return '';
    const c = (this.conductores || []).find((cc:any) => cc.id === id);
    if (!c) return String(id);
    //return `${c.licencia || 'Conductor'} - ${c.tipo_licencia || ''}`.trim();
    const persona = c.persona.tipo_documento === 'DNI' ? `${c.persona.nombre.toUpperCase()} ${c.persona.apellido.toUpperCase()}` : `${c.persona.razon_social.toUpperCase()}`;
    return persona.trim();
  }



  setView(mode: 'cards' | 'grid') {
    this.viewMode = mode;
    try { localStorage.setItem('manifiestos.viewMode', mode); } catch {}
  }

ngOnInit(): void {
    try { const saved = (localStorage.getItem('manifiestos.viewMode') || '').toLowerCase(); if (saved === 'grid' || saved === 'cards') this.viewMode = saved as any; } catch {}
    this.loadManifiestos();
    this.loadPuntos();
    this.loadConductores();
    this.loadPersonas();
  }

  // Acciones tarjeta
  verEnvios(item: Manifiesto) { this.showGuiaModal = false; this.showAddEnviosModal = false;
    const id = (item as any)?.id;
    if (!id) return;
    this.enviosManifiestoId = id as any;
    this.enviosConductorId = (item as any).conductor_id ?? null;
    this.enviosOrigenId = this.safeOrigen(item as any);
    this.enviosDestinoId = this.safeDestino(item as any);
    this.enviosLoading = true;
    this.enviosError = null;
    this.enviosLista = [];
    this.showEnviosModal = true;
    this.enviosSrv.getEnviosManifiesto(Number(id)).subscribe({
      next: (res) => { this.enviosLista = res || []; this.enviosLoading = false; },
      error: () => { this.enviosLoading = false; this.enviosError = 'No se pudieron cargar los envíos'; }
    });
  }
  closeEnvios() { this.showEnviosModal = false; }

  // Generar guï¿½a
  showGuiaModal = false;
  guiaLoading = false;
  guiaError: string | null = null;
  guiaItems: { envio: Envio, detalles: DetalleComprobante[] }[] = [];
  guiaManifiestoId: number | null = null;
  guiaSerie: string = '';
  guiaNumero: string = '';
  guiaOrigenId: number | null = null;
  guiaDestinoId: number | null = null;
  guiaConductorId: number | null = null;
  guiaCopilotoId: number | null = null;
  guiaTurno: string | null = null;
  guiaFechaTraslado: string | null = null;
  guiaPlaca: string | null = null;
  guiaFechaLarga: string = '';
  guiaFechaImpresion: string = '';
  guiaOperador: string = '';
  guiaSucursal: string = '';
  guiaAgencia: string = '';
  guiaNota: string = '';
  guiaRows: { envio: Envio, detalle: any, cantidad: number, descripcion: string, precio_unitario: number, subtotal: number }[] = [];
  guiaSubTotal = 0;
  guiaIgv = 0;
  guiaTotal = 0;

  // Generar guia (despacho + guia + items)
  showGuiaGeneradaModal = false;
  guiaGenLoading = false;
  guiaGenError: string | null = null;
  guiaGenManifiestoId: number | null = null;
  guiaGenSerie: string = '';
  guiaGenNumero: string = '';
  guiaGenDespacho: DespachoRead | null = null;
  guiaGenGuia: Guia | null = null;
  guiaGenItems: ItemGuia[] = [];
  guiaGenEstado: string = '';
  guiaDoc: any = null;
  guiaDocNow = new Date();
  guiaEstadoUpdating = false;

  generarManifiesto(item: Manifiesto) { this.showEnviosModal = false; this.showAddEnviosModal = false;
    const id = (item as any)?.id;
    if (!id) return;
    this.guiaManifiestoId = Number(id);
    this.guiaSerie = String(((item as any).serie || ''));
    this.guiaNumero = String(((item as any).numero || ''));
    this.guiaOrigenId = this.safeOrigen(item as any);
    this.guiaDestinoId = this.safeDestino(item as any);
    this.guiaConductorId = (item as any).conductor_id ?? null;
    this.guiaCopilotoId = (item as any).copiloto_id ?? null;
    this.guiaTurno = (item as any).turno ?? null;
    this.guiaFechaTraslado = (item as any).fecha_traslado ?? null;
    this.guiaPlaca = (item as any).placa ?? null;
    this.guiaFechaLarga = this.formatFechaLarga(new Date());
    this.guiaFechaImpresion = this.formatFechaCorta(new Date());
    this.showGuiaModal = true;
    this.guiaLoading = true;
    this.guiaError = null;
    this.guiaItems = [];
    this.guiaRows = [];
    this.guiaSubTotal = 0;
    this.guiaIgv = 0;
    this.guiaTotal = 0;
    this.enviosSrv.getEnviosManifiesto(Number(id)).subscribe({
      next: (envs: any[]) => {
        const envios = envs || [];
        const calls = envios.map((e:any) => (e?.id ? this.detEnvSrv.getDetallesEnvio(Number(e.id)) : of([])));
        forkJoin(calls).subscribe({
          next: (detList: any[]) => {
            this.guiaItems = envios.map((e:any, idx:number) => ({ envio: e as any, detalles: (detList[idx] || []) as any[] }));
            this.guiaRows = this.buildGuiaRows(envios, detList || []);
            this.guiaLoading = false;
          },
          error: () => { this.guiaLoading = false; this.guiaError = 'No se pudieron cargar los detalles de comprobante'; }
        });
      },
      error: () => { this.guiaLoading = false; this.guiaError = 'No se pudieron cargar los envi&acuteos del manifiesto'; }
    });
  }
  closeGuia() { this.showGuiaModal = false; }

  generarGuia(item: Manifiesto) {
    this.showGuiaModal = false;
    this.showEnviosModal = false;
    this.showAddEnviosModal = false;
    const id = (item as any)?.id;
    if (!id) return;
    this.guiaGenManifiestoId = Number(id);
    this.guiaGenSerie = String(((item as any).serie || ''));
    this.guiaGenNumero = String(((item as any).numero || ''));
    this.guiaGenDespacho = null;
    this.guiaGenGuia = null;
    this.guiaGenItems = [];
    this.guiaGenEstado = '';
    this.guiaDoc = null;
    this.guiaDocNow = new Date();
    this.guiaGenError = null;
    this.guiaGenLoading = true;
    this.showGuiaGeneradaModal = true;

    this.enviosSrv.getEnviosManifiesto(Number(id)).subscribe({
      next: (envs: any[]) => {
        const envios = envs || [];
        if (!envios.length) {
          this.guiaGenLoading = false;
          this.guiaGenError = 'No hay envios asociados; no se puede generar la guia.';
          return;
        }
        this.ensureDespachoGuiaItems(item, envios);
      },
      error: () => {
        this.guiaGenLoading = false;
        this.guiaGenError = 'No se pudieron cargar los envios del manifiesto.';
      }
    });
  }

  closeGuiaGenerada() { this.showGuiaGeneradaModal = false; }

  exportGuiaPDF() {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 32;
    const tableWidth = pageWidth - marginX * 2;
    const colWidths = [24, 48, 62, 28, 120, 46, 70, 46, 70, 44, 44];
    const colX = colWidths.reduce((acc: number[], w, i) => {
      const last = acc.length ? acc[acc.length - 1] : marginX;
      acc.push(i === 0 ? marginX : last + colWidths[i - 1]);
      return acc;
    }, []);
    let y = 36;

    const setFont = (size: number, bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
    };
    const addLine = (text: string, x: number, yPos: number, maxWidth?: number) => {
      doc.text(text || '', x, yPos, maxWidth ? { maxWidth } : undefined);
    };
    const addHeaderBlock = () => {
      setFont(10, true);
      addLine('PILOTO:', marginX, y);
      setFont(10, false);
      addLine(this.conductorLabel(this.guiaConductorId), marginX + 48, y);
      y += 14;

      setFont(10, true);
      addLine('COPILOTO:', marginX, y);
      setFont(10, false);
      addLine(this.conductorLabel(this.guiaCopilotoId), marginX + 60, y);
      y += 14;

      setFont(10, true);
      addLine('FECHA TRASLADO:', marginX, y);
      setFont(10, false);
      addLine(this.formatFechaCorta(this.guiaFechaTraslado), marginX + 98, y);
      y += 18;

      const centerX = pageWidth / 2;
      setFont(11, true);
      addLine('MANIFIESTO DE ENCOMIENDAS', centerX - 90, 36);
      setFont(11, true);
      addLine(`${this.guiaSerie || ''}-${this.guiaNumero || ''}`, centerX - 30, 50);

      setFont(10, true);
      addLine('PLACA:', centerX - 90, 68);
      setFont(10, false);
      addLine(this.guiaPlaca || 'Pendiente', centerX - 45, 68);
      y = Math.max(y, 82);

      setFont(10, true);
      addLine('ORIGEN:', centerX - 90, 82);
      setFont(10, false);
      addLine(this.nameFrom(this.guiaOrigenId), centerX - 45, 82);

      setFont(10, true);
      addLine('DESTINO:', pageWidth - marginX - 140, 82);
      setFont(10, false);
      addLine(this.nameFrom(this.guiaDestinoId), pageWidth - marginX - 80, 82);

      setFont(10, true);
      addLine(this.guiaFechaLarga || '', pageWidth - marginX - 140, 36);
      setFont(10, true);
      addLine('TURNO:', pageWidth - marginX - 140, 68);
      setFont(10, false);
      addLine(this.turnoLabel(this.guiaTurno), pageWidth - marginX - 90, 68);
      y = 98;
    };

    const drawTableHeader = () => {
      setFont(8, true);
      const headers = ['N°', 'FECHA', 'NRO DOC.', 'CANT', 'DESCRIPCIÓN', 'DNI', 'REMITENTE', 'DNI', 'DESTINATARIO', 'USUARIO', 'TOT S/.'];
      headers.forEach((h, i) => {
        addLine(h, colX[i] + 2, y);
      });
      y += 12;
      doc.line(marginX, y, marginX + tableWidth, y);
      y += 10;
    };

    const drawRow = (row: any, idx: number) => {
      setFont(8, false);
      const values = [
        String(idx + 1),
        this.formatFechaCorta(row.envio?.fecha_envio),
        this.envioDocumento(row.envio),
        String(row.cantidad ?? ''),
        String(row.descripcion ?? ''),
        this.personaDocumentoById(row.envio?.remitente),
        this.personaNombreById(row.envio?.remitente),
        this.personaDocumentoById(row.envio?.destinatario),
        this.personaNombreById(row.envio?.destinatario),
        this.envioUsuario(row.envio),
        Number(row.subtotal || 0).toFixed(2),
      ];
      const maxHeights = values.map((v, i) => doc.splitTextToSize(v || '', colWidths[i] - 4).length);
      const rowLines = Math.max(...maxHeights, 1);
      const rowHeight = rowLines * 10;
      if (y + rowHeight > 770) {
        doc.addPage();
        y = 36;
        addHeaderBlock();
        drawTableHeader();
      }
      values.forEach((v, i) => {
        const lines = doc.splitTextToSize(v || '', colWidths[i] - 4);
        addLine(lines.join('\n'), colX[i] + 2, y);
      });
      y += rowHeight;
      doc.line(marginX, y, marginX + tableWidth, y);
      y += 2;
    };

    addHeaderBlock();
    setFont(10, true);
    addLine('DETALLE:', marginX, y);
    y += 12;

    drawTableHeader();
    if ((this.guiaRows || []).length) {
      this.guiaRows.forEach((row, idx) => drawRow(row, idx));
    } else {
      setFont(9, false);
      addLine('No hay ítems para este manifiesto.', marginX, y + 4);
      y += 16;
    }

    y += 6;
    if (y > 720) { doc.addPage(); y = 36; }
    setFont(9, true);
    addLine('SUB TOTAL', marginX, y);
    setFont(9, false);
    addLine(this.guiaSubTotal.toFixed(2), marginX + 70, y);
    y += 12;
    setFont(9, true);
    addLine('IGV', marginX, y);
    setFont(9, false);
    addLine(this.guiaIgv.toFixed(2), marginX + 70, y);
    y += 12;
    setFont(9, true);
    addLine('TOTAL S/.', marginX, y);
    addLine(this.guiaTotal.toFixed(2), marginX + 70, y);

    y += 22;
    setFont(8, true);
    addLine('DATOS DE IMPRESIÓN', marginX, y);
    y += 12;
    setFont(8, false);
    addLine('OPERADOR: ' + (this.guiaOperador || '-'), marginX, y);
    y += 10;
    addLine('SUCURSAL: ' + (this.guiaSucursal || '-'), marginX, y);
    y += 10;
    addLine('AGENCIA: ' + (this.guiaAgencia || '-'), marginX, y);
    y += 10;
    addLine('FECHA IMPRESIÓN: ' + (this.guiaFechaImpresion || ''), marginX, y);
    y += 10;
    addLine('NOTA: ' + (this.guiaNota || '-'), marginX, y);

    y += 30;
    doc.line(marginX + 40, y, marginX + 220, y);
    setFont(9, false);
    addLine('Firma del Conductor', marginX + 70, y + 14);
    addLine(this.conductorLabel(this.guiaConductorId), marginX + 50, y - 6);

    doc.line(pageWidth - marginX - 220, y, pageWidth - marginX - 40, y);
    addLine('Recibido por', pageWidth - marginX - 160, y + 14);

    const fname = `guia_manifiesto_${this.guiaSerie || ''}-${this.guiaNumero || ''}.pdf`;
    doc.save(fname);
  }

  anadirEnvio(item: Manifiesto) { this.showGuiaModal = false; this.showEnviosModal = false;
    const id = (item as any)?.id;
    if (!id) return;
    this.addConductorId = (item as any)?.conductor_id ?? null;
    this.addOrigenId = this.safeOrigen(item as any);
    this.addDestinoId = this.safeDestino(item as any);
    this.showAddEnviosModal = true;
    this.addEnviosLoading = true;
    this.addEnviosError = null;
    this.addEnviosLista = [];
    this.addManifiestoId = (item as any)?.id;
    this.enviosSrv.getEnvios().subscribe({
      next: (res) => {
        const all = (res || []) as any[];
        this.addEnviosLista = all.filter(e => (e as any)?.manifiesto == null && Number((e as any)?.punto_destino_id) === Number(this.addDestinoId));
        this.addEnviosLoading = false;
      },
      error: () => { this.addEnviosLoading = false; this.addEnviosError = 'No se pudieron cargar los envï¿½os'; }
    });
  }

  closeAddEnvios() { this.showAddEnviosModal = false; }
  attachEnvioToManifiesto(envio: Envio) {
    console.log(this.addManifiestoId);
    const mid = this.addManifiestoId;
    const eid = (envio as any)?.id;
    if (!mid || !eid) return;
    this.addEnviosLoading = true;
    this.enviosSrv.updateEnvios(Number(eid), { manifiesto: Number(mid) } as any).subscribe({
      next: () => {
        this.addEnviosLoading = false;
        this.addEnviosLista = (this.addEnviosLista || []).filter((e:any) => e.id !== eid);
        this.showNotif('EnvÃ­o aï¿½adido al manifiesto');
      },
      error: () => { this.addEnviosLoading = false; this.showNotif('No se pudo aï¿½adir', 'error'); }
    });
  }

  attachAllEnviosToManifiesto() {
    const mid = this.addManifiestoId;
    const list = (this.filteredAddEnvios || []).filter((e: any) => !!e?.id);
    if (!mid || !list.length) return;
    this.addEnviosLoading = true;
    const calls = list.map((e: any) => this.enviosSrv.updateEnvios(Number(e.id), { manifiesto: Number(mid) } as any));
    forkJoin(calls).subscribe({
      next: () => {
        const ids = new Set(list.map((e: any) => Number(e.id)));
        this.addEnviosLista = (this.addEnviosLista || []).filter((e: any) => !ids.has(Number(e.id)));
        this.addEnviosLoading = false;
        this.showNotif('Envíos añadidos al manifiesto');
      },
      error: () => {
        this.addEnviosLoading = false;
        this.showNotif('No se pudieron añadir todos los envíos', 'error');
      }
    });
  }

  personaLabelById(id: number | null | undefined): string {
    if (!id) return '';
    const f = (this.personas || []).find((pp: any) => Number(pp.id) === Number(id));
    if (!f) return String(id);
    const nombre = [f?.nombre, f?.apellido].filter(Boolean).join(' ').trim();
    const razon = (f?.razon_social || '').trim();
    const base = (razon || nombre || '').trim();
    const doc = (f?.nro_documento || '').trim();
    return [base, doc].filter(Boolean).join(' - ');
  }

  personaNombreById(id: number | null | undefined): string {
    if (!id) return '';
    const f = (this.personas || []).find((pp: any) => Number(pp.id) === Number(id));
    if (!f) return String(id);
    const nombre = [f?.nombre, f?.apellido].filter(Boolean).join(' ').trim();
    return (f?.razon_social || nombre || '').trim();
  }

  personaDocumentoById(id: number | null | undefined): string {
    if (!id) return '';
    const f = (this.personas || []).find((pp: any) => Number(pp.id) === Number(id));
    if (!f) return '';
    return (f?.nro_documento || '').trim();
  }

  conductorDocumento(id: number | null | undefined): string {
    if (!id) return '';
    const c = (this.conductores || []).find((cc:any) => cc.id === id);
    return (c as any)?.persona?.nro_documento || '';
  }

  envioDocumento(envio: Envio | null | undefined): string {
    if (!envio) return '-';
    return String((envio as any)?.guia ?? (envio as any)?.id ?? '-');
  }

  envioUsuario(envio: Envio | null | undefined): string {
    if (!envio) return '-';
    return String((envio as any)?.usuario ?? '-');
  }

  turnoLabel(turno: string | null | undefined): string {
    if (!turno) return '';
    const t = String(turno).toUpperCase();
    if (t.includes(':')) return String(turno);
    if (t === 'M') return 'Mañana';
    if (t === 'T') return 'Tarde';
    if (t === 'N') return 'Noche';
    return t;
  }

  formatFechaCorta(date: string | Date | null | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  formatFechaLarga(date: string | Date | null | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return d.toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: '2-digit' });
  }

  private buildGuiaRows(envios: any[], detList: any[]): { envio: Envio, detalle: any, cantidad: number, descripcion: string, precio_unitario: number, subtotal: number }[] {
    const rows: { envio: Envio, detalle: any, cantidad: number, descripcion: string, precio_unitario: number, subtotal: number }[] = [];
    let total = 0;
    (envios || []).forEach((envio: any, idx: number) => {
      const detalles = (detList?.[idx] || []) as any[];
      if (!detalles.length) {
        rows.push({ envio, detalle: null, cantidad: 0, descripcion: 'Sin detalle', precio_unitario: 0, subtotal: 0 });
        return;
      }
      detalles.forEach((det: any) => {
        const cantidad = Number(det?.cantidad) || 0;
        const precio = Number(det?.precio_unitario) || 0;
        const subtotal = cantidad * precio;
        total += subtotal;
        rows.push({
          envio,
          detalle: det,
          cantidad,
          descripcion: String(det?.descripcion ?? ''),
          precio_unitario: precio,
          subtotal,
        });
      });
    });
    this.guiaSubTotal = total;
    this.guiaIgv = 0;
    this.guiaTotal = total;
    return rows;
  }

  private ensureDespachoGuiaItems(item: Manifiesto, envios: Envio[]) {
    const manifiestoId = Number((item as any)?.id);
    this.guiasSrv.getDespachoManifiesto(manifiestoId).subscribe({
      next: (res: any[]) => {
        const despacho = (Array.isArray(res) ? res[0] : res) as DespachoRead | undefined;
        if (despacho && (despacho as any).id) {
          this.guiaGenDespacho = despacho;
          this.ensureGuiaItemsForDespacho(item, envios, despacho);
          return;
        }
        this.createDespacho(item, envios);
      },
      error: (err) => {
        console.log(err?.status);
        if (err?.status === 404) {
          this.createDespacho(item, envios);
          return;
        }
        this.guiaGenLoading = false;
        this.guiaGenError = 'No se pudo validar el despacho.';
      }
    });
  }

  private createDespacho(item: Manifiesto, envios: Envio[]) {
    const payload = this.buildDespachoPayload(item);
    this.guiasSrv.createDespacho(payload).subscribe({
      next: (despacho) => {
        this.guiaGenDespacho = despacho;
        this.ensureGuiaItemsForDespacho(item, envios, despacho);
      },
      error: () => {
        this.guiaGenLoading = false;
        this.guiaGenError = 'No se pudo crear el despacho.';
      }
    });
  }

  private ensureGuiaItemsForDespacho(item: Manifiesto, envios: Envio[], despacho: DespachoRead) {
    forkJoin({
      guias: this.guiasSrv.getGuiasByDespacho(despacho.id),
      items: this.guiasSrv.getItemsDespacho(despacho.id),
    }).subscribe({
      next: ({ guias, items }) => {
        const guia = (guias || [])[0] as Guia | undefined;
        const existingItems = (items || []) as ItemGuia[];
        if (guia && existingItems.length) {
          this.guiaGenGuia = guia;
          this.guiaGenItems = existingItems;
          this.guiaGenEstado = String((despacho as any)?.estado || 'B');
          this.guiaDoc = this.buildGuiaDoc(item, despacho, guia, existingItems);
          this.guiaGenLoading = false;
          this.showNotif('Guia ya generada');
          return;
        }
        const guia$ = guia ? of(guia) : this.guiasSrv.createGuia(this.buildGuiaPayload(item, despacho.id));
        guia$.subscribe({
          next: (guiaRes) => {
            this.guiaGenGuia = guiaRes as Guia;
            this.guiaGenEstado = String((despacho as any)?.estado || 'B');
            if (existingItems.length) {
              this.guiaGenItems = existingItems;
              this.guiaDoc = this.buildGuiaDoc(item, despacho, guiaRes as Guia, existingItems);
              this.guiaGenLoading = false;
              return;
            }
            this.createItemsForDespacho(item, despacho, envios);
          },
          error: () => {
            this.guiaGenLoading = false;
            this.guiaGenError = 'No se pudo crear la guia.';
          }
        });
      },
      error: () => {
        this.guiaGenLoading = false;
        this.guiaGenError = 'No se pudo cargar la informacion de la guia.';
      }
    });
  }

  private createItemsForDespacho(item: Manifiesto, despacho: DespachoRead, envios: Envio[]) {
    const calls = (envios || []).map((e: any) => (e?.id ? this.detEnvSrv.getDetallesEnvio(Number(e.id)) : of([])));
    forkJoin(calls).subscribe({
      next: (detList: any[]) => {
        const payloads = this.buildGuiaItemPayloads(despacho.id, envios, detList || []);
        if (!payloads.length) {
          this.guiaGenItems = [];
          this.guiaGenLoading = false;
          this.guiaGenError = 'No hay detalles para crear items.';
          return;
        }
        forkJoin(payloads.map((p) => this.guiasSrv.createItemDespacho(p))).subscribe({
          next: (created: any[]) => {
            this.guiaGenItems = (created || []) as ItemGuia[];
            if (this.guiaGenGuia) {
              this.guiaDoc = this.buildGuiaDoc(item, despacho, this.guiaGenGuia, this.guiaGenItems);
            }
            this.guiaGenLoading = false;
            this.showNotif('Guia generada');
          },
          error: () => {
            this.guiaGenLoading = false;
            this.guiaGenError = 'No se pudieron crear los items de la guia.';
          }
        });
      },
      error: () => {
        this.guiaGenLoading = false;
        this.guiaGenError = 'No se pudieron cargar los detalles de envios.';
      }
    });
  }

  private buildDespachoPayload(item: Manifiesto): any {
    const origenId = this.safeOrigen(item as any);
    const destinoId = this.safeDestino(item as any);
    const serie = String((item as any)?.serie || '');
    const numero = String((item as any)?.numero || '');
    const me: any = localStorage.getItem('me');

    console.log(me.id);
    return {
      manifiesto_id: Number((item as any)?.id),
      estado: 'B',
      compania_id: Number(this.authSrv.getCompaniaId() || 0),
      origen_ubigeo: String(origenId ?? ''),
      origen_direccion: this.nameFrom(origenId),
      destino_ubigeo: String(destinoId ?? ''),
      destino_direccion: this.nameFrom(destinoId),
      razon_transferencia: `Manifiesto ${serie}-${numero}`.trim(),
      inicio: this.utilSrv.formatFecha(new Date()),
      aprobado_by: Number(me.id),
      notas: '',
    };
  }

  private buildGuiaPayload(item: Manifiesto, despachoId: number): any {
    const series = String((item as any)?.serie || '');
    const numeroRaw = String((item as any)?.numero || '');
    const numero = String(numeroRaw.replace(/\D+/g, '')) || 0;
    const numeroCompleto = [series, numeroRaw].filter(Boolean).join('-');
    return {
      despacho_id: Number(despachoId),
      doc_type: 'GRTI',
      series,
      numero,
      numero_completo: numeroCompleto,
      emitido_en: this.utilSrv.formatFecha(new Date()),
    };
  }

  private buildGuiaItemPayloads(despachoId: number, envios: Envio[], detList: any[]): ItemGuiaCreate[] {
    const payloads: ItemGuiaCreate[] = [];
    (envios || []).forEach((envio: any, idx: number) => {
      const detalles = (detList?.[idx] || []) as any[];
      if (!detalles.length) {
        payloads.push({
          despacho_id: despachoId,
          sku: `ENV-${envio?.id ?? ''}`,
          descripcion: `Envio ${envio?.id ?? ''}`.trim(),
          uom: 'UND',
          cantidad: 1,
          peso: Number(envio?.peso) || 0,
        });
        return;
      }
      detalles.forEach((det: any, detIdx: number) => {
        const itemNum = Number(det?.numero_item) || detIdx + 1;
        payloads.push({
          despacho_id: despachoId,
          sku: `ENV-${envio?.id ?? ''}-${itemNum}`,
          descripcion: String(det?.descripcion ?? ''),
          uom: 'UND',
          cantidad: Number(det?.cantidad) || 0,
          peso: Number(envio?.peso) || 0,
        });
      });
    });
    return payloads;
  }

  setGuiaEstado(stateLabel: 'LISTO' | 'EMITIDA' | 'ANULADA') {
    if (!this.guiaGenDespacho || this.guiaEstadoUpdating) return;
    const code = stateLabel === 'LISTO' ? 'L' : (stateLabel === 'EMITIDA' ? 'E' : 'A');
    this.guiaEstadoUpdating = true;
    this.guiasSrv.updateDespacho(this.guiaGenDespacho.id, { estado: code } as any).subscribe({
      next: (res: any) => {
        this.guiaEstadoUpdating = false;
        this.guiaGenEstado = code;
        this.guiaGenDespacho = (res || this.guiaGenDespacho) as any;
        this.showNotif(`Estado actualizado a ${stateLabel}`);
      },
      error: () => {
        this.guiaEstadoUpdating = false;
        this.showNotif('No se pudo actualizar el estado', 'error');
      }
    });
  }

  guiaEstadoLabel(code: string | null | undefined): string {
    const c = String(code || '').toUpperCase();
    if (c === 'B') return 'BORRADOR';
    if (c === 'L') return 'LISTO';
    if (c === 'E') return 'EMITIDA';
    if (c === 'A') return 'ANULADA';
    return c || '-';
  }

  printGuia() {
    if (!this.guiaDoc) return;
    const printContent = document.getElementById('guia-print');
    if (!printContent) {
      this.showNotif('No se pudo preparar la impresion', 'error');
      return;
    }
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      this.showNotif('No se pudo abrir la ventana de impresion', 'error');
      return;
    }
    const style = `
      body { font-family: "Courier New", Courier, monospace; color: #111827; margin: 20px; }
      .header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 12px; }
      .header__left .title { font-size: 16px; font-weight: 700; }
      .doc-number { font-size: 14px; font-weight: 600; margin-top: 2px; }
      .meta { margin-top: 6px; font-size: 12px; }
      .header__right { text-align: right; }
      .qr img { width: 90px; height: 90px; object-fit: contain; border: 1px solid #e5e7eb; padding: 4px; }
      .box { border: 1px solid #111827; padding: 10px; margin-top: 10px; }
      .box__title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
      .grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
      .subbox { border: 1px dashed #111827; padding: 8px; }
      .subbox__title { font-size: 11px; font-weight: 700; margin-bottom: 4px; }
      .line { font-size: 12px; margin: 2px 0; }
      .items { width: 100%; border-collapse: collapse; font-size: 12px; }
      .items th, .items td { border: 1px solid #111827; padding: 6px; vertical-align: top; }
      .items thead th { background: #f3f4f6; text-align: left; }
      .items .num, .items .right { text-align: right; }
      .items .empty { text-align: center; color: #6b7280; }
      .w-code { width: 14%; }
      .w-uom { width: 8%; }
      .w-qty { width: 10%; }
      .w-lot { width: 12%; }
      .w-weight { width: 12%; }
      .footer { margin-top: 10px; display: flex; justify-content: space-between; gap: 10px; font-size: 11px; }
      .small { font-size: 11px; }
      .mono { font-family: "Courier New", Courier, monospace; }
    `;
    win.document.write(`<!doctype html><html><head><title>Guia ${this.guiaDoc.fullNumber || ''}</title><style>${style}</style></head><body>${printContent.outerHTML}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  }

  private buildGuiaDoc(item: Manifiesto, despacho: DespachoRead, guia: Guia, items: ItemGuia[]) {
    const conductor = this.conductorById((item as any)?.conductor_id);
    const companyName = String(localStorage.getItem('razon_social') || this.authSrv.getCompania() || '').trim();
    const companyRuc = String(localStorage.getItem('ruc') || '').trim();
    const mappedItems = (items || []).map((it: any) => ({
      sku: it.sku || '',
      description: it.descripcion || '',
      uom: it.uom || '',
      qty: Number(it.cantidad) || 0,
      lot: '',
      weightKg: Number(it.peso) || 0,
    }));
    const totalQty = mappedItems.reduce((acc: number, it: any) => acc + (Number(it.qty) || 0), 0);
    const totalWeightKg = mappedItems.reduce((acc: number, it: any) => acc + (Number(it.weightKg) || 0), 0);
    const fullNumber = String((guia as any)?.numero_completo || `${(guia as any)?.series || ''}-${(guia as any)?.numero || ''}`).trim();
    const hashSha = String((guia as any)?.hash_sha || '');
    return {
      fullNumber,
      issuedAt: (guia as any)?.emitido_en || null,
      startDatetime: despacho?.inicio || null,
      qrDataUrl: '',
      verifyUrl: '',
      companyName: companyName || '-',
      companyRuc: companyRuc || '-',
      transferReason: despacho?.razon_transferencia || '',
      notes: despacho?.notas || '',
      originUbigeo: despacho?.origen_ubigeo || '',
      originAddress: despacho?.origen_direccion || '',
      destUbigeo: despacho?.destino_ubigeo || '',
      destAddress: despacho?.destino_direccion || '',
      vehiclePlate: (item as any)?.placa || '',
      trailerPlate: '',
      driverName: conductor?.name || this.conductorLabel((item as any)?.conductor_id),
      driverDocType: conductor?.docType || '',
      driverDocNumber: conductor?.docNumber || '',
      driverLicense: conductor?.license || '',
      hashShort: hashSha ? hashSha.slice(0, 12) + '...' : '',
      issuedBy: this.authSrv.getUserLabel() || '',
      items: mappedItems,
      totalQty,
      totalWeightKg,
      hashSha256: hashSha,
    };
  }

  private conductorById(id: number | null | undefined) {
    if (!id) return null;
    const c = (this.conductores || []).find((cc: any) => Number(cc.id) === Number(id));
    if (!c) return null;
    return {
      name: this.conductorLabel(id),
      docType: (c as any)?.persona?.tipo_documento || '',
      docNumber: (c as any)?.persona?.nro_documento || '',
      license: (c as any)?.licencia || '',
    };
  }
}






