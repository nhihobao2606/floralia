import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-logout-confirmation',
  standalone: false,
  templateUrl: './logout-confirmation.html',
  styleUrl: './logout-confirmation.css',
})
export class LogoutConfirmation {
  @Input() open = false;
  @Output() cancelled = new EventEmitter<void>();
  @Output() confirmed = new EventEmitter<void>();
}
