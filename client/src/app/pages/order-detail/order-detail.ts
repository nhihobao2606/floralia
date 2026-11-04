import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CancelReason, Order, OrderItem, OrderService } from '../../services/order-service';
import { CartService } from '../../services/cart-service';
import { ProductService } from '../../services/product-service';
import { ProductNavigationService } from '../../services/product-navigation-service';

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
  loading = true;
  pageError = '';
  actionError = '';
  actionMessage = '';

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
  selectedCancelReasons: string[] = [];
  otherCancelReason = '';
  selectedCancelItemIndexes: number[] = [];
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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService,
    private cartService: CartService,
    private productService: ProductService,
    private productNavigation: ProductNavigationService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = params['id'] || '';
      this.order = this.orderService.getOrderByIdSync(id);
      this.loadOrderDetail(id);
    });
  }

  loadOrderDetail(id: string): void {
    this.loading = true;
    this.orderService.getOrderById(id).subscribe({
      next: (order) => {
        if (order) {
          this.order = order;
        } else {
          this.pageError = 'Không tìm thấy đơn hàng.';
        }
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.pageError = error?.error?.message || 'Không thể tải thông tin đơn hàng.';
      }
    });
  }

  // --- Helpers ---
  canCancel(): boolean {
    if (!this.order?.userId) return false;
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

  getReturnReason(): string {
    if (!this.order) return '';
    return this.order.refundReason ||
      this.order.cancelReason ||
      this.order.cancelReasons?.map(reason => reason.reason).join(', ') ||
      '';
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
    if (this.selectedCancelItemIndexes.length === 0) {
      this.actionError = 'Vui lòng chọn ít nhất một sản phẩm muốn hủy.';
      return;
    }
    this.selectedCancelReasons = [];
    this.otherCancelReason = '';
    this.showCancelModal = true;
  }

  toggleCancelItem(index: number): void {
    this.selectedCancelItemIndexes = this.selectedCancelItemIndexes.includes(index)
      ? this.selectedCancelItemIndexes.filter(selected => selected !== index)
      : [...this.selectedCancelItemIndexes, index];
    this.actionError = '';
    this.actionMessage = '';
  }

  getSelectedCancelItems(): OrderItem[] {
    return this.order?.items.filter((_, index) => this.selectedCancelItemIndexes.includes(index)) || [];
  }

  toggleCancelReason(reason: string): void {
    this.selectedCancelReasons = this.selectedCancelReasons.includes(reason)
      ? this.selectedCancelReasons.filter(selected => selected !== reason)
      : [...this.selectedCancelReasons, reason];
    if (!this.selectedCancelReasons.includes('Khác')) {
      this.otherCancelReason = '';
    }
    this.actionError = '';
  }

  closeCancelModal(): void {
    this.showCancelModal = false;
  }

  confirmCancelOrder(): void {
    if (!this.order) return;
    if (this.selectedCancelItemIndexes.length === 0) {
      this.actionError = 'Vui lòng chọn ít nhất một sản phẩm muốn hủy.';
      return;
    }
    if (this.selectedCancelReasons.length === 0) {
      this.actionError = 'Vui lòng chọn ít nhất một lý do hủy đơn.';
      return;
    }
    if (this.selectedCancelReasons.includes('Khác') && !this.otherCancelReason.trim()) {
      this.actionError = 'Vui lòng nhập lý do khác.';
      return;
    }
    const pm = (this.order.paymentMethod || '').toLowerCase();
    const isPaid = ['paypal', 'vnpay', 'chuyển khoản', 'momo', 'qr'].some(method => pm.includes(method));
    this.actionError = '';
    const previousTotal = this.order.total;
    const cancelReasons: CancelReason[] = this.selectedCancelReasons.map(reason => ({
      reason,
      ...(reason === 'Khác' ? { detail: this.otherCancelReason.trim() } : {})
    }));
    const selectedIndexes = [...this.selectedCancelItemIndexes];
    const previousOrder = this.order;
    const selectedIndexSet = new Set(selectedIndexes);
    const reasonSummary = cancelReasons
      .map(reason => reason.detail ? `${reason.reason}: ${reason.detail}` : reason.reason)
      .join(', ');
    const cancelledItems = previousOrder.items
      .filter((_, index) => selectedIndexSet.has(index))
      .map(item => ({ ...item, cancelReason: reasonSummary, cancelReasons }));
    const remainingItems = previousOrder.items.filter((_, index) => !selectedIndexSet.has(index));
    const subtotal = remainingItems.reduce(
      (sum, item) => sum + Number(item.total ?? item.price * item.quantity),
      0
    );
    const itemProductDiscount = (item: Order['items'][number]): number => Number(
      item.productDiscount ??
      Math.max(0, Number(item.oldPrice ?? item.price) - Number(item.salePrice ?? item.price)) * item.quantity
    ) || 0;
    const productDiscount = remainingItems.reduce((sum, item) => sum + itemProductDiscount(item), 0);
    const allProductDiscount = previousOrder.items.reduce((sum, item) => sum + itemProductDiscount(item), 0);
    const oldVoucherDiscount = Number(
      previousOrder.voucherDiscount ?? Math.max(0, previousOrder.discount - allProductDiscount)
    ) || 0;
    const oldSaleSubtotal = previousOrder.items.reduce(
      (sum, item) => sum + Number(item.salePrice ?? item.price) * item.quantity,
      0
    );
    const remainingSaleSubtotal = remainingItems.reduce(
      (sum, item) => sum + Number(item.salePrice ?? item.price) * item.quantity,
      0
    );
    const voucherDiscount = remainingItems.length && oldSaleSubtotal > 0
      ? Math.min(remainingSaleSubtotal, Math.round(oldVoucherDiscount * remainingSaleSubtotal / oldSaleSubtotal))
      : 0;
    const discount = productDiscount + voucherDiscount;
    const optimisticOrder: Order = {
      ...previousOrder,
      items: remainingItems,
      cancelledItems: [...(previousOrder.cancelledItems || []), ...cancelledItems],
      cancelReasons,
      cancelReason: reasonSummary,
      subtotal,
      productDiscount,
      voucherDiscount,
      discount,
      shippingFee: remainingItems.length ? previousOrder.shippingFee : 0,
      total: subtotal - discount + (remainingItems.length ? previousOrder.shippingFee : 0),
      ...(remainingItems.length === 0 ? { status: 'cancelled', statusLabel: 'ĐÃ HỦY' } : {})
    };
    this.isCancelSubmitting = true;
    this.closeCancelModal();
    this.order = optimisticOrder;
    this.selectedCancelItemIndexes = [];
    this.orderService.cancelOrderItems(
      this.order.id,
      selectedIndexes,
      cancelReasons
    ).subscribe({
      next: ({ order }) => {
        this.isCancelSubmitting = false;
        this.order = order;
        const refundDue = Math.max(0, previousTotal - order.total);
        const partial = order.status !== 'cancelled';
        const successMessage = partial ? 'Đã hủy sản phẩm đã chọn.' : 'Đã hủy toàn bộ đơn hàng.';
        this.actionMessage = isPaid && refundDue > 0
          ? `${successMessage}\nSẽ sớm hoàn tiền phần chênh lệch về cho bạn.`
          : successMessage;
      },
      error: (error) => {
        this.isCancelSubmitting = false;
        this.order = previousOrder;
        this.selectedCancelItemIndexes = selectedIndexes;
        this.actionError = error?.error?.message || 'Không thể hủy đơn hàng. Vui lòng thử lại.';
      }
    });
  }

  // --- Return & Refund ---
  openReturnModal(): void {
    this.selectedReturnReason = 'Hàng bị vỡ/hỏng khi vận chuyển';
    this.returnNote = '';
    this.returnImages = [];
    this.showReturnModal = true;
  }

  closeReturnModal(): void {
    this.showReturnModal = false;
  }

  onReturnImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    Array.from(input.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e: any) => this.returnImages.push(e.target.result);
      reader.readAsDataURL(file);
    });
  }

  confirmReturn(): void {
    if (!this.order) return;
    this.actionError = '';
    this.orderService.updateOrderStatus(
      this.order.id,
      'refund_pending',
      'CHỜ DUYỆT HOÀN TIỀN',
      {
        refundReason: this.selectedReturnReason,
        refundNote: this.returnNote,
        refundImages: this.returnImages
      }
    ).subscribe({
      next: ({ order }) => {
        this.order = order;
        this.closeReturnModal();
        alert('Yêu cầu hoàn tiền đã được gửi. Sẽ sớm được duyệt.');
      },
      error: (error) => {
        this.actionError = error?.error?.message || 'Không thể gửi yêu cầu hoàn tiền. Vui lòng thử lại.';
      }
    });
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
    const currentCart = this.cartService.getCart();
    this.order.items.forEach(it => {
      currentCart.push({
        id: it.sku,
        productId: it.sku,
        sku: it.sku,
        name: it.name,
        title: it.name,
        price: it.price,
        quantity: it.quantity,
        image: it.image,
        thumbnail: it.image,
        variantLabel: it.variant || ''
      });
    });
    this.cartService.saveCart(currentCart);
    this.router.navigate(['/cart']);
  }

  formatPrice(num?: number): string {
    return (num || 0).toLocaleString('vi-VN') + ' đ';
  }

  goBack(): void {
    this.router.navigate(['/orders']);
  }
}
