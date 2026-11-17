import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminLogoutDialog } from '../../../components/admin-logout-dialog/admin-logout-dialog';
import { AdminSidebar } from '../../../components/admin-sidebar/admin-sidebar';
import { AdminVoucher, AdminVoucherService } from '../../../services/admin-voucher-service';
import { AdminCategory, AdminCategoryService } from '../../../services/admin-category-service';
import { finalize, timeout } from 'rxjs';
import { UnsavedChangesDialog } from '../../../components/unsaved-changes-dialog/unsaved-changes-dialog';

@Component({
  selector: 'app-voucher-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AdminSidebar, AdminLogoutDialog, UnsavedChangesDialog],
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
  logoutConfirmationVisible = false;
  exitPromptVisible = false;
  private lastSavedSnapshot = '';
  private resolveCanDeactivate?: (allowNavigation: boolean) => void;
  private pendingLogout = false;
  private categoriesLoaded = false;
  private voucherLoaded = false;
  categories: AdminCategory[] = [];
  categoryDropdownOpen = false;
  form = {
    code: '', name: '', description: '', discountType: 'percent' as 'percent' | 'fixed', discountValue: 15,
    maxDiscount: 50000 as number | null, minOrderValue: 0, usageLimit: 500, perUserLimit: 1,
    startDate: '', endDate: '', scope: 'all' as 'all' | 'categories' | 'products',
    categories: [] as string[], productIdsText: '', audience: 'all' as 'all' | 'new_customer', status: 'active' as 'active' | 'paused' | 'draft',
  };

  constructor(private readonly route: ActivatedRoute, private readonly router: Router, private readonly service: AdminVoucherService, private readonly categoryService: AdminCategoryService, private readonly cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    this.editing = Boolean(this.id);
    const saved = localStorage.getItem('adminUser') || sessionStorage.getItem('adminUser');
    if (saved) { try { const user = JSON.parse(saved); this.adminName = user.fullName || user.name || 'Admin'; } catch { this.adminName = 'Admin'; } }
    this.categoryService.getAll().subscribe({
      next: response => {
        this.categories = (response.data || []).filter(category => category.visible !== false);
        this.form.categories = this.form.categories.map(value => this.categoryValue(value));
        this.categoriesLoaded = true;
        this.setBaselineWhenReady();
        this.cdr.detectChanges();
      },
      error: () => { this.categoriesLoaded = true; this.setBaselineWhenReady(); this.error = 'Could not load product categories.'; },
    });
    if (this.editing) this.load();
    else { this.voucherLoaded = true; this.setBaselineWhenReady(); }
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
          scope: voucher.scope || 'all', categories: [...(voucher.categories || [])],
          productIdsText: (voucher.productIds || []).join(', '), audience: voucher.audience || 'all',
          status: voucher.status === 'paused' ? 'paused' : voucher.status === 'draft' ? 'draft' : 'active',
        };
        this.form.categories = this.form.categories.map(value => this.categoryValue(value));
        this.voucherLoaded = true;
        this.setBaselineWhenReady();
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

  get selectedCategoryLabel(): string {
    const selected = this.categories.filter(category => this.form.categories.includes(category.slug));
    return selected.length ? selected.map(category => category.name).join(', ') : 'Chọn danh mục áp dụng';
  }

  toggleCategory(slug: string, checked: boolean): void {
    this.form.categories = checked
      ? [...new Set([...this.form.categories, slug])]
      : this.form.categories.filter(value => value !== slug);
  }

  save(status?: 'active' | 'draft', exitAfterSave = false): void {
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
      scope: this.form.scope, categories: [...this.form.categories], productIds: this.splitList(this.form.productIdsText),
      audience: this.form.audience, status: status || this.form.status,
    };
    const request = this.editing ? this.service.update(this.id, payload) : this.service.create(payload);
    request.pipe(timeout(10000), finalize(() => { this.saving = false; this.cdr.detectChanges(); })).subscribe({
      next: response => {
        this.lastSavedSnapshot = this.formSnapshot();
        if (exitAfterSave) {
          this.finishLogoutIfNeeded();
          this.resolveExitNavigation(true);
          return;
        }
        void this.router.navigate(['/vouchers', response.voucher.id]);
      },
      error: err => {
        this.error = err?.name === 'TimeoutError'
          ? 'Máy chủ phản hồi quá lâu. Vui lòng kiểm tra kết nối rồi thử lưu lại.'
          : err?.error?.message || 'Không thể lưu voucher. Vui lòng thử lại.';
        this.cdr.detectChanges();
      },
    });
  }

  get hasUnsavedChanges(): boolean {
    return !this.loading && !!this.lastSavedSnapshot && this.formSnapshot() !== this.lastSavedSnapshot;
  }
  confirmCanDeactivate(): boolean | Promise<boolean> {
    if (!this.hasUnsavedChanges) { this.finishLogoutIfNeeded(); return true; }
    this.error = '';
    this.exitPromptVisible = true;
    this.cdr.detectChanges();
    return new Promise(resolve => { this.resolveCanDeactivate = resolve; });
  }
  stayOnEditor(): void { this.pendingLogout = false; this.resolveExitNavigation(false); }
  discardChangesAndExit(): void { this.finishLogoutIfNeeded(); this.resolveExitNavigation(true); }
  saveChangesAndExit(): void { this.save(undefined, true); }
  private formSnapshot(): string { return JSON.stringify(this.form); }
  private setBaselineWhenReady(): void {
    if (this.categoriesLoaded && this.voucherLoaded) this.lastSavedSnapshot = this.formSnapshot();
  }
  private resolveExitNavigation(allowNavigation: boolean): void {
    this.exitPromptVisible = false;
    const resolve = this.resolveCanDeactivate;
    this.resolveCanDeactivate = undefined;
    this.cdr.detectChanges();
    resolve?.(allowNavigation);
  }
  private finishLogoutIfNeeded(): void {
    if (!this.pendingLogout) return;
    this.service.clearSession();
    this.pendingLogout = false;
  }
  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.exitPromptVisible && !this.saving) this.stayOnEditor();
    else if (this.logoutConfirmationVisible) this.cancelLogoutConfirmation();
  }

  private splitList(value: string): string[] { return [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))]; }
  private categoryValue(value: string): string {
    const normalized = String(value || '').trim().toLocaleLowerCase();
    return this.categories.find(category =>
      [category.slug, category.name, category.code].some(candidate => String(candidate || '').trim().toLocaleLowerCase() === normalized)
    )?.slug || value;
  }
  requestLogoutConfirmation(): void { this.logoutConfirmationVisible = true; }
  cancelLogoutConfirmation(): void { this.logoutConfirmationVisible = false; }
  confirmLogout(): void { this.logoutConfirmationVisible = false; this.logout(); }
  logout(): void { this.pendingLogout = true; void this.router.navigate(['/admin-login']); }
}

