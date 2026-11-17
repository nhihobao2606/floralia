import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CancelReason, Order, OrderItem, OrderService } from '../../services/order-service';
import { ProductService } from '../../services/product-service';
import { ProductNavigationService } from '../../services/product-navigation-service';
import { formatVietnameseDong } from "../../shared/vnd-format";

@Component({
  selector: 'app-order-detail',
  standalone: false,
  templateUrl: './order-detail.html',
  styleUrl: './order-detail.css'
})
export class OrderDetail implements OnInit {
  readonly progressSteps = [
    'Đã ghi nhận',
    'Chờ xác nhận',
    'Chờ lấy hàng',
    'Đang giao',
    'Đã giao'
  ];
  order: Order | null = null;
  reorderItems: OrderItem[] | null = null;
  loading = true;
  pageError = '';
  actionError = '';
  actionMessage = '';
  private loadRequestId = 0;

  // Cancel modal
  showCancelModal = false;
  cancelReasons: string[] = [
    'Muốn thay đổi địa chỉ giao hàng',
    'Muốn nhập/thay đổi mã giảm giá',
    'Muốn thay đổi sản phẩm (loại trà, dung lượng, số lượng...)',
    'Thủ tục thanh toán quá rắc rối',
    'Tìm thấy giá rẻ hơn ở chỗ khác',
    'Đổi ý, không muốn mua nữa',
    'Khác'
  ];
  selectedCancelReason = '';
  otherCancelReason = '';
  isCancelSubmitting = false;

