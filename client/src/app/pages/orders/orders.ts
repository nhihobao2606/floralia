import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CancelReason, getOrderSlug, Order, OrderItem, OrderService } from '../../services/order-service';

@Component({
  selector: 'app-orders',
  standalone: false,
  templateUrl: './orders.html',
  styleUrl: './orders.css'
})
export class Orders implements OnInit, OnDestroy {
  showLogoutConfirm = false;
  menu = [
    { label: 'Tổng quan', icon: 'bi-grid', link: '/account' },
    { label: 'Đơn hàng', icon: 'bi-box-seam', link: '/orders' },
    { label: 'Sổ địa chỉ', icon: 'bi-geo-alt', link: '/addresses' },
    { label: 'Sản phẩm yêu thích', icon: 'bi-heart', link: '/wishlist' },
  ];

  tabs = [
    { id: 'all', label: 'Tất cả' },
    { id: 'pending', label: 'Chờ xác nhận' },
    { id: 'processing', label: 'Chờ lấy hàng' },
    { id: 'shipping', label: 'Chờ giao hàng' },
    { id: 'completed', label: 'Hoàn thành' },
    { id: 'cancelled', label: 'Đã hủy' },
    { id: 'refunded', label: 'Trả hàng/Hoàn tiền' },
  ];

  activeTab = 'all';
  searchQuery = '';
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;
  private loadRequestId = 0;
  orders: Order[] = [];
  filteredOrders: Order[] = [];
  loading = true;
  loadError = '';
  reorderItems: OrderItem[] | null = null;

  user: any = null;
  initial = 'H';
  avatar = '';

  // Cancel order modal state
  showCancelModal = false;
  cancellingOrder: Order | null = null;
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

  // Contact modal state
  showContactModal = false;
  contactingOrder: Order | null = null;

  // Return & refund modal (for completed orders only)
  showReturnModal = false;
  returningOrder: Order | null = null;
  returnReasons: string[] = [
    'Hàng bị vỡ/hỏng khi vận chuyển',
    'Hàng không đúng mô tả',
    'Giao sai sản phẩm',
    'Chất lượng không như kỳ vọng',
    'Muốn đổi sang sản phẩm khác',
    'Lý do khác'
  ];
  selectedReturnReason = 'Hàng bị vỡ/hỏng khi vận chuyển';
  returnNote2 = '';
  returnImages: string[] = [];

  // Review modal state
  showReviewModal = false;
  reviewingOrder: Order | null = null;
  reviewRating = 5;
  reviewComment = '';

  constructor(
    private orderService: OrderService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadUserData();
    const requestedTab = this.route.snapshot.queryParamMap.get('tab');
    if (requestedTab && this.tabs.some(tab => tab.id === requestedTab)) {
      this.activeTab = requestedTab;
    }
    this.loadOrders();
  }

  ngOnDestroy(): void {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.loadRequestId++;
  }

  loadUserData(): void {
    const raw = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    if (raw) {
      try {
        this.user = JSON.parse(raw);
        this.avatar = this.user.avatar || '';
        const name = this.user.fullName || this.user.name || '';
        this.initial = name.trim().charAt(0).toUpperCase() || '?';
      } catch {
        this.user = null;
        this.initial = '?';
      }
    } else {
      this.user = null;
      this.initial = '?';
    }
  }

