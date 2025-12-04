import { Component, OnInit, inject } from '@angular/core';
import jsPDF from 'jspdf';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Envios } from '../../../../core/services/envios';
import { DetalleMovimientos } from '../../../../core/services/detalle-movimientos';
import { Personas } from '../../../../core/services/personas';
import { Puntos } from '../../../../core/services/puntos';
import { Envio, DetalleFull as Detalle, Persona, Puntos as Punto } from '../../../../core/mapped';

@Component({
  selector: 'feature-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportes.html',
  styleUrl: './reportes.css',
})
export class ReportesFeature implements OnInit {
  fromDate: string = '';
  toDate: string = '';
  private readonly enviosSrv = inject(Envios);
  private readonly detalleSrv = inject(DetalleMovimientos);
  private readonly personasSrv = inject(Personas);
  private readonly puntosSrv = inject(Puntos);

  loading = false;
  error: string | null = null;

  envios: Envio[] = [];
  movimientos: Detalle[] = [];
  personas: Persona[] = [];
  puntos: Punto[] = [];

  // Leaflet map state
  private leafletPromise: Promise<void> | null = null;
  leafletReady = false;
  leafletLoading = false;
  map: any = null;
  originsLayer: any = null;
  destLayer: any = null;

  ngOnInit(): void {
    this.load();
  }

  load() {
    this.loading = true;
    this.error = null;
    let enviosLoaded = false, movsLoaded = false, personasLoaded = false, puntosLoaded = false;
    const done = () => {
      if (enviosLoaded && movsLoaded && personasLoaded && puntosLoaded) {
        this.loading = false;
        this.setupMapIfReady();
      }
    };
    this.enviosSrv.getEnvios().subscribe({
      next: (res) => { this.envios = res || []; enviosLoaded = true; done(); },
      error: () => { this.error = 'No se pudieron cargar los envíos'; enviosLoaded = true; done(); }
    });
    this.detalleSrv.getDetallesListFull().subscribe({
      next: (res) => { this.movimientos = res || []; movsLoaded = true; done(); },
      error: () => { this.error = (this.error || ''); this.error += (this.error? ' · ' : '') + 'No se pudieron cargar los movimientos'; movsLoaded = true; done(); }
    });
    this.personasSrv.getPersonas().subscribe({
      next: (res) => { this.personas = res || []; personasLoaded = true; done(); },
      error: () => { this.personas = []; personasLoaded = true; done(); }
    });
    this.puntosSrv.getPuntos().subscribe({
      next: (res) => { this.puntos = res || []; puntosLoaded = true; done(); },
      error: () => { this.puntos = []; puntosLoaded = true; done(); }
    });
  }

  // Helpers de etiquetas
  personaLabelById(id: number | null | undefined): string {
    if (!id) return '';
    const f = (this.personas || []).find((p:any) => Number(p.id) === Number(id));
    if (!f) return String(id);
    const nombre = [f?.nombre, f?.apellido].filter(Boolean).join(' ').trim();
    const razon = (f?.razon_social || '').trim();
    const base = (razon || nombre || '').trim();
    const doc = (f?.nro_documento || '').trim();
    return [base, doc].filter(Boolean).join(' - ');
  }
  puntoNombre(id: number | null | undefined): string {
    if (!id) return '';
    const f = (this.puntos || []).find((pp:any) => Number(pp.id) === Number(id));
    return (f as any)?.nombre || String(id);
  }
  puntoCoord(id: number | null | undefined): {lat:number,lng:number} | null {
    if (!id) return null;
    const f: any = (this.puntos || []).find((pp:any) => Number(pp.id) === Number(id));
    if (!f) return null;
    const lat = Number((f.lat ?? f.latitude));
    const lng = Number((f.lng ?? f.longitud ?? f.longitude));
    if (isFinite(lat) && isFinite(lng)) return { lat, lng };
    return null;
  }

  // KPIs env�os
  get filteredEnvios(): Envio[] {
    const fd = this.fromDate ? new Date(this.fromDate) : null;
    const td = this.toDate ? new Date(this.toDate) : null;
    return (this.envios || []).filter((e: any) => {
      const d = e?.fecha_envio ? new Date(e.fecha_envio) : null;
      if (fd && (!d || d < fd)) return false;
      if (td && (!d || d > td)) return false;
      return true;
    });
  }
  get kpiEntregados(): number { return this.filteredEnvios.filter((e:any)=> !!(e?.fecha_recepcion || e?.estado_entrega)).length; }
  get kpiNoEntregados(): number { return this.filteredEnvios.filter((e:any) => !(e?.fecha_recepcion || e?.estado_entrega)).length; }
  get kpiPagados(): number { return this.filteredEnvios.filter((e:any) => !!e?.estado_pago).length; }
  get kpiNoPagados(): number { return this.filteredEnvios.filter((e:any) => !e?.estado_pago).length; }

