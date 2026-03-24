import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-grr-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './grr-preview.component.html',
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
export class GrrPreviewComponent {
  @Input() doc: any | null = null;

  print(): void {
    if (!this.doc) {
      window.print();
      return;
    }
    const win = window.open('', '_blank', 'width=420,height=800');
    if (!win) return;
    const logo = this.companyLogoSrc();
    const qr = this.toImageSrc(this.doc?.qrDataUrl);
    const items = (this.doc?.items || []).map((it: any, i: number) => `
      <div class="item">
        <div><b>${i + 1}. ${this.e(it?.description || '')}</b></div>
        <div>SKU: ${this.e(it?.sku || '-')}</div>
        <div>Cant: ${this.e(it?.qty || 0)} ${this.e(it?.uom || 'UND')}</div>
        <div>Peso: ${this.e(it?.weightKg || 0)} kg</div>
      </div>
    `).join('');
    const style = `
      @page { size: 80mm auto; margin: 2.5mm; }
      html, body { width: 80mm; margin: 0; padding: 0; background: #fff; font-family: Arial, Helvetica, sans-serif; color:#000; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .doc { width: 74mm; margin: 0 auto; color: #000; font-size: 11px; line-height: 1.24; }
      .head, .blk { border-bottom: 0.5px solid #000; padding: 1.8mm 0; }
      .head { text-align: center; }
      .logo { max-height: 16mm; max-width: 40mm; object-fit: contain; margin: 0 auto 1mm; display: block; image-rendering: crisp-edges; }
      .title { font-weight: 700; letter-spacing: .2px; }
      .num { font-weight: 700; margin-top: .5mm; }
      .ttl { font-weight: 700; margin-bottom: 1mm; }
      .row { margin: .5mm 0; word-break: break-word; }
      .item { border-bottom: 0.5px solid #000; padding: 1mm 0; }
      .item:last-child { border-bottom: 0; }
      .qr { text-align: center; margin-top: 1.5mm; }
      .qr img { width: 30mm; height: 30mm; object-fit: contain; image-rendering: crisp-edges; }
      .foot { text-align: center; padding-top: 2mm; font-size: 10px; color: #000; }
    `;
    const html = `
      <div class="doc">
        <div class="head">
          ${logo ? `<img class="logo" src="${logo}" alt="Logo">` : ''}
          <div class="title">GUIA DE REMISION TRANSPORTISTA</div>
          <div class="num">${this.e(this.doc?.fullNumber || '-')}</div>
        </div>
        <div class="blk">
          <div class="ttl">Datos generales</div>
          <div class="row">Número de Registro MTC:15178239CNG</div>
          <div class="row">Emitida: ${this.e(this.doc?.issuedAt || '-')}</div>
          <div class="row">Inicio traslado: ${this.e(this.doc?.startDatetime || '-')}</div>
          <div class="row">Empresa: ${this.e(this.doc?.companyName || '-')}</div>
          <div class="row">RUC: ${this.e(this.doc?.companyRuc || '-')}</div>
        </div>
        <div class="blk">
          <div class="ttl">Ruta</div>
          <div class="row">Origen: ${this.e(this.doc?.originName || '-')}</div>
          <div class="row">Dirección origen: ${this.e(this.doc?.originAddress || '-')}</div>
          <div class="row">Destino: ${this.e(this.doc?.destName || '-')}</div>
          <div class="row">Dirección destino: ${this.e(this.doc?.destAddress || '-')}</div>
        </div>
        <div class="blk">
          <div class="ttl">Transporte</div>
          <div class="row">VehÃ­culo: ${this.e(this.doc?.vehiclePlate || '-')}</div>
          <div class="row">Conductor: ${this.e(this.doc?.driverName || '-')}</div>
          <div class="row">Doc: ${this.e((this.doc?.driverDocType || '') + ' ' + (this.doc?.driverDocNumber || ''))}</div>
          <div class="row">Licencia: ${this.e(this.doc?.driverLicense || '-')}</div>
        </div>
        <div class="blk">
          <div class="ttl">Bienes trasladados</div>
          ${items || '<div class="row">Sin Ã­tems</div>'}
          <div class="row"><b>Total cant:</b> ${this.e(this.doc?.totalQty || 0)}</div>
          <div class="row"><b>Total peso:</b> ${this.e(this.doc?.totalWeightKg || 0)} kg</div>
        </div>
        ${(this.doc?.hashSha256 || qr) ? `
          <div class="blk">
            <div class="ttl">Trazabilidad</div>
            ${this.doc?.hashSha256 ? `<div class="row">Hash: ${this.e(this.doc?.hashSha256)}</div>` : ''}
            ${qr ? `<div class="qr"><img src="${qr}" alt="QR"></div>` : ''}
          </div>
        ` : ''}
        <div class="foot">Representacion impresa de guia de remision transportista</div>
      </div>
    `;
    win.document.open();
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Imprimir Guia de Remision Transportista</title><style>${style}</style></head><body>${html}</body></html>`);
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
    if (c0 === 0x89 && c1 === 0x50 && c2 === 0x4E && c3 === 0x47) return true;
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

