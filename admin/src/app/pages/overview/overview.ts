import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AdminSidebar } from '../../components/admin-sidebar/admin-sidebar';
import { AdminNotificationService, SimulatedOrderNotification } from '../../services/admin-notification-service';
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
  imports: [CommonModule, FormsModule, RouterModule, AdminSidebar],
  templateUrl: './overview.html',
  styleUrl: './overview.css',
})
export class Overview implements OnInit {
  adminName = 'Admin';
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

  constructor(
    private readonly dashboardService: AdminDashboardService,
    private readonly notificationService: AdminNotificationService,
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
  }

  readAdminName(): void {
    const storedUser = localStorage.getItem('adminUser') || sessionStorage.getItem('adminUser');
    if (!storedUser) return;
    try {
      const user = JSON.parse(storedUser) as { fullName?: string };
      this.adminName = user.fullName || 'Admin';
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

  loadData(): void {
    this.loading = true;
    this.loadError = '';
    this.dashboardService.getDashboardData(this.activePeriod).subscribe({
      next: (data) => {
        if (data) {
          this.dashboardData = data;
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