  loadOrders(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = null;
    }
    const requestId = ++this.loadRequestId;
    this.loading = true;
    this.loadError = '';
    this.orders = [];
    this.filteredOrders = [];
    this.orderService.getOrders(this.activeTab, this.searchQuery).subscribe({
      next: (data) => {
        if (requestId !== this.loadRequestId) return;
        this.orders = data;
        this.applyFilter();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        if (requestId !== this.loadRequestId) return;
        this.applyFilter();
        this.loading = false;
        this.loadError = error?.error?.message || 'Không thể tải đơn hàng. Vui lòng thử lại.';
        this.cdr.markForCheck();
      }
    });
  }

  setTab(tabId: string): void {
    this.activeTab = tabId;
    this.loadOrders();
  }

  onSearch(query: string): void {
    this.searchQuery = query;
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.searchTimeout = null;
      this.loadOrders();
      this.cdr.markForCheck();
    }, 300);
  }

  applyFilter(): void {
    let list = Array.isArray(this.orders) ? this.orders : [];

    // Filter by tab
    if (this.activeTab !== 'all') {
      list = list.filter(o => {
        if (this.activeTab === 'shipping') {
          return o.status === 'shipping' || o.status === 'delivered' || o.status === 'waiting';
        }
        if (this.activeTab === 'completed') {
          return o.status === 'completed';
        }
        if (this.activeTab === 'refunded') return o.status === 'refunded' || o.status === 'refund_pending' || o.status === 'refund_approved';
        return o.status === this.activeTab;
      });
    }

    // Filter by search query
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      list = list.filter(o =>
        (o.id && o.id.toLowerCase().includes(q)) ||
        (o.code && o.code.toLowerCase().includes(q)) ||
        (o.items && o.items.some(it => it.name && it.name.toLowerCase().includes(q)))
      );
    }

    this.filteredOrders = list;
  }

  getDisplayItems(order: Order): Order['items'] {
    if (order.items?.length || order.status !== 'cancelled') return order.items || [];
    return order.cancelledItems || [];
  }

  viewDetail(order: Order, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.router.navigate(['/orders', getOrderSlug(order)]);
  }

  trackOrder(order: Order, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.router.navigate(['/orders', getOrderSlug(order)]);
  }

  contactFloralia(order: Order, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.contactingOrder = order;
    this.showContactModal = true;
  }

  closeContactModal(): void {
    this.showContactModal = false;
    this.contactingOrder = null;
  }

  confirmReceived(order: Order, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.orderService.updateOrderStatus(order.id, 'completed', 'HOÀN THÀNH').subscribe({
      next: ({ order: updated }) => {
        Object.assign(order, updated);
        this.activeTab = 'completed';
        this.loadOrders();
      },
      error: (error) => {
        alert(error?.error?.message || 'Không thể xác nhận đã nhận hàng.');
      }
    });
  }

  isReturnOrder(order: Order): boolean {
    return order.status === 'refund_pending' ||
      order.status === 'refund_approved' ||
      order.status === 'refunded' ||
      Boolean(order.refundReason);
  }

  getReturnReason(order: Order): string {
    return order.refundReason || order.cancelReason || order.cancelReasons?.map(reason => reason.reason).join(', ') || '';
  }

  openReviewModal(order: Order, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.reviewingOrder = order;
    this.reviewRating = 5;
    this.reviewComment = '';
    this.showReviewModal = true;
  }

  closeReviewModal(): void {
    this.showReviewModal = false;
    this.reviewingOrder = null;
  }

  submitReview(): void {
    alert('Cảm ơn bạn đã gửi đánh giá cho sản phẩm!');
    this.closeReviewModal();
  }

  reorder(order: Order, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (order.items?.length) {
      this.reorderItems = order.items;
    } else {
      this.router.navigate(['/products']);
    }
  }

  proceedToReorderCheckout(): void {
    this.reorderItems = null;
    void this.router.navigate(['/checkout']);
  }

  openCancelModal(order: Order, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.cancellingOrder = order;
    this.selectedCancelReason = '';
    this.otherCancelReason = '';
    this.isCancelSubmitting = false;
    this.showCancelModal = true;
  }

  toggleCancelReason(reason: string): void {
    this.selectedCancelReason = reason;
    if (reason !== 'Khác') {
      this.otherCancelReason = '';
    }
  }

  closeCancelModal(): void {
    if (this.isCancelSubmitting) return;
    this.showCancelModal = false;
    this.cancellingOrder = null;
  }

  confirmCancelOrder(): void {
    if (!this.cancellingOrder || this.isCancelSubmitting) return;
    if (!this.selectedCancelReason) {
      alert('Vui lòng chọn lý do hủy đơn.');
      return;
    }
    if (this.selectedCancelReason === 'Khác' && !this.otherCancelReason.trim()) {
      alert('Vui lòng nhập lý do khác.');
      return;
    }

    const targetOrder = this.cancellingOrder;
    const pm = (targetOrder.paymentMethod || '').toLowerCase();
    const isPaid = ['paypal', 'vnpay', 'chuyển khoản', 'momo', 'qr'].some(method => pm.includes(method));
    const cancelReasons: CancelReason[] = [{
      reason: this.selectedCancelReason,
      ...(this.selectedCancelReason === 'Khác' ? { detail: this.otherCancelReason.trim() } : {})
    }];

    this.isCancelSubmitting = true;
    this.cdr.markForCheck();
    this.orderService.updateOrderStatus(targetOrder.id, 'cancelled', 'ĐÃ HỦY', {
      cancelReasons
    }).subscribe({
      next: ({ order }) => {
        this.isCancelSubmitting = false;
        Object.assign(targetOrder, order);
        this.activeTab = 'cancelled';
        this.loadOrders();
        this.closeCancelModal();
        this.cdr.markForCheck();
        if (isPaid) {
          alert('Hủy đơn thành công!\nSẽ sớm hoàn tiền về cho bạn.');
        } else {
          alert('Hủy đơn hàng thành công!');
        }
      },
      error: (error) => {
        this.isCancelSubmitting = false;
        this.cdr.markForCheck();
        alert(error?.error?.message || 'Không thể hủy đơn hàng. Vui lòng thử lại.');
      }
    });
  }

  // Return & Refund (only for completed orders)
  openReturnModal(order: Order, event?: Event): void {
    if (event) event.stopPropagation();
    this.returningOrder = order;
    this.selectedReturnReason = 'Hàng bị vỡ/hỏng khi vận chuyển';
    this.returnNote2 = '';
    this.returnImages = [];
    this.showReturnModal = true;
  }

  closeReturnModal(): void {
    this.showReturnModal = false;
    this.returningOrder = null;
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
    if (!this.returningOrder) return;
    const targetOrder = this.returningOrder;
    this.orderService.updateOrderStatus(targetOrder.id, 'refund_pending', 'CHỜ DUYỆT HOÀN TIỀN', {
      refundReason: this.selectedReturnReason,
      refundNote: this.returnNote2,
      refundImages: this.returnImages
    }).subscribe({
      next: ({ order }) => {
        Object.assign(targetOrder, order);
        this.applyFilter();
        this.closeReturnModal();
        alert('Yêu cầu hoàn tiền đã được gửi. Sẽ sớm được duyệt.');
      },
      error: (error) => {
        alert(error?.error?.message || 'Không thể gửi yêu cầu hoàn tiền. Vui lòng thử lại.');
      }
    });
  }

  formatPrice(num: number): string {
    return (num || 0).toLocaleString('vi-VN') + 'đ';
  }

  requestLogout(event: Event): void {
    event.preventDefault();
    this.showLogoutConfirm = true;
  }

  confirmLogout(): void {
    this.showLogoutConfirm = false;
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('token');
    window.dispatchEvent(new CustomEvent('auth-changed'));
    this.router.navigate(['/login']);
  }
}
