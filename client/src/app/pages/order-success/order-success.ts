import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Order, OrderService } from '../../services/order-service';

@Component({
  selector: 'app-order-success',
  standalone: false,
  templateUrl: './order-success.html',
  styleUrl: './order-success.css'
})
export class OrderSuccess implements OnInit {
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
      this.loadOrder(id);
    });
  }

  loadOrder(id: string): void {
    this.loading = true;
    this.orderService.getOrderById(id).subscribe({
      next: (order) => {
        this.order = order;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  trackOrder(): void {
    if (this.order) {
      this.router.navigate(['/orders', this.order.id]);
    } else {
      this.router.navigate(['/orders']);
    }
  }

  continueShopping(): void {
    this.router.navigate(['/products']);
  }

  formatPrice(num?: number): string {
    return (num || 0).toLocaleString('vi-VN') + 'đ';
  }
}
