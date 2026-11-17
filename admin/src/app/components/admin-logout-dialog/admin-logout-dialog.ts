import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

@Component({
  selector: 'app-admin-logout-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-logout-dialog.html',
  styleUrl: './admin-logout-dialog.css',
})
export class AdminLogoutDialog {
  @Input() visible = false;
  @Output() cancelled = new EventEmitter<void>();
  @Output() confirmed = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.visible) {
      this.cancelled.emit();
    }
  }
}
