import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AdminSidebar } from '../../../components/admin-sidebar/admin-sidebar';
import { AdminOrder, AdminOrderService } from '../../../services/admin-order-service';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, AdminSidebar],
  templateUrl: './orders.html',
  styleUrl: './orders.css'
})
export class AdminOrders implements OnInit {
  orders: AdminOrder[] = [];
  loading = false;
  error = '';
  success = '';
  updatingId: string | null = null;

  constructor(private readonly orderService: AdminOrderService, private readonly router: Router) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading = true;
    this.error = '';
    this.orderService.getAll().subscribe({
      next: response => {
        this.orders = response.orders || [];
        this.loading = false;
      },
      error: error => {
        this.error = error?.error?.message || 'Không thể tải đơn hàng.';
        this.loading = false;
      }
    });
  }

  nextStatus(order: AdminOrder): string | null {
    if (order.status === 'pending') return 'processing';
    if (order.status === 'processing') return 'shipping';
    if (order.status === 'shipping') return 'delivered';
    return null;
  }

  updateStatus(order: AdminOrder): void {
    const status = this.nextStatus(order);
    if (!status || this.updatingId) return;
    this.updatingId = order.id;
    this.error = '';
    this.orderService.updateStatus(order.id, status).subscribe({
      next: response => {
        this.replaceOrder(response.order);
        this.updatingId = null;
      },
      error: error => {
        this.error = error?.error?.message || 'Không thể cập nhật trạng thái đơn.';
        this.updatingId = null;
      }
    });
  }

  approveRefund(order: AdminOrder): void {
    if (this.updatingId) return;
    this.updatingId = order.id;
    this.error = '';
    this.success = '';
    this.orderService.approveRefund(order.id).subscribe({
      next: response => {
        this.replaceOrder(response.order);
        this.updatingId = null;
        this.success = 'Đã duyệt. Sẽ sớm hoàn tiền cho khách hàng.';
      },
      error: error => {
        this.error = error?.error?.message || 'Không thể duyệt yêu cầu hoàn tiền.';
        this.updatingId = null;
      }
    });
  }

  private replaceOrder(updated: AdminOrder): void {
    this.orders = this.orders.map(order => order.id === updated.id ? updated : order);
  }

  logout(): void {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminUser');
    void this.router.navigate(['/admin-login']);
  }
}
