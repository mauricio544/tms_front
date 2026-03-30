import { Component, OnInit, inject, HostListener } from '@angular/core';
import jsPDF from 'jspdf';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroMapPin, heroTruck } from '@ng-icons/heroicons/outline';
import { UiAlertComponent } from '../../shared/ui/alert/alert';
import { UiConfirmComponent } from '../../shared/ui/confirm/confirm';
import { Manifiestos } from '../../../../core/services/manifiestos';
import { Envios } from '../../../../core/services/envios';
import { Puntos } from '../../../../core/services/puntos';
import { Conductores as ConductoresService } from '../../../../core/services/conductores';
import { Manifiesto, Envio, Puntos as Points, Persona, DetalleComprobante, DespachoRead, Guia, ItemGuia, ItemGuiaCreate, Vehiculo, SerieComprobante as SerieComprobanteModel, GuiaTramaFinal, ManifiestoGuiasSunatResumenRead, ManifiestoGuiaSunatEstadoRead, ManifiestoEnvioPendienteGuiaRead } from '../../../../core/mapped';
import { Conductor } from '../../../../core/mapped';
import { Personas } from '../../../../core/services/personas';
import { DetallesComprobante } from '../../../../core/services/detalles-comprobante';
import { DetalleEnvio } from '../../../../core/services/detalle-envio';
import { forkJoin, of, catchError } from 'rxjs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Utilitarios } from '../../../../core/services/utilitarios';
import { Guias } from '../../../../core/services/guias';
import { SerieComprobante as SerieComprobanteService } from '../../../../core/services/serie-comprobante';
import { AuthService } from '../../../../core/services/auth.service';
import { Vehiculos } from '../../../../core/services/vehiculos';
import {Utils} from '../../../../core/services/utils';
import { GrtBuilderService, GrtDocument } from './grt-builder.service';
import { GrtPreviewComponent } from '../../shared/grt-preview/grt-preview.component';
import { GrrPreviewComponent } from '../../shared/grr-preview/grr-preview.component';

export type FormManifiesto = { conductor_id: number | null; codigo_punto_origen: number | null; codigo_punto_destino: number | null; serie: string; numero: string; copiloto_id: number | null, turno: string | null, placa: string | null, fecha_traslado: string | null; vehiculo_id: number | null };
type SunatGuiaEstado = 'aceptado' | 'rechazado' | 'pendiente';
type SunatGuiaItem = { envioId: number; envioTicket?: string; guiaId: number; numero: string; sunatCod?: string; sunatMsg?: string };
type SunatPendingGuiaItem = { envioId: number; envioTicket?: string; fechaEnvio?: string; origenNombre?: string; destinoNombre?: string; motivo?: string };
type SunatGenerationState = { total: number; done: number; errors: number; running: boolean; guias: SunatGuiaItem[]; pendingGuias: SunatPendingGuiaItem[]; totalPendientesGuia: number };

