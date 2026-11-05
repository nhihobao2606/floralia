import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Router } from '@angular/router';
import { inject } from '@angular/core';

@Component({
  selector: 'app-admin-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './admin-sidebar.html',
  styleUrl: './admin-sidebar.css',
})
export class AdminSidebar {
  private readonly router = inject(Router);
  @Output() readonly logoutRequested = new EventEmitter<void>();

  isProductManagementRoute(): boolean {
    const path = this.router.url.split(/[?#]/, 1)[0];
    return path.startsWith('/products') || path.startsWith('/categories');
  }

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
