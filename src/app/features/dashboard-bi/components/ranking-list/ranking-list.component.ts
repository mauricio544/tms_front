import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface RankingItem {
  label: string;
  value: number;
  helper?: string;
}

@Component({
  selector: 'bi-ranking-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ranking-list.component.html',
})
export class RankingListComponent {
  @Input() items: RankingItem[] = [];
  @Input() emptyText = 'Sin datos';
  @Input() color = '#0891b2';

  get maxValue(): number {
    return Math.max(...(this.items || []).map((it) => Number(it.value || 0)), 1);
  }

  pct(value: number): number {
    return Math.round((Number(value || 0) / this.maxValue) * 100);
  }
}
