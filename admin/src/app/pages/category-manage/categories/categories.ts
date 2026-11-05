import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AdminCategory, AdminCategoryService, AdminCategoryStats } from '../../../services/admin-category-service';

@Component({
  selector: 'app-categories',
  standalone: false,
  styleUrl: './categories.css',
  templateUrl: './categories.html',
})
export class Categories implements OnInit, OnDestroy {
  readonly pageSize = 15;
  readonly emptyStats: AdminCategoryStats = { total: 0, main: 0, sub: 0, hidden: 0 };
  categories: AdminCategory[] = [];
  private allCategories: AdminCategory[] = [];
  collapsedParents = new Set<string>();
  selectedIds = new Set<string>();

  readonly levelOptions = [
    { label: 'Tất cả cấp danh mục', value: 'all' },
    { label: 'Danh mục chính', value: 'main' },
    { label: 'Công dụng (Danh mục con)', value: 'sub' },
  ];

  readonly statusOptions = [
    { label: 'Tất cả trạng thái', value: 'all' },
    { label: 'Đang hiển thị', value: 'visible' },
    { label: 'Đang ẩn', value: 'hidden' },
  ];

  stats: AdminCategoryStats = { ...this.emptyStats };
  searchText = '';
  levelFilter = 'all';
  statusFilter = 'all';
  currentPage = 1;
  total = 0;
  loading = false;
  listError = '';
  actionError = '';
  pendingDelete: AdminCategory | null = null;
  deleting = false;
  pendingVisibilityToggle: { category: AdminCategory; nextVisible: boolean } | null = null;
  togglingVisibility = false;
  toastMessage = '';
  private toastTimeout?: ReturnType<typeof setTimeout>;
  logoutConfirmationVisible = false;
  adminName = 'Admin';
  private requestId = 0;

  constructor(
    private readonly service: AdminCategoryService,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.readAdminName();
    const initial = this.service.getCachedList() || this.service.getInitialList();
    if (initial) {
      this.allCategories = initial.data || [];
      this.recalculateStats();
      this.loading = false;
      this.applyLocalFilters();
    }
    this.loadCategories();
  }

