import { Injectable } from '@angular/core';
import { Conductor, DespachoRead, Envio, ItemGuia, Manifiesto, Persona, Puntos, Guia } from '../../../../core/mapped';

export interface GrtRelacionadoDoc {
  envioId: number;
  ticketNumero?: string;
  grrNumero?: string;
  remitente?: string;
  destinatario?: string;
  pesoKg?: number;
  bultos?: number;
}

export interface GrtSunatData {
  hash?: string;
  qr?: string;
  codigo?: string;
  mensaje?: string;
  ticket?: string;
  fechaEnvio?: string;
  fechaRespuesta?: string;
}

export interface GrtDocument {
  tipo: 'GRT';
  titulo: string;
  serie: string;
  numero: string;
  fullNumber: string;
  estado?: string;
  fechaEmision?: string;
  fechaTraslado?: string;
  manifiestoId: number;
  manifiestoNumero: string;
  transportista: {
    razonSocial: string;
    ruc: string;
  };
  remitentes: Array<{
    nombre: string;
    documento?: string;
  }>;
  conductor: {
    nombre: string;
    documento?: string;
    licencia?: string;
  };
  vehiculo: {
    placa?: string;
    descripcion?: string;
  };
  partida: {
    ubigeo?: string;
    direccion: string;
  };
  llegada: {
    ubigeo?: string;
    direccion: string;
  };
  resumenGrr: {
    totalEnvios: number;
    totalGrr: number;
    totalBultos: number;
    totalPesoKg: number;
    grrNumeros: string[];
  };
  relacionados: GrtRelacionadoDoc[];
  sunat?: GrtSunatData;
}

export interface BuildGrtInput {
  manifiesto: Manifiesto;
  envios: Envio[];
  detallePorEnvio: Record<number, Array<{ cantidad?: number; descripcion?: string }>>;
  puntos: Puntos[];
  personas: Persona[];
  conductor: Conductor | null;
  despacho?: DespachoRead | null;
  guia?: Guia | null;
  itemsDespacho?: ItemGuia[];
}

@Injectable({ providedIn: 'root' })
export class GrtBuilderService {
  build(input: BuildGrtInput): GrtDocument {
    const { manifiesto, envios, detallePorEnvio, puntos, personas, conductor, despacho, guia, itemsDespacho } = input;
    const serie = String((guia as any)?.series || manifiesto?.serie || '').trim();
    const numero = String((guia as any)?.numero || manifiesto?.numero || '').trim();
    const fullNumber = String((guia as any)?.numero_completo || [serie, numero].filter(Boolean).join('-')).trim() || '-';
    const origen = this.puntoNombre(puntos, (manifiesto as any)?.codigo_punto_origen);
    const destino = this.puntoNombre(puntos, (manifiesto as any)?.codigo_punto_destino);
    const remitenteMap = new Map<number, { nombre: string; documento?: string }>();

    const relacionados: GrtRelacionadoDoc[] = (envios || []).map((e: any) => {
      const envioId = Number(e?.id || 0);
      const remitentePersona = (personas || []).find((p: any) => Number(p?.id || 0) === Number(e?.remitente || 0));
      const destinatarioPersona = (personas || []).find((p: any) => Number(p?.id || 0) === Number(e?.destinatario || 0));
      const remitenteNombre = this.personaNombre(remitentePersona);
      const destinatarioNombre = this.personaNombre(destinatarioPersona);
      if (remitentePersona) {
        remitenteMap.set(Number(remitentePersona.id), {
          nombre: remitenteNombre,
          documento: String((remitentePersona as any)?.nro_documento || '').trim(),
        });
      }
      const detalle = (detallePorEnvio?.[envioId] || []) as any[];
      const bultos = detalle.reduce((acc: number, d: any) => acc + (Number(d?.cantidad || 0) || 0), 0);
      return {
        envioId,
        ticketNumero: String(e?.ticket_numero || '').trim(),
        grrNumero: String(e?.guia || '').trim(),
        remitente: remitenteNombre,
        destinatario: destinatarioNombre,
        pesoKg: Number(e?.peso || 0) || 0,
        bultos,
      };
    });

    const grrNumeros = Array.from(
      new Set(relacionados.map(r => String(r?.grrNumero || '').trim()).filter(Boolean))
    );
    const totalBultos = relacionados.reduce((acc, r) => acc + (Number(r?.bultos || 0) || 0), 0);
    const totalPesoKg = Number(
      (itemsDespacho && itemsDespacho.length
        ? itemsDespacho.reduce((acc: number, it: any) => acc + (Number(it?.peso || 0) || 0), 0)
        : relacionados.reduce((acc, r) => acc + (Number(r?.pesoKg || 0) || 0), 0)
      ).toFixed(2)
    );

    const driverPersona = (conductor as any)?.persona || null;
    const conductorNombre = driverPersona ? this.personaNombre(driverPersona) : '';
    const conductorDoc = String(driverPersona?.nro_documento || '').trim();

    return {
      tipo: 'GRT',
      titulo: 'GUIA DE REMISION TRANSPORTISTA',
      serie,
      numero,
      fullNumber,
      estado: this.estadoDespacho((despacho as any)?.estado),
      fechaEmision: String((guia as any)?.emitido_en || '').trim(),
      fechaTraslado: String((manifiesto as any)?.fecha_traslado || (despacho as any)?.inicio || '').trim(),
      manifiestoId: Number((manifiesto as any)?.id || 0),
      manifiestoNumero: `${String((manifiesto as any)?.serie || '').trim()}-${String((manifiesto as any)?.numero || '').trim()}`.replace(/^-|-$/g, ''),
      transportista: {
        razonSocial: String(localStorage.getItem('razon_social') || '').trim() || '-',
        ruc: String(localStorage.getItem('ruc') || '').trim() || '-',
      },
      remitentes: Array.from(remitenteMap.values()),
      conductor: {
        nombre: conductorNombre || '-',
        documento: conductorDoc || '',
        licencia: String((conductor as any)?.licencia || '').trim(),
      },
      vehiculo: {
        placa: String((manifiesto as any)?.placa || '').trim(),
        descripcion: '',
      },
      partida: {
        ubigeo: String((despacho as any)?.origen_ubigeo || '').trim(),
        direccion: String((despacho as any)?.origen_direccion || origen || '').trim() || '-',
      },
      llegada: {
        ubigeo: String((despacho as any)?.destino_ubigeo || '').trim(),
        direccion: String((despacho as any)?.destino_direccion || destino || '').trim() || '-',
      },
      resumenGrr: {
        totalEnvios: relacionados.length,
        totalGrr: grrNumeros.length,
        totalBultos,
        totalPesoKg,
        grrNumeros,
      },
      relacionados,
      sunat: {
        hash: String((guia as any)?.hash_sha || '').trim(),
        qr: String((guia as any)?.qr || '').trim(),
      },
    };
  }

