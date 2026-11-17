import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminLogoutDialog } from '../../../components/admin-logout-dialog/admin-logout-dialog';
import { AdminSidebar } from '../../../components/admin-sidebar/admin-sidebar';
import { AdminVoucher, AdminVoucherService, VoucherOrder } from '../../../services/admin-voucher-service';
import { finalize, timeout } from 'rxjs';

@Component({
  selector: 'app-voucher-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AdminSidebar, AdminLogoutDialog],
  templateUrl: './voucher-detail.html',
  styleUrl: './voucher-detail.css',
})
export class AdminVoucherDetail implements OnInit {
  voucher: AdminVoucher | null = null;
  orders: VoucherOrder[] = [];
  loading = true;
  error = '';
  success = '';
  busy = false;
  query = '';
  period: 14 | 30 | 0 = 14;
  adminName = 'Admin';
  logoutConfirmationVisible = false;
  currentPage = 1;
  readonly pageSize = 5;

  constructor(private readonly route: ActivatedRoute, private readonly router: Router, private readonly service: AdminVoucherService, private readonly changeDetector: ChangeDetectorRef) {}

  ngOnInit(): void {
    const saved = localStorage.getItem('adminUser') || sessionStorage.getItem('adminUser');
    if (saved) { try { const user = JSON.parse(saved); this.adminName = user.fullName || user.name || 'Admin'; } catch { this.adminName = 'Admin'; } }
    this.load();
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.loading = true;
    this.error = '';
    this.changeDetector.detectChanges();
    if (!id) {
      this.error = 'Không tìm thấy mã voucher trên đường dẫn.';
      this.loading = false;
      return;
    }
    this.service.get(id).pipe(
      timeout(15000),
      finalize(() => {
        this.loading = false;
        this.changeDetector.detectChanges();
      }),
    ).subscribe({
      next: result => {
        this.voucher = result.voucher || null;
        this.orders = result.orders || [];
        this.changeDetector.detectChanges();
      },
      error: err => {
        if (err?.status === 401 || err?.status === 403) {
          this.error = 'Phiên quản trị đã hết hạn. Vui lòng đăng nhập lại.';
          this.service.clearSession();
          this.changeDetector.detectChanges();
          window.setTimeout(() => void this.router.navigate(['/admin-login']), 1200);
          return;
        }
        this.error = err?.name === 'TimeoutError'
          ? 'Máy chủ phản hồi quá lâu. Hãy thử tải lại chi tiết voucher.'
          : err?.status === 0
            ? 'Không kết nối được máy chủ. Hãy kiểm tra backend ở cổng 3002.'
            : err?.error?.message || 'Không thể tải chi tiết voucher.';
        this.changeDetector.detectChanges();
      },
    });
  }
  get recentOrders(): VoucherOrder[] {
    const query = this.query.trim().toLowerCase();
    return this.orders.filter(order => !query || `${order.code || order.id || ''} ${order.receiver?.name || order.user?.fullName || ''} ${order.receiver?.email || order.user?.email || ''}`.toLowerCase().includes(query));
  }
  get totalPages(): number { return Math.max(1, Math.ceil(this.recentOrders.length / this.pageSize)); }
  get pages(): number[] { return Array.from({ length: this.totalPages }, (_, index) => index + 1); }
  get visibleOrders(): VoucherOrder[] { return this.recentOrders.slice((this.currentPage - 1) * this.pageSize, this.currentPage * this.pageSize); }
  get usagePercent(): number { return this.voucher?.usageLimit ? Math.min(100, Math.round(this.voucher.usedCount / this.voucher.usageLimit * 100)) : 0; }
  get usageBars(): Array<{ label: string; count: number; height: number }> {
    const days = this.period || Math.min(90, Math.max(14, this.orders.reduce((oldest, order) => {
      const value = order.createdAt || order.date;
      const date = value ? new Date(value) : new Date();
      return Number.isFinite(date.getTime()) ? Math.max(oldest, Math.ceil((Date.now() - date.getTime()) / 86_400_000) + 1) : oldest;
    }, 14)));
    const today = new Date();
    const counts = Array.from({ length: days }, (_, index) => {
      const date = new Date(today); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (days - index - 1));
      const count = this.orders.filter(order => {
        const value = order.createdAt || order.date;
        if (!value) return false;
        const orderDate = new Date(value); orderDate.setHours(0, 0, 0, 0);
        return orderDate.getTime() === date.getTime();
      }).length;
      return { date, count };
    });
    const max = Math.max(1, ...counts.map(item => item.count));
    return counts.map((item, index) => ({ label: index % Math.ceil(days / 5) === 0 || index === days - 1 ? `${item.date.getDate()}/${item.date.getMonth() + 1}` : '', count: item.count, height: item.count ? Math.max(8, item.count / max * 100) : 2 }));
  }
  money(value: number): string { return Number(value || 0).toLocaleString('vi-VN'); }
  discountText(): string { if (!this.voucher) return ''; return this.voucher.discountType === 'percent' ? `${this.voucher.discountValue}%` : `${this.money(this.voucher.discountValue)}₫`; }
  statusLabel(): string {
    const status = this.voucher?.status;
    return status === 'active' ? 'Đang chạy' : status === 'upcoming' ? 'Sắp diễn ra' : status === 'paused' ? 'Tạm dừng' : status === 'expired' ? 'Hết hạn' : 'Bản nháp';
  }
  orderStatusLabel(status?: string | null): string {
    const labels: Record<string, string> = {
      pending: 'Chờ xác nhận',
      processing: 'Chờ lấy hàng',
      waiting: 'Chờ lấy hàng',
      shipping: 'Đang vận chuyển',
      delivered: 'Đã giao hàng',
      completed: 'Đã giao hàng',
      cancelled: 'Đã hủy',
      refunded: 'Đã hoàn tiền',
      returned: 'Đã hoàn trả',
    };
    return status ? labels[status.toLowerCase()] || status : 'Đã áp dụng';
  }
  setPage(page: number): void { if (page >= 1 && page <= this.totalPages) this.currentPage = page; }

  toggleStatus(): void {
    if (!this.voucher || this.busy) return;
    const status = this.voucher.status === 'paused' ? 'active' : 'paused';
    this.busy = true; this.error = ''; this.success = '';
    this.service.setStatus(this.voucher.id, status).subscribe({
      next: result => { this.voucher = result.voucher; this.success = result.message; this.busy = false; },
      error: err => { this.error = err?.error?.message || 'Không thể cập nhật trạng thái voucher.'; this.busy = false; },
    });
  }

  deleteVoucher(): void {
    if (!this.voucher || this.busy || !window.confirm(`Xóa voucher ${this.voucher.code}?`)) return;
    this.busy = true; this.error = '';
    this.service.delete(this.voucher.id).subscribe({
      next: () => void this.router.navigate(['/vouchers']),
      error: err => { this.error = err?.error?.message || 'Không thể xóa voucher.'; this.busy = false; },
    });
  }

  copyCode(): void {
    if (this.voucher) void navigator.clipboard?.writeText(this.voucher.code).then(() => this.success = 'Đã sao chép mã voucher.');
  }

  requestLogoutConfirmation(): void { this.logoutConfirmationVisible = true; }
  cancelLogoutConfirmation(): void { this.logoutConfirmationVisible = false; }
  confirmLogout(): void { this.logoutConfirmationVisible = false; this.logout(); }
  logout(): void { this.service.clearSession(); void this.router.navigate(['/admin-login']); }
}