  ngOnDestroy(): void {
    this.requestId++;
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get pageStart(): number {
    return this.total ? (this.currentPage - 1) * this.pageSize + 1 : 0;
  }

  get pageEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.total);
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get allCurrentPageSelected(): boolean {
    return this.categories.length > 0 && this.categories.every(item => this.selectedIds.has(item._id));
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

  loadCategories(): void {
    const requestId = ++this.requestId;
    this.loading = true;
    this.listError = '';
    this.changeDetector.markForCheck();
    this.service.getAll().subscribe({
      next: result => {
        if (requestId !== this.requestId) return;
        this.allCategories = result.data || [];
        this.service.cacheList(result);
        this.recalculateStats();
        this.loading = false;
        this.applyLocalFilters();
        this.changeDetector.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        if (requestId !== this.requestId) return;
        this.loading = false;
        if (error.status === 401 || error.status === 403) {
          this.logout();
          return;
        }
        this.listError = error.error?.message || 'Không thể tải danh sách danh mục.';
        this.changeDetector.markForCheck();
      },
    });
  }

  private recalculateStats(): void {
    const mainCount = this.allCategories.filter(item => item.level === 'main').length;
    const subItems = this.allCategories.filter(item => item.level !== 'main');
    const uniqueSubNames = new Set(subItems.map(item => item.name.trim().toLocaleLowerCase())).size;
    const hiddenCount = this.allCategories.filter(item => !item.visible).length;
    this.stats = {
      total: this.allCategories.length,
      main: mainCount,
      sub: uniqueSubNames,
      hidden: hiddenCount,
    };
  }

  retryLoading(): void {
    this.loadCategories();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.applyLocalFilters();
  }

  onSearch(value: string): void {
    this.searchText = value;
    this.currentPage = 1;
    this.applyLocalFilters();
  }

  resetFilters(): void {
    this.searchText = '';
    this.levelFilter = 'all';
    this.statusFilter = 'all';
    this.currentPage = 1;
    this.applyLocalFilters();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.applyLocalFilters();
  }

  hasChildren(category: AdminCategory): boolean {
    if (category.level !== 'main') return false;
    return this.allCategories.some(
      item => item.level === 'sub' && (item.parentCode === category.code || item.parentName === category.name)
    );
  }

  isCollapsed(category: AdminCategory): boolean {
    return this.collapsedParents.has(category.code);
  }

  toggleCollapse(category: AdminCategory): void {
    if (category.level !== 'main') return;
    if (this.collapsedParents.has(category.code)) {
      this.collapsedParents.delete(category.code);
    } else {
      this.collapsedParents.add(category.code);
    }
    this.applyLocalFilters();
  }

  toggleSelectAll(checked: boolean): void {
    for (const item of this.categories) {
      if (checked) {
        this.selectedIds.add(item._id);
      } else {
        this.selectedIds.delete(item._id);
      }
    }
  }

  toggleSelectRow(category: AdminCategory, checked: boolean): void {
    if (checked) {
      this.selectedIds.add(category._id);
    } else {
      this.selectedIds.delete(category._id);
    }
  }

  isSelected(category: AdminCategory): boolean {
    return this.selectedIds.has(category._id);
  }

  private applyLocalFilters(): void {
    const query = this.searchText.trim().toLocaleLowerCase();
    const hasActiveFilter = Boolean(query) || this.levelFilter !== 'all' || this.statusFilter !== 'all';

    const filtered = this.allCategories.filter(category => {
      if (!hasActiveFilter && category.level === 'sub' && category.parentCode && this.collapsedParents.has(category.parentCode)) {
        return false;
      }
      const matchesText =
        !query ||
        [category.name, category.code, category.parentName].some(value =>
          String(value || '').toLocaleLowerCase().includes(query)
        );
      const matchesLevel = this.levelFilter === 'all' || category.level === this.levelFilter;
      const matchesStatus =
        this.statusFilter === 'all' ||
        (this.statusFilter === 'visible' ? category.visible : !category.visible);
      return matchesText && matchesLevel && matchesStatus;
    });

    this.total = filtered.length;
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
    const start = (this.currentPage - 1) * this.pageSize;
    this.categories = filtered.slice(start, start + this.pageSize);
  }

  requestToggleVisibility(event: Event, category: AdminCategory): void {
    event.preventDefault();
    event.stopPropagation();
    this.actionError = '';
    this.pendingVisibilityToggle = {
      category,
      nextVisible: !category.visible,
    };
  }

  cancelToggleVisibility(): void {
    this.pendingVisibilityToggle = null;
  }

  confirmToggleVisibility(): void {
    if (!this.pendingVisibilityToggle) return;
    const { category, nextVisible } = this.pendingVisibilityToggle;
    this.pendingVisibilityToggle = null;
    this.actionError = '';

    category.visible = nextVisible;
    if (category.level === 'main') {
      for (const child of this.allCategories) {
        if (child.parentCode === category.code) {
          child.visible = nextVisible;
        }
      }
    }
    this.recalculateStats();
    this.applyLocalFilters();
    this.showToast(
      nextVisible
        ? `Đã bật hiển thị danh mục "${category.name}" trên website.`
        : `Đã ẩn danh mục "${category.name}" khỏi website.`
    );
    this.changeDetector.markForCheck();

    this.service.toggleVisibility(category._id, nextVisible).subscribe({
      error: () => {},
    });
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.toastTimeout = setTimeout(() => {
      this.toastMessage = '';
      this.toastTimeout = undefined;
      this.changeDetector.markForCheck();
    }, 3000);
  }

  createCategory(): void {
    void this.router.navigate(['/categories/new']);
  }

  editCategory(category: AdminCategory): void {
    void this.router.navigate(['/categories', category._id, 'edit']);
  }

  requestDelete(category: AdminCategory): void {
    this.pendingDelete = category;
    this.actionError = '';
  }

  cancelDelete(): void {
    if (!this.deleting) {
      this.pendingDelete = null;
    }
  }

  confirmDelete(): void {
    if (!this.pendingDelete || this.deleting) return;
    const target = this.pendingDelete;
    this.deleting = true;
    this.actionError = '';
    this.service.delete(target._id).subscribe({
      next: () => {
        this.pendingDelete = null;
        this.deleting = false;
        this.allCategories = this.allCategories.filter(
          item => item._id !== target._id && !(target.level === 'main' && item.parentCode === target.code)
        );
        this.recalculateStats();
        if (this.categories.length === 1 && this.currentPage > 1) {
          this.currentPage--;
        }
        this.applyLocalFilters();
        this.changeDetector.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        this.deleting = false;
        this.actionError = error.error?.message || 'Không thể xóa danh mục.';
        this.changeDetector.markForCheck();
      },
    });
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
    localStorage.removeItem('adminUser');
    localStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminUser');
    sessionStorage.removeItem('adminToken');
    void this.router.navigate(['/admin-login']);
  }
}

