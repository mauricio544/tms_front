import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DetalleMovimientos } from '../../../../core/services/detalle-movimientos';
import { Movimientos } from '../../../../core/services/movimientos';
import { Personas } from '../../../../core/services/personas';
import { Generales } from '../../../../core/services/generales';
import { DetalleFull as Detalle, CabeceraCreate, DetalleCreate, Persona, General } from '../../../../core/mapped';

@Component({
  selector: 'feature-gastos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gastos.html',
  styleUrl: './gastos.css',
})
export class GastosFeature implements OnInit {
  private readonly detalleSrv = inject(DetalleMovimientos);
  private readonly movimientosSrv = inject(Movimientos);
  private readonly personasSrv = inject(Personas);
  private readonly generalesSrv = inject(Generales);

  loading = false;
  error: string | null = null;
  detalles: Detalle[] = [];

  // Filtro
  search = '';
  selectedDate: string | null = null;

  // Paginación
  page = 1;
  pageSize = 10;
  get total(): number { return this.filtered.length; }
  get totalPages(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }
  get pageStart(): number { return this.total ? (this.page - 1) * this.pageSize + 1 : 0; }
  get pageEnd(): number { return Math.min(this.page * this.pageSize, this.total); }
  get pageItems(): Detalle[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filtered.slice(start, start + this.pageSize);
  }
  setPage(n: number) { this.page = Math.min(Math.max(1, n), this.totalPages); }
  onFilterChange() { this.page = 1; }

  ngOnInit(): void {
    this.load();
    this.loadPersonas();
    this.loadGenerales();
  }

  get filtered(): Detalle[] {
    const term = (this.search || '').trim().toLowerCase();
    const list = (this.detalles || []).slice().sort((a: any, b: any) => (b?.id ?? 0) - (a?.id ?? 0));
    if (!term) return list;
    return list.filter((d: any) => {
      const txt = [d?.id, d?.tipo_comprobante, d?.numero_comprobante, d?.descripcion, d?.tipo_gasto, d?.cabecera_id, d?.monto]
        .map(x => String(x ?? '')).join(' ').toLowerCase();
      return txt.includes(term);
    });
  }

  get totalNeto(): number {
    return (this.filtered || []).reduce((acc: number, it: any) => {
      const sign = ((it.cabecera?.tipo_movimiento || "") === "E") ? -1 : 1;
      return acc + sign * Number(it.monto || 0);
    }, 0);
  }
  get totalIngresos(): number {
    return (this.filtered || []).reduce((acc: number, it: any) => acc + (((it.cabecera?.tipo_movimiento || '') === 'I') ? Number(it.monto || 0) : 0), 0);
  }

  get totalEgresos(): number {
    return (this.filtered || []).reduce((acc: number, it: any) => acc + (((it.cabecera?.tipo_movimiento || '') === 'E') ? Number(it.monto || 0) : 0), 0);
  }


  load() {
    this.loading = true;
    this.error = null;
    this.detalleSrv.getDetallesListFull().subscribe({
      next: (res) => { this.detalles = res || []; this.loading = false; },
      error: () => { this.loading = false; this.error = 'No se pudieron cargar los movimientos'; }
    });
  }