@Component({
  selector: 'feature-manifiestos',
  standalone: true,
  imports: [CommonModule, FormsModule, UiAlertComponent, UiConfirmComponent, RouterLink, Utils, NgIconComponent, GrtPreviewComponent, GrrPreviewComponent],
  providers: [provideIcons({ heroMapPin, heroTruck })],
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
  private readonly serieSrv = inject(SerieComprobanteService);
  private readonly authSrv = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly vehiculosSrv = inject(Vehiculos);
  private readonly grtBuilder = inject(GrtBuilderService);
  private readonly sanitizer = inject(DomSanitizer);

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
  filterFecha = this.localDateInput();
  defaultOrigenId: number | null = null;
  origenLocked = false;

  // Vista: 'cards' o 'grid'
  viewMode: 'cards' | 'grid' = 'cards';
  // Estado base para detalle contextual (preparación para drawer)
  selectedManifiestoId: number | null = null;
  drawerOpen = false;
  activeTab: 'resumen' | 'envios' | 'guias' | 'documento' | 'mapa' | 'historial' = 'resumen';
  actionMenuOpenId: number | null = null;
  actionMenuPos: { top: number; left: number } = { top: 0, left: 0 };

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
  confirmDetachOpen = false;
  confirmDetachTitle = 'Confirmar';
  confirmDetachMessage = '';
  pendingDetachEnvioId: number | null = null;

  // Notificaciones
  notif: string | null = null;
  notifType: 'success' | 'error' = 'success';

  // Geo modal
  showGeoModal = false;
  geoLat: number | null = null;
  geoLng: number | null = null;
  geoAccuracy: number | null = null;
  geoManifiestoLabel = '';
  geoMapUrl: SafeResourceUrl | null = null;

  // Puntos y conductores
  puntos: Points[] = [];
  conductores: Conductor[] = [];
  personas: Persona[] = [];
  vehiculos: Vehiculo[] = [];

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
  onFechaFilterChange() {
    this.page = 1;
    this.loadManifiestos();
  }
  openDetailContext(item: Manifiesto, tab: 'resumen' | 'envios' | 'guias' | 'documento' | 'mapa' | 'historial' = 'resumen') {
    const id = Number((item as any)?.id || 0);
    if (!id) return;
    this.selectedManifiestoId = id;
    this.drawerOpen = true;
    this.activeTab = tab;
    this.syncDetailQueryParams();
    if (tab === 'envios') this.loadEnviosForManifiesto(item);
    if (tab === 'guias') this.loadSunatResumenForManifiesto(item);
  }
  closeDetailContext() {
    this.drawerOpen = false;
    this.showEnviosModal = false;
    this.showGuiaModal = false;
    this.showGuiaGeneradaModal = false;
    this.syncDetailQueryParams();
  }
  setActiveTab(tab: 'resumen' | 'envios' | 'guias' | 'documento' | 'mapa' | 'historial') {
    this.activeTab = tab;
    this.syncDetailQueryParams();
    if (tab === 'envios') this.loadEnviosForSelected();
    if (tab === 'guias') this.loadSunatResumenForSelected();
  }
  toggleActionMenu(item: Manifiesto, ev?: Event) {
    try { ev?.preventDefault(); ev?.stopPropagation(); } catch {}
    const id = Number((item as any)?.id || 0);
    if (!id) return;
    if (this.actionMenuOpenId === id) {
      this.actionMenuOpenId = null;
      return;
    }
    this.actionMenuOpenId = id;
    this.positionActionMenu(ev);
  }
  closeActionMenu() { this.actionMenuOpenId = null; }
  isActionMenuOpen(item: Manifiesto): boolean { return Number((item as any)?.id || 0) === this.actionMenuOpenId; }
  get actionMenuItem(): Manifiesto | null {
    const id = Number(this.actionMenuOpenId || 0);
    if (!id) return null;
    return (this.lista_manifiestos || []).find((m: any) => Number((m as any)?.id || 0) === id) || null;
  }
  private positionActionMenu(ev?: Event) {
    const target = (ev?.currentTarget || ev?.target) as HTMLElement | null;
    if (!target || typeof window === 'undefined') return;
    const rect = target.getBoundingClientRect();
    const menuWidth = 192; // w-48
    const menuHeight = 280;
    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 720;
    const left = Math.max(8, Math.min(rect.right - menuWidth, vw - menuWidth - 8));
    const openUp = rect.bottom + 8 + menuHeight > vh;
    const top = openUp ? Math.max(8, rect.top - menuHeight - 8) : Math.max(8, rect.bottom + 6);
    this.actionMenuPos = { top, left };
  }
  @HostListener('document:click')
  onDocumentClick() { this.closeActionMenu(); }
  @HostListener('window:resize')
  onWindowResize() { this.closeActionMenu(); }
  @HostListener('window:scroll')
  onWindowScroll() { this.closeActionMenu(); }
  @HostListener('document:keydown.escape')
  onEscapeKey() {
    this.closeActionMenu();
    if (this.showAddEnviosModal) { this.closeAddEnvios(); return; }
    if (this.showGrtModal) { this.closeGrt(); return; }
    if (this.showGeoModal) { this.closeGeo(); return; }
    if (this.showModal) { this.closeModal(); return; }
    if (this.drawerOpen) { this.closeDetailContext(); return; }
  }
  openEnviosContext(item: Manifiesto, ev?: Event) {
    try { ev?.preventDefault(); ev?.stopPropagation(); } catch {}
    this.openDetailContext(item, 'envios');
    this.closeActionMenu();
    this.verEnvios(item);
  }
  openAddEnviosContext(item: Manifiesto, ev?: Event) {
    try { ev?.preventDefault(); ev?.stopPropagation(); } catch {}
    this.openDetailContext(item, 'envios');
    this.closeActionMenu();
    this.anadirEnvio(item);
  }
  openGenerarManifiestoContext(item: Manifiesto, ev?: Event) {
    try { ev?.preventDefault(); ev?.stopPropagation(); } catch {}
    this.openDetailContext(item, 'documento');
    this.closeActionMenu();
    this.generarManifiesto(item);
  }
  openGuiaSunatContext(item: Manifiesto, ev?: Event) {
    try { ev?.preventDefault(); ev?.stopPropagation(); } catch {}
    this.openDetailContext(item, 'guias');
    this.closeActionMenu();
    this.generarGuiaSunat(item);
  }
  openGrtContext(item: Manifiesto, ev?: Event) {
    try { ev?.preventDefault(); ev?.stopPropagation(); } catch {}
    this.openDetailContext(item, 'guias');
    this.closeActionMenu();
    this.generarGRT(item);
  }
  openPublicLinkContext(item: Manifiesto, ev?: Event) {
    try { ev?.preventDefault(); ev?.stopPropagation(); } catch {}
    this.openDetailContext(item, 'documento');
    this.closeActionMenu();
    this.generarPublicLink(item);
  }
  canShowPublicLink(item: Manifiesto | null | undefined): boolean {
    const userSedeId = this.getUserPuntoId();
    if (userSedeId <= 0) return false;
    const destinoId = Number((item as any)?.codigo_punto_destino || 0);
    return destinoId > 0 && destinoId === userSedeId;
  }
  openEditContext(item: Manifiesto, ev?: Event) {
    try { ev?.preventDefault(); ev?.stopPropagation(); } catch {}
    this.openDetailContext(item, 'resumen');
    this.closeActionMenu();
    this.openEdit(item);
  }
  openGeoContext(item: Manifiesto, ev?: Event) {
    try { ev?.preventDefault(); ev?.stopPropagation(); } catch {}
    this.openDetailContext(item, 'mapa');
    this.closeActionMenu();
    this.openGeo(item);
  }
  askDeleteContext(item: Manifiesto, ev?: Event) {
    try { ev?.preventDefault(); ev?.stopPropagation(); } catch {}
    this.closeActionMenu();
    this.askDelete(item);
  }
  get selectedManifiesto(): Manifiesto | null {
    const id = Number(this.selectedManifiestoId || 0);
    if (!id) return null;
    return (this.lista_manifiestos || []).find((m: any) => Number((m as any).id) === id) || null;
  }
  get selectedSunatState(): SunatGenerationState | null {
    const mid = Number(this.selectedManifiestoId || 0);
    if (!mid) return null;
    return this.sunatGenState[mid] || null;
  }
  private loadEnviosForSelected() {
    const item = this.selectedManifiesto;
    if (!item) return;
    this.loadEnviosForManifiesto(item);
  }
  private loadSunatResumenForSelected() {
    const item = this.selectedManifiesto;
    if (!item) return;
    this.loadSunatResumenForManifiesto(item);
  }
  private loadSunatResumenForManifiesto(item: Manifiesto) {
    const mid = Number((item as any)?.id || 0);
    if (!mid) return;
    forkJoin({
      resumen: this.manifiestosSrv.getManifiestoResumenGuias(mid),
      envios: this.enviosSrv.getEnviosManifiesto(mid).pipe(catchError(() => of([] as Envio[]))),
    }).subscribe({
      next: ({ resumen, envios }) => {
        this.hydrateSunatStateFromResumen(mid, resumen as ManifiestoGuiasSunatResumenRead, false, this.buildTicketByEnvioMap((envios || []) as Envio[]));
      },
      error: () => { /* noop */ }
    });
  }
  private loadEnviosForManifiesto(item: Manifiesto) {
    const id = Number((item as any)?.id || 0);
    if (!id) return;
    this.enviosManifiestoId = id;
    this.enviosConductorId = (item as any).conductor_id ?? null;
    this.enviosOrigenId = this.safeOrigen(item as any);
    this.enviosDestinoId = this.safeDestino(item as any);
    this.enviosLoading = true;
    this.enviosError = null;
    this.enviosLista = [];
    this.enviosSrv.getEnviosManifiesto(id).subscribe({
      next: (res) => { this.enviosLista = res || []; this.enviosLoading = false; },
      error: () => { this.enviosLoading = false; this.enviosError = 'No se pudieron cargar los envíos'; }
    });
  }
  private syncDetailQueryParams() {
    const queryParams: any = { ...this.route.snapshot.queryParams };
    if (this.drawerOpen && this.selectedManifiestoId) {
      queryParams.selected = this.selectedManifiestoId;
      queryParams.tab = this.activeTab;
    } else {
      delete queryParams.selected;
      delete queryParams.tab;
    }
    this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
  }
  private hydrateDetailFromQueryParams() {
    const qp = this.route.snapshot.queryParamMap;
    const selected = Number(qp.get('selected') || 0);
    const tab = String(qp.get('tab') || '').toLowerCase();
    const validTabs = ['resumen', 'envios', 'guias', 'documento', 'mapa', 'historial'];
    if (!selected) return;
    this.selectedManifiestoId = selected;
    this.drawerOpen = true;
    this.activeTab = (validTabs.includes(tab) ? tab : 'resumen') as any;
  }

  newManifiesto: FormManifiesto = { conductor_id: null, codigo_punto_origen: null, codigo_punto_destino: null, serie: this.buildSerieBySede(), numero: '' , copiloto_id: null, turno: '', placa: '', fecha_traslado: '', vehiculo_id: null };

  private localDateInput(value?: string | Date | null): string {
    if (!value) {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
    if (value instanceof Date) {
      const d = value;
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
    const s = String(value);
    return s.includes('T') ? s.slice(0, 10) : s;
  }

  // Modal helpers
  numeroAutoLoading = false;
  private formatNumero6(value: number): string {
    const n = Number(value || 0);
    return String(Math.max(0, n)).padStart(6, '0');
  }
  private loadNextNumeroManifiesto() {
    this.numeroAutoLoading = true;
    this.manifiestosSrv.getLastManifiesto().subscribe({
      next: (res: any) => {
        const ultimoId = Number((res as any)?.ultimo_id || 0);
        this.newManifiesto.numero = this.formatNumero6(ultimoId + 1);
        this.numeroAutoLoading = false;
      },
      error: () => {
        const fallback = Math.max(0, ...((this.lista_manifiestos || []).map((m: any) => Number((m as any)?.id || 0))));
        this.newManifiesto.numero = this.formatNumero6(fallback + 1);
        this.numeroAutoLoading = false;
      }
    });
  }
  openModal() {
    this.editing = false;
    this.editingId = null;
    this.newManifiesto = { conductor_id: null, codigo_punto_origen: null, codigo_punto_destino: null, serie: this.buildSerieBySede(), numero: '' , copiloto_id: null, turno: '', placa: '', fecha_traslado: this.localDateInput(), vehiculo_id: null };
    this.applyDefaultOrigen();
    this.loadNextNumeroManifiesto();
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
      fecha_traslado: this.localDateInput((item as any)?.fecha_traslado),
      vehiculo_id: (item as any)?.vehiculo_id ?? null,
      codigo_punto_origen: (item as any).codigo_punto_origen ?? null,
      codigo_punto_destino: (item as any).codigo_punto_destino ?? null,
      serie: (item as any).serie ?? '',
      numero: (item as any).numero ?? '',
    };
    this.applyDefaultOrigen();
    if (this.newManifiesto.vehiculo_id) {
      this.onVehiculoChange(this.newManifiesto.vehiculo_id);
    }
    this.numeroAutoLoading = false;
    console.log(this.newManifiesto);
    this.saveError = null;
    this.showModal = true;
  }
  closeModal() { this.showModal = false; }

  estadoLabel(item: Manifiesto): string {
    const raw = String((item as any)?.estado || '').trim().toUpperCase();
    if (raw === 'LLEGADA') return 'LLEGADA';
    return 'EN-TRANSITO';
  }

  hasGeo(item: Manifiesto): boolean {
    const lat = Number((item as any)?.arrived_lat);
    const lng = Number((item as any)?.arrived_lng);
    return Number.isFinite(lat) && Number.isFinite(lng);
  }

  openGeo(item: Manifiesto) {
    if (!this.hasGeo(item)) return;
    this.geoLat = Number((item as any)?.arrived_lat);
    this.geoLng = Number((item as any)?.arrived_lng);
    this.geoAccuracy = Number((item as any)?.arrived_accuracy_m ?? null);
    this.geoManifiestoLabel = `${(item as any)?.serie || ''}-${(item as any)?.numero || ''}`.trim();
    const lat = this.geoLat as number;
    const lng = this.geoLng as number;
    const delta = 0.01;
    const left = lng - delta;
    const right = lng + delta;
    const top = lat + delta;
    const bottom = lat - delta;
    const url = `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lng}`;
    this.geoMapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    this.showGeoModal = true;
  }

  closeGeo() {
    this.showGeoModal = false;
    this.geoLat = null;
    this.geoLng = null;
    this.geoAccuracy = null;
    this.geoManifiestoLabel = '';
    this.geoMapUrl = null;
  }

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
    const serieFinal = this.editing ? String(m.serie || '').trim() : this.buildSerieBySede();
    const numeroFinal = this.editing
      ? String(m.numero || '').trim()
      : this.formatNumero6(Number(String(m.numero || '0').replace(/\D+/g, '')) || 0);
    const payload = {
      conductor_id: Number(m.conductor_id),
      copiloto_id: Number(m.copiloto_id),
      turno: String(m.turno),
      placa: String(m.placa),
      fecha_traslado: String(this.localDateInput(m.fecha_traslado)),
      vehiculo_id: m.vehiculo_id != null ? Number(m.vehiculo_id) : null,
      codigo_punto_origen: Number(m.codigo_punto_origen),
      codigo_punto_destino: Number(m.codigo_punto_destino),
      serie: serieFinal,
      numero: numeroFinal,
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
          vehiculo_id: (res as any)?.vehiculo_id ?? payload.vehiculo_id,
          fecha_traslado: res?.fecha_traslado ?? payload.fecha_traslado,
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
        /*if (!wasEditing) {
          this.attachEnviosByDestino(updated);
        }*/
        this.saving = false;
        this.editing = false;
        this.editingId = null;
        this.onFilterChange();
        this.closeModal();
        this.showNotif(wasEditing ? 'Manifiesto actualizado' : 'Manifiesto creado y envíos añadidos');
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
    const origenId = Number((item as any)?.codigo_punto_origen);
    const destinoId = Number((item as any)?.codigo_punto_destino);
    if (!mid || !origenId || !destinoId) return;
    this.getEnviosByRole().subscribe({
      next: (res) => {
        const all = (res || []) as any[];
        const toAttach = all.filter((e: any) =>
          e?.manifiesto == null &&
          Number(e?.punto_origen_id) === origenId &&
          Number(e?.punto_destino_id) === destinoId
        );
        if (!toAttach.length) return;
        const calls = toAttach.map((e: any) => this.enviosSrv.updateEnvios(Number(e.id), { manifiesto: mid, estado_envio: "EN TRÁNSITO" } as any));
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
  private buildSerieBySede(): string {
    const sedeId = this.getUserPuntoId();
    if (sedeId > 0) return `MV${sedeId}`;
    return 'MV';
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
    const puntoId = this.getUserPuntoId();
    const fecha = this.filterFecha || this.localDateInput();
    const source$ = this.useManifiestoPuntoEndpoint()
      ? this.manifiestosSrv.getManifiestoPunto(puntoId, fecha)
      : this.manifiestosSrv.getManifiestos(fecha);
    source$.subscribe({
      next: (response) => {
        this.lista_manifiestos = (response as any) || [];
        this.loading = false;
        if (this.drawerOpen && this.activeTab === 'envios') this.loadEnviosForSelected();
      },
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
      next: (res: Points[]) => { this.puntos = res || []; this.applyDefaultOrigen(); },
      error: () => { /* noop */ },
    });
  }

  nameFrom(id: number | null): string {
    if (!id) return '';
    const f = (this.puntos || []).find((p:any) => p.id === id);
    return (f as any)?.nombre.toUpperCase() || String(id);
  }

  addressFrom(id: number | null): string {
    if (!id) return '';
    const f = (this.puntos || []).find((p: any) => Number((p as any)?.id || 0) === Number(id));
    return String((f as any)?.direccion || '').trim();
  }

  ubigeoFrom(id: number | null): string {
    if (!id) return '';
    const f = (this.puntos || []).find((p: any) => Number((p as any)?.id || 0) === Number(id));
    const ubigeo = String((f as any)?.ubigeo ?? '').trim();
    const nombre = String((f as any)?.nombre ?? '').trim().toUpperCase();
    // Regla hardcoded solicitada para este punto.
    if (nombre === 'AREQUIPA' || nombre === 'CAMANA' || nombre === 'ALTO SIGUAS') {
      if (!ubigeo) return '';
      return ubigeo.startsWith('0') ? ubigeo : `0${ubigeo}`;
    }
    return ubigeo;
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
  loadVehiculos() {
    this.vehiculosSrv.getVehiculos().subscribe({
      next: (res) => { this.vehiculos = res || []; },
      error: () => { this.vehiculos = []; },
    });
  }

  onVehiculoChange(value: number | null) {
    const id = Number(value || 0);
    if (!id) {
      this.newManifiesto.placa = '';
      return;
    }
    const found = (this.vehiculos || []).find((v: any) => Number(v.id) === id);
    this.newManifiesto.placa = String((found as any)?.placa.toUpperCase() || '');
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
    this.hydrateDetailFromQueryParams();
    this.loadManifiestos();
    this.loadPuntos();
    this.loadConductores();
    this.loadPersonas();
    this.loadVehiculos();
  }

  private resolveDefaultOrigenId(): number | null {
    try {
      const raw = localStorage.getItem('me');
      if (!raw) return null;
      const me = JSON.parse(raw || '{}');
      const sedeId = Number(me?.sedes?.[0]?.id || 0);
      return sedeId > 0 ? sedeId : null;
    } catch {
      return null;
    }
  }

  private applyDefaultOrigen() {
    const id = this.resolveDefaultOrigenId();
    if (!id) {
      this.defaultOrigenId = null;
      this.origenLocked = false;
      return;
    }
    this.defaultOrigenId = id;
    this.origenLocked = true;
    if (!this.newManifiesto?.codigo_punto_origen || Number(this.newManifiesto.codigo_punto_origen) !== Number(id)) {
      this.newManifiesto.codigo_punto_origen = id;
    }
  }

  // Acciones tarjeta
  verEnvios(item: Manifiesto) { this.showGuiaModal = false; this.showAddEnviosModal = false;
    this.showEnviosModal = true;
    this.loadEnviosForManifiesto(item);
  }
  closeEnvios() { this.showEnviosModal = false; }

  // Generar guía
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
  guiaGenIsSunat = false;
  guiaGenTitle = '';
  showGrtModal = false;
  grtLoading = false;
  grtError: string | null = null;
  grtDoc: GrtDocument | null = null;
  private showOnlyView(target: 'none' | 'manifiesto' | 'grr' | 'grt') {
    this.showGuiaModal = target === 'manifiesto';
    this.showGuiaGeneradaModal = target === 'grr';
    this.showGrtModal = target === 'grt';
  }

  sunatGenState: Record<number, SunatGenerationState> = {};
  sunatGuiasOpenId: number | null = null;
  sunatRetryLoading: Record<number, boolean> = {};
  sunatPendingCreateLoading: Record<number, boolean> = {};
  publicLinkLoading: Record<number, boolean> = {};
  publicLinkError: Record<number, string | null> = {};

  generarManifiesto(item: Manifiesto) { this.showEnviosModal = false; this.showAddEnviosModal = false;
    this.showOnlyView('manifiesto');
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
    this.guiaOperador = this.getLoggedUserLabel();
    this.guiaSucursal = '';
    this.guiaAgencia = '';
    this.guiaNota = '';
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

  printManifiestoInline() {
    const printContent = document.getElementById('manifiesto-inline-print');
    if (!printContent) {
      this.showNotif('No se pudo preparar la impresion', 'error');
      return;
    }
    const win = window.open('', '_blank', 'width=1024,height=768');
    if (!win) {
      this.showNotif('No se pudo abrir la ventana de impresion', 'error');
      return;
    }
    const styleTags = Array.from(document.querySelectorAll('style'))
      .map((n) => (n as HTMLStyleElement).outerHTML)
      .join('\n');
    const linkTags = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map((n) => {
        const href = (n as HTMLLinkElement).href;
        return href ? `<link rel="stylesheet" href="${href}">` : '';
      })
      .join('\n');
    const baseHref = `${window.location.origin}/`;
    const printCss = `
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        html, body { margin: 0; padding: 0; background: #fff; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .print-host { width: 100%; max-width: 190mm; margin: 0 auto; }
      </style>
    `;
    const bodyClass = String(document.body.className || '');
    win.document.open();
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><base href="${baseHref}"><title>Manifiesto ${this.guiaSerie || ''}-${this.guiaNumero || ''}</title>${linkTags}${styleTags}${printCss}</head><body class="${bodyClass}"><div class="print-host">${printContent.outerHTML}</div></body></html>`);
    win.document.close();
    let printed = false;
    const doPrint = () => {
      if (printed) return;
      printed = true;
      try { win.focus(); } catch {}
      try { win.print(); } catch {}
      setTimeout(() => { try { win.close(); } catch {} }, 120);
    };
    win.addEventListener('load', doPrint, { once: true });
    setTimeout(doPrint, 700);
  }

  printManifiestoThermal80mm() {
    const rows = Array.isArray(this.guiaRows) ? this.guiaRows : [];
    if (this.guiaLoading || !!this.guiaError || !rows.length) {
      this.showNotif('No hay datos para imprimir en formato térmico', 'error');
      return;
    }
    const numero = `${String(this.guiaSerie || '').trim()}-${String(this.guiaNumero || '').trim()}`.replace(/^-|-$/g, '') || '-';
    const origen = this.nameFrom(this.guiaOrigenId) || '-';
    const destino = this.nameFrom(this.guiaDestinoId) || '-';
    const placa = String(this.guiaPlaca || 'Pendiente').trim();
    const turno = this.turnoLabel(this.guiaTurno) || '-';
    const piloto = this.conductorLabel(this.guiaConductorId) || '-';
    const copiloto = this.conductorLabel(this.guiaCopilotoId) || '-';
    const fechaTraslado = this.formatFechaCorta(this.guiaFechaTraslado) || '-';
    const fechaImpresion = this.formatFechaCorta(new Date()) || '-';
    const total = Number(this.guiaTotal || 0).toFixed(2);
    const detailRows = rows.map((row, idx) => {
      const envio: any = row?.envio || {};
      const doc = this.envioDocumento(envio) || '-';
      const fecha = this.formatFechaCorta(envio?.fecha_envio) || '-';
      const cant = Number(row?.cantidad || 0);
      const desc = String(row?.descripcion || 'Sin detalle').trim() || 'Sin detalle';
      const remitente = this.personaNombreById(envio?.remitente) || String(envio?.remitente || '-');
      const destinatario = this.personaNombreById(envio?.destinatario) || String(envio?.destinatario || '-');
      const subtotal = Number(row?.subtotal || 0).toFixed(2);
      return `
        <div class="item">
          <div class="line strong">${idx + 1}. DOC: ${this.escHtml(doc)}</div>
          <div class="line">Fecha: ${this.escHtml(fecha)}</div>
          <div class="line">Cant: ${this.escHtml(String(cant))}</div>
          <div class="line">Desc: ${this.escHtml(desc)}</div>
          <div class="line">Rem: ${this.escHtml(remitente)}</div>
          <div class="line">Dest: ${this.escHtml(destinatario)}</div>
          <div class="line strong">Total: S/ ${this.escHtml(subtotal)}</div>
        </div>
      `;
    }).join('');

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Manifiesto ${this.escHtml(numero)}</title>
  <style>
    @page { size: 80mm auto; margin: 2.5mm; }
    html, body { width: 80mm; margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; line-height: 1.25; }
    .wrap { width: 74mm; margin: 0 auto; }
    .center { text-align: center; }
    .title { font-weight: 700; font-size: 13px; }
    .doc { font-weight: 700; font-size: 12px; margin-top: 1px; }
    .sep { border-top: 1px dashed #000; margin: 5px 0; }
    .line { margin: 2px 0; word-break: break-word; }
    .strong { font-weight: 700; }
    .item { border-bottom: 1px dotted #666; padding: 4px 0; }
    .total { margin-top: 4px; font-size: 13px; font-weight: 700; text-align: right; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="center title">MANIFIESTO DE ENCOMIENDAS</div>
    <div class="center doc">${this.escHtml(numero)}</div>
    <div class="sep"></div>
    <div class="line"><span class="strong">Fecha Impresión:</span> ${this.escHtml(fechaImpresion)}</div>
    <div class="line"><span class="strong">Fecha Traslado:</span> ${this.escHtml(fechaTraslado)}</div>
    <div class="line"><span class="strong">Turno:</span> ${this.escHtml(turno)}</div>
    <div class="line"><span class="strong">Placa:</span> ${this.escHtml(placa)}</div>
    <div class="line"><span class="strong">Origen:</span> ${this.escHtml(origen)}</div>
    <div class="line"><span class="strong">Destino:</span> ${this.escHtml(destino)}</div>
    <div class="line"><span class="strong">Piloto:</span> ${this.escHtml(piloto)}</div>
    <div class="line"><span class="strong">Copiloto:</span> ${this.escHtml(copiloto)}</div>
    <div class="sep"></div>
    <div class="line strong">DETALLE</div>
    ${detailRows}
    <div class="total">TOTAL GENERAL: S/ ${this.escHtml(total)}</div>
  </div>
  <script>
    (function () {
      var printed = false;
      function doPrintOnce() {
        if (printed) return;
        printed = true;
        window.print();
      }
      window.addEventListener('load', doPrintOnce, { once: true });
      setTimeout(doPrintOnce, 250);
      window.addEventListener('afterprint', function () { setTimeout(function () { window.close(); }, 120); }, { once: true });
    })();
  </script>
</body>
</html>`;
    const w = window.open('', '_blank');
    if (!w) {
      this.showNotif('No se pudo abrir la ventana de impresion', 'error');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  private escHtml(v: any): string {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private getUserSedeId(): number {
    try {
      const raw = localStorage.getItem('me');
      if (!raw) return 0;
      const me = JSON.parse(raw) as any;
      const sede = Array.isArray(me?.sedes) ? me.sedes[0] : null;
      return Number(sede?.id || 0);
    } catch {
      return 0;
    }
  }

  private pickSunatSerie(series: SerieComprobanteModel[]): SerieComprobanteModel | null {
    const sedeId = this.getUserSedeId();
    if (!sedeId) return null;
    return (series || []).find(s => {
      const sameSede = Number(s.sede_id) === sedeId;
      const tipo = String((s as any).tipo_comprobante_sunat ?? '').trim();
      return sameSede && tipo === '31';
    }) || null;
  }

  generarGuia(item: Manifiesto) {
    this.showGuiaModal = false;
    this.showEnviosModal = false;
    this.showAddEnviosModal = false;
    const id = (item as any)?.id;
    if (!id) return;
    this.guiaGenManifiestoId = Number(id);
    this.guiaGenSerie = String(((item as any).serie || ''));
    this.guiaGenNumero = String(((item as any).numero || ''));
    this.guiaGenIsSunat = false;
    this.guiaGenTitle = `Guia del Manifiesto ${this.guiaGenSerie}-${this.guiaGenNumero}`.trim();
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

  generarGuiaSunat(item: Manifiesto) {
    this.showOnlyView('none');
    this.showEnviosModal = false;
    this.showAddEnviosModal = false;
    const id = (item as any)?.id;
    if (!id) return;
    this.guiaGenManifiestoId = Number(id);
    this.guiaGenSerie = '';
    this.guiaGenNumero = '';
    this.guiaGenIsSunat = true;
    this.guiaGenTitle = 'Guía de remisión transportista Sunat';
    this.guiaGenDespacho = null;
    this.guiaGenGuia = null;
    this.guiaGenItems = [];
    this.guiaGenEstado = '';
    this.guiaDoc = null;
    this.guiaDocNow = new Date();
    this.guiaGenError = null;
    this.guiaGenLoading = true;

    this.serieSrv.getSeries().subscribe({
      next: (series: SerieComprobanteModel[]) => {
        const sunatSerie = this.pickSunatSerie(series || []);
        if (!sunatSerie) {
          this.guiaGenLoading = false;
          this.guiaGenError = 'No se encontro serie Sunat para la sede.';
          return;
        }
        const correlativo = Number((sunatSerie as any).correlativo || 0);
        this.guiaGenSerie = String((sunatSerie as any).serie || '');
        this.guiaGenNumero = String(correlativo || '');
        this.guiaGenTitle = `Guía de remisión transportista ${this.guiaGenSerie}-${this.guiaGenNumero}`.trim();
        this.enviosSrv.getEnviosManifiesto(Number(id)).subscribe({
          next: (envs: any[]) => {
            const envios = envs || [];
            if (!envios.length) {
              this.guiaGenLoading = false;
              this.guiaGenError = 'No hay envios asociados; no se puede generar la guia.';
              return;
            }
            this.loadResumenSunatAndProcess(item, envios, sunatSerie);
          },
          error: () => {
            this.guiaGenLoading = false;
            this.guiaGenError = 'No se pudieron cargar los envios del manifiesto.';
          }
        });
      },
      error: () => {
        this.guiaGenLoading = false;
        this.guiaGenError = 'No se pudieron cargar las series Sunat.';
      }
    });
  }

  generarGRT(item: Manifiesto) {
    const manifiestoId = Number((item as any)?.id || 0);
    if (!manifiestoId) return;
    this.showOnlyView('grt');
    this.grtLoading = true;
    this.grtError = null;
    this.grtDoc = null;

    this.enviosSrv.getEnviosManifiesto(manifiestoId).subscribe({
      next: (envs: Envio[]) => {
        const envios = (envs || []) as Envio[];
        if (!envios.length) {
          this.grtLoading = false;
          this.grtError = 'No hay envíos asociados al manifiesto.';
          return;
        }
        const detalleCalls = envios.map((e: any) => this.detEnvSrv.getDetallesEnvio(Number((e as any)?.id || 0)));
        forkJoin({
          detalleList: forkJoin(detalleCalls),
          despachos: this.guiasSrv.getDespachoManifiesto(manifiestoId).pipe(catchError(() => of([] as any))),
          resumen: this.manifiestosSrv.getManifiestoResumenGuias(manifiestoId).pipe(catchError(() => of(null as any))),
        }).subscribe({
          next: ({ detalleList, despachos, resumen }) => {
            const despacho = Array.isArray(despachos) ? (despachos[0] || null) : (despachos as any);
            const grrNumeros = this.extractNumeroGuiasResumen(resumen as any);
            const detallePorEnvio: Record<number, any[]> = {};
            envios.forEach((e: any, idx: number) => {
              const eid = Number((e as any)?.id || 0);
              detallePorEnvio[eid] = (detalleList?.[idx] || []) as any[];
            });

            if (!despacho?.id) {
              this.grtDoc = this.grtBuilder.build({
                manifiesto: item,
                envios,
                detallePorEnvio,
                puntos: this.puntos || [],
                personas: this.personas || [],
                conductor: (this.conductores || []).find((c: any) => Number(c?.id || 0) === Number((item as any)?.conductor_id || 0)) || null,
                despacho: null,
                guia: null,
                itemsDespacho: [],
                grrNumerosOverride: grrNumeros,
              });
              this.grtLoading = false;
              return;
            }

            forkJoin({
              guias: this.guiasSrv.getGuiasByDespacho(Number((despacho as any).id)),
              items: this.guiasSrv.getItemsDespacho(Number((despacho as any).id)),
            }).subscribe({
              next: ({ guias, items }) => {
                const guia = (guias || [])[0] || null;
                this.grtDoc = this.grtBuilder.build({
                  manifiesto: item,
                  envios,
                  detallePorEnvio,
                  puntos: this.puntos || [],
                  personas: this.personas || [],
                  conductor: (this.conductores || []).find((c: any) => Number(c?.id || 0) === Number((item as any)?.conductor_id || 0)) || null,
                  despacho: (despacho as any) || null,
                  guia: (guia as any) || null,
                  itemsDespacho: (items || []) as any[],
                  grrNumerosOverride: grrNumeros,
                });
                this.grtLoading = false;
              },
              error: () => {
                this.grtLoading = false;
                this.grtError = 'No se pudieron consolidar guías/items del manifiesto.';
              }
            });
          },
          error: () => {
            this.grtLoading = false;
            this.grtError = 'No se pudo consolidar el manifiesto para la GRT.';
          }
        });
      },
      error: () => {
        this.grtLoading = false;
        this.grtError = 'No se pudieron cargar los envíos del manifiesto.';
      }
    });
  }

  closeGrt() {
    this.showOnlyView('none');
    this.grtLoading = false;
    this.grtError = null;
    this.grtDoc = null;
  }

  generarPublicLink(item: Manifiesto) {
    const manifiestoId = Number((item as any)?.id || 0);
    if (!manifiestoId) {
      this.showNotif('No se pudo abrir enlace: manifiesto inválido', 'error');
      return;
    }
    this.publicLinkLoading[manifiestoId] = true;
    this.publicLinkError[manifiestoId] = null;
    try {
      const url = this.router.serializeUrl(
        this.router.createUrlTree(['manifiestos/publico/id', manifiestoId])
      );
      window.open(url, '_blank', 'noopener');
    } catch {
      this.publicLinkError[manifiestoId] = 'No se pudo abrir el enlace público';
      this.showNotif('No se pudo abrir el enlace público', 'error');
    } finally {
      this.publicLinkLoading[manifiestoId] = false;
    }
  }

  closeGuiaGenerada() { this.showGuiaGeneradaModal = false; }

  downloadGuiaPdf() {
    if (!this.guiaDoc) return;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const marginX = 36;
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 40;
    const line = 14;
    const add = (text: string, bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(10);
      doc.text(text || '', marginX, y, { maxWidth: pageWidth - marginX * 2 });
      y += line;
    };
    add(`Guía: ${this.guiaDoc.fullNumber || '-'}`, true);
    add(`Emitida: ${this.guiaDoc.issuedAt || '-'}`);
    add(`Inicio traslado: ${this.guiaDoc.startDatetime || '-'}`);
    add(`Empresa: ${this.guiaDoc.companyName || '-'}`);
    add(`RUC: ${this.guiaDoc.companyRuc || '-'}`);
    add(`Origen: ${this.guiaDoc.originAddress || '-'}`);
    add(`Destino: ${this.guiaDoc.destAddress || '-'}`);
    add(`Conductor: ${this.guiaDoc.driverName || '-'}`);
    add(`Licencia: ${this.guiaDoc.driverLicense || '-'}`);
    y += 6;
    add('Items', true);
    (this.guiaDoc.items || []).forEach((it: any, idx: number) => {
      add(`${idx + 1}. ${it.description || '-'}  |  Cant: ${it.qty || 0}  |  Peso: ${it.weightKg || 0}`);
    });
    y += 6;
    add(`Total cantidad: ${this.guiaDoc.totalQty || 0}`, true);
    add(`Total peso: ${this.guiaDoc.totalWeightKg || 0}`, true);
    const fname = `guia_${(this.guiaDoc.fullNumber || 'sunat').replace(/\\s+/g, '_')}.pdf`;
    doc.save(fname);
  }

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
    addLine('FECHA IMPRESIÓN: ' + (this.guiaFechaImpresion || ''), marginX, y);

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
    const origenId = Number(this.addOrigenId || 0);
    const destinoId = Number(this.addDestinoId || 0);
    if (!origenId || !destinoId) {
      this.addEnviosLoading = false;
      this.addEnviosError = 'El manifiesto no tiene origen/destino válido';
      return;
    }
    this.enviosSrv.getEnviosPuntos(origenId, destinoId).subscribe({
      next: (res) => {
        const all = (res || []) as any[];
        this.addEnviosLista = all.filter(e => (e as any)?.manifiesto == null);
        this.addEnviosLoading = false;
      },
      error: () => { this.addEnviosLoading = false; this.addEnviosError = 'No se pudieron cargar los envíos'; }
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
        this.showNotif('Envío añadido al manifiesto');
      },
      error: () => { this.addEnviosLoading = false; this.showNotif('No se pudo añadir', 'error'); }
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
  onCancelDetach() {
    this.confirmDetachOpen = false;
    this.pendingDetachEnvioId = null;
  }
  onConfirmDetach() {
    const eid = this.pendingDetachEnvioId;
    if (!eid) { this.onCancelDetach(); return; }
    this.enviosSrv.updateEnvios(Number(eid), { manifiesto: null } as any).subscribe({
      next: () => {
        this.enviosLista = (this.enviosLista || []).filter((e: any) => e.id !== eid);
        this.onCancelDetach();
        this.showNotif('Envio removido del manifiesto');
      },
      error: () => {
        this.onCancelDetach();
        this.showNotif('No se pudo quitar el envio', 'error');
      }
    });
  }

  detachEnvioFromManifiesto(envio: Envio) {
    const eid = (envio as any)?.id;
    if (!eid) return;
    this.pendingDetachEnvioId = Number(eid);
    this.confirmDetachMessage = `¿Quitar el envío ${eid} del manifiesto?`;
    this.confirmDetachOpen = true;
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
    return String((envio as any)?.guia ?? (envio as any)?.ticket_numero ?? '-');
  }

  envioUsuario(envio: Envio | null | undefined): string {
    if (!envio) return '-';
    return String((envio as any)?.usuario_crea ?? '-');
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
    const anio = year % 100 // d.getFullYear();
    return `${day}/${month}/${anio}`;
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
        const subtotal = Number(det?.precio_total) || 0;
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

  private generateSunatGuiaForEnvios(item: Manifiesto, envios: Envio[], sunatSerie: SerieComprobanteModel) {
    let index = 0;
    let correlativo = Number((sunatSerie as any).correlativo || 0);
    const total = envios.length;
    const mid = Number((item as any)?.id || 0);
    this.sunatGenState[mid] = { total, done: 0, errors: 0, running: true, guias: [], pendingGuias: [], totalPendientesGuia: 0 };
    const runNext = () => {
      if (index >= total) {
        this.refreshSunatResumenState(item, true);
        return;
      }
      const envio = envios[index++];
      const numeroRaw = String(correlativo || '');
      this.guiaGenTitle = `Guía de remisión transportista ${this.guiaGenSerie}-${numeroRaw} (${index}/${total})`.trim();
      this.createDespachoForEnvio(item, envio, (despacho) => {
        this.createSunatGuiaAndItemsForEnvio(item, envio, despacho, sunatSerie, numeroRaw, (result) => {
          const guiaRes = result?.guia;
          if (this.sunatGenState[mid]) {
            this.sunatGenState[mid].done += 1;
            if (guiaRes) {
              const numero = String((guiaRes as any)?.numero_completo || `${(guiaRes as any)?.series || ''}-${(guiaRes as any)?.numero || ''}`).trim();
              this.sunatGenState[mid].guias.push({
                envioId: Number((envio as any)?.id || 0),
                envioTicket: String((envio as any)?.ticket_numero || '').trim(),
                guiaId: Number((guiaRes as any)?.id || 0),
                numero,
                sunatCod: result?.sunatCod || '',
                sunatMsg: result?.sunatMsg || '',
              });
              if (String(result?.sunatCod || '') === '99') {
                this.sunatGenState[mid].errors += 1;
              }
            }
          }
          correlativo += 1;
          runNext();
        }, () => {
          if (this.sunatGenState[mid]) {
            this.sunatGenState[mid].done += 1;
            this.sunatGenState[mid].errors += 1;
          }
          runNext();
        });
      });
    };
    runNext();
  }

  private createDespacho(item: Manifiesto, envios: Envio[], sunatSerie?: SerieComprobanteModel) {
    const payload = this.buildDespachoPayload(item);
    this.guiasSrv.createDespacho(payload).subscribe({
      next: (despacho) => {
        this.guiaGenDespacho = despacho;
        if (sunatSerie) {
          this.createSunatGuiaAndItems(item, envios, despacho, sunatSerie);
        } else {
          this.ensureGuiaItemsForDespacho(item, envios, despacho);
        }
      },
      error: () => {
        this.guiaGenLoading = false;
        this.guiaGenError = 'No se pudo crear el despacho.';
      }
    });
  }

  private createDespachoForEnvio(item: Manifiesto, envio: Envio, done: (despacho: DespachoRead) => void) {
    const payload = this.buildDespachoPayload(item, envio);
    this.guiasSrv.createDespacho(payload).subscribe({
      next: (despacho) => {
        this.guiaGenDespacho = despacho;
        done(despacho);
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

  private createSunatGuiaAndItems(item: Manifiesto, envios: Envio[], despacho: DespachoRead, sunatSerie: SerieComprobanteModel) {
    this.guiasSrv.getItemsDespacho(despacho.id).subscribe({
      next: (items: ItemGuia[]) => {
        const existingItems = (items || []) as ItemGuia[];
        const correlativo = Number((sunatSerie as any).correlativo || 0);
        const series = String((sunatSerie as any).serie || '');
        const payload = this.buildGuiaPayload(item, despacho.id, {
          series,
          numeroRaw: String(correlativo || ''),
          docType: 'GRT',
        });
        this.guiasSrv.createGuia(payload).subscribe({
          next: (guiaRes) => {
            this.guiaGenGuia = guiaRes as Guia;
            this.guiaGenEstado = String((despacho as any)?.estado || 'B');
            const updateSerie = () => {
              const nextCorr = (Number((sunatSerie as any).correlativo || 0) || 0) + 1;
              const body: SerieComprobanteModel = { ...sunatSerie, correlativo: nextCorr };
              this.serieSrv.updateSeries(Number((sunatSerie as any).id), body).subscribe({ next: () => {}, error: () => { this.showNotif('Guía creada, pero no se pudo actualizar la serie Sunat', 'error'); } });
            };
            if (existingItems.length) {
              this.guiaGenItems = existingItems;
              this.guiaDoc = this.buildGuiaDoc(item, despacho, guiaRes as Guia, existingItems);
              this.guiaGenLoading = false;
              this.sendGuiaToSunat(
                Number((guiaRes as any)?.id || 0),
                () => {
                  this.showNotif('Guía de remisión transportista generada');
                  updateSerie();
                }
              );
              return;
            }
            this.createItemsForDespacho(item, despacho, envios, () => {
              this.sendGuiaToSunat(
                Number((guiaRes as any)?.id || 0),
                () => {
                  this.showNotif('Guía de remisión transportista generada');
                  updateSerie();
                }
              );
            });
          },
          error: () => {
            this.guiaGenLoading = false;
            this.guiaGenError = 'No se pudo crear la guia Sunat.';
          }
        });
      },
      error: () => {
        this.guiaGenLoading = false;
        this.guiaGenError = 'No se pudieron cargar los items del despacho.';
      }
    });
  }

  private createSunatGuiaAndItemsForEnvio(
    item: Manifiesto,
    envio: Envio,
    despacho: DespachoRead,
    sunatSerie: SerieComprobanteModel,
    numeroRaw: string,
    done: (result: { guia: Guia | null; sunatCod: string; sunatMsg: string }) => void,
    onError: () => void
  ) {
    this.guiasSrv.getItemsDespacho(despacho.id).subscribe({
      next: (items: ItemGuia[]) => {
        const existingItems = (items || []) as ItemGuia[];
        const series = String((sunatSerie as any).serie || '');
        const payload = this.buildGuiaPayload(item, despacho.id, {
          series,
          numeroRaw,
          docType: 'GRT',
        });
        this.guiasSrv.createGuia(payload).subscribe({
          next: (guiaRes) => {
            this.guiaGenGuia = guiaRes as Guia;
            this.guiaGenEstado = String((despacho as any)?.estado || 'B');
            if (existingItems.length) {
              this.guiaGenItems = existingItems;
              this.guiaDoc = this.buildGuiaDoc(item, despacho, guiaRes as Guia, existingItems);
              this.sendGuiaToSunat(Number((guiaRes as any)?.id || 0), (sunatCod, sunatMsg) => {
                done({ guia: guiaRes as Guia, sunatCod, sunatMsg });
              });
              return;
            }
            this.createItemsForDespacho(item, despacho, [envio], () => {
              this.sendGuiaToSunat(Number((guiaRes as any)?.id || 0), (sunatCod, sunatMsg) => {
                done({ guia: guiaRes as Guia, sunatCod, sunatMsg });
              });
            });
          },
          error: () => {
            this.guiaGenLoading = false;
            this.guiaGenError = 'No se pudo crear la guia Sunat.';
            onError();
          }
        });
      },
      error: () => {
        this.guiaGenLoading = false;
        this.guiaGenError = 'No se pudieron cargar los items del despacho.';
        onError();
      }
    });
  }

  sunatProgress(mid: number): number {
    const st = this.sunatGenState[mid];
    if (!st || !st.total) return 0;
    return Math.round((st.done / st.total) * 100);
  }

  toggleSunatGuias(mid: number) {
    this.sunatGuiasOpenId = this.sunatGuiasOpenId === mid ? null : mid;
  }

  private sendGuiaToSunat(guiaId: number, done: (sunatCod: string, sunatMsg: string) => void) {
    if (!guiaId) {
      done('', 'No se encontro identificador de guía para enviar a SUNAT.');
      return;
    }
    this.guiasSrv.sunatSendGuia(guiaId).subscribe({
      next: (res: any) => {
        done(String((res as any)?.sunat_cod ?? ''), String((res as any)?.sunat_msg ?? ''));
      },
      error: () => {
        done('', 'No se pudo obtener respuesta de SUNAT.');
      }
    });
  }

  private loadResumenSunatAndProcess(item: Manifiesto, envios: Envio[], sunatSerie: SerieComprobanteModel) {
    const mid = Number((item as any)?.id || 0);
    if (!mid) return;
    this.manifiestosSrv.getManifiestoResumenGuias(mid).subscribe({
      next: (resumen: ManifiestoGuiasSunatResumenRead) => {
        const ticketByEnvio = this.buildTicketByEnvioMap(envios);
        const pendingToGenerate = this.resolvePendingEnviosForGeneration(item, resumen, envios);
        const totalGuias = Number((resumen as any)?.total_guias || 0);
        const totalPendientes = Number((resumen as any)?.total_envios_pendientes_guia || 0);
        if (!totalGuias) {
          this.generateSunatGuiaForEnvios(item, envios, sunatSerie);
          return;
        }
        this.hydrateSunatStateFromResumen(mid, resumen, true, ticketByEnvio);
        if (totalPendientes > 0 && pendingToGenerate.length) {
          this.generateSunatGuiaForEnvios(item, pendingToGenerate, sunatSerie);
          return;
        }
        const pending = ((resumen as any)?.guias_no_emitidas || []) as ManifiestoGuiaSunatEstadoRead[];
        if (!pending.length) {
          this.guiaGenLoading = false;
          if (this.sunatGenState[mid]) this.sunatGenState[mid].running = false;
          this.showNotif('Las guías ya se encuentran emitidas');
          return;
        }
        this.emitPendingGuiasFromResumen(mid, pending, () => this.refreshSunatResumenState(item, true));
      },
      error: () => {
        // Fallback: si falla resumen, conservar flujo actual de generación.
        this.generateSunatGuiaForEnvios(item, envios, sunatSerie);
      }
    });
  }

  private emitPendingGuiasFromResumen(mid: number, pending: ManifiestoGuiaSunatEstadoRead[], done: () => void) {
    let idx = 0;
    const list = pending || [];
    const runNext = () => {
      if (idx >= list.length) {
        done();
        return;
      }
      const current: any = list[idx++];
      const guiaId = Number(current?.guia_id || 0);
      this.sendGuiaToSunat(guiaId, (sunatCod, sunatMsg) => {
        const st = this.sunatGenState[mid];
        if (st) {
          st.done += 1;
          const hit = (st.guias || []).find((g) => Number(g.guiaId || 0) === guiaId);
          if (hit) {
            hit.sunatCod = String(sunatCod || '');
            hit.sunatMsg = String(sunatMsg || '');
          }
          if (String(sunatCod || '') === '99' || !String(sunatCod || '').trim()) st.errors += 1;
        }
        runNext();
      });
    };
    runNext();
  }

  private refreshSunatResumenState(item: Manifiesto, showNotifDone = false) {
    const mid = Number((item as any)?.id || 0);
    if (!mid) return;
    forkJoin({
      resumen: this.manifiestosSrv.getManifiestoResumenGuias(mid),
      envios: this.enviosSrv.getEnviosManifiesto(mid).pipe(catchError(() => of([] as Envio[]))),
    }).subscribe({
      next: ({ resumen, envios }) => {
        this.hydrateSunatStateFromResumen(mid, resumen as ManifiestoGuiasSunatResumenRead, false, this.buildTicketByEnvioMap((envios || []) as Envio[]));
        this.guiaGenLoading = false;
        if (showNotifDone) this.showNotif('Proceso de guías actualizado');
      },
      error: () => {
        this.guiaGenLoading = false;
        if (this.sunatGenState[mid]) this.sunatGenState[mid].running = false;
      }
    });
  }

  private refreshSunatResumenStateById(mid: number, showNotifDone = false) {
    if (!mid) return;
    const item = (this.lista_manifiestos || []).find((m: any) => Number((m as any)?.id || 0) === mid) as Manifiesto | undefined;
    if (!item) return;
    this.refreshSunatResumenState(item, showNotifDone);
  }

  private hydrateSunatStateFromResumen(mid: number, resumen: ManifiestoGuiasSunatResumenRead, running: boolean, ticketByEnvio?: Record<number, string>) {
    const emitted = (((resumen as any)?.guias_emitidas || []) as ManifiestoGuiaSunatEstadoRead[])
      .map((g) => this.mapResumenGuiaToSunatItem(g, ticketByEnvio));
    const notEmitted = (((resumen as any)?.guias_no_emitidas || []) as ManifiestoGuiaSunatEstadoRead[])
      .map((g) => this.mapResumenGuiaToSunatItem(g, ticketByEnvio));
    const pendingGuias = this.extractPendingGuiasFromResumen(resumen, ticketByEnvio);
    const guias = [...emitted, ...notEmitted]
      .sort((a, b) => Number(a.envioId || 0) - Number(b.envioId || 0));
    const total = Math.max(Number((resumen as any)?.total_envios || 0), Number((resumen as any)?.total_guias || 0), guias.length);
    const totalPendientesGuia = Math.max(Number((resumen as any)?.total_envios_pendientes_guia || 0), pendingGuias.length);
    const errors = guias.filter((g) => String(g.sunatCod || '') === '99').length;
    this.sunatGenState[mid] = {
      total,
      done: Math.max(Number((resumen as any)?.total_guias_emitidas || 0), guias.filter((g) => String(g.sunatCod || '').trim() === '0').length),
      errors,
      running,
      guias,
      pendingGuias,
      totalPendientesGuia,
    };
  }

  private extractPendingGuiasFromResumen(resumen: ManifiestoGuiasSunatResumenRead, ticketByEnvio?: Record<number, string>): SunatPendingGuiaItem[] {
    const rawList = this.getPendingGuiasRawList(resumen);
    const mapped = rawList
      .map((p: any) => {
        const envioId = Number((p as any)?.envio_id || (p as any)?.id || 0);
        if (!envioId) return null;
        return {
          envioId,
          envioTicket: String((p as any)?.ticket_numero || ticketByEnvio?.[envioId] || '').trim(),
          fechaEnvio: String((p as any)?.fecha_envio || '').trim(),
          origenNombre: String((p as any)?.origen_nombre || '').trim(),
          destinoNombre: String((p as any)?.destino_nombre || '').trim(),
          motivo: String((p as any)?.motivo || '').trim(),
        } as SunatPendingGuiaItem;
      })
      .filter((x): x is SunatPendingGuiaItem => !!x);
    const unique = new Map<number, SunatPendingGuiaItem>();
    mapped.forEach((row) => unique.set(Number(row.envioId || 0), row));
    return Array.from(unique.values()).sort((a, b) => Number(a.envioId || 0) - Number(b.envioId || 0));
  }

  private getPendingGuiasRawList(resumen: ManifiestoGuiasSunatResumenRead): ManifiestoEnvioPendienteGuiaRead[] {
    const singular = ((resumen as any)?.envios_pendientes_guia || []) as ManifiestoEnvioPendienteGuiaRead[];
    const plural = ((resumen as any)?.envios_pendientes_guias || []) as ManifiestoEnvioPendienteGuiaRead[];
    return [...(singular || []), ...(plural || [])];
  }

  private resolvePendingEnviosForGeneration(item: Manifiesto, resumen: ManifiestoGuiasSunatResumenRead, envios: Envio[]): Envio[] {
    const pendingRaw = this.getPendingGuiasRawList(resumen);
    const enviosById = new Map<number, Envio>();
    (envios || []).forEach((e: any) => {
      const id = Number((e as any)?.id || 0);
      if (id) enviosById.set(id, e as Envio);
    });
    if (pendingRaw.length) {
      const result: Envio[] = [];
      pendingRaw.forEach((row: any) => {
        const envioId = Number((row as any)?.envio_id || (row as any)?.id || 0);
        if (!envioId) return;
        const fromList = enviosById.get(envioId);
        if (fromList) {
          result.push(fromList);
          return;
        }
        result.push({
          id: envioId,
          ticket_numero: String((row as any)?.ticket_numero || ''),
          fecha_envio: String((row as any)?.fecha_envio || ''),
          punto_origen_id: Number((row as any)?.punto_origen_id || this.safeOrigen(item as any) || 0),
          punto_destino_id: Number((row as any)?.punto_destino_id || this.safeDestino(item as any) || 0),
          peso: 0,
        } as any);
      });
      const unique = new Map<number, Envio>();
      result.forEach((e: any) => unique.set(Number((e as any)?.id || 0), e));
      return Array.from(unique.values()).filter((e: any) => Number((e as any)?.id || 0) > 0);
    }
    const totalPendientes = Number((resumen as any)?.total_envios_pendientes_guia || 0);
    if (totalPendientes <= 0) return [];
    const withGuia = new Set<number>();
    const allGuias = [
      ...(((resumen as any)?.guias_emitidas || []) as any[]),
      ...(((resumen as any)?.guias_no_emitidas || []) as any[]),
    ];
    allGuias.forEach((g: any) => {
      const envioId = Number((g as any)?.envio_id || 0);
      if (envioId) withGuia.add(envioId);
    });
    return (envios || []).filter((e: any) => {
      const id = Number((e as any)?.id || 0);
      return id > 0 && !withGuia.has(id);
    });
  }

  private mapResumenGuiaToSunatItem(g: ManifiestoGuiaSunatEstadoRead, ticketByEnvio?: Record<number, string>): SunatGuiaItem {
    const envioId = Number((g as any)?.envio_id || 0);
    return {
      envioId,
      envioTicket: String(ticketByEnvio?.[envioId] || '').trim(),
      guiaId: Number((g as any)?.guia_id || 0),
      numero: String((g as any)?.numero_guia || ''),
      sunatCod: String((g as any)?.sunat_cod ?? ''),
      sunatMsg: String((g as any)?.sunat_msg ?? ''),
    };
  }

  private buildTicketByEnvioMap(envios: Envio[]): Record<number, string> {
    const map: Record<number, string> = {};
    (envios || []).forEach((e: any) => {
      const id = Number((e as any)?.id || 0);
      if (!id) return;
      map[id] = String((e as any)?.ticket_numero || '').trim();
    });
    return map;
  }

  generarGuiaSunatPendiente(item: Manifiesto, envioId: number) {
    const mid = Number((item as any)?.id || 0);
    const eid = Number(envioId || 0);
    if (!mid || !eid) return;
    this.showOnlyView('none');
    this.showEnviosModal = false;
    this.showAddEnviosModal = false;
    this.sunatPendingCreateLoading[eid] = true;
    this.guiaGenManifiestoId = mid;
    this.guiaGenIsSunat = true;
    this.guiaGenError = null;
    this.guiaGenLoading = true;
    forkJoin({
      series: this.serieSrv.getSeries(),
      envios: this.enviosSrv.getEnviosManifiesto(mid),
    }).subscribe({
      next: ({ series, envios }) => {
        const sunatSerie = this.pickSunatSerie((series || []) as SerieComprobanteModel[]);
        if (!sunatSerie) {
          this.sunatPendingCreateLoading[eid] = false;
          this.guiaGenLoading = false;
          this.guiaGenError = 'No se encontro serie Sunat para la sede.';
          return;
        }
        const list = (envios || []) as Envio[];
        const target = list.find((e: any) => Number((e as any)?.id || 0) === eid);
        if (!target) {
          this.sunatPendingCreateLoading[eid] = false;
          this.guiaGenLoading = false;
          this.guiaGenError = 'No se encontró el envío pendiente dentro del manifiesto.';
          return;
        }
        const correlativo = Number((sunatSerie as any).correlativo || 0);
        this.guiaGenSerie = String((sunatSerie as any).serie || '');
        this.guiaGenNumero = String(correlativo || '');
        this.guiaGenTitle = `Guía de remisión transportista ${this.guiaGenSerie}-${this.guiaGenNumero}`.trim();
        this.generateSunatGuiaForEnvios(item, [target], sunatSerie);
        this.sunatPendingCreateLoading[eid] = false;
      },
      error: () => {
        this.sunatPendingCreateLoading[eid] = false;
        this.guiaGenLoading = false;
        this.guiaGenError = 'No se pudieron cargar datos para generar la guía pendiente.';
      }
    });
  }

  retryEmitSunatGuia(mid: number, guiaId: number) {
    const guia = Number(guiaId || 0);
    const manifiestoId = Number(mid || 0);
    if (!guia || !manifiestoId) return;
    this.sunatRetryLoading[guia] = true;
    this.sendGuiaToSunat(guia, () => {
      this.sunatRetryLoading[guia] = false;
      this.refreshSunatResumenStateById(manifiestoId, true);
    });
  }

  sunatEstadoByCod(cod?: string | number | null): SunatGuiaEstado {
    const raw = String(cod ?? '').trim();
    if (raw === '0') return 'aceptado';
    if (raw === '99') return 'rechazado';
    return 'pendiente';
  }

  sunatEstadoLabel(cod?: string | number | null): string {
    const estado = this.sunatEstadoByCod(cod);
    if (estado === 'aceptado') return 'SUNAT Aceptado';
    if (estado === 'rechazado') return 'SUNAT Rechazado';
    return 'SUNAT Pendiente';
  }

  sunatEstadoClass(cod?: string | number | null): string {
    const estado = this.sunatEstadoByCod(cod);
    if (estado === 'aceptado') return 'bg-emerald-100 text-emerald-700';
    if (estado === 'rechazado') return 'bg-red-100 text-red-700';
    return 'bg-amber-100 text-amber-700';
  }

  private buildGuiaDocFromTrama(trama: GuiaTramaFinal) {
    const guia = (trama as any)?.guia || {};
    const despacho = (trama as any)?.despacho || {};
    const envio = (trama as any)?.envio || {};
    const conductor = (trama as any)?.conductor || null;
    const vehiculo = (trama as any)?.vehiculo || null;
    const companyName = String(localStorage.getItem('razon_social') || this.authSrv.getCompania() || '').trim();
    const companyRuc = String(localStorage.getItem('ruc') || '').trim();
    const items = (trama as any)?.items || [];
    const mappedItems = (items || []).map((it: any) => ({
      sku: `ENV-${envio?.id ?? ''}-${it?.numero_item ?? ''}`.trim(),
      description: String(it?.descripcion ?? ''),
      uom: 'UND',
      qty: Number(it?.cantidad) || 0,
      lot: '',
      weightKg: Number(envio?.peso) || 0,
    }));
    const totalQty = mappedItems.reduce((acc: number, it: any) => acc + (Number(it.qty) || 0), 0);
    const totalWeightKg = mappedItems.reduce((acc: number, it: any) => acc + (Number(it.weightKg) || 0), 0);
    const fullNumber = String(guia?.numero_completo || `${guia?.series || ''}-${guia?.numero || ''}`).trim();
    const hashSha = String(guia?.hash_sha || '');
    const persona = (conductor as any)?.persona || {};
    const origenId = Number((envio as any)?.punto_origen_id || 0) || null;
    const destinoId = Number((envio as any)?.punto_destino_id || 0) || null;
    const originName = this.nameFrom(origenId);
    const destName = this.nameFrom(destinoId);
    const originAddress = this.addressFrom(origenId) || String(despacho?.origen_direccion || '').trim();
    const destAddress = this.addressFrom(destinoId) || String(despacho?.destino_direccion || '').trim();
    return {
      fullNumber,
      issuedAt: guia?.emitido_en || null,
      startDatetime: despacho?.inicio || null,
      qrDataUrl: this.qrSrc(guia?.qr),
      verifyUrl: '',
      companyName: companyName || '-',
      companyRuc: companyRuc || '-',
      transferReason: despacho?.razon_transferencia || '',
      notes: despacho?.notas || '',
      originUbigeo: despacho?.origen_ubigeo || '',
      originName: originName || '',
      originAddress: originAddress || '',
      destUbigeo: despacho?.destino_ubigeo || '',
      destName: destName || '',
      destAddress: destAddress || '',
      vehiclePlate: vehiculo?.placa || '',
      trailerPlate: '',
      driverName: [persona?.nombre, persona?.apellido].filter(Boolean).join(' ').trim() || persona?.razon_social || '-',
      driverDocType: persona?.tipo_documento || '',
      driverDocNumber: persona?.nro_documento || '',
      driverLicense: (conductor as any)?.licencia || '',
      hashShort: hashSha ? hashSha.slice(0, 12) + '...' : '',
      issuedBy: this.authSrv.getUserLabel() || '',
      items: mappedItems,
      totalQty,
      totalWeightKg,
      hashSha256: hashSha,
    };
  }

  qrSrc(raw?: string): string {
    const value = String(raw || '').trim();
    if (!value) return '';
    if (value.startsWith('data:image')) return value;
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    return `data:image/png;base64,${value}`;
  }

  verGuiaTrama(envioId: number) {
    this.showOnlyView('grr');
    this.guiaGenLoading = true;
    this.guiaGenError = null;
    this.guiaDoc = null;
    this.guiaGenIsSunat = true;
    this.guiaGenTitle = 'Guía de remisión transportista';
    this.guiasSrv.getTramaGuia(envioId).subscribe({
      next: (trama: GuiaTramaFinal) => {
        this.guiaGenLoading = false;
        this.guiaGenDespacho = (trama as any)?.despacho || null;
        this.guiaGenEstado = String((trama as any)?.despacho?.estado || 'B');
        const numero = String((trama as any)?.guia?.numero_completo || '').trim();
        if (numero) this.guiaGenTitle = `Guía de remisión transportista ${numero}`;
        this.guiaDoc = this.buildGuiaDocFromTrama(trama);
      },
      error: () => {
        this.guiaGenLoading = false;
        this.guiaGenError = 'No se pudo cargar la guía';
      }
    });
  }

  private createItemsForDespacho(item: Manifiesto, despacho: DespachoRead, envios: Envio[], afterCreated?: () => void) {
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
            if (afterCreated) afterCreated();
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

  private buildDespachoPayload(item: Manifiesto, envio?: Envio): any {
    const origenId = envio?.punto_origen_id ?? this.safeOrigen(item as any);
    const destinoId = envio?.punto_destino_id ?? this.safeDestino(item as any);
    const serie = String((item as any)?.serie || '');
    const numero = String((item as any)?.numero || '');
    const me: any = localStorage.getItem('me');

    console.log(me.id);
    return {
      manifiesto_id: envio ? null : Number((item as any)?.id),
      envio_id: envio ? Number((envio as any)?.id) : null,
      estado: 'B',
      compania_id: Number(this.authSrv.getCompaniaId() || 0),
      origen_ubigeo: this.ubigeoFrom(origenId),
      origen_direccion: this.addressFrom(origenId) || this.nameFrom(origenId),
      destino_ubigeo: this.ubigeoFrom(destinoId),
      destino_direccion: this.addressFrom(destinoId) || this.nameFrom(destinoId),
      razon_transferencia: envio ? `Envio ${envio?.ticket_numero ?? ''}`.trim() : `Manifiesto ${serie}-${numero}`.trim(),
      inicio: this.utilSrv.formatFecha(new Date()),
      aprobado_by: Number(me.id),
      notas: '',
    };
  }

  private buildGuiaPayload(item: Manifiesto, despachoId: number, opts?: { series?: string; numeroRaw?: string; docType?: string }): any {
    const series = String(opts?.series ?? (item as any)?.serie ?? '');
    const numeroRaw = String(opts?.numeroRaw ?? (item as any)?.numero ?? '');
    const numero = String(numeroRaw.replace(/\D+/g, '')) || 0;
    const numeroCompleto = [series, numeroRaw].filter(Boolean).join('-');
    return {
      despacho_id: Number(despachoId),
      doc_type: String(opts?.docType || 'GRTI'),
      series,
      numero,
      numero_completo: numeroCompleto,
      emitido_en: this.utilSrv.formatFecha(new Date()),
    };
  }

  private extractNumeroGuiasResumen(resumen: ManifiestoGuiasSunatResumenRead | null | undefined): string[] {
    const all = [
      ...(((resumen as any)?.guias_emitidas || []) as any[]),
      ...(((resumen as any)?.guias_no_emitidas || []) as any[]),
    ];
    return Array.from(new Set(all.map((g: any) => String(g?.numero_guia || '').trim()).filter(Boolean)));
  }

  private getCurrentMe(): any | null {
    try {
      const raw = localStorage.getItem('me');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  private getLoggedUserLabel(): string {
    const me = this.getCurrentMe();
    const fullName = String(
      me?.nombre_completo ||
      me?.full_name ||
      me?.name ||
      me?.username ||
      me?.email ||
      ''
    ).trim();
    return fullName || '-';
  }

  private getRoleNames(): string[] {
    const me = this.getCurrentMe();
    const roles = Array.isArray(me?.roles) ? me.roles : [];
    return roles.map((r: any) => String(r?.name ?? r?.nombre ?? r?.rol ?? r?.role ?? r).toLowerCase().trim());
  }

  private hasRole(...targetRoles: string[]): boolean {
    const roleNames = this.getRoleNames();
    return targetRoles.some((role) => roleNames.includes(role));
  }

  private getUserPuntoId(): number {
    const me = this.getCurrentMe();
    const sede = Array.isArray(me?.sedes) ? me.sedes[0] : null;
    return Number(sede?.id || 0);
  }

  private useManifiestoPuntoEndpoint(): boolean {
    const puntoId = this.getUserPuntoId();
    if (puntoId <= 0) return false;
    return this.hasRole('operario', 'adm_sede', 'admin_sede');
  }

  private useEnviosSedeEndpoint(): boolean {
    const puntoId = this.getUserPuntoId();
    if (puntoId <= 0) return false;
    return this.hasRole('adm_sede', 'admin_sede');
  }

  private getEnviosByRole() {
    const puntoId = this.getUserPuntoId();
    if (this.useEnviosSedeEndpoint()) {
      return this.enviosSrv.getEnviosSede(puntoId);
    }
    return this.enviosSrv.getEnvios();
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
    const origenId = Number((item as any)?.codigo_punto_origen || 0) || null;
    const destinoId = Number((item as any)?.codigo_punto_destino || 0) || null;
    const originName = this.nameFrom(origenId);
    const destName = this.nameFrom(destinoId);
    const originAddress = this.addressFrom(origenId) || String(despacho?.origen_direccion || '').trim();
    const destAddress = this.addressFrom(destinoId) || String(despacho?.destino_direccion || '').trim();
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
      originName: originName || '',
      originAddress: originAddress || '',
      destUbigeo: despacho?.destino_ubigeo || '',
      destName: destName || '',
      destAddress: destAddress || '',
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
