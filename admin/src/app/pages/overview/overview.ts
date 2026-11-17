import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AdminSidebar } from '../../components/admin-sidebar/admin-sidebar';
import { AdminLogoutDialog } from '../../components/admin-logout-dialog/admin-logout-dialog';
import { AdminNotificationService, SimulatedOrderNotification } from '../../services/admin-notification-service';
import { AdminInventoryService, InventoryProduct } from '../../services/admin-inventory-service';
import {
  AdminDashboardService,
  DashboardData,
  INITIAL_DASHBOARD_DATA,
  LowStockAlert,
  RecentOrderOverview,
  RevenueTimelineItem,
  StatusDistributionItem,
  TopProductOverview,
} from '../../services/admin-dashboard-service';

export interface DonutSliceItem extends StatusDistributionItem {
  dashArray: string;
  dashOffset: number;
}

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AdminSidebar, AdminLogoutDialog],
  templateUrl: './overview.html',
  styleUrl: './overview.css',
})
export class Overview implements OnInit {
  adminName = 'Admin';
  adminAvatar = '';
  loading = false;
  loadError = '';
  activePeriod: 'all' | '7days' | '30days' | 'month' = 'all';

  // Instant UI data: immediately available without full-page loading screen
  dashboardData: DashboardData = INITIAL_DASHBOARD_DATA;

  // Pie chart interaction
  hoveredStatus: string | null = null;

  // Header notifications & logout
  notificationsOpen = false;
  logoutConfirmationVisible = false;
  private inventoryProducts: InventoryProduct[] | null = null;

