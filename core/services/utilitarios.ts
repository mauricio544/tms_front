import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class Utilitarios {
  formatFecha(fecha: string | Date): string {
    if (!fecha) return '';

    const d = new Date(fecha);

    if (isNaN(d.getTime())) return '';

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
