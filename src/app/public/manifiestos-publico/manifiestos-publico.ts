import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Public } from '../../../../core/services/public';
import { Utils } from '../../../../core/services/utils';
import { ManifiestoWithEnviosRead } from '../../../../core/mapped';

@Component({
  selector: 'public-manifiestos',
  standalone: true,
  imports: [CommonModule, FormsModule, Utils],
  templateUrl: './manifiestos-publico.html',
  styleUrl: './manifiestos-publico.css',
})
export class ManifiestosPublicoComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly publicSrv = inject(Public);

  loading = false;
  error: string | null = null;
  manifiestos: ManifiestoWithEnviosRead[] = [];
  conductorId = 0;
  token = '';
  arrivedNote: Record<number, string> = {};
  estadoLoading: Record<number, boolean> = {};
  estadoError: Record<number, string | null> = {};

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.token = String(params.get('token') || '').trim();
      this.conductorId = Number(this.route.snapshot.queryParamMap.get('conductor_id') || 0);
      if (!this.token || !this.conductorId) {
        this.error = 'Enlace inválido';
        return;
      }
      this.loadManifiestos();
    });
  }

  private loadManifiestos() {
    this.loading = true;
    this.error = null;
    this.publicSrv.getManifiestosEnTransito(this.conductorId, this.token).subscribe({
      next: (res) => {
        this.manifiestos = (res || []) as ManifiestoWithEnviosRead[];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'No se pudieron cargar los manifiestos en tránsito';
      }
    });
  }

  envioLabel(envio: any): string {
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
      this.publicSrv.updateManiestoEstado(this.conductorId, mid, this.token, {
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
