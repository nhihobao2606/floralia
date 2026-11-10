import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

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
export class AdminSidebar implements OnInit, OnChanges {
  private readonly router = inject(Router);

  @Input() orderBadge?: number | string | null;
  @Output() readonly logoutRequested = new EventEmitter<void>();

  isProductManagementRoute(): boolean {
    const path = this.router.url.split(/[?#]/, 1)[0];
    return path.startsWith('/products') || path.startsWith('/categories');
  }

  readonly menu: AdminMenuItem[] = [
    { label: 'Tổng quan', icon: 'bi-grid-1x2', route: '/overview', disabled: false },
    { label: 'Quản lý đơn hàng', icon: 'bi-receipt', route: '/orders', badge: 10, disabled: false },
    { label: 'Quản lý sản phẩm', icon: 'bi-box-seam', disabled: true },
    { label: 'Quản lý danh mục', icon: 'bi-tags', disabled: true },
    { label: 'Quản lý tồn kho', icon: 'bi-layers', route: '/inventory', disabled: false },
    { label: 'Quản lý người dùng', icon: 'bi-person', route: '/users', disabled: false },
    { label: 'Quản lý bài viết Blog', icon: 'bi-journal-text', route: '/articles', disabled: false },
    { label: 'Quản lý khuyến mãi', icon: 'bi-tag', route: '/vouchers', disabled: false },
  ];

  ngOnInit(): void {
    this.updateOrderBadge();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['orderBadge']) {
      this.updateOrderBadge();
    }
  }

  private updateOrderBadge(): void {
    if (this.orderBadge !== undefined && this.orderBadge !== null) {
      const orderItem = this.menu.find((m) => m.route === '/orders');
      if (orderItem) {
        orderItem.badge = this.orderBadge;
      }
    }
  }

  requestLogout(): void {
    this.logoutRequested.emit();
  }
}