  constructor(
    private readonly dashboardService: AdminDashboardService,
    private readonly notificationService: AdminNotificationService,
    private readonly inventoryService: AdminInventoryService,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {
    const cached = this.dashboardService.getCachedData(this.activePeriod);
    if (cached) {
      this.dashboardData = cached;
    }
  }

  ngOnInit(): void {
    this.readAdminName();
    this.loadData();
    this.loadInventoryAlerts();
  }

  readAdminName(): void {
    const storedUser = localStorage.getItem('adminUser') || sessionStorage.getItem('adminUser');
    if (!storedUser) return;
    try {
      const user = JSON.parse(storedUser) as { fullName?: string; avatar?: string };
      this.adminName = user.fullName || 'Admin';
      this.adminAvatar = user.avatar || '';
    } catch {
      this.adminName = 'Admin';
    }
  }

  get unreadNotificationsCount(): number {
    return this.notificationService.unreadCount;
  }

  get notifications(): SimulatedOrderNotification[] {
    return this.notificationService.notifications;
  }

  toggleNotifications(): void {
    this.notificationsOpen = !this.notificationsOpen;
  }

  markNotificationsRead(): void {
    this.notificationService.markAllRead();
  }

  requestLogoutConfirmation(): void {
    this.logoutConfirmationVisible = true;
  }

  cancelLogout(): void {
    this.logoutConfirmationVisible = false;
  }

  confirmLogout(): void {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminUser');
    this.router.navigate(['/admin-login']);
  }

  changePeriod(period: 'all' | '7days' | '30days' | 'month'): void {
    if (this.activePeriod === period) return;
    this.activePeriod = period;
    const cached = this.dashboardService.getCachedData(period);
    if (cached) {
      this.dashboardData = cached;
    }
    this.loadData();
  }

  exportReport(): void {
    if (this.loading) return;
    const periodLabels = {
      all: 'Tất cả',
      month: 'Tháng này',
      '30days': '30 ngày',
      '7days': '7 ngày',
    };
    const summary = this.dashboardData.summary;
    const rows: Array<Array<string | number>> = [
      ['BÁO CÁO TỔNG QUAN FLORALIA'],
      ['Khoảng thời gian', periodLabels[this.activePeriod]],
      ['Thời điểm xuất', new Date().toLocaleString('vi-VN')],
      [],
      ['CHỈ SỐ TỔNG QUAN'],
      ['Chỉ số', 'Giá trị'],
      ['Tổng doanh thu (VND)', summary.totalRevenue],
      ['Doanh thu đơn đã giao (VND)', summary.deliveredRevenue],
      ['Tổng đơn hàng', summary.totalOrders],
      ['Đơn chờ xác nhận', summary.pendingOrders],
      ['Đơn chờ lấy hàng', summary.processingOrders],
      ['Đơn đang vận chuyển', summary.shippingOrders],
      ['Đơn đã giao', summary.deliveredOrders],
      ['Đơn đã hủy', summary.cancelledOrders],
      ['Tỷ lệ hoàn thành (%)', summary.completionRate],
      ['Tổng sản phẩm', summary.totalProducts],
      ['Sản phẩm còn hàng', summary.inStockProducts],
      ['Sản phẩm sắp hết', summary.lowStockProducts],
      ['Sản phẩm hết hàng', summary.outOfStockProducts],
      ['Tổng khách hàng', summary.totalCustomers],
      ['Khách hàng hoạt động', summary.activeCustomers],
      ['Tổng bài viết', summary.totalBlogs],
      ['Tổng voucher', summary.totalVouchers],
      [],
      ['DOANH THU THEO THỜI GIAN'],
      ['Ngày', 'Doanh thu (VND)', 'Số đơn'],
      ...this.dashboardData.revenueTimeline.map(item => [item.date, item.revenue, item.ordersCount]),
      [],
      ['TRẠNG THÁI ĐƠN HÀNG'],
      ['Trạng thái', 'Số đơn', 'Tỷ lệ (%)'],
      ...this.dashboardData.statusDistribution.map(item => [item.label, item.count, item.percentage]),
      [],
      ['SẢN PHẨM BÁN CHẠY'],
      ['SKU', 'Tên sản phẩm', 'Danh mục', 'Số lượng đã bán', 'Doanh thu (VND)'],
      ...this.dashboardData.topProducts.map(item => [
        item.sku, item.name, item.category, item.unitsSold, item.totalRevenue,
      ]),
      [],
      ['ĐƠN HÀNG MỚI NHẤT'],
      ['Mã đơn', 'Ngày', 'Giờ', 'Khách hàng', 'Điện thoại', 'Sản phẩm', 'Số mặt hàng', 'Tổng tiền (VND)', 'Trạng thái', 'Thanh toán'],
      ...this.dashboardData.recentOrders.map(order => [
        order.code, order.date, order.time, order.customerName, order.customerPhone,
        order.firstItemName, order.itemCount, order.total, order.statusLabel, order.paymentStatusLabel,
      ]),
      [],
      ['CẢNH BÁO TỒN KHO'],
      ['SKU', 'Tên sản phẩm', 'Danh mục', 'Tồn kho', 'Giá (VND)', 'Trạng thái'],
      ...this.dashboardData.lowStockAlerts.map(item => [
        item.sku, item.name, item.category, item.stock, item.price, item.statusText,
      ]),
    ];
    const escapeCsvCell = (value: string | number): string => {
      let text = String(value ?? '');
      if (typeof value === 'string' && /^\s*[=+\-@]/.test(text)) {
        text = `'${text}`;
      }
      return `"${text.replace(/"/g, '""')}"`;
    };
    const csv = '\uFEFF' + rows
      .map(row => row.map(escapeCsvCell).join(','))
      .join('\r\n');
    const blobUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `bao-cao-tong-quan-${this.activePeriod}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
  }

  loadData(): void {
    this.loading = true;
    this.loadError = '';
    this.dashboardService.getDashboardData(this.activePeriod).subscribe({
      next: (data) => {
        if (data) {
          this.dashboardData = this.inventoryProducts ? this.withInventoryStock(data, this.inventoryProducts) : data;
        }
        this.loading = false;
        this.changeDetector.markForCheck();
      },
      error: (err) => {
        console.error('Không thể tải dữ liệu tổng quan:', err);
        this.loading = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  private loadInventoryAlerts(): void {
    this.inventoryService.getAll().subscribe({
      next: products => {
        this.inventoryProducts = products || [];
        this.dashboardData = this.withInventoryStock(this.dashboardData, this.inventoryProducts);
        this.changeDetector.markForCheck();
      },
      error: error => console.warn('Không thể đồng bộ cảnh báo tồn kho từ danh sách tồn kho:', error),
    });
  }

  private withInventoryStock(data: DashboardData, products: InventoryProduct[]): DashboardData {
    const threshold = 10;
    const lowStockProducts = products.filter(product => (product.variants?.length ? product.variants : [{ stock: product.stock }])
      .some(variant => Number(variant.stock) > 0 && Number(variant.stock) < threshold)).length;
    const outOfStockProducts = products.filter(product => (product.variants?.length ? product.variants : [{ stock: product.stock }])
      .some(variant => Number(variant.stock) === 0)).length;
    const inStockProducts = products.filter(product => (product.variants?.length ? product.variants : [{ stock: product.stock }])
      .some(variant => Number(variant.stock) >= threshold)).length;
    const alerts: LowStockAlert[] = products.flatMap(product => {
      const variants = product.variants?.length ? product.variants : [{ sku: product.sku, label: 'Tiêu chuẩn', stock: product.stock, price: product.price }];
      return variants.flatMap(variant => {
        const stock = Math.max(0, Number(variant.stock) || 0);
        if (stock >= threshold) return [];
        const out = stock === 0;
        return [{
          id: product._id || product.sku,
          sku: variant.sku,
          variantLabel: variant.label,
          name: product.name,
          category: product.category || 'Trà',
          stock,
          price: Number(variant.price ?? product.price) || 0,
          imageUrl: product.imageUrl?.startsWith('/products/') ? `http://localhost:3002${product.imageUrl}` : product.imageUrl || '/assets/images/products/74.png',
          statusText: out ? 'Hết hàng' : 'Sắp hết hàng',
          statusClass: out ? 'out-of-stock' : 'low-stock',
        }];
      });
    }).sort((a, b) => a.stock - b.stock).slice(0, 6);
    return {
      ...data,
      summary: { ...data.summary, totalProducts: products.length, inStockProducts, lowStockProducts, outOfStockProducts },
      lowStockAlerts: alerts,
    };
  }

  formatVND(value: number): string {
    if (typeof value !== 'number' || isNaN(value)) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  }

  formatCompact(value: number): string {
    if (typeof value !== 'number' || isNaN(value)) return '0';
    if (value >= 1_000_000_000) {
      return (value / 1_000_000_000).toFixed(1) + ' tỷ';
    }
    if (value >= 1_000_000) {
      return (value / 1_000_000).toFixed(1) + ' tr';
    }
    if (value >= 1_000) {
      return (value / 1_000).toFixed(0) + ' k';
    }
    return value.toLocaleString('vi-VN');
  }

  getMaxTimelineRevenue(): number {
    if (!this.dashboardData?.revenueTimeline || this.dashboardData.revenueTimeline.length === 0) {
      return 1000000;
    }
    const max = Math.max(...this.dashboardData.revenueTimeline.map((item) => item.revenue));
    return max > 0 ? max : 1000000;
  }

  getBarHeight(revenue: number): number {
    const max = this.getMaxTimelineRevenue();
    if (max <= 0 || revenue <= 0) return 6;
    const percent = Math.round((revenue / max) * 100);
    return Math.max(8, Math.min(100, percent));
  }

  setHoveredStatus(status: string | null): void {
    this.hoveredStatus = status;
  }

  get hoveredSlice(): StatusDistributionItem | undefined {
    if (!this.hoveredStatus || !this.dashboardData?.statusDistribution) return undefined;
    return this.dashboardData.statusDistribution.find((s) => s.status === this.hoveredStatus);
  }

  get donutSlices(): DonutSliceItem[] {
    const items = this.dashboardData?.statusDistribution || [];
    const total = this.dashboardData?.summary?.totalOrders || 0;
    const radius = 52;
    const circumference = 2 * Math.PI * radius; // ~326.726

    if (total <= 0) {
      return [];
    }

    let accumulatedPercent = 0;
    return items.map((item) => {
      const percent = Math.max(0, item.percentage);
      const strokeLength = (percent / 100) * circumference;
      const dashOffset = -((accumulatedPercent / 100) * circumference);
      accumulatedPercent += percent;

      return {
        ...item,
        dashArray: `${strokeLength} ${circumference}`,
        dashOffset,
      };
    });
  }

  editProduct(productIdOrSku?: string): void {
    if (!productIdOrSku) {
      this.router.navigate(['/products']);
      return;
    }
    this.router.navigate(['/products', productIdOrSku, 'edit']);
  }

  goToOrder(orderId: string): void {
    this.router.navigate(['/orders', orderId]);
  }

  goToOrdersWithStatus(status?: string): void {
    if (status) {
      this.router.navigate(['/orders'], { queryParams: { status } });
    } else {
      this.router.navigate(['/orders']);
    }
  }

  goToProducts(): void {
    this.router.navigate(['/products']);
  }

  goToInventory(): void {
    this.router.navigate(['/inventory']);
  }

  goToReceiveStock(): void {
    this.router.navigate(['/inventory/receive']);
  }

  goToUsers(): void {
    this.router.navigate(['/users']);
  }

  goToVouchers(): void {
    this.router.navigate(['/vouchers']);
  }

  formatShortTime(time?: string): string {
    if (!time) return '';
    return time.length > 5 ? time.substring(0, 5) : time;
  }
}
