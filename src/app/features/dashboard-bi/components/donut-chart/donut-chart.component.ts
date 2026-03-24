import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DonutItem {
  label: string;
  value: number;
  color?: string;
}

@Component({
  selector: 'bi-donut-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './donut-chart.component.html',
})
export class DonutChartComponent {
  @Input() items: DonutItem[] = [];

  private readonly palette = ['#0ea5b7', '#0891b2', '#0369a1', '#334155', '#10b981', '#f59e0b', '#e11d48'];

  get total(): number {
    return Math.max((this.items || []).reduce((acc, it) => acc + Number(it.value || 0), 0), 1);
  }

  get conicStyle(): string {
    if (!this.items.length) return 'conic-gradient(#e2e8f0 0deg 360deg)';
    let acc = 0;
    const slices = this.items.map((item, idx) => {
      const value = Number(item.value || 0);
      const start = acc;
      const deg = (value / this.total) * 360;
      acc += deg;
      const color = item.color || this.palette[idx % this.palette.length];
      return `${color} ${start}deg ${acc}deg`;
    });
    return `conic-gradient(${slices.join(',')})`;
  }

  swatch(item: DonutItem, idx: number): string {
    return item.color || this.palette[idx % this.palette.length];
  }
}