  private personaNombre(p: any): string {
    if (!p) return '';
    const razon = String(p?.razon_social || '').trim();
    if (razon) return razon;
    return [String(p?.nombre || '').trim(), String(p?.apellido || '').trim()].filter(Boolean).join(' ').trim();
  }

  private puntoNombre(puntos: Puntos[], id: number | null | undefined): string {
    const pid = Number(id || 0);
    if (!pid) return '';
    const f = (puntos || []).find((p: any) => Number(p?.id || 0) === pid);
    return String((f as any)?.nombre || '').trim();
  }

  private estadoDespacho(code: string | null | undefined): string {
    const c = String(code || '').toUpperCase().trim();
    if (c === 'B') return 'BORRADOR';
    if (c === 'L') return 'LISTO';
    if (c === 'E') return 'EMITIDA';
    if (c === 'A') return 'ANULADA';
    return c || '-';
  }
}

export const GRT_MOCK: GrtDocument = {
  tipo: 'GRT',
  titulo: 'GUIA DE REMISION TRANSPORTISTA',
  serie: 'T001',
  numero: '12345',
  fullNumber: 'T001-12345',
  estado: 'EMITIDA',
  fechaEmision: '2026-03-15 10:00',
  fechaTraslado: '2026-03-15',
  manifiestoId: 77,
  manifiestoNumero: 'M001-000077',
  transportista: { razonSocial: 'TRANSPORTES DEMO SAC', ruc: '20123456789' },
  remitentes: [{ nombre: 'ACME SAC', documento: '20600000001' }],
  conductor: { nombre: 'JUAN PEREZ', documento: '45678912', licencia: 'B12345678' },
  vehiculo: { placa: 'ABC-123' },
  partida: { ubigeo: '150101', direccion: 'LIMA - CENTRO' },
  llegada: { ubigeo: '040101', direccion: 'AREQUIPA - CENTRO' },
  resumenGrr: { totalEnvios: 2, totalGrr: 2, totalBultos: 8, totalPesoKg: 42.5, grrNumeros: ['GRR-0001', 'GRR-0002'] },
  relacionados: [
    { envioId: 10, ticketNumero: 'TCK-0010', grrNumero: 'GRR-0001', remitente: 'ACME SAC', destinatario: 'CLIENTE 1', pesoKg: 20.5, bultos: 3 },
    { envioId: 11, ticketNumero: 'TCK-0011', grrNumero: 'GRR-0002', remitente: 'ACME SAC', destinatario: 'CLIENTE 2', pesoKg: 22.0, bultos: 5 },
  ],
  sunat: { hash: 'ABCDEF1234567890', qr: '' },
};