  // Exportaci�n CSV (todos los registros filtrados)
  exportCSV() {
    const rows = this.filtered;
    const headers = ['ID','Tipo Comprobante','N° Comprobante','Descripción','Tipo Gasto','Monto','Cabecera ID'];
    const toCell = (v: any) => {
      const s = String(v ?? '');
      if (s.includes(';') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const lines = [headers.join(';')].concat(rows.map((it: any) => [
      it?.id,
      it?.tipo_comprobante,
      it?.numero_comprobante,
      it?.descripcion ?? '',
      it?.tipo_gasto ?? '',
      it?.monto ?? '',
      it?.cabecera_id,
    ].map(toCell).join(';')));
    const payload = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([payload], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'movimientos.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Modal: agregar movimiento
  showAddModal = false;
  savingAdd = false;
  addError: string | null = null;
  cabeceraForm: Partial<CabeceraCreate> = { tipo_movimiento: 'I', monto: undefined as any } as any;
  detalleForm: Partial<DetalleCreate> = { tipo_comprobante: undefined as any, numero_comprobante: '', descripcion: '', tipo_gasto: undefined, monto: undefined as any } as any;

  get isValidAdd(): boolean {
    const c: any = this.cabeceraForm;
    const d: any = this.detalleForm;
    const okTM = String(c.tipo_movimiento || '').trim().length > 0;
    const okMonto = Number(c.monto) > 0;
    const okTipoC = Number(d.tipo_comprobante) >= 0;
    const okNumC = String(d.numero_comprobante || '').trim().length > 0;
    const okMontoDet = Number(d.monto ?? c.monto) > 0;
    return okTM && okMonto && okTipoC && okNumC && okMontoDet;
  }

  openAddMovimiento() {
    this.showAddModal = true;
    this.savingAdd = false;
    this.addError = null;
    this.cabeceraForm = { tipo_movimiento: 'I', monto: undefined as any } as any;
    this.detalleForm = { tipo_comprobante: undefined as any, numero_comprobante: '', descripcion: '', tipo_gasto: undefined, monto: undefined as any } as any;
    this.personaQuery = '';
    this.showPersonaOptions = false;
  }

  closeAddMovimiento() { this.showAddModal = false; }

  submitAddMovimiento() {
    if (!this.isValidAdd || this.savingAdd) return;
    const c: any = this.cabeceraForm;
    const d: any = this.detalleForm;
    const cabBody: any = {
      tipo_movimiento: String(c.tipo_movimiento),
      monto: Number(c.monto),
      persona_id: c.persona_id != null ? Number(c.persona_id) : undefined,
      placa: String(c.placa || '').trim() || undefined,
      autorizado: c.autorizado != null ? Number(c.autorizado) : undefined,
      manifiesto_id: c.manifiesto_id != null ? Number(c.manifiesto_id) : undefined,
    };
    this.savingAdd = true;
    this.addError = null;
    this.movimientosSrv.createMovimientos(cabBody).subscribe({
      next: (cab: any) => {
        const cabId = (cab as any)?.id;
        if (!cabId) { this.savingAdd = false; this.addError = 'No se obtuvo ID de cabecera'; return; }
        const detBody: any = {
          tipo_comprobante: Number(d.tipo_comprobante),
          numero_comprobante: String(d.numero_comprobante || '').trim(),
          descripcion: (String(d.descripcion || '').trim() || null) as any,
          tipo_gasto: d.tipo_gasto != null ? Number(d.tipo_gasto) : null,
          monto: Number(d.monto != null ? d.monto : cabBody.monto),
          cabecera_id: Number(cabId),
        };
        this.detalleSrv.createDetalles(detBody).subscribe({
          next: () => {
            this.savingAdd = false;
            this.showAddModal = false;
            this.load();
          },
          error: () => { this.savingAdd = false; this.addError = 'No se pudo crear el detalle'; }
        });
      },
      error: () => { this.savingAdd = false; this.addError = 'No se pudo crear la cabecera'; }
    });
  }

  // Personas
  personas: Persona[] = [];
  personasLoading = false;
  personaQuery = '';
  showPersonaOptions = false;
  personasError: string | null = null;
  personaLabel(p: Persona): string {
    const nombre = [p.nombre, p.apellido].filter(Boolean).join(' ').trim();
    const razon = (p.razon_social || '').trim();
    const base = (razon || nombre || '').trim();
    const doc = (p.nro_documento || '').trim();
    return [base, doc].filter(Boolean).join(' - ');
  }
  get filteredPersonas(): Persona[] {
    const q = (this.personaQuery || '').toLowerCase().trim();
    const list = this.personas || [];
    if (!q) return list.slice(0, 10);
    return list.filter(p => this.personaLabel(p).toLowerCase().includes(q)).slice(0, 10);
  }
  selectPersona(p: Persona) {
    (this.cabeceraForm as any).persona_id = (p as any).id;
    this.personaQuery = this.personaLabel(p);
    this.showPersonaOptions = false;
  }
  clearPersona() { (this.cabeceraForm as any).persona_id = undefined; this.personaQuery = ''; }
  loadPersonas() {
    this.personasLoading = true;
    this.personasError = null;
    this.personasSrv.getPersonas().subscribe({
      next: (res) => { this.personas = res || []; this.personasLoading = false; },
      error: () => { this.personasLoading = false; this.personasError = 'No se pudieron cargar personas'; }
    });
  }

    onDateChange() {
      const d = (this.selectedDate || '').trim();
      this.page = 1;
      if (!d) { this.load(); return; }
      this.loading = true; this.error = null;
      const param = 'fecha=' + encodeURIComponent(d);
      this.detalleSrv.getDetallesByFecha(param).subscribe({
        next: (res) => { this.detalles = res || []; this.loading = false; },
        error: () => { this.loading = false; this.error = 'No se pudieron cargar los movimientos por fecha'; }
      });
    }

    clearDate() {
      this.selectedDate = null;
      this.page = 1;
      this.load();
    }

  // Generales
  generales: General[] = [];
  tiposComprobante: General[] = [];
  loadGenerales() {
    this.generalesSrv.getGenerales().subscribe({
      next: (gs: General[]) => {
        this.generales = gs || [];
        this.tiposComprobante = (this.generales || []).filter(g => Number((g as any).codigo_principal) === 1);
      },
      error: () => { /* no-op */ }
    });
  }
}











