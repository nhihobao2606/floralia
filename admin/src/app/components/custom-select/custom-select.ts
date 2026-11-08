import { Component, forwardRef, HostListener, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface CustomSelectOption { label: string; value: string; }

@Component({
  selector: 'app-custom-select',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './custom-select.html',
  styleUrl: './custom-select.css',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CustomSelect), multi: true }],
})
export class CustomSelect implements ControlValueAccessor {
  @Input() options: Array<string | CustomSelectOption> = [];
  @Input() placeholder = 'Chọn';
  @Input() ariaLabel = '';
  @Input() disabled = false;
  value = '';
  open = false;
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  get normalizedOptions(): CustomSelectOption[] {
    return this.options.map(option => typeof option === 'string' ? { label: option, value: option } : option);
  }

  get selectedLabel(): string {
    return this.normalizedOptions.find(option => option.value === this.value)?.label || '';
  }

  writeValue(value: string | null): void { this.value = value || ''; }
  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; }
  toggle(): void { if (!this.disabled) this.open = !this.open; }
  select(option: CustomSelectOption): void {
    this.value = option.value;
    this.onChange(option.value);
    this.onTouched();
    this.open = false;
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: MouseEvent): void {
    if (!(event.target instanceof Element) || !event.target.closest('app-custom-select')) this.open = false;
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void { this.open = false; }
}
