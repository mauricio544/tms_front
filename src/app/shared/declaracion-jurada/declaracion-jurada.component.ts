import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, ViewChild } from '@angular/core';

export interface DeclaracionJuradaData {
  remitenteNombre?: string;
  remitenteDoc?: string;
  remitenteDomicilio?: string;
  itemsDescripcion?: string;
}

@Component({
  selector: 'app-declaracion-jurada',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './declaracion-jurada.component.html',
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
      .thermal-80 {
        width: 74mm !important;
        border: 0 !important;
        box-shadow: none !important;
      }
      .no-print {
        display: none !important;
      }
      .thermal-80, .thermal-80 * {
        color: #000 !important;
      }
      .thermal-80 img {
        image-rendering: crisp-edges;
      }
      * {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  `]
})
export class DeclaracionJuradaComponent {
  @Input() data: DeclaracionJuradaData | null = null;
  @ViewChild('printRoot') printRoot?: ElementRef<HTMLElement>;

  readonly lineas: string[] = [
    'Artículo 411. - El que, en un procedimiento administrativo, hace una falsa declaración en relación a hechos o circunstancias que le corresponde probar, violando la presunción de veracidad establecida por ley, será reprimido con pena privativa de libertad no menor de uno ni mayor de cuatro años.”',
    'Artículo 2°.- Modalidades de Contrabando',
    'Constituyen modalidades del delito de Contrabando y serán reprimidos con las mismas penas señaladas en el artículo 1°, quienes desarrollen las siguientes acciones:a. Extraer, consumir, utilizar o disponer de las mercancías de la zona primaria delimitada por la Ley General de Aduanas o por leyes especiales sin haberse autorizado legalmente su retiro por la Administración Aduanera.b. Consumir, almacenar, utilizar o disponer de las mercancías que hayan sido autorizadas para su traslado de una zona primaria a otra, para su reconocimiento físico, sin el pago previo de los tributos o gravámenesc. Internar mercancías de una zona franca o zona geográfica nacional de tratamiento aduanero especial o de alguna zona geográfica nacional de menor tributación y sujeta a un régimen especial arancelario hacia el resto del territorio nacional sin el cumplimiento de los requisitos de Ley o el pago previo de los tributos diferenciales.d. Conducir en cualquier medio de transporte, hacer circular dentro del territorio nacional, embarcar, desembarcar o transbordar mercancías, sin haber sido sometidas al ejercicio de control aduanero.Informe N° 93-2021-SUNAT/340000',
    'e. Intentar introducir o introduzca al territorio nacional mercancías con elusión o burla del control aduanero utilizando cualquier documento aduanero ante la Administración Aduanera.(*)',
    '(*) Artículo derogado por la Única Disposición Complementaria Derogatoria del D.Leg N° 1542',
    '.',
    'Firmando  y colocado mi huela dactilar . con fecha ……………………………...',
    '………………………………..',
    'DNI: ………………………..',
  ];

  get encabezadoLinea(): string {
    const nombre = String(this.data?.remitenteNombre || '').trim() || '…………………………………………………………………..';
    const dni = String(this.data?.remitenteDoc || '').trim() || '………………………';
    const domicilio = String(this.data?.remitenteDomicilio || '').trim() || '………………………………………………………………………………';
    const items = String(this.data?.itemsDescripcion || '').trim() || '………………..';
    return `YO ${nombre} IDENTIFICADA (O)  CON DNI:${dni}  , CON DOMICILIO  ${domicilio} , Con toda  la Veracidad Declaro que lo  enviado  Como Encomienda  es bajo mi responsabilidad por ser  PROPIETARIO Y/o contiene ${items} además cuenta con la documentación dando fe a lo indicado .Todo sin perjudicar a la Empresa y al sr Conductor recalcando  que dicha encomienda – me pertenece adjuntando mi Copia de DNI.`;
  }

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
        @page { size: 80mm auto; margin: 2.5mm; }
        html, body { width: 80mm; margin: 0; padding: 0; background: #fff; color:#000; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .thermal-80 { width: 74mm !important; max-width: 74mm !important; }
        .thermal-80, .thermal-80 * { color: #000 !important; }
        .thermal-80 img { image-rendering: crisp-edges; }
        .no-print { display: none !important; }
      </style>
    `;
    win.document.open();
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><base href="${baseHref}">${linkTags}${styleTags}${printCss}<title>Imprimir Declaración</title></head><body>${node.outerHTML}</body></html>`);
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
    setTimeout(doPrint, 600);
  }

  companyLogoSrc(): string | null {
    const fromMe = (() => {
      try {
        const rawMe = localStorage.getItem('me');
        if (!rawMe) return '';
        const me = JSON.parse(rawMe) as any;
        return String(me?.companies?.[0]?.logo || '').trim();
      } catch {
        return '';
      }
    })();
    const raw = String(
      localStorage.getItem('cia_logo') ||
      localStorage.getItem('company_logo') ||
      localStorage.getItem('logo') ||
      fromMe ||
      ''
    ).trim();
    if (!raw || raw.toLowerCase() === 'null' || raw.toLowerCase() === 'undefined') return null;
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:image')) return raw;
    if (raw.startsWith('/')) {
      try { return `${window.location.origin}${raw}`; } catch { return raw; }
    }
    if (/\.(png|jpg|jpeg|webp|svg)$/i.test(raw)) {
      try { return `${window.location.origin}/${raw.replace(/^\/+/, '')}`; } catch { return raw; }
    }
    return `data:image/png;base64,${raw}`;
  }
}
