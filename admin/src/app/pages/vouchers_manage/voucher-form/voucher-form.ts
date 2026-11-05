import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminSidebar } from '../../../components/admin-sidebar/admin-sidebar';
import { AdminVoucher, AdminVoucherService } from '../../../services/admin-voucher-service';
import { finalize, timeout } from 'rxjs';

@Component({
  selector: 'app-voucher-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AdminSidebar],
  templateUrl: './voucher-form.html',
  styleUrl: './voucher-form.css',
})
export class AdminVoucherForm implements OnInit {
  id = '';
  editing = false;
  loading = false;
  saving = false;
  error = '';
  adminName = 'Admin';
  form = {
    code: '', name: '', description: '', discountType: 'percent' as 'percent' | 'fixed', discountValue: 15,
    maxDiscount: 50000 as number | null, minOrderValue: 0, usageLimit: 500, perUserLimit: 1,
    startDate: '', endDate: '', scope: 'all' as 'all' | 'categories' | 'products',
    categoriesText: '', productIdsText: '', audience: 'all' as 'all' | 'new_customer', status: 'active' as 'active' | 'paused' | 'draft',
  };

  constructor(private readonly route: ActivatedRoute, private readonly router: Router, private readonly service: AdminVoucherService, private readonly cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    this.editing = Boolean(this.id);
    const saved = localStorage.getItem('adminUser') || sessionStorage.getItem('adminUser');
    if (saved) { try { const user = JSON.parse(saved); this.adminName = user.fullName || user.name || 'Admin'; } catch { this.adminName = 'Admin'; } }
    if (this.editing) this.load();
  }

  private load(): void {
    this.loading = true;
    this.error = '';
    this.cdr.detectChanges();
    this.service.get(this.id).pipe(timeout(15000), finalize(() => { this.loading = false; this.cdr.detectChanges(); })).subscribe({
      next: response => {
        const voucher = response.voucher;
        this.form = {
          code: voucher.code || '', name: voucher.name || '', description: voucher.description || '',
          discountType: voucher.discountType || 'percent', discountValue: voucher.discountValue || 1,
          maxDiscount: voucher.maxDiscount ?? null, minOrderValue: voucher.minOrderValue || 0,
          usageLimit: voucher.usageLimit || 0, perUserLimit: voucher.perUserLimit || 0,
          startDate: voucher.startDate ? new Date(voucher.startDate).toISOString().slice(0, 10) : '',
          endDate: voucher.endDate ? new Date(voucher.endDate).toISOString().slice(0, 10) : '',
          scope: voucher.scope || 'all', categoriesText: (voucher.categories || []).join(', '),
          productIdsText: (voucher.productIds || []).join(', '), audience: voucher.audience || 'all',
          status: voucher.status === 'paused' ? 'paused' : voucher.status === 'draft' ? 'draft' : 'active',
        };
        this.cdr.detectChanges();
      },
      error: err => {
        this.error = err?.name === 'TimeoutError'
          ? 'Máy chủ phản hồi quá lâu. Vui lòng kiểm tra kết nối rồi tải lại voucher.'
          : err?.error?.message || 'Không thể tải voucher. Vui lòng thử lại.';
        this.cdr.detectChanges();
      },
    });
  }

  generateCode(): void {
    const token = Math.random().toString(36).slice(2, 8).toUpperCase();
    this.form.code = `FLORALIA${token}`.slice(0, 24);
  }

  money(value: number): string { return Number(value || 0).toLocaleString('vi-VN'); }

  save(status?: 'active' | 'draft'): void {
    if (this.saving) return;
    this.error = '';
    this.form.code = this.form.code.trim().toUpperCase().replace(/\s+/g, '_');
    if (!this.form.code || !this.form.name.trim()) { this.error = 'Vui lòng nhập mã voucher và tên chương trình.'; return; }
    if (this.form.discountValue <= 0 || (this.form.discountType === 'percent' && this.form.discountValue > 100)) { this.error = 'Mức giảm giá không hợp lệ.'; return; }
    if (this.form.endDate && this.form.startDate && this.form.endDate < this.form.startDate) { this.error = 'Ngày kết thúc phải sau ngày bắt đầu.'; return; }
    this.saving = true;
    this.cdr.detectChanges();
    const payload: Partial<AdminVoucher> = {
      code: this.form.code, name: this.form.name.trim(), description: this.form.description.trim(),
      discountType: this.form.discountType, discountValue: Number(this.form.discountValue),
      maxDiscount: this.form.discountType === 'percent' ? (this.form.maxDiscount ? Number(this.form.maxDiscount) : null) : null,
      minOrderValue: Number(this.form.minOrderValue || 0), usageLimit: Number(this.form.usageLimit || 0),
      perUserLimit: Number(this.form.perUserLimit || 0), startDate: this.form.startDate || null, endDate: this.form.endDate || null,
      scope: this.form.scope, categories: this.splitList(this.form.categoriesText), productIds: this.splitList(this.form.productIdsText),
      audience: this.form.audience, status: status || this.form.status,
    };
    const request = this.editing ? this.service.update(this.id, payload) : this.service.create(payload);
    request.pipe(timeout(10000), finalize(() => { this.saving = false; this.cdr.detectChanges(); })).subscribe({
      next: response => { void this.router.navigate(['/vouchers', response.voucher.id]); },
      error: err => {
        this.error = err?.name === 'TimeoutError'
          ? 'Máy chủ phản hồi quá lâu. Vui lòng kiểm tra kết nối rồi thử lưu lại.'
          : err?.error?.message || 'Không thể lưu voucher. Vui lòng thử lại.';
        this.cdr.detectChanges();
      },
    });
  }

  private splitList(value: string): string[] { return [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))]; }
  logout(): void { this.service.clearSession(); void this.router.navigate(['/admin-login']); }
}
