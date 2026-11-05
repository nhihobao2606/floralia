import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminSidebar } from '../../../components/admin-sidebar/admin-sidebar';
import { AdminOrder, AdminOrderService } from '../../../services/admin-order-service';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, AdminSidebar],
  templateUrl: './order-detail.html',
  styleUrl: './order-detail.css',
})
export class AdminOrderDetail implements OnInit {
  order: AdminOrder | null = null;
  orders: AdminOrder[] = [];
  loading = true;
  error = '';
  adminName = 'Nguyễn Minh Anh';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly orderService: AdminOrderService,
  ) {}

  ngOnInit(): void {
    const savedUser = localStorage.getItem('adminUser') || sessionStorage.getItem('adminUser');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed?.name) {
          this.adminName = parsed.name;
        }
      } catch {
        this.adminName = 'Nguyễn Minh Anh';
      }
    }

    const id = this.route.snapshot.paramMap.get('id') || '';
    this.loadOrder(id);
  }

  loadOrder(id: string): void {
    this.loading = true;
    this.error = '';
    this.orderService.getAll().subscribe({
      next: response => {
        this.orders = response.orders || [];
        const found = this.orders.find(item => item.id === id);
        this.order = found || this.orders[0] || null;

        if (!this.order) {
          this.error = 'Không tìm thấy đơn hàng này.';
        }
        this.loading = false;
      },
      error: error => {
        this.error = error?.error?.message || 'Không thể tải chi tiết đơn hàng.';
        this.loading = false;
      },
    });
  }

  get customerName(): string {
    return this.order?.receiver?.name || 'Khách hàng';
  }

  get customerPhone(): string {
    return this.order?.receiver?.phone || 'Chưa cập nhật';
  }

  get customerAddress(): string {
    return this.order?.receiver?.address || 'Chưa có địa chỉ';
  }

  get customerEmail(): string {
    return this.order?.receiver?.email || 'Chưa cập nhật';
  }

  get customerOrders(): AdminOrder[] {
    if (!this.order || !this.orders.length) return [];
    const current = this.order;
    const sameCustomer = this.orders.filter(item => {
      if (!item.receiver) return false;
      const sameName = item.receiver.name === current.receiver?.name;
      const samePhone = item.receiver.phone === current.receiver?.phone;
      return sameName || samePhone;
    });
    return sameCustomer.length ? sameCustomer : [current];
  }

  get totalOrderValue(): number {
    return this.customerOrders.reduce((sum, item) => sum + (item.total || 0), 0);
  }

  get recentOrderCount(): number {
    return this.customerOrders.length;
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
  }

  getOrderDate(order: AdminOrder): string {
    return order.createdAt || '14/01/2024';
  }

  goBack(): void {
    void this.router.navigate(['/orders']);
  }

  logout(): void {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminUser');
    void this.router.navigate(['/admin-login']);
  }
}
