import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminLogoutDialog } from '../../../components/admin-logout-dialog/admin-logout-dialog';
import { AdminSidebar } from '../../../components/admin-sidebar/admin-sidebar';
import { catchError, finalize, of, timeout } from 'rxjs';
import { AdminUser, AdminUserService } from '../../../services/admin-user-service';
import { AdminOrder, AdminOrderService } from '../../../services/admin-order-service';

type HistoryTab = 'orders' | 'vouchers';

interface OrderRow {
  id: string;
  date: string;
  title: string;
  subtitle: string;
  total: number;
  image: string;
  voucherCode?: string;
  voucherDiscount: number;
}

interface UsedVoucherRow {
  code: string;
  usageCount: number;
  totalDiscount: number;
  lastUsed: string;
}

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminSidebar, AdminLogoutDialog, RouterLink],
  templateUrl: './user-detail.html',
  styleUrl: './user-detail.css',
})
export class AdminUserDetail implements OnInit {
  user: AdminUser | null = null;
  loading = true;
  ordersLoading = false;
  ordersError = '';
  error = '';
  adminName = 'Admin Floralia';
  logoutConfirmationVisible = false;
  activeTab: HistoryTab = 'orders';
  searchTerm = '';
  currentPage = 1;
  pageSize = 4;
  showLockModal = false;
  lockReason = 'Nghi vấn đơn hàng ảo';
  updatingStatus = false;
  statusMessage = '';
  statusMessageType: 'pending' | 'success' | 'error' = 'success';
  userOrders: OrderRow[] = [];

  readonly favoriteTeas = ['Bạch Trà Shan Tuyết', 'Trà Cúc Tiến Vua'];

