import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GUEST_TRACKED_ORDER_KEY, Order, OrderService } from '../../services/order-service';

@Component({
  selector: 'app-order-detail',
  standalone: false,
  templateUrl: './order-detail.html',
  styleUrl: './order-detail.css'
})
export class OrderDetail implements OnInit {
  order: Order | null = null;
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = params['id'] || '4152';
      // Initialize immediately synchronously so page is never blank
      this.order = this.orderService.getOrderByIdSync(id);
      this.loading = false;
      this.clearGuestTrackingIfDelivered(this.order);
      this.loadOrderDetail(id);
    });
  }

  loadOrderDetail(id: string): void {
    this.loading = true;
    this.orderService.getOrderById(id).subscribe({
      next: (order) => {
        this.order = order;
        this.loading = false;
        this.clearGuestTrackingIfDelivered(order);
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  private clearGuestTrackingIfDelivered(order: Order | null): void {
    const isGuest = !localStorage.getItem('currentUser') && !sessionStorage.getItem('currentUser');
    const isDelivered = order && (order.step >= 4 || order.status === 'delivered' || order.status === 'completed');
    if (isGuest && isDelivered && localStorage.getItem(GUEST_TRACKED_ORDER_KEY) === order.id) {
      localStorage.removeItem(GUEST_TRACKED_ORDER_KEY);
      window.dispatchEvent(new Event('guest-order-tracked'));
    }
  }

  formatPrice(num?: number): string {
    return (num || 0).toLocaleString('vi-VN') + ' đ';
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }
}
