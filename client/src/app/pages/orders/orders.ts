import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CancelReason, getOrderSlug, Order, OrderService, sortOrdersNewestFirst } from '../../services/order-service';
import { CartService } from '../../services/cart-service';

@Component({
  selector: 'app-orders',
  standalone: false,
  templateUrl: './orders.html',
  styleUrl: './orders.css'
})
export class Orders implements OnInit {
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
    { id: 'shipping', label: 'Vận chuyển' },
    { id: 'waiting', label: 'Chờ giao hàng' },
    { id: 'completed', label: 'Hoàn thành' },
    { id: 'cancelled', label: 'Đã hủy' },
    { id: 'refunded', label: 'Trả hàng/Hoàn tiền' },
  ];

  activeTab = 'all';
  searchQuery = '';
  orders: Order[] = [];
  filteredOrders: Order[] = [];
  loading = true;
  loadError = '';

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
  selectedCancelReasons: string[] = [];
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
    private cartService: CartService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadUserData();
    this.loadOrders();
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
    this.orders = this.orderService.getDefaultOrders();
    this.applyFilter();
    this.loading = true;
    this.loadError = '';
    this.orderService.getOrders().subscribe({
      next: (data) => {
        this.orders = sortOrdersNewestFirst(data);
        this.applyFilter();
        this.loading = false;
      },
      error: (error) => {
        this.applyFilter();
        this.loading = false;
        this.loadError = error?.error?.message || 'Không thể tải đơn hàng. Vui lòng thử lại.';
      }
    });
  }

  setTab(tabId: string): void {
    this.activeTab = tabId;
    this.applyFilter();
  }

  onSearch(query: string): void {
    this.searchQuery = query;
    this.applyFilter();
  }

  applyFilter(): void {
    let list = Array.isArray(this.orders) ? sortOrdersNewestFirst(this.orders) : [];

    // Filter by tab
    if (this.activeTab !== 'all') {
      list = list.filter(o => {
        if (this.activeTab === 'shipping') {
          return o.status === 'shipping' || o.status === 'processing';
        }
        if (this.activeTab === 'waiting') {
          return o.status === 'delivered' || o.status === 'waiting';
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

    this.filteredOrders = sortOrdersNewestFirst(list);
  }

  getDisplayItems(order: Order): Array<Order['items'][number] & { cancelled: boolean }> {
    const activeItems = (order.items || []).map(item => ({ ...item, cancelled: false }));
    const cancelledItems = (order.cancelledItems || []).map(item => ({ ...item, cancelled: true }));
    return [...activeItems, ...cancelledItems];
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
    if (confirm(`Xác nhận bạn đã nhận được đầy đủ sản phẩm của đơn hàng ${order.code}?`)) {
      this.orderService.updateOrderStatus(order.id, 'completed', 'HOÀN THÀNH').subscribe({
        next: ({ order: updated }) => {
          Object.assign(order, updated);
          this.activeTab = 'completed';
          this.applyFilter();
        },
        error: (error) => {
          alert(error?.error?.message || 'Không thể xác nhận đã nhận hàng.');
        }
      });
    }
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
    if (order.items && order.items.length > 0) {
      const currentCart = this.cartService.getCart();
      order.items.forEach(it => {
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
    } else {
      this.router.navigate(['/products']);
    }
  }

  openCancelModal(order: Order, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.cancellingOrder = order;
    this.selectedCancelReasons = [];
    this.otherCancelReason = '';
    this.isCancelSubmitting = false;
    this.showCancelModal = true;
  }

  toggleCancelReason(reason: string): void {
    this.selectedCancelReasons = this.selectedCancelReasons.includes(reason)
      ? this.selectedCancelReasons.filter(selected => selected !== reason)
      : [...this.selectedCancelReasons, reason];
    if (!this.selectedCancelReasons.includes('Khác')) {
      this.otherCancelReason = '';
    }
  }

  closeCancelModal(): void {
    this.showCancelModal = false;
    this.cancellingOrder = null;
  }

  confirmCancelOrder(): void {
    if (!this.cancellingOrder || this.isCancelSubmitting) return;
    if (this.selectedCancelReasons.length === 0) {
      alert('Vui lòng chọn ít nhất một lý do hủy đơn.');
      return;
    }
    if (this.selectedCancelReasons.includes('Khác') && !this.otherCancelReason.trim()) {
      alert('Vui lòng nhập lý do khác.');
      return;
    }

    const targetOrder = this.cancellingOrder;
    const pm = (targetOrder.paymentMethod || '').toLowerCase();
    const isPaid = ['paypal', 'vnpay', 'chuyển khoản', 'momo', 'qr'].some(method => pm.includes(method));
    const cancelReasons: CancelReason[] = this.selectedCancelReasons.map(reason => ({
      reason,
      ...(reason === 'Khác' ? { detail: this.otherCancelReason.trim() } : {})
    }));

    this.isCancelSubmitting = true;
    this.closeCancelModal();
    this.orderService.updateOrderStatus(targetOrder.id, 'cancelled', 'ĐÃ HỦY', {
      cancelReasons
    }).subscribe({
      next: ({ order }) => {
        this.isCancelSubmitting = false;
        Object.assign(targetOrder, order);
        this.applyFilter();
        if (isPaid) {
          alert('Hủy đơn thành công!\nSẽ sớm hoàn tiền về cho bạn.');
        } else {
          alert('Hủy đơn hàng thành công!');
        }
      },
      error: (error) => {
        this.isCancelSubmitting = false;
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
