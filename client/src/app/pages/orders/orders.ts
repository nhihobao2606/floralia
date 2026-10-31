import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Order, OrderService } from '../../services/order-service';
import { CartService } from '../../services/cart-service';

@Component({
  selector: 'app-orders',
  standalone: false,
  templateUrl: './orders.html',
  styleUrl: './orders.css'
})
export class Orders implements OnInit {
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
  loading = false;

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
  selectedCancelReason = 'Muốn thay đổi sản phẩm (loại trà, dung lượng, số lượng...)';

  // Contact modal state
  showContactModal = false;
  contactingOrder: Order | null = null;

  // Refund modal state
  showRefundModal = false;
  refundingOrder: Order | null = null;
  refundReason = 'Hàng bị vỡ/hỏng khi vận chuyển';
  refundNote = '';

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
    // Load default orders IMMEDIATELY so the view never starts blank
    const defaults = this.orderService.getDefaultOrders();
    if (Array.isArray(defaults) && defaults.length > 0) {
      this.orders = defaults;
      this.applyFilter();
    }
    // Then sync with backend asynchronously
    this.loadOrders();
  }

  loadUserData(): void {
    const raw = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    if (raw) {
      try {
        this.user = JSON.parse(raw);
        this.avatar = this.user.avatar || '';
        const name = this.user.fullName || this.user.name || 'Hồ Bảo Nhi';
        this.initial = name.trim().charAt(0).toUpperCase();
      } catch (e) {
        this.user = { fullName: 'Hồ Bảo Nhi', email: 'hobaonhi400@gmail.com' };
        this.initial = 'H';
      }
    } else {
      this.user = { fullName: 'Hồ Bảo Nhi', email: 'hobaonhi400@gmail.com' };
      this.initial = 'H';
    }
  }

  loadOrders(): void {
    this.orderService.getOrders().subscribe({
      next: (data) => {
        if (Array.isArray(data) && data.length > 0) {
          this.orders = data;
          this.applyFilter();
        }
      },
      error: () => {
        // Fallback already populated
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
    let list = Array.isArray(this.orders) ? [...this.orders] : [];

    // Filter by tab
    if (this.activeTab !== 'all') {
      list = list.filter(o => {
        if (this.activeTab === 'waiting') {
          return o.status === 'shipping' || o.status === 'processing';
        }
        if (this.activeTab === 'completed') {
          return o.status === 'completed' || o.status === 'delivered';
        }
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

  viewDetail(order: Order, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.router.navigate(['/orders', order.id]);
  }

  trackOrder(order: Order, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.router.navigate(['/orders', order.id]);
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
      order.status = 'completed';
      order.statusLabel = 'HOÀN THÀNH';
      this.orderService.updateOrderStatus(order.id, 'completed', 'HOÀN THÀNH').subscribe();
      this.applyFilter();
    }
  }

  openRefundModal(order: Order, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.refundingOrder = order;
    this.refundReason = 'Hàng bị vỡ/hỏng khi vận chuyển';
    this.refundNote = '';
    this.showRefundModal = true;
  }

  closeRefundModal(): void {
    this.showRefundModal = false;
    this.refundingOrder = null;
  }

  confirmRefund(): void {
    if (!this.refundingOrder) return;
    this.refundingOrder.status = 'refunded';
    this.refundingOrder.statusLabel = 'ĐÃ HOÀN TIỀN';
    this.refundingOrder.refundAmount = this.refundingOrder.total;
    this.orderService.updateOrderStatus(this.refundingOrder.id, 'refunded', 'ĐÃ HOÀN TIỀN').subscribe();
    this.applyFilter();
    this.closeRefundModal();
    alert('Yêu cầu trả hàng/hoàn tiền đã được ghi nhận. Chúng tôi sẽ liên hệ trong 24h!');
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
    this.selectedCancelReason = 'Muốn thay đổi sản phẩm (loại trà, dung lượng, số lượng...)';
    this.showCancelModal = true;
  }

  closeCancelModal(): void {
    this.showCancelModal = false;
    this.cancellingOrder = null;
  }

  confirmCancelOrder(): void {
    if (!this.cancellingOrder) return;

    const targetOrder = this.cancellingOrder;
    targetOrder.status = 'cancelled';
    targetOrder.statusLabel = 'ĐÃ HỦY';

    this.orderService.updateOrderStatus(targetOrder.id, 'cancelled', 'ĐÃ HỦY').subscribe({
      next: () => {
        this.applyFilter();
        this.closeCancelModal();
      },
      error: () => {
        this.applyFilter();
        this.closeCancelModal();
      }
    });
  }

  formatPrice(num: number): string {
    return (num || 0).toLocaleString('vi-VN') + 'đ';
  }

  logout(event: Event): void {
    event.preventDefault();
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('token');
    window.dispatchEvent(new CustomEvent('auth-changed'));
    this.router.navigate(['/login']);
  }
}