  // Return/Refund modal
  showReturnModal = false;
  returnReasons: string[] = [
    'Hàng bị vỡ/hỏng khi vận chuyển',
    'Hàng không đúng mô tả',
    'Giao sai sản phẩm',
    'Chất lượng không như kỳ vọng',
    'Muốn đổi sang sản phẩm khác',
    'Lý do khác'
  ];
  selectedReturnReason = 'Hàng bị vỡ/hỏng khi vận chuyển';
  returnNote = '';
  returnImages: string[] = [];
  isReturnSubmitting = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService,
    private productService: ProductService,
    private productNavigation: ProductNavigationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = params['id'] || '';
      this.order = this.orderService.getOrderByIdSync(id);
      this.loadOrderDetail(id);
    });
  }

  loadOrderDetail(id: string): void {
    const requestId = ++this.loadRequestId;
    this.order = id ? this.orderService.getOrderByIdSync(id) : null;
    this.loading = true;
    this.pageError = '';
    if (!id) {
      this.loading = false;
      this.pageError = 'Không tìm thấy đơn hàng.';
      return;
    }

    this.orderService.getOrderById(id).subscribe({
      next: (order) => {
        if (requestId !== this.loadRequestId) return;
        if (order) {
          this.order = order;
        } else if (!this.order) {
          this.pageError = 'Không tìm thấy đơn hàng.';
        } else {
          this.pageError = 'Không thể làm mới đơn hàng. Đang hiển thị dữ liệu đã lưu.';
        }
        this.loading = false;
      },
      error: (error) => {
        if (requestId !== this.loadRequestId) return;
        this.loading = false;
        this.pageError = this.order
          ? 'Không thể làm mới đơn hàng. Đang hiển thị dữ liệu đã lưu.'
          : error?.error?.message || 'Không thể tải thông tin đơn hàng.';
      }
    });
  }

  // --- Helpers ---
  canCancel(): boolean {
    if (!this.order) return false;
    const s = this.order.status;
    return s === 'pending' || s === 'processing';
  }

  canReturn(): boolean {
    if (!this.order?.userId) return false;
    return this.order.status === 'delivered';
  }

  isRefundPending(): boolean {
    return this.order?.status === 'refund_pending';
  }

  isRefundApproved(): boolean {
    return this.order?.status === 'refund_approved';
  }

  getDisplayItems(): Array<OrderItem & { statusReason: string }> {
    if (!this.order) return [];
    const items = this.order.items?.length
      ? this.order.items
      : this.order.status === 'cancelled'
        ? this.order.cancelledItems || []
        : [];
    return items.map(item => ({
      ...item,
      statusReason: this.getItemStatusReason(item)
    }));
  }

  private getItemStatusReason(item: OrderItem): string {
    if (!this.order) return '';
    if (this.order.status === 'cancelled') {
      const cancelledItem = this.order.cancelledItems?.find(
        candidate => candidate.sku === item.sku && candidate.variant === item.variant
      );
      const reasons = cancelledItem?.cancelReasons?.length
        ? cancelledItem.cancelReasons
        : this.order.cancelReasons;
      const reason = reasons?.map(entry =>
        entry.detail ? `${entry.reason}: ${entry.detail}` : entry.reason
      ).join(', ') || cancelledItem?.cancelReason || this.order.cancelReason;
      return reason ? `Lý do hủy: ${reason}` : '';
    }

    if (['refund_pending', 'refund_approved', 'refunded'].includes(this.order.status)) {
      return this.order.refundReason ? `Lý do trả hàng: ${this.order.refundReason}` : '';
    }
    return '';
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

  openProduct(item: OrderItem): void {
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
          this.actionError = 'Không tìm thấy trang chi tiết của sản phẩm này.';
          return;
        }
        void this.productNavigation.navigateToProduct(product, products);
      },
      error: error => {
        console.error('Không thể tìm trang chi tiết sản phẩm từ SKU đơn hàng:', error);
        this.actionError = 'Không thể mở sản phẩm lúc này. Vui lòng thử lại.';
      }
    });
  }

  // --- Cancel Order ---
  openCancelModal(): void {
    this.actionError = '';
    this.actionMessage = '';
    this.selectedCancelReason = '';
    this.otherCancelReason = '';
    this.showCancelModal = true;
  }

  toggleCancelReason(reason: string): void {
    this.selectedCancelReason = reason;
    if (reason !== 'Khác') {
      this.otherCancelReason = '';
    }
    this.actionError = '';
  }

  closeCancelModal(): void {
    if (this.isCancelSubmitting) return;
    this.showCancelModal = false;
  }

  confirmCancelOrder(): void {
    if (!this.order || this.isCancelSubmitting) return;
    if (!this.selectedCancelReason) {
      alert('Vui lòng chọn lý do hủy đơn.');
      return;
    }
    if (this.selectedCancelReason === 'Khác' && !this.otherCancelReason.trim()) {
      alert('Vui lòng nhập lý do khác.');
      return;
    }
    const pm = (this.order.paymentMethod || '').toLowerCase();
    const isPaid = ['paypal', 'vnpay', 'chuyển khoản', 'momo', 'qr'].some(method => pm.includes(method));
    this.actionError = '';
    const cancelReasons: CancelReason[] = [{
      reason: this.selectedCancelReason,
      ...(this.selectedCancelReason === 'Khác' ? { detail: this.otherCancelReason.trim() } : {})
    }];
    this.isCancelSubmitting = true;
    this.orderService.updateOrderStatus(
      this.order.id,
      'cancelled',
      'ĐÃ HỦY',
      { cancelReasons }
    ).subscribe({
      next: ({ order }) => {
        this.isCancelSubmitting = false;
        this.order = order;
        this.closeCancelModal();
        this.actionMessage = isPaid
          ? 'Đã hủy đơn hàng. Sẽ sớm hoàn tiền về cho bạn.'
          : 'Đã hủy đơn hàng.';
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.isCancelSubmitting = false;
        alert(error?.error?.message || 'Không thể hủy đơn hàng. Vui lòng thử lại.');
      }
    });
  }

  // --- Return & Refund ---
  openReturnModal(): void {
    if (this.isReturnSubmitting) return;
    this.actionError = '';
    this.selectedReturnReason = 'Hàng bị vỡ/hỏng khi vận chuyển';
    this.returnNote = '';
    this.returnImages = [];
    this.showReturnModal = true;
  }

  closeReturnModal(): void {
    if (this.isReturnSubmitting) return;
    this.showReturnModal = false;
  }

  onReturnImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || this.isReturnSubmitting) return;
    this.actionError = '';
    const files = Array.from(input.files);
    if (this.returnImages.length + files.length > 5) {
      this.actionError = 'Bạn chỉ có thể gửi tối đa 5 ảnh minh chứng.';
      input.value = '';
      return;
    }
    files.forEach(file => {
      if (!file.type.startsWith('image/')) {
        this.actionError = 'Vui lòng chỉ chọn tệp hình ảnh.';
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        this.actionError = 'Mỗi ảnh minh chứng phải có dung lượng tối đa 10 MB.';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string' && reader.result.length <= 14_000_000) {
          this.returnImages.push(reader.result);
        } else {
          this.actionError = 'Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn.';
        }
        this.cdr.markForCheck();
      };
      reader.onerror = () => {
        this.actionError = 'Không thể đọc ảnh đã chọn. Vui lòng thử lại.';
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(file);
    });
    input.value = '';
    this.cdr.markForCheck();
  }

  confirmReturn(): void {
    if (!this.order || this.isReturnSubmitting) return;
    this.actionError = '';
    if (!this.selectedReturnReason.trim()) {
      this.actionError = 'Vui lòng chọn lý do trả hàng/hoàn tiền.';
      return;
    }
    this.showReturnModal = false;
    alert('Chức năng đang phát triển.');
    this.cdr.markForCheck();
  }

  // --- Confirm Received ---
  confirmReceived(): void {
    if (!this.order) return;
    this.orderService.updateOrderStatus(this.order.id, 'completed', 'HOÀN THÀNH').subscribe({
      next: () => this.router.navigate(['/orders'], { queryParams: { tab: 'completed' } }),
      error: (error) => {
        this.actionError = error?.error?.message || 'Không thể xác nhận đã nhận hàng.';
      }
    });
  }

  reorder(): void {
    if (!this.order || !this.order.items || this.order.items.length === 0) {
      this.router.navigate(['/products']);
      return;
    }
    this.reorderItems = this.order.items;
  }

  proceedToReorderCheckout(): void {
    this.reorderItems = null;
    void this.router.navigate(['/checkout']);
  }

  formatPrice(num?: number): string {
    return formatVietnameseDong(num);
  }

  goBack(): void {
    const queryParams = this.route.snapshot.queryParamMap;
    this.router.navigate(['/orders'], {
      queryParams: {
        tab: queryParams.get('tab') || 'all',
        q: queryParams.get('q') || null
      }
    });
  }
}
