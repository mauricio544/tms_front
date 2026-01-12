import {Directive, ElementRef, HostListener} from '@angular/core';

@Directive({
  selector: '[uppercase]',
  standalone: true
})

export class Uppercase {
  constructor(private element: ElementRef<HTMLInputElement>) {}
  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const input = this.element.nativeElement;
    const value = input.value.toUpperCase();
    if (input.value !== value) {
      input.value = value;
      input.dispatchEvent(new KeyboardEvent('input', { bubbles: true }));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      console.log(input.value);
    }
  }
}
