import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, ViewChild } from '@angular/core';

export interface ComprobantePreview {
  tipo: string;
  ambiente?: 'beta' | 'produccion';
  serie: string;
  numero: string;
  fechaEmision: string;
  moneda: string;
  formaPago?: string;
  montoLetras?: string;
  logoUrl?: string;
  emisor: {
    razonSocial: string;
    nombreComercial?: string;
    ruc: string;
    direccion?: string;
    telefono?: string;
    correo?: string;
  };
  cliente: {
    nombre: string;
    tipoDocumento?: string;
    numeroDocumento?: string;
    direccion?: string;
  };
  referencia?: {
    envioId?: string;
    tracking?: string;
    origen?: string;
    destino?: string;
  };
  items: Array<{
    numeroItem?: number;
    descripcion: string;
    cantidad: number;
    unidadMedida?: string;
    precioUnitario?: number;
    valorUnitario?: number;
    igv?: number;
    totalLinea: number;
    codigoProducto?: string;
  }>;
  totales: {
    gravadas?: number;
    exoneradas?: number;
    inafectas?: number;
    descuentos?: number;
    otrosCargos?: number;
    igv?: number;
    icbper?: number;
    total: number;
  };
  detraccion?: {
    aplica: boolean;
    codigoSpot?: string;
    porcentaje?: number;
    base?: number;
    monto?: number;
    estado?: string;
    fechaDeposito?: string;
    constancia?: string;
    periodo?: string;
  };
  sunat?: {
    hash?: string;
    qr?: string;
    codigo?: string;
    mensaje?: string;
    ticket?: string;
    fechaEnvio?: string;
    fechaRespuesta?: string;
    estadoCpe?: 'aceptado' | 'pendiente' | 'rechazado';
  };
  leyendas?: string[];
  observaciones?: string[];
}

@Component({
  selector: 'app-comprobante-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './comprobante-preview.component.html',
  styles: [`
    .thermal-80 {
      width: 78mm;
      max-width: 100%;
    }
    @media print {
      @page {
        size: 80mm auto;
        margin: 2mm;
      }
      .thermal-80 {
        width: 78mm !important;
        border: 0 !important;
        box-shadow: none !important;
      }
      .no-print {
        display: none !important;
      }
      * {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  `]
})
export class ComprobantePreviewComponent {
  @Input() comprobante: ComprobantePreview | null = null;
  @Input() showSunatTitle = true;
  @Input() showCpeStatus = true;
  @ViewChild('printRoot') printRoot?: ElementRef<HTMLElement>;

  print(): void {
    const node = this.printRoot?.nativeElement;
    if (!node) { window.print(); return; }
    const win = window.open('', '_blank', 'width=420,height=900');
    if (!win) return;
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
        @page { size: 80mm auto; margin: 2mm; }
        html, body { width: 80mm; margin: 0; padding: 0; background: #fff; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .no-print { display: none !important; }
      </style>
    `;
    win.document.open();
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><base href="${baseHref}">${linkTags}${styleTags}${printCss}<title>Imprimir Comprobante</title></head><body>${node.outerHTML}</body></html>`);
    win.document.close();
    const doPrint = () => {
      try { win.focus(); } catch {}
      try { win.print(); } catch {}
      setTimeout(() => { try { win.close(); } catch {} }, 150);
    };
    win.addEventListener('load', doPrint, { once: true });
    setTimeout(doPrint, 600);
  }

  buildSerieNumero(): string {
    const c = this.comprobante;
    if (!c) return '-';
    return `${c.serie || '-'}-${c.numero || '-'}`;
  }

  resolveTituloDocumento(tipo?: string): string {
    const t = String(tipo || '').toUpperCase().trim();
    if (t === '01' || t.includes('FACT')) return 'FACTURA ELECTRONICA';
    if (t === '03' || t.includes('BOL')) return 'BOLETA DE VENTA ELECTRONICA';
    if (t === '07' || t.includes('CRED')) return 'NOTA DE CREDITO ELECTRONICA';
    if (t === '08' || t.includes('DEB')) return 'NOTA DE DEBITO ELECTRONICA';
    return 'COMPROBANTE ELECTRONICO';
  }

  formatFecha(value?: string | null): string {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  }

  formatMoneda(value?: number | null, currency?: string): string {
    const amount = Number(value ?? 0);
    const code = (currency || this.comprobante?.moneda || 'PEN').toUpperCase();
    return amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ` ${code}`;
  }

  hasPositive(value?: number | null): boolean {
    return Number(value ?? 0) > 0;
  }

  cpeEstadoLabel(value?: string): string {
    const v = String(value || '').toLowerCase().trim();
    if (v === 'aceptado') return 'Aceptado';
    if (v === 'rechazado') return 'Rechazado';
    return 'Pendiente';
  }

  cpeEstadoClass(value?: string): string {
    const v = String(value || '').toLowerCase().trim();
    if (v === 'aceptado') return 'bg-emerald-100 text-emerald-700';
    if (v === 'rechazado') return 'bg-red-100 text-red-700';
    return 'bg-amber-100 text-amber-700';
  }

  toImageSrc(raw?: string): string | null {
    const value = String(raw || '').trim();
    if (!value) return null;
    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:image')) return value;
    return `data:image/png;base64,${value}`;
  }

  hasReferencia(): boolean {
    const r = this.comprobante?.referencia;
    return !!(r?.envioId || r?.tracking || r?.origen || r?.destino);
  }

  hasSunatData(): boolean {
    const s = this.comprobante?.sunat;
    return !!(s?.hash || s?.codigo || s?.mensaje || s?.ticket || s?.fechaEnvio || s?.fechaRespuesta || s?.estadoCpe || s?.qr);
  }
}
