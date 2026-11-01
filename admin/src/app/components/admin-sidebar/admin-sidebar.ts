import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-sidebar.html',
  styleUrl: './admin-sidebar.css',
})
export class AdminSidebar {
  @Output() readonly logoutRequested = new EventEmitter<void>();

  readonly menu = [
    { label: 'Tổng quan', icon: 'bi-grid-1x2', disabled: true },
    { label: 'Quản lý đơn hàng', icon: 'bi-receipt', disabled: true },
    { label: 'Quản lý sản phẩm', icon: 'bi-box-seam', disabled: true },
    { label: 'Quản lý danh mục', icon: 'bi-tags', disabled: true },
    { label: 'Quản lý tồn kho', icon: 'bi-layers', disabled: true },
    { label: 'Quản lý người dùng', icon: 'bi-person', disabled: true },
    { label: 'Quản lý bài viết Blog', icon: 'bi-journal-text', disabled: false },
    { label: 'Quản lý khuyến mãi', icon: 'bi-tag', disabled: true },
  ];

  requestLogout(): void {
    this.logoutRequested.emit();
  }
}
