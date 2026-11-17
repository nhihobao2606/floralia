import { Component, ElementRef, forwardRef, HostListener, Input, OnDestroy, ViewChild } from '@angular/core';
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
export class CustomSelect implements ControlValueAccessor, OnDestroy {
  @Input() options: Array<string | CustomSelectOption> = [];
  @Input() placeholder = 'Chọn';
  @Input() ariaLabel = '';
  @Input() disabled = false;
  @Input() compact = false;
  @Input() maxMenuHeight = 230;
  @Input() fixedMenu = false;
  @Input() minMenuWidth = 0;
  @ViewChild('trigger') trigger?: ElementRef<HTMLButtonElement>;
  private portalMenu?: HTMLDivElement;
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
  toggle(): void {
    if (this.disabled) return;
    if (this.open) { this.closeMenu(); return; }
    this.open = true;
    if (this.fixedMenu) setTimeout(() => this.createPortalMenu(), 0);
  }
  select(option: CustomSelectOption): void {
    this.value = option.value;
    this.onChange(option.value);
    this.onTouched();
    this.closeMenu();
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: MouseEvent): void {
    if (!(event.target instanceof Element) || (!event.target.closest('app-custom-select') && !this.portalMenu?.contains(event.target))) this.closeMenu();
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void { this.closeMenu(); }

  @HostListener('window:resize')
  repositionOnResize(): void { if (this.open && this.fixedMenu) this.positionFixedMenu(); }

  @HostListener('window:scroll')
  repositionOnScroll(): void { if (this.open && this.fixedMenu) this.positionFixedMenu(); }

  private positionFixedMenu(): void {
    const element = this.trigger?.nativeElement;
    const menu = this.portalMenu;
    if (!element || !menu) return;
    const rect = element.getBoundingClientRect();
    const viewportPadding = 8;
    const width = Math.min(Math.max(rect.width, this.minMenuWidth), window.innerWidth - viewportPadding * 2);
    const top = rect.bottom + 8;
    const availableHeight = Math.max(80, window.innerHeight - top - viewportPadding);
    const left = Math.min(Math.max(viewportPadding, rect.left), window.innerWidth - width - viewportPadding);
    Object.assign(menu.style, { top: `${top}px`, left: `${left}px`, width: `${width}px`, maxHeight: `${Math.min(this.maxMenuHeight, this.normalizedOptions.length * 44 + 12, availableHeight)}px` });
  }

  private createPortalMenu(): void {
    if (!this.open || !this.fixedMenu) return;
    this.portalMenu?.remove();
    const menu = document.createElement('div');
    menu.className = 'custom-select-portal-menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', this.ariaLabel || this.placeholder);
    for (const option of this.normalizedOptions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'custom-select-portal-option';
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(option.value === this.value));
      if (option.value === this.value) button.classList.add('selected');
      button.textContent = option.label;
      button.addEventListener('click', () => this.select(option));
      menu.appendChild(button);
    }
    if (!this.normalizedOptions.length) {
      const empty = document.createElement('div');
      empty.className = 'custom-select-portal-empty';
      empty.textContent = 'Chưa có lựa chọn';
      menu.appendChild(empty);
    }
    document.body.appendChild(menu);
    this.portalMenu = menu;
    this.positionFixedMenu();
  }

  private closeMenu(): void {
    this.portalMenu?.remove();
    this.portalMenu = undefined;
    this.open = false;
  }

  ngOnDestroy(): void {
    this.portalMenu?.remove();
  }
}
