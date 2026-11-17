import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, timeout } from 'rxjs';
import { AdminLogoutDialog } from '../../../components/admin-logout-dialog/admin-logout-dialog';
import { AdminSidebar } from '../../../components/admin-sidebar/admin-sidebar';
import { AdminVoucher, AdminVoucherService, VoucherStatus, VoucherSummary } from '../../../services/admin-voucher-service';

type VoucherFilter = 'all' | 'active' | 'upcoming' | 'paused' | 'expired';

@Component({
  selector: 'app-admin-vouchers',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AdminSidebar, AdminLogoutDialog],
  templateUrl: './vouchers.html',
  styleUrl: './vouchers.css',
})
export class AdminVouchers implements OnInit {
  readonly pageSize = 7;
  vouchers: AdminVoucher[] = [];
  summary: VoucherSummary = { total: 0, active: 0, upcoming: 0, paused: 0, expired: 0, monthlyUsage: 0 };
  filter: VoucherFilter = 'all';
  searchTerm = '';
  currentPage = 1;
  loading = false;
  error = '';
  success = '';
  busyId = '';
  adminName = 'Admin';
  logoutConfirmationVisible = false;

  constructor(
    private readonly service: AdminVoucherService,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const saved = localStorage.getItem('adminUser') || sessionStorage.getItem('adminUser');
    if (saved) { try { const user = JSON.parse(saved); this.adminName = user.fullName || user.name || 'Admin'; } catch { this.adminName = 'Admin'; } }
    this.load();
  }

  load(): void {
    this.loading = true; this.error = '';
    this.changeDetector.detectChanges();
    this.service.getAll().pipe(
      timeout(15000),
      finalize(() => {
        this.loading = false;
        this.changeDetector.detectChanges();
      }),
    ).subscribe({
      next: result => {
        this.vouchers = result.vouchers || [];
        this.summary = result.summary || this.summary;
        this.currentPage = Math.min(this.currentPage, this.pageCount);
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
          ? 'Máy chủ phản hồi quá lâu. Hãy thử tải lại voucher.'
          : err?.status === 0
            ? 'Không kết nối được máy chủ. Hãy kiểm tra backend ở cổng 3002.'
            : err?.error?.message || 'Không thể tải danh sách voucher.';
        this.changeDetector.detectChanges();
      },
    });
  }

  get filtered(): AdminVoucher[] {
    const query = this.searchTerm.trim().toLowerCase();
    return this.vouchers.filter(voucher => (this.filter === 'all' || voucher.status === this.filter)
      && (!query || `${voucher.code} ${voucher.name} ${voucher.description || ''}`.toLowerCase().includes(query)));
  }
  get pageCount(): number { return Math.max(1, Math.ceil(this.filtered.length / this.pageSize)); }
  get visible(): AdminVoucher[] { return this.filtered.slice((this.currentPage - 1) * this.pageSize, this.currentPage * this.pageSize); }
  get pages(): number[] { return Array.from({ length: this.pageCount }, (_, i) => i + 1); }
  setFilter(filter: VoucherFilter): void { this.filter = filter; this.currentPage = 1; }
  setPage(page: number): void { if (page >= 1 && page <= this.pageCount) this.currentPage = page; }
  discountText(voucher: AdminVoucher): string { return voucher.discountType === 'percent' ? `${voucher.discountValue}%` : `${this.money(voucher.discountValue)}₫`; }
  money(value: number): string { return Number(value || 0).toLocaleString('vi-VN'); }
  statusLabel(status: VoucherStatus): string { return ({ active: 'Đang chạy', upcoming: 'Sắp diễn ra', paused: 'Tạm dừng', expired: 'Hết hạn', draft: 'Bản nháp' })[status]; }
  usagePercent(voucher: AdminVoucher): number { return voucher.usageLimit > 0 ? Math.min(100, Math.round(voucher.usedCount / voucher.usageLimit * 100)) : 0; }
  detail(voucher: AdminVoucher): void { void this.router.navigate(['/vouchers', voucher.id]); }

  toggle(voucher: AdminVoucher, event: Event): void {
    event.stopPropagation();
    if (this.busyId) return;
    const nextStatus = voucher.status === 'paused' ? 'active' : 'paused';
    this.busyId = voucher.id; this.error = ''; this.success = '';
    this.service.setStatus(voucher.id, nextStatus).subscribe({
      next: result => { this.busyId = ''; this.success = result.message; this.load(); },
      error: err => { this.busyId = ''; this.error = err?.error?.message || 'Không thể đổi trạng thái voucher.'; },
    });
  }

  remove(voucher: AdminVoucher, event: Event): void {
    event.stopPropagation();
    if (this.busyId || !window.confirm(`Xóa voucher ${voucher.code}?`)) return;
    this.busyId = voucher.id; this.error = ''; this.success = '';
    this.service.delete(voucher.id).subscribe({
      next: result => { this.busyId = ''; this.success = result.message; this.load(); },
      error: err => { this.busyId = ''; this.error = err?.error?.message || 'Không thể xóa voucher.'; },
    });
  }

  requestLogoutConfirmation(): void { this.logoutConfirmationVisible = true; }
  cancelLogoutConfirmation(): void { this.logoutConfirmationVisible = false; }
  confirmLogout(): void { this.logoutConfirmationVisible = false; this.logout(); }
  logout(): void { this.service.clearSession(); void this.router.navigate(['/admin-login']); }
}
