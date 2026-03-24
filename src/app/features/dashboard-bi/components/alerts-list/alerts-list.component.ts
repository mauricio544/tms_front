import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BIDashboardAlertaItem } from '../../../../../../core/services/bi';

@Component({
  selector: 'bi-alerts-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alerts-list.component.html',
})
export class AlertsListComponent {
  @Input() items: BIDashboardAlertaItem[] = [];

  toneClass(level: string): string {
    const value = String(level || '').toLowerCase();
    if (value === 'alta') return 'bg-rose-100 text-rose-700';
    if (value === 'media') return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-700';
  }
}
