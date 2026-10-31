import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Order, OrderService } from '../../services/order-service';

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
      this.loadOrderDetail(id);
    });
  }

  loadOrderDetail(id: string): void {
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

  formatPrice(num?: number): string {
    return (num || 0).toLocaleString('vi-VN') + ' đ';
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }
}
