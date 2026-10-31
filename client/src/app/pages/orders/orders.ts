import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Order, OrderService } from '../../services/order-service';

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
  loading = true;

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

  constructor(
    private orderService: OrderService,
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
    this.loading = true;
    this.orderService.getOrders().subscribe({
      next: (data) => {
        this.orders = data;
        this.applyFilter();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
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
    let list = [...this.orders];

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
        o.id.toLowerCase().includes(q) ||
        o.code.toLowerCase().includes(q) ||
        o.items.some(it => it.name.toLowerCase().includes(q))
      );
    }

    this.filteredOrders = list;
  }

  viewDetail(order: Order): void {
    this.router.navigate(['/orders', order.id]);
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

    // Call service update if available
    this.orderService.updateOrderStatus(targetOrder.id, 'cancelled', 'ĐÃ HỦY').subscribe({
      next: () => {
        this.applyFilter();
        this.closeCancelModal();
      },
      error: () => {
        // Fallback local update
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
