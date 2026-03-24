import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'bi-kpi-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kpi-card.component.html',
})
export class KpiCardComponent {
  @Input() title = '';
  @Input() value: string | number | null = '-';
  @Input() hint = '';
  @Input() tone: 'neutral' | 'good' | 'warn' | 'bad' | 'info' = 'neutral';
}
