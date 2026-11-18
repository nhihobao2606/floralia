import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Injectable,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface AdminMenuItem {
  label: string;
  icon: string;
  route?: string;
  badge?: number | string;
  disabled: boolean;
}

@Injectable({ providedIn: 'root' })
class AdminSidebarState {
  isCollapsed = false;
}

@Component({
  selector: 'app-admin-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './admin-sidebar.html',
  styleUrl: './admin-sidebar.css',
})
export class AdminSidebar implements OnInit, OnChanges {
  private readonly sidebarState = inject(AdminSidebarState);

  @Input() orderBadge?: number | string | null;
  @Output() readonly logoutRequested = new EventEmitter<void>();

  get isCollapsed(): boolean {
    return this.sidebarState.isCollapsed;
  }

  readonly menu: AdminMenuItem[] = [
    { label: 'Tổng quan', icon: 'bi-grid-1x2', route: '/overview', disabled: false },
    { label: 'Quản lý đơn hàng', icon: 'bi-receipt', route: '/orders', badge: 10, disabled: false },
    { label: 'Quản lý sản phẩm', icon: 'bi-box-seam', route: '/products', disabled: false },
    { label: 'Quản lý danh mục', icon: 'bi-tags', route: '/categories', disabled: false },
    { label: 'Quản lý tồn kho', icon: 'bi-layers', route: '/inventory', disabled: false },
    { label: 'Quản lý người dùng', icon: 'bi-person', route: '/users', disabled: false },
    { label: 'Quản lý bài viết Blog', icon: 'bi-journal-text', route: '/articles', disabled: false },
    { label: 'Quản lý khuyến mãi', icon: 'bi-tag', route: '/vouchers', disabled: false },
    { label: 'Dự báo doanh số', icon: 'bi-graph-up-arrow', route: '/forecast', disabled: false },
    { label: 'Gợi ý sản phẩm', icon: 'bi-stars', route: '/recommendations', disabled: false },
  ];

  ngOnInit(): void {
    this.updateOrderBadge();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['orderBadge']) {
      this.updateOrderBadge();
    }
  }

  toggleSidebar(): void {
    this.sidebarState.isCollapsed = !this.sidebarState.isCollapsed;
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