  readonly reasonOptions = [
    'Nghi vấn đơn hàng ảo',
    'Khách hàng vi phạm chính sách',
    'Yêu cầu bảo mật',
    'Khác',
  ];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly userService: AdminUserService,
    private readonly orderService: AdminOrderService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const saved = localStorage.getItem('adminUser') || sessionStorage.getItem('adminUser');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.name) this.adminName = parsed.name;
      } catch {
        this.adminName = 'Admin Floralia';
      }
    }

    const id = this.route.snapshot.paramMap.get('id') || '';
    this.loadUser(id);
  }

  loadUser(id: string): void {
    if (!id) {
      this.loading = false;
      this.error = 'Không tìm thấy người dùng này.';
      this.user = null;
      return;
    }

    this.loading = true;
    this.error = '';
    this.changeDetector.detectChanges();

    this.userService.getAll().pipe(
      timeout(15000),
      finalize(() => {
        this.loading = false;
        this.changeDetector.detectChanges();
      }),
    ).subscribe({
      next: response => {
        const users = response.users || [];
        this.user = users.find(item => item.id === id) || null;
        if (this.user) this.user.role = this.user.role === 'admin' ? 'admin' : 'customer';

        if (!this.user) {
          this.error = 'Không tìm thấy người dùng này.';
          this.userOrders = [];
          return;
        }

        // Render the profile as soon as its data is ready; order history is secondary.
        this.loading = false;
        this.changeDetector.detectChanges();
        this.loadUserOrders();
      },
      error: () => {
        this.user = null;
        this.userOrders = [];
        this.error = 'Không thể tải thông tin người dùng.';
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  private loadUserOrders(): void {
    if (!this.user) {
      this.userOrders = [];
      return;
    }

    this.ordersLoading = true;
    this.ordersError = '';
    this.orderService.getForUser(this.user.id).pipe(
      timeout(12000),
      catchError(() => of({ success: false, orders: [] })),
      finalize(() => {
        this.ordersLoading = false;
        this.changeDetector.detectChanges();
      }),
    ).subscribe({
      next: response => {
        if (!response.success) {
          this.ordersError = 'Không thể tải lịch sử đơn hàng. Vui lòng thử lại sau.';
        }
        const orders = response.orders || [];
        this.userOrders = orders
          .map(order => ({
            id: order.code || order.id,
            date: this.formatOrderDate(order.createdAt || order.date),
            title: this.getOrderTitle(order),
            subtitle: this.getOrderSubtitle(order),
            total: Number(order.total || 0),
            image: this.getOrderImage(order),
            voucherCode: order.voucherCode,
            voucherDiscount: Number(order.voucherDiscount) || 0,
          }));

        if (this.user) {
          this.user.orderCount = this.userOrders.length;
          this.user.totalSpent = this.userOrders.reduce((sum, order) => sum + order.total, 0);
        }

        this.currentPage = 1;
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.userOrders = [];
        this.ordersError = 'Không thể tải lịch sử đơn hàng. Vui lòng thử lại sau.';
      },
    });
  }

  retryUserOrders(): void {
    this.loadUserOrders();
  }

  get filteredOrders(): OrderRow[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.userOrders;
    }

    return this.userOrders.filter(order => {
      const haystack = `${order.id} ${order.title} ${order.subtitle}`.toLowerCase();
      return haystack.includes(term);
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredOrders.length / this.pageSize));
  }

  get calculatedTotalSpent(): number {
    return this.userOrders.reduce((sum, order) => sum + order.total, 0);
  }

  get usedVoucherCodes(): string[] {
    return [...new Set(this.userOrders
      .map(order => order.voucherCode?.trim().toUpperCase())
      .filter((code): code is string => Boolean(code)))];
  }

  get usedVouchers(): UsedVoucherRow[] {
    const vouchers = new Map<string, UsedVoucherRow>();
    for (const order of this.userOrders) {
      if (!order.voucherCode) continue;
      const code = order.voucherCode.trim().toUpperCase();
      const voucher = vouchers.get(code) || { code, usageCount: 0, totalDiscount: 0, lastUsed: order.date };
      voucher.usageCount += 1;
      voucher.totalDiscount += Number(order.voucherDiscount) || 0;
      if (order.date !== '—' && (voucher.lastUsed === '—' || this.compareOrderDates(order.date, voucher.lastUsed) > 0)) {
        voucher.lastUsed = order.date;
      }
      vouchers.set(code, voucher);
    }
    return [...vouchers.values()].sort((a, b) => this.compareOrderDates(b.lastUsed, a.lastUsed));
  }

  private compareOrderDates(first: string, second: string): number {
    const parse = (value: string) => {
      const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      return match ? new Date(+match[3], +match[2] - 1, +match[1]).getTime() : 0;
    };
    return parse(first) - parse(second);
  }

  get paginatedOrders(): OrderRow[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.filteredOrders.slice(startIndex, startIndex + this.pageSize);
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index + 1);
  }

  goBack(): void {
    void this.router.navigate(['/users']);
  }

  editUser(): void {
    if (!this.user) return;
    void this.router.navigate(['/users', this.user.id, 'edit']);
  }

  requestLogoutConfirmation(): void {
    this.logoutConfirmationVisible = true;
  }

  cancelLogoutConfirmation(): void {
    this.logoutConfirmationVisible = false;
  }

  confirmLogout(): void {
    this.logoutConfirmationVisible = false;
    this.logout();
  }

  logout(): void {
    this.userService.clearCache();
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminUser');
    void this.router.navigate(['/admin-login']);
  }

  toggleTab(tab: HistoryTab): void {
    this.activeTab = tab;
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.currentPage = 1;
  }

  setPage(page: number): void {
    if (page < 1 || page > this.totalPages) {
      return;
    }
    this.currentPage = page;
  }

  openLockModal(): void {
    this.statusMessage = '';
    this.showLockModal = true;
  }

  closeLockModal(): void {
    this.showLockModal = false;
  }

  confirmLock(): void {
    if (!this.user || this.updatingStatus) {
      return;
    }
    const action = this.user.status === 'blocked' ? 'unblock' : 'block';
    const targetUser = this.user;
    this.updatingStatus = true;
    this.statusMessage = action === 'block' ? 'Đang gửi yêu cầu khóa tài khoản...' : 'Đang gửi yêu cầu mở khóa tài khoản...';
    this.statusMessageType = 'pending';
    this.changeDetector.detectChanges();
    this.userService.toggleStatus(targetUser.id, action, this.lockReason).pipe(
      timeout(15000),
      finalize(() => {
        this.updatingStatus = false;
        this.changeDetector.detectChanges();
      }),
    ).subscribe({
      next: response => {
        this.user = { ...targetUser, ...response.user };
        this.statusMessage = response.message;
        this.statusMessageType = 'success';
        this.showLockModal = false;
        this.changeDetector.detectChanges();
      },
      error: error => {
        this.statusMessage = error?.error?.message || (error?.name === 'TimeoutError'
          ? 'Máy chủ phản hồi quá lâu. Hãy kiểm tra kết nối rồi thử lại.'
          : 'Không thể cập nhật trạng thái tài khoản.');
        this.statusMessageType = 'error';
        this.changeDetector.detectChanges();
      },
    });
  }

  get initials(): string {
    if (!this.user?.fullName) return 'U';
    return this.user.fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() || '')
      .join('') || 'U';
  }

  get roleLabel(): string {
    return this.user?.role === 'admin' ? 'Quản trị viên' : 'Khách hàng';
  }

  get statusLabel(): string {
    return this.user?.status === 'blocked' ? 'Bị khóa' : 'Hoạt động';
  }

  formatDate(value?: string | null): string {
    if (!value) return '12/10/2024';
    const match = String(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const date = match
      ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]))
      : new Date(value);
    if (Number.isNaN(date.getTime())) return '12/10/2024';
    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  }

  private formatOrderDate(value?: string | null): string {
    if (!value) return '—';
    const match = String(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const date = match
      ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]))
      : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  }

  private getOrderTitle(order: AdminOrder): string {
    const itemName = order.items?.[0]?.name || order.items?.[0]?.productName || 'Sản phẩm Floralia';
    const remainingProducts = Math.max(0, (order.items?.length || 0) - 1);
    return remainingProducts ? `${itemName} + ${remainingProducts} sản phẩm khác` : itemName;
  }

  private getOrderSubtitle(order: AdminOrder): string {
    const items = order.items || [];
    const quantity = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    return items.length
      ? `Số lượng: ${quantity} hộp${items.length > 1 ? ` · ${items.length} sản phẩm` : ''}`
      : 'Đơn hàng không có thông tin sản phẩm';
  }

  private getOrderImage(order: AdminOrder): string {
    const image = order.items?.[0]?.image?.trim() || '';
    if (!image) return '';
    if (/^(https?:|data:|blob:)/i.test(image)) return image;
    return image.startsWith('/') ? `http://localhost:3002${image}` : '';
  }

  onOrderImageError(order: OrderRow): void {
    order.image = '';
  }
  formatCurrency(value: number): string {
    return `${value.toLocaleString('vi-VN')}đ`;
  }
}
