import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { ActivatedRoute, CanDeactivateFn, Router } from '@angular/router';
import { AdminCategory, AdminCategoryService, CategoryFormValue } from '../../../services/admin-category-service';

@Component({
  selector: 'app-category-editor',
  standalone: false,
  styleUrl: './category-editor.css',
  templateUrl: './category-editor.html',
})
export class CategoryEditor implements OnInit {
  adminName = 'Admin';
  isEdit = false;
  categoryId = '';
  loading = false;
  saving = false;
  error = '';
  nameTouched = false;
  codeManuallyEdited = false;
  successMessage = '';
  logoutConfirmationVisible = false;
  exitPromptVisible = false;
  private lastSavedSnapshot = '';
  private resolveCanDeactivate?: (allowNavigation: boolean) => void;
  private pendingLogout = false;

  private allCategories: AdminCategory[] = [];
  parentOptions: Array<{ label: string; value: string }> = [
    { label: '— Danh mục chính (không có cha) —', value: '' },
    { label: 'Trà thảo mộc', value: 'Trà thảo mộc' },
    { label: 'Trà thảo mộc mix', value: 'Trà thảo mộc mix' },
  ];

  form: CategoryFormValue = this.emptyForm();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly service: AdminCategoryService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.readAdminName();
    this.categoryId = this.route.snapshot.paramMap.get('id') || '';
    this.isEdit = Boolean(this.categoryId);
    this.loadAllCategoriesForSuggestions();
    if (this.isEdit) {
      this.loadCategory();
    } else {
      this.lastSavedSnapshot = this.createFormSnapshot();
    }
  }

  private emptyForm(): CategoryFormValue {
    return {
      code: 'DM01-06',
      name: '',
      parentName: '',
      parentCode: '',
      visible: true,
      productCount: 0,
    };
  }

  private readAdminName(): void {
    try {
      const raw = localStorage.getItem('adminUser') || sessionStorage.getItem('adminUser');
      const user = raw ? JSON.parse(raw) : null;
      this.adminName = user?.name || user?.fullName || user?.email || 'Admin';
    } catch {
      this.adminName = 'Admin';
    }
  }

  private loadAllCategoriesForSuggestions(): void {
    const cached = this.service.getCachedList();
    if (cached?.data?.length) {
      this.applyCategoryOptions(cached.data);
    }
    this.service.getAll().subscribe({
      next: result => {
        this.service.cacheList(result);
        this.applyCategoryOptions(result.data || []);
        this.changeDetector.markForCheck();
      },
      error: () => {
        this.changeDetector.markForCheck();
      },
    });
  }

  private applyCategoryOptions(categories: AdminCategory[]): void {
    this.allCategories = categories;
    const mains = categories.filter(
      item => item.level === 'main' && (!this.isEdit || item._id !== this.categoryId)
    );
    const options = [{ label: '— Danh mục chính (không có cha) —', value: '' }];
    for (const main of mains) {
      if (!options.some(opt => opt.value === main.name)) {
        options.push({ label: main.name, value: main.name });
      }
    }
    this.parentOptions = options;

    if (!this.isEdit && !this.codeManuallyEdited) {
      const wasClean = !this.hasUnsavedChanges;
      this.form.code = this.suggestCode(this.form.parentName);
      if (wasClean) {
        this.lastSavedSnapshot = this.createFormSnapshot();
      }
    }
  }

  private suggestCode(parentName: string): string {
    if (!this.allCategories.length) {
      return parentName ? 'DM01-06' : 'DM06';
    }
    if (!parentName) {
      const mainNumbers = this.allCategories
        .filter(item => item.level === 'main')
        .map(item => {
          const match = /^DM(\d+)$/i.exec(item.code.trim());
          return match ? Number.parseInt(match[1], 10) : 0;
        });
      const nextMain = Math.max(5, ...mainNumbers) + 1;
      return `DM${String(nextMain).padStart(2, '0')}`;
    }

    const parent = this.allCategories.find(
      item => item.level === 'main' && item.name === parentName
    );
    const prefix = parent?.code || 'DM01';
    const subNumbers = this.allCategories
      .filter(item => item.parentCode === prefix || item.parentName === parentName)
      .map(item => {
        const match = new RegExp(`^${prefix}-(\\d+)$`, 'i').exec(item.code.trim());
        return match ? Number.parseInt(match[1], 10) : 0;
      });
    const nextSub = Math.max(0, ...subNumbers) + 1;
    return `${prefix}-${String(nextSub).padStart(2, '0')}`;
  }

  onParentChange(parentName: string): void {
    this.form.parentName = parentName;
    const parent = this.allCategories.find(
      item => item.level === 'main' && item.name === parentName
    );
    this.form.parentCode = parent?.code || '';
    if (!this.isEdit && !this.codeManuallyEdited) {
      this.form.code = this.suggestCode(parentName);
    }
  }

  onCodeInput(): void {
    this.codeManuallyEdited = true;
  }

  private loadCategory(): void {
    const cached = this.service.getCachedCategory(this.categoryId);
    if (cached) {
      this.applyCategory(cached);
      this.loading = false;
    } else {
      this.loading = true;
    }
    this.service.getById(this.categoryId).subscribe({
      next: category => {
        this.applyCategory(category);
        this.loading = false;
        this.changeDetector.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        if (error.status === 401 || error.status === 403) {
          this.forceLogout();
          return;
        }
        this.error = error.error?.message || 'Không thể tải thông tin danh mục.';
        this.changeDetector.markForCheck();
      },
    });
  }

  private applyCategory(category: AdminCategory): void {
    this.form = {
      code: category.code || '',
      name: category.name || '',
      parentName: category.level === 'sub' ? category.parentName || '' : '',
      parentCode: category.level === 'sub' ? category.parentCode || '' : '',
      visible: category.visible !== false,
      productCount: category.productCount ?? 0,
    };
    this.lastSavedSnapshot = this.createFormSnapshot();
  }

  private createFormSnapshot(): string {
    return JSON.stringify({
      code: this.form.code.trim(),
      name: this.form.name.trim(),
      parentName: this.form.parentName,
      visible: this.form.visible,
    });
  }

  get hasUnsavedChanges(): boolean {
    if (this.loading || !this.lastSavedSnapshot) {
      return false;
    }
    return this.createFormSnapshot() !== this.lastSavedSnapshot;
  }

  get nameInvalid(): boolean {
    return this.nameTouched && !this.form.name.trim();
  }

  confirmCanDeactivate(): boolean | Promise<boolean> {
    if (!this.hasUnsavedChanges) {
      this.finishLogoutIfNeeded();
      return true;
    }
    this.error = '';
    this.exitPromptVisible = true;
    this.changeDetector.markForCheck();
    return new Promise(resolve => {
      this.resolveCanDeactivate = resolve;
    });
  }

  stayOnEditor(): void {
    this.pendingLogout = false;
    this.resolveExitNavigation(false);
  }

  discardChangesAndExit(): void {
    this.finishLogoutIfNeeded();
    this.resolveExitNavigation(true);
  }

  saveChangesAndExit(): void {
    this.save(true);
  }

  private resolveExitNavigation(allowNavigation: boolean): void {
    this.exitPromptVisible = false;
    const resolve = this.resolveCanDeactivate;
    this.resolveCanDeactivate = undefined;
    this.changeDetector.markForCheck();
    resolve?.(allowNavigation);
  }

  private finishLogoutIfNeeded(): void {
    if (!this.pendingLogout) {
      return;
    }
    localStorage.removeItem('adminUser');
    localStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminUser');
    sessionStorage.removeItem('adminToken');
    this.pendingLogout = false;
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.logoutConfirmationVisible) {
      this.cancelLogoutConfirmation();
    } else if (this.exitPromptVisible && !this.saving) {
      this.stayOnEditor();
    }
  }

  cancel(): void {
    void this.router.navigate(['/categories']);
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

  private logout(): void {
    this.pendingLogout = true;
    void this.router.navigate(['/admin-login']);
  }

  private forceLogout(): void {
    this.lastSavedSnapshot = '';
    this.pendingLogout = true;
    this.finishLogoutIfNeeded();
    void this.router.navigate(['/admin-login']);
  }

  private validateForm(): boolean {
    this.nameTouched = true;
    if (!this.form.name.trim()) {
      this.error = 'Vui lòng nhập tên danh mục.';
      return false;
    }
    if (!this.form.code.trim()) {
      this.error = 'Vui lòng nhập mã danh mục.';
      return false;
    }
    return true;
  }

  save(exitAfterSave = false): void {
    if (this.saving) return;
    if (!this.validateForm()) {
      this.changeDetector.markForCheck();
      return;
    }
    this.error = '';
    this.saving = true;

    const payload: CategoryFormValue = {
      code: this.form.code.trim().toUpperCase(),
      name: this.form.name.trim(),
      parentName: this.form.parentName.trim(),
      parentCode: this.form.parentCode.trim(),
      visible: this.form.visible,
    };

    const request = this.isEdit
      ? this.service.update(this.categoryId, payload)
      : this.service.create(payload);

    request.subscribe({
      next: saved => {
        this.saving = false;
        this.applyCategory(saved);
        if (exitAfterSave) {
          this.finishLogoutIfNeeded();
          this.resolveExitNavigation(true);
          return;
        }
        this.successMessage = this.isEdit
          ? 'Đã lưu thay đổi danh mục thành công.'
          : 'Đã thêm danh mục mới thành công.';
        if (!this.isEdit && saved._id) {
          this.isEdit = true;
          this.categoryId = saved._id;
          void this.router.navigate(['/categories', saved._id, 'edit'], { replaceUrl: true });
        }
        this.changeDetector.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        if (error.status === 401 || error.status === 403) {
          this.forceLogout();
          return;
        }
        this.error = error.error?.message || 'Không thể lưu danh mục.';
        this.changeDetector.markForCheck();
      },
    });
  }
}

export const canDeactivateCategoryEditor: CanDeactivateFn<CategoryEditor> =
  component => component.confirmCanDeactivate();

