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
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-admin-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
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
  readonly menu = [
    { label: 'Tổng quan', icon: 'bi-grid-1x2', disabled: true, route: '' },
    { label: 'Quản lý đơn hàng', icon: 'bi-receipt', disabled: false, route: '/orders' },
    { label: 'Quản lý sản phẩm', icon: 'bi-box-seam', disabled: true, route: '' },
    { label: 'Quản lý danh mục', icon: 'bi-tags', disabled: true, route: '' },
    { label: 'Quản lý tồn kho', icon: 'bi-layers', disabled: true, route: '' },
    { label: 'Quản lý người dùng', icon: 'bi-person', disabled: false, route: '/users' },
    { label: 'Quản lý bài viết Blog', icon: 'bi-journal-text', disabled: false, route: '/articles' },
    { label: 'Quản lý khuyến mãi', icon: 'bi-tag', disabled: false, route: '/vouchers' },
  ];

  requestLogout(): void {
    this.logoutRequested.emit();
  }
}
