import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-unsaved-changes-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './unsaved-changes-dialog.html',
  styleUrl: './unsaved-changes-dialog.css',
})
export class UnsavedChangesDialog {
  @Input() visible = false;
  @Input() saving = false;
  @Input() error = '';
  @Output() readonly stay = new EventEmitter<void>();
  @Output() readonly discard = new EventEmitter<void>();
  @Output() readonly saveAndLeave = new EventEmitter<void>();
}
