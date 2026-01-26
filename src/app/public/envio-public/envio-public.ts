import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Utils } from '../../../../core/services/utils';
import { Envios } from '../../../../core/services/envios';
import { DetalleEnvio } from '../../../../core/services/detalle-envio';
import { Comprobantes } from '../../../../core/services/comprobantes';
import { Personas } from '../../../../core/services/personas';
import { Puntos as PuntosService } from '../../../../core/services/puntos';
import { Comprobante, DetalleEnvio as DetalleEnvioModel, Envio, Persona, Puntos as PuntoModel } from '../../../../core/mapped';

@Component({
  selector: 'public-envio',
  standalone: true,
  imports: [CommonModule, Utils],
  templateUrl: './envio-public.html',
  styleUrl: './envio-public.css',
})
export class EnvioPublicComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly enviosSrv = inject(Envios);
  private readonly detalleSrv = inject(DetalleEnvio);
  private readonly comprobantesSrv = inject(Comprobantes);
  private readonly personasSrv = inject(Personas);
  private readonly puntosSrv = inject(PuntosService);

  loading = false;
  error: string | null = null;
  envio: Envio | null = null;
  detalles: DetalleEnvioModel[] = [];
  detallesLoading = false;
  comprobante: Comprobante | null = null;
  comprobanteLoading = false;
  personas: Persona[] = [];
  puntos: PuntoModel[] = [];

  ngOnInit(): void {
    this.personasSrv.getPersonas().subscribe({ next: (list) => { this.personas = list || []; }, error: () => {} });
    this.puntosSrv.getPuntos().subscribe({ next: (list) => { this.puntos = list || []; }, error: () => {} });
    this.route.paramMap.subscribe(params => {
      const id = Number(params.get('id') || 0);
      if (!id) { this.error = 'Envío inválido'; return; }
      this.loadEnvio(id);
    });
  }

  private loadEnvio(id: number) {
    this.loading = true;
    this.error = null;
    this.enviosSrv.getEnvio(id).subscribe({
      next: (res) => {
        this.envio = res as any;
        this.loading = false;
        this.loadDetalles(id);
        this.loadComprobante(id);
      },
      error: () => {
        this.loading = false;
        this.error = 'No se pudo cargar el envío';
      }
    });
  }

  private loadDetalles(id: number) {
    this.detallesLoading = true;
    this.detalleSrv.getDetallesEnvio(id).subscribe({
      next: (list) => { this.detalles = list || []; this.detallesLoading = false; },
      error: () => { this.detallesLoading = false; }
    });
  }

  private loadComprobante(id: number) {
    this.comprobanteLoading = true;
    this.comprobantesSrv.getComprobanteEnvio(id).subscribe({
      next: (res) => { this.comprobante = res as any; this.comprobanteLoading = false; },
      error: () => { this.comprobanteLoading = false; this.comprobante = null; }
    });
  }

  personaNombre(id: number | null | undefined): string {
    const pid = Number(id || 0);
    if (!pid) return '-';
    const p = (this.personas || []).find(x => Number((x as any).id) === pid) as any;
    if (!p) return String(id);
    return (p.razon_social || '').trim() || [p.nombre, p.apellido].filter(Boolean).join(' ').trim() || String(id);
  }

  personaDocumento(id: number | null | undefined): string {
    const pid = Number(id || 0);
    if (!pid) return '-';
    const p = (this.personas || []).find(x => Number((x as any).id) === pid) as any;
    return p ? String(p.nro_documento || '-') : '-';
  }

  puntoNombre(id: number | null | undefined): string {
    const pid = Number(id || 0);
    if (!pid) return '-';
    const p = (this.puntos || []).find(x => Number((x as any).id) === pid) as any;
    return p ? String(p.nombre || '-').toUpperCase() : String(id);
  }
}
