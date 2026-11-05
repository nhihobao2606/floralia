import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface AdminMenuItem {
  label: string;
  icon: string;
  route?: string;
  badge?: number | string;
  disabled: boolean;
}

@Component({
  selector: 'app-admin-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './admin-sidebar.html',
  styleUrl: './admin-sidebar.css',
})
export class AdminSidebar {
  @Output() readonly logoutRequested = new EventEmitter<void>();

  readonly menu: AdminMenuItem[] = [
    { label: 'Tổng quan', icon: 'bi-grid-1x2', disabled: true },
    { label: 'Quản lý đơn hàng', icon: 'bi-receipt', route: '/orders', badge: 12, disabled: false },
    { label: 'Quản lý sản phẩm', icon: 'bi-box-seam', disabled: true },
    { label: 'Quản lý danh mục', icon: 'bi-tags', disabled: true },
    { label: 'Quản lý tồn kho', icon: 'bi-layers', disabled: true },
    { label: 'Quản lý người dùng', icon: 'bi-person', disabled: true },
    { label: 'Quản lý bài viết Blog', icon: 'bi-journal-text', route: '/articles', disabled: false },
    { label: 'Quản lý khuyến mãi', icon: 'bi-tag', disabled: true },
  ];

  requestLogout(): void {
    this.logoutRequested.emit();
  }
}
