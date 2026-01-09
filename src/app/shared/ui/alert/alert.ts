import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';

@Component({
  selector: 'ui-alert',
  standalone: true,
  templateUrl: './alert.html',
  imports: [CommonModule],
})
export class UiAlertComponent implements OnChanges, OnDestroy {
  @Input() show = false;
  @Input() type: 'success' | 'error' | 'info' | 'warning' = 'info';
  @Input() message = '';
  @Input() autoHideMs = 3000;
  @Output() closed = new EventEmitter<void>();

  private timer: any = null;

  get containerClasses(): string {
    return this.type === 'success'
      ? 'bg-green-50 border border-green-200 text-green-700'
      : this.type === 'error'
      ? 'bg-red-50 border border-red-200 text-red-700'
      : this.type === 'warning'
      ? 'bg-yellow-50 border border-yellow-200 text-yellow-700'
      : 'bg-blue-50 border border-blue-200 text-blue-700';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show'] || changes['message']) {
      this.setupTimer();
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  onClose() {
    this.clearTimer();
    this.show = false;
    this.closed.emit();
  }

  private setupTimer() {
    this.clearTimer();
    if (this.show && this.autoHideMs > 0) {
      this.timer = setTimeout(() => this.onClose(), this.autoHideMs);
    }
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