  // KPIs movimientos
  get totalIngresos(): number {
    return (this.movimientos || []).reduce((acc: number, it: any) => acc + (((it?.cabecera?.tipo_movimiento || '') === 'I') ? Number(it?.monto || 0) : 0), 0);
  }
  get totalEgresos(): number {
    return (this.movimientos || []).reduce((acc: number, it: any) => acc + (((it?.cabecera?.tipo_movimiento || '') === 'E') ? Number(it?.monto || 0) : 0), 0);
  }
  get totalNeto(): number { return this.totalIngresos - this.totalEgresos; }

  // Datos para gr�ficas simples
  get totalEnvios(): number { return this.filteredEnvios.length; }
  get piePagadosDeg(): number {
    const total = Math.max(1, this.totalEnvios);
    return Math.round((this.kpiPagados / total) * 360);
  }
  get movMax(): number { return Math.max(this.totalIngresos, this.totalEgresos, 1); }

  // Top N desgloses
  private countBy<T>(items: T[], keySel: (x: T) => string): { label: string, value: number }[] {
    const map = new Map<string, number>();
    items.forEach(it => {
      const k = keySel(it) || '';
      if (!k) return;
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }))
      .sort((a,b)=> b.value - a.value);
  }
  get topOrigen(): {label:string,value:number}[] {
    const arr = this.countBy(this.filteredEnvios, (e:any) => this.puntoNombre(e?.punto_origen_id));
    return arr.slice(0, 5);
  }
  get topDestino(): {label:string,value:number}[] {
    const arr = this.countBy(this.filteredEnvios, (e:any) => this.puntoNombre(e?.punto_destino_id));
    return arr.slice(0, 5);
  }
  get topCliente(): {label:string,value:number}[] {
    const arr = this.countBy(this.filteredEnvios, (e:any) => this.personaLabelById(e?.destinatario));
    return arr.slice(0, 5);
  }

  // Leaflet: load and map setup
  private ensureLeafletLoaded(): Promise<void> {
    if (typeof (window as any).L !== 'undefined') return Promise.resolve();
    if (this.leafletPromise) return this.leafletPromise;
    this.leafletLoading = true;
    this.leafletPromise = new Promise<void>((resolve, reject) => {
      const head = document.head;
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      head.appendChild(css);
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => { this.leafletLoading = false; resolve(); };
      script.onerror = () => { this.leafletLoading = false; reject(new Error('Leaflet load error')); };
      head.appendChild(script);
    });
    return this.leafletPromise;
  }

  get hasCoords(): boolean {
    return (this.puntos || []).some((p:any) => {
      const lat = Number((p as any).lat ?? (p as any).latitude);
      const lng = Number((p as any).lng ?? (p as any).longitud ?? (p as any).longitude);
      return isFinite(lat) && isFinite(lng);
    });
  }

  private extent() {
    const coords = (this.puntos || [])
      .map((p:any) => ({ lat: Number((p as any).lat ?? (p as any).latitude), lng: Number((p as any).lng ?? (p as any).longitud ?? (p as any).longitude) }))
      .filter(c => isFinite(c.lat) && isFinite(c.lng));
    const minLat = Math.min(...coords.map(c=>c.lat));
    const maxLat = Math.max(...coords.map(c=>c.lat));
    const minLng = Math.min(...coords.map(c=>c.lng));
    const maxLng = Math.max(...coords.map(c=>c.lng));
    return { minLat, maxLat, minLng, maxLng };
  }

  private setupMapIfReady() {
    if (!this.hasCoords) return;
    this.ensureLeafletLoaded().then(() => {
      if (!this.leafletReady) this.initLeafletMap();
      this.updateLeafletMarkers();
    }).catch(() => { /* ignore */ });
  }

  private initLeafletMap() {
    const L: any = (window as any).L;
    const el = document.getElementById('reportesMap');
    if (!el) return;
    this.map = L.map(el, { zoomControl: true, attributionControl: true });
    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
    tiles.addTo(this.map);
    this.originsLayer = L.layerGroup().addTo(this.map);
    this.destLayer = L.layerGroup().addTo(this.map);
    // Fit to all punto coords
    const { minLat, maxLat, minLng, maxLng } = this.extent();
    if (isFinite(minLat) && isFinite(maxLat) && isFinite(minLng) && isFinite(maxLng)) {
      const bounds = L.latLngBounds(L.latLng(minLat, minLng), L.latLng(maxLat, maxLng));
      this.map.fitBounds(bounds.pad(0.15));
    } else {
      this.map.setView([ -9.19, -75.02 ], 6); // Per� approx
    }
    this.leafletReady = true;
  }

  private updateLeafletMarkers() {
    if (!this.leafletReady || !this.map) return;
    const L: any = (window as any).L;
    this.originsLayer.clearLayers();
    this.destLayer.clearLayers();
    // Count top 5 origins and destinations from filtered env�os
    const cntO = new Map<number, number>();
    const cntD = new Map<number, number>();
    (this.filteredEnvios || []).forEach((e:any) => {
      const o = Number(e?.punto_origen_id); const d = Number(e?.punto_destino_id);
      if (o) cntO.set(o, (cntO.get(o)||0) + 1);
      if (d) cntD.set(d, (cntD.get(d)||0) + 1);
    });
    const topIds = (map: Map<number,number>) => Array.from(map.entries()).sort((a,b)=> b[1]-a[1]).slice(0,5);
    const topsO = topIds(cntO);
    const topsD = topIds(cntD);

    const boundsPoints: any[] = [];
    topsO.forEach(([id,count]) => {
      const pc = this.puntoCoord(id);
      if (!pc) return;
      const marker = L.circleMarker([pc.lat, pc.lng], { radius: 6, color: '#059669', fillColor: '#059669', fillOpacity: 0.9 });
      marker.bindTooltip(`${this.puntoNombre(id)} (Origen: ${count})`);
      marker.addTo(this.originsLayer);
      boundsPoints.push([pc.lat, pc.lng]);
    });
    topsD.forEach(([id,count]) => {
      const pc = this.puntoCoord(id);
      if (!pc) return;
      const marker = L.circleMarker([pc.lat, pc.lng], { radius: 6, color: '#4338ca', fillColor: '#4338ca', fillOpacity: 0.9 });
      marker.bindTooltip(`${this.puntoNombre(id)} (Destino: ${count})`);
      marker.addTo(this.destLayer);
      boundsPoints.push([pc.lat, pc.lng]);
    });
    if (boundsPoints.length) {
      const b = L.latLngBounds(boundsPoints as any);
      this.map.fitBounds(b.pad(0.2));
    }
  }

  onDateChange() {
    this.updateLeafletMarkers();
  }

  // Export CSV del resumen
  exportCSV() {
    const esc = (v:any)=> '"' + String(v ?? '').replace(/"/g,'""') + '"';
    const lines: string[] = [];
    lines.push(['KPI','Valor'].map(esc).join(','));
    lines.push(['Entregados', this.kpiEntregados].map(esc).join(','));
    lines.push(['No entregados', this.kpiNoEntregados].map(esc).join(','));
    lines.push(['Pagados', this.kpiPagados].map(esc).join(','));
    lines.push(['No pagados', this.kpiNoPagados].map(esc).join(','));
    lines.push('');
    lines.push(['Resumen','Monto'].map(esc).join(','));
    lines.push(['Ingresos', this.totalIngresos.toFixed(2)].map(esc).join(','));
    lines.push(['Egresos', this.totalEgresos.toFixed(2)].map(esc).join(','));
    lines.push(['Neto', this.totalNeto.toFixed(2)].map(esc).join(','));
    const blob = new Blob([lines.join("\r\n")], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href=url; a.download='reporte_kpis.csv'; document.body.appendChild(a); a.click();
    setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  }

  // Export PDF del resumen
  exportPDF() {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    let y = 48;
    const line = 18; const x = 48;
    doc.setFont('helvetica','bold');
    doc.text('Reporte de KPIs', x, y); y += line;
    doc.setFont('helvetica','normal');
    const rango = (this.fromDate || this.toDate) ? `Rango: ${this.fromDate || '—'} a ${this.toDate || '—'}` : 'Rango: Todos';
    doc.text(rango, x, y); y += line * 1.2;
    doc.setFont('helvetica','bold'); doc.text('Envíos', x, y); y += line;
    doc.setFont('helvetica','normal');
    doc.text(`Entregados: ${this.kpiEntregados}`, x, y); y += line;
    doc.text(`No entregados: ${this.kpiNoEntregados}`, x, y); y += line;
    doc.text(`Pagados: ${this.kpiPagados}`, x, y); y += line;
    doc.text(`No pagados: ${this.kpiNoPagados}`, x, y); y += line * 1.2;
    doc.setFont('helvetica','bold'); doc.text('Movimientos', x, y); y += line;
    doc.setFont('helvetica','normal');
    doc.text(`Ingresos: ${this.totalIngresos.toFixed(2)}`, x, y); y += line;
    doc.text(`Egresos: ${this.totalEgresos.toFixed(2)}`, x, y); y += line;
    doc.text(`Neto: ${this.totalNeto.toFixed(2)}`, x, y);
    doc.save('reporte_kpis.pdf');
  }
}
