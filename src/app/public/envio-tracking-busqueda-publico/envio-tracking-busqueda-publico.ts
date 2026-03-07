import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EnvioTrackingPublicRead } from '../../../../core/mapped';
import { Public } from '../../../../core/services/public';
import { Utils } from '../../../../core/services/utils';

@Component({
  selector: 'public-envio-tracking-busqueda',
  standalone: true,
  imports: [CommonModule, FormsModule, Utils],
  templateUrl: './envio-tracking-busqueda-publico.html',
  styleUrl: './envio-tracking-busqueda-publico.css',
})
export class EnvioTrackingBusquedaPublicoComponent {
  private readonly publicSrv = inject(Public);

  readonly timelineSteps = [
    { key: 'recepcion', label: 'RECEPCION' },
    { key: 'transito', label: 'EN TRANSITO' },
    { key: 'proceso_entrega', label: 'EN PROCESO ENTREGA' },
  ] as const;

  query = '';
  loading = false;
  error: string | null = null;
  tracking: EnvioTrackingPublicRead | null = null;

  onSearch() {
    const trimmed = String(this.query || '').trim();
    if (!trimmed) {
      this.error = 'Ingresa un id_tracking valido';
      this.tracking = null;
      return;
    }

    this.loading = true;
    this.error = null;
    this.tracking = null;

    this.publicSrv.getEnvioIdTracking(trimmed).subscribe({
      next: (res) => {
        this.tracking = res as any;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'No se encontro un envio con ese id_tracking';
      }
    });
  }

  estadoEnvioLabel(): string {
    const estado = String((this.tracking as any)?.estado_envio || '').trim();
    return estado || 'En transito';
  }

  currentEstadoIndex(): number {
    const estado = String((this.tracking as any)?.estado_envio || '').trim();
    const normalized = this.normalizeEstado(estado);
    if (!normalized) return 1;
    if (normalized.includes('recepcion')) return 0;
    if (normalized.includes('transito')) return 1;
    if (normalized.includes('proceso') && normalized.includes('entrega')) return 2;
    if (normalized.includes('entrega')) return 2;
    return 1;
  }

  isStepActive(index: number): boolean {
    if (this.isDelivered()) return index === this.timelineSteps.length - 1;
    return this.currentEstadoIndex() === index;
  }

  isStepCompleted(index: number): boolean {
    if (this.isDelivered()) return true;
    return this.currentEstadoIndex() > index;
  }

  origenLabel(): string {
    const nombre = String((this.tracking as any)?.origen_nombre || '').trim();
    if (nombre) return nombre;
    const id = (this.tracking as any)?.punto_origen_id;
    return id != null ? String(id) : '-';
  }

  destinoLabel(): string {
    const nombre = String((this.tracking as any)?.destino_nombre || '').trim();
    if (nombre) return nombre;
    const id = (this.tracking as any)?.punto_destino_id;
    return id != null ? String(id) : '-';
  }

  isDelivered(): boolean {
    return (this.tracking as any)?.estado_entrega === true;
  }

  private normalizeEstado(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }
}
