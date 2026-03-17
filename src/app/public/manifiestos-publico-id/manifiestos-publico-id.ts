import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Utils } from '../../../../core/services/utils';
import { Manifiestos } from '../../../../core/services/manifiestos';
import { ManifiestoWithEnviosRead } from '../../../../core/mapped';

@Component({
  selector: 'public-manifiestos-by-id',
  standalone: true,
  imports: [CommonModule, FormsModule, Utils],
  templateUrl: './manifiestos-publico-id.html',
  styleUrl: './manifiestos-publico-id.css',
})
export class ManifiestosPublicoIdComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly manifiestosSrv = inject(Manifiestos);

  loading = false;
  error: string | null = null;
  manifiestos: ManifiestoWithEnviosRead[] = [];
  manifiestoId = 0;
  arrivedNote: Record<number, string> = {};
  estadoLoading: Record<number, boolean> = {};
  estadoError: Record<number, string | null> = {};

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.manifiestoId = Number(params.get('id') || 0);
      if (!this.manifiestoId) {
        this.error = 'Enlace inválido';
        return;
      }
      this.loadManifiesto();
    });
  }

  private loadManifiesto() {
    this.loading = true;
    this.error = null;
    this.manifiestosSrv.getManifiestoTransito(this.manifiestoId).subscribe({
      next: (res) => {
        this.manifiestos = res ? [res as ManifiestoWithEnviosRead] : [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'No se pudo cargar el manifiesto en tránsito';
      }
    });
  }

  get manifiestoHeaderCodigo(): string {
    const man = (this.manifiestos || [])[0] as any;
    return this.manifiestoCodigo(man);
  }

  get manifiestoHeaderPlaca(): string {
    const man = (this.manifiestos || [])[0] as any;
    return this.placaLabel(man);
  }

  manifiestoCodigo(man: any): string {
    if (!man) return '-';
    const serie = String(man?.serie || man?.manifiesto_serie || '').trim();
    const numeroRaw = man?.numero ?? man?.manifiesto_numero ?? '';
    const numero = String(numeroRaw).trim();
    if (serie && numero) return `${serie}-${numero}`;
    if (serie) return serie;
    if (numero) return numero;
    return '-';
  }

  placaLabel(man: any): string {
    if (!man) return '-';
    return String(
      man?.placa ||
      man?.vehiculo_placa ||
      man?.placa_vehiculo ||
      '-'
    ).trim() || '-';
  }

  envioLabel(envio: any): string {
    const ticket = String(envio?.ticket_numero || envio?.ticket || '').trim();
    if (ticket) return ticket;
    const id = String(envio?.id || '').trim();
    return id || '-';
  }

  private nowLocalIso(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  async marcarLlegada(man: ManifiestoWithEnviosRead) {
    const mid = Number((man as any)?.id || 0);
    if (!mid) {
      this.estadoError[mid] = 'Manifiesto inválido';
      return;
    }
    this.estadoLoading[mid] = true;
    this.estadoError[mid] = null;
    try {
      const pos = await this.getGeo();
      const now = this.nowLocalIso();
      const note = String(this.arrivedNote[mid] || '').trim();
      this.manifiestosSrv.updateManifiestosEstado(mid, {
        estado: 'LLEGADA',
        arrived_at: now,
        arrived_lat: pos?.lat ?? 0,
        arrived_lng: pos?.lng ?? 0,
        arrived_accuracy_m: pos?.accuracy ?? undefined,
        arrived_note: note,
      }).subscribe({
        next: () => {
          (man as any).estado = 'LLEGADA';
          this.estadoLoading[mid] = false;
        },
        error: () => {
          this.estadoLoading[mid] = false;
          this.estadoError[mid] = 'No se pudo actualizar el estado';
        }
      });
    } catch {
      this.estadoLoading[mid] = false;
      this.estadoError[mid] = 'No se pudo obtener la ubicación';
    }
  }

  private getGeo(): Promise<{ lat: number; lng: number; accuracy: number | null }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('geolocation'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
        }),
        () => reject(new Error('geo')),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }
}
