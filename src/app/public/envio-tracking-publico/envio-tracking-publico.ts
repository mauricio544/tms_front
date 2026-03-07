import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Public } from '../../../../core/services/public';
import { Utils } from '../../../../core/services/utils';
import { EnvioTrackingPublicRead } from '../../../../core/mapped';

@Component({
  selector: 'public-envio-tracking',
  standalone: true,
  imports: [CommonModule, Utils],
  templateUrl: './envio-tracking-publico.html',
  styleUrl: './envio-tracking-publico.css',
})
export class EnvioTrackingPublicoComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly publicSrv = inject(Public);

  readonly timelineSteps = [
    { key: 'recepcion', label: 'RECEPCI?N' },
    { key: 'transito', label: 'EN TR?NSITO' },
    { key: 'proceso_entrega', label: 'EN PROCESO ENTREGA' },
  ] as const;

  loading = false;
  error: string | null = null;
  tracking: EnvioTrackingPublicRead | null = null;
  token = '';
  ticketNumero = '';

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.token = String(params.get('token') || '').trim();
      this.ticketNumero = String(this.route.snapshot.queryParamMap.get('ticket_numero') || '').trim();
      if (!this.token || !this.ticketNumero) {
        this.error = 'Enlace inválido';
        return;
      }
      this.loadTracking();
    });
  }

  private loadTracking() {
    this.loading = true;
    this.error = null;
    this.publicSrv.getEnvioTracking(this.ticketNumero, this.token).subscribe({
      next: (res) => {
        this.tracking = res as any;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'No se pudo cargar el tracking del envío';
      }
    });
  }

  estadoEnvioLabel(): string {
    const estado = String((this.tracking as any)?.estado_envio || '').trim();
    return estado || 'En tránsito';
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

  entregaLabel(): string {
    const val = (this.tracking as any)?.estado_entrega;
    if (val === true) return 'Entregado';
    if (val === false) return 'En tránsito';
    return 'En tránsito';
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

  whatsAppOptInUrl(): string {
    const ticket = String((this.tracking as any)?.ticket_numero || this.ticketNumero || '').trim();
    if (!ticket) return '';
    return `https://wa.me/15558870391?text=${encodeURIComponent(`ALTA ${ticket}`)}`;
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
