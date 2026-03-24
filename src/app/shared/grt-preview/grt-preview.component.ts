import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { GrtDocument } from '../../features/manifiestos/grt-builder.service';

@Component({
  selector: 'app-grt-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './grt-preview.component.html',
  styles: [`
    .thermal-80 {
      width: 74mm;
      max-width: 100%;
    }
    @media print {
      @page {
        size: 80mm auto;
        margin: 2.5mm;
      }
      .no-print { display: none !important; }
      .thermal-80 {
        width: 74mm !important;
        border: 0 !important;
        box-shadow: none !important;
      }
      .thermal-80, .thermal-80 * { color: #000 !important; }
      .thermal-80 img { image-rendering: crisp-edges; }
      * {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  `]
})
export class GrtPreviewComponent {
  @Input() grt: GrtDocument | null = null;
  @ViewChild('printRoot') printRoot?: ElementRef<HTMLElement>;

  print(): void {
    if (!this.grt) {
      window.print();
      return;
    }
    const win = window.open('', '_blank', 'width=420,height=800');
    if (!win) return;
    const style = `
      @page { size: 80mm auto; margin: 2.5mm; }
      html, body { width: 80mm; margin: 0; padding: 0; background: #fff; font-family: Arial, Helvetica, sans-serif; color:#000; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .grt { width: 74mm; margin: 0 auto; color: #000; font-size: 11px; line-height: 1.24; }
      .head, .block { border-bottom: 0.5px solid #000; padding: 1.8mm 0; }
      .head { text-align: center; }
      .logo { max-height: 16mm; max-width: 40mm; object-fit: contain; margin: 0 auto 1mm; display: block; image-rendering: crisp-edges; }
      .title { font-weight: 700; letter-spacing: .2px; }
      .num { font-weight: 700; margin-top: .5mm; }
      .st { font-size: 10px; color: #000; margin-top: .5mm; }
      .ttl { font-weight: 700; margin-bottom: 1mm; }
      .row { margin: .5mm 0; word-break: break-word; }
      .item { border-bottom: 0.5px solid #000; padding: 1mm 0; }
      .item:last-child { border-bottom: 0; }
      .qr { text-align: center; margin-top: 1.5mm; }
      .qr img { width: 30mm; height: 30mm; object-fit: contain; image-rendering: crisp-edges; }
      .foot { text-align: center; padding-top: 2mm; font-size: 10px; color: #000; }
    `;
    const logo = this.companyLogoSrc();
    const qr = this.toImageSrc(this.grt?.sunat?.qr);
    const relacionados = (this.grt?.relacionados || []).map((r, i) => `
      <div class="item">
        <div class="row"><b>${i + 1}. EnvÃ­o #${this.e(r.envioId)}</b></div>
        ${r.ticketNumero ? `<div class="row">Ticket: ${this.e(r.ticketNumero)}</div>` : ''}
        ${r.grrNumero ? `<div class="row">GRR: ${this.e(r.grrNumero)}</div>` : ''}
        ${r.remitente ? `<div class="row">Remitente: ${this.e(r.remitente)}</div>` : ''}
        ${r.destinatario ? `<div class="row">Destinatario: ${this.e(r.destinatario)}</div>` : ''}
        <div class="row">Bultos: ${this.e(r.bultos || 0)} | Peso: ${this.e(r.pesoKg || 0)} kg</div>
      </div>
    `).join('');
    const html = `
      <div class="grt">
        <div class="head">
          ${logo ? `<img class="logo" src="${logo}" alt="Logo">` : ''}
          <div class="title">${this.e(this.grt?.titulo || 'GUIA DE REMISION TRANSPORTISTA')}</div>
          <div class="num">${this.e(this.grt?.fullNumber || '-')}</div>
          ${this.grt?.estado ? `<div class="st">Estado: ${this.e(this.grt?.estado)}</div>` : ''}
        </div>
        <div class="block">
          <div class="ttl">Datos generales</div>
          <div class="row">Número de Registro MTC:15178239CNG</div>
          <div class="row">F. emisiÃ³n: ${this.e(this.formatDate(this.grt?.fechaEmision))}</div>
          <div class="row">F. traslado: ${this.e(this.formatDate(this.grt?.fechaTraslado))}</div>
          <div class="row">Manifiesto: ${this.e(this.grt?.manifiestoNumero || this.grt?.manifiestoId || '-')}</div>
        </div>
        <div class="block">
          <div class="ttl">Transportista</div>
          <div class="row">${this.e(this.grt?.transportista?.razonSocial || '-')}</div>
          <div class="row">RUC: ${this.e(this.grt?.transportista?.ruc || '-')}</div>
        </div>
        <div class="block">
          <div class="ttl">Transporte</div>
          <div class="row">VehÃ­culo: ${this.e(this.grt?.vehiculo?.placa || '-')}</div>
          <div class="row">Conductor: ${this.e(this.grt?.conductor?.nombre || '-')}</div>
          ${this.grt?.conductor?.documento ? `<div class="row">Doc: ${this.e(this.grt?.conductor?.documento)}</div>` : ''}
        </div>
        <div class="block">
          <div class="ttl">Ruta</div>
          <div class="row">Partida: ${this.e(this.grt?.partida?.direccion || '-')}</div>
          <div class="row">Llegada: ${this.e(this.grt?.llegada?.direccion || '-')}</div>
        </div>
        <div class="block">
          <div class="ttl">Resumen GRR asociadas</div>
          <div class="row">Total envÃ­os: ${this.e(this.grt?.resumenGrr?.totalEnvios || 0)}</div>
          <div class="row">Total bultos: ${this.e(this.grt?.resumenGrr?.totalBultos || 0)}</div>
          <div class="row">Peso total (kg): ${this.e(this.grt?.resumenGrr?.totalPesoKg || 0)}</div>
          ${(this.grt?.resumenGrr?.grrNumeros || []).length ? `<div class="row">NÃºmeros guÃ­a: ${this.e((this.grt?.resumenGrr?.grrNumeros || []).join(', '))}</div>` : ''}
        </div>
        <div class="block">
          <div class="ttl">Documentos relacionados</div>
          ${relacionados || '<div class="row">Sin documentos relacionados</div>'}
        </div>
        ${(this.grt?.sunat?.hash || qr) ? `
          <div class="block">
            <div class="ttl">Datos SUNAT</div>
            ${this.grt?.sunat?.hash ? `<div class="row">Hash: ${this.e(this.grt?.sunat?.hash)}</div>` : ''}
            ${qr ? `<div class="qr"><img src="${qr}" alt="QR"></div>` : ''}
          </div>
        ` : ''}
        <div class="foot">RepresentaciÃ³n impresa de GuÃ­a de RemisiÃ³n Transportista</div>
      </div>
    `;
    win.document.open();
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Imprimir GRT</title><style>${style}</style></head><body>${html}</body></html>`);
    win.document.close();
    let printed = false;
    const doPrint = () => {
      if (printed) return;
      printed = true;
      try { win.focus(); } catch {}
      try { win.print(); } catch {}
      setTimeout(() => { try { win.close(); } catch {} }, 150);
    };
    win.addEventListener('load', doPrint, { once: true });
    setTimeout(doPrint, 450);
  }

  companyLogoSrc(): string | null {
    const raw = String(localStorage.getItem('cia_logo') || '').trim();
    if (!raw) return null;
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:image')) return raw;
    return `data:image/png;base64,${raw}`;
  }

  formatDate(value?: string | null): string {
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

  toImageSrc(raw?: string): string | null {
    const value = String(raw || '').trim();
    if (!value) return null;
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    const dataUrlBase64 = this.extractBase64FromDataUrl(value);
    if (dataUrlBase64) {
      if (this.isLikelyImageBase64(dataUrlBase64)) return value;
      const decodedDataUrl = this.tryDecodeBase64(dataUrlBase64);
      if (decodedDataUrl && this.isLikelyImageBinary(decodedDataUrl)) return value;
      const qrPayloadFromDataUrl = (decodedDataUrl && this.isLikelyQrPayload(decodedDataUrl)) ? decodedDataUrl : dataUrlBase64;
      return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrPayloadFromDataUrl)}`;
    }
    if (this.isLikelyImageBase64(value)) return `data:image/png;base64,${value}`;
    const decoded = this.tryDecodeBase64(value);
    if (decoded && this.isLikelyImageBinary(decoded)) return `data:image/png;base64,${value}`;
    const qrPayload = (decoded && this.isLikelyQrPayload(decoded)) ? decoded : value;
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrPayload)}`;
  }

  private extractBase64FromDataUrl(value: string): string | null {
    const v = String(value || '').trim();
    if (!v.startsWith('data:image')) return null;
    const marker = 'base64,';
    const idx = v.indexOf(marker);
    if (idx < 0) return null;
    return v.slice(idx + marker.length).trim();
  }

  private tryDecodeBase64(value: string): string | null {
    try { return atob(value); } catch { return null; }
  }

  private isLikelyImageBase64(value: string): boolean {
    const v = String(value || '').trim();
    return v.startsWith('iVBORw0KGgo') || v.startsWith('/9j/') || v.startsWith('R0lGOD');
  }

  private isLikelyImageBinary(value: string): boolean {
    if (!value) return false;
    const c0 = value.charCodeAt(0);
    const c1 = value.length > 1 ? value.charCodeAt(1) : -1;
    const c2 = value.length > 2 ? value.charCodeAt(2) : -1;
    const c3 = value.length > 3 ? value.charCodeAt(3) : -1;
    // PNG: 89 50 4E 47
    if (c0 === 0x89 && c1 === 0x50 && c2 === 0x4E && c3 === 0x47) return true;
    // JPG: FF D8 FF
    if (c0 === 0xFF && c1 === 0xD8 && c2 === 0xFF) return true;
    return false;
  }

  private isLikelyQrPayload(value: string): boolean {
    const v = String(value || '').trim();
    return v.includes('|') || /^[\w\-.:/]+$/.test(v);
  }

  private e(value: any): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

