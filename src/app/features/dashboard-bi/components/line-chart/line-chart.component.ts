import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface LinePoint {
  label: string;
  value: number;
}

@Component({
  selector: 'bi-line-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './line-chart.component.html',
})
export class LineChartComponent {
  @Input() points: LinePoint[] = [];
  @Input() stroke = '#0ea5b7';

  get maxY(): number {
    return Math.max(...(this.points || []).map((p) => Number(p.value || 0)), 1);
  }

  get polylinePoints(): string {
    const series = this.points || [];
    if (!series.length) return '';
    return series.map((p, idx) => {
      const x = series.length === 1 ? 50 : (idx / (series.length - 1)) * 100;
      const y = 100 - ((Number(p.value || 0) / this.maxY) * 100);
      return `${x},${y}`;
    }).join(' ');
  }
}
