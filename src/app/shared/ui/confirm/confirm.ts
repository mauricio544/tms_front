import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'ui-confirm',
  standalone: true,
  templateUrl: './confirm.html',
  imports: [CommonModule],
})
export class UiConfirmComponent {
  @Input() show = false;
  @Input() title = 'Confirmar';
  @Input() message = '';
  @Input() confirmText = 'Aceptar';
  @Input() cancelText = 'Cancelar';
  @Input() type: 'danger' | 'default' = 'default';

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  onConfirm() { this.confirm.emit(); }
  onCancel() { this.cancel.emit(); }
}

