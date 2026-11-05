import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GUEST_TRACKED_ORDER_KEY, getOrderSlug, Order, OrderService } from '../../services/order-service';
import { ProductService } from '../../services/product-service';
import { ProductNavigationService } from '../../services/product-navigation-service';

@Component({
  selector: 'app-order-success',
  standalone: false,
  templateUrl: './order-success.html',
  styleUrl: './order-success.css'
})
export class OrderSuccess implements OnInit {
  readonly progressSteps = [
    'Đã ghi nhận',
    'Chờ xác nhận',
    'Chờ lấy hàng',
    'Đang giao',
    'Đã giao'
  ];
  order: Order | null = null;
  loading = true;
  pageError = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService,
    private productService: ProductService,
    private productNavigation: ProductNavigationService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = params['id'] || '';
      this.order = this.orderService.getOrderByIdSync(id);
      this.loadOrder(id);
    });
  }

  loadOrder(id: string): void {
    this.loading = true;
    this.orderService.getOrderById(id).subscribe({
      next: (order) => {
        this.order = order;
        this.loading = false;
        if (order) {
          localStorage.setItem(GUEST_TRACKED_ORDER_KEY, order.id);
          window.dispatchEvent(new Event('guest-order-tracked'));
        } else {
          this.pageError = 'Không tìm thấy đơn hàng.';
        }
      },
      error: (error) => {
        this.loading = false;
        this.pageError = error?.error?.message || 'Không thể xác nhận đơn hàng đã được lưu.';
      }
    });
  }

  trackOrder(): void {
    if (this.order) {
      this.router.navigate(['/orders', getOrderSlug(this.order)]);
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

  get currentProgressStep(): number {
    switch (this.order?.status) {
      case 'pending': return 2;
      case 'processing': return 3;
      case 'shipping': return 4;
      case 'delivered':
      case 'completed': return 5;
      default: return 1;
    }
  }

  isProgressStepCompleted(step: number): boolean {
    return step < this.currentProgressStep ||
      (step === this.currentProgressStep && this.order?.status === 'completed');
  }

  formatStepNumber(step: number): string {
    return String(step).padStart(2, '0');
  }

  openProduct(item: Order['items'][number]): void {
    if (item.slug) {
      void this.productNavigation.navigateToProduct({ slug: item.slug });
      return;
    }

    this.productService.getProducts().subscribe({
      next: products => {
        const product = products.find(candidate =>
          candidate.sku === item.sku ||
          candidate.variants?.some(variant => variant.sku === item.sku)
        );
        if (!product?.slug) {
          this.pageError = 'Không tìm thấy trang chi tiết của sản phẩm này.';
          return;
        }
        void this.productNavigation.navigateToProduct(product, products);
      },
      error: error => {
        console.error('Không thể tìm trang chi tiết sản phẩm từ SKU đơn hàng:', error);
        this.pageError = 'Không thể mở sản phẩm lúc này. Vui lòng thử lại.';
      }
    });
  }
}
