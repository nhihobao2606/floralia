import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AdminProduct, AdminProductService, AdminProductStats } from '../../../services/admin-product-service';

@Component({
  selector: 'app-products',
  standalone: false,
  styleUrl: './products.css',
  templateUrl: './products.html',
})
export class Products implements OnInit, OnDestroy {
  readonly pageSize = 8;
  readonly emptyStats: AdminProductStats = { total: 0, active: 0, inactive: 0 };
  products: AdminProduct[] = [];
  private allProducts: AdminProduct[] = [];
  categories: string[] = [];
  readonly statusOptions = [
    { label: 'Tất cả trạng thái', value: 'all' },
    { label: 'Đang kinh doanh', value: 'active' },
    { label: 'Hết hàng', value: 'out-of-stock' },
  ];
  stats = { ...this.emptyStats };
  searchText = '';
  categoryFilter = 'all';
  statusFilter = 'all';
  currentPage = 1;
  total = 0;
  loading = false;
  listError = '';
  actionError = '';
  pendingDelete: AdminProduct | null = null;
  pendingDeleteProducts: AdminProduct[] = [];
  selectedProductIds = new Set<string>();
  deleting = false;
  deletingSelected = false;
  logoutConfirmationVisible = false;
  adminName = 'Admin';
  private requestId = 0;

  constructor(
    private readonly service: AdminProductService,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.readAdminName();
    const cached = this.service.getCachedList();
    if (cached) {
      this.allProducts = cached.data || [];
      this.categories = cached.categories || [];
      this.stats = cached.stats || { ...this.emptyStats };
      this.loading = false;
      this.applyLocalFilters();
    }
    this.loadProducts();
  }

  ngOnDestroy(): void {
    this.requestId++;
  }

  get totalPages(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }
  get pageStart(): number { return this.total ? (this.currentPage - 1) * this.pageSize + 1 : 0; }
  get pageEnd(): number { return Math.min(this.currentPage * this.pageSize, this.total); }
  get pageNumbers(): number[] { return Array.from({ length: this.totalPages }, (_, i) => i + 1); }
  get allVisibleSelected(): boolean { return this.products.length > 0 && this.products.every(product => this.selectedProductIds.has(this.selectionId(product))); }
  get selectedCount(): number { return this.selectedProductIds.size; }

  private readAdminName(): void {
    try {
      const raw = localStorage.getItem('adminUser') || sessionStorage.getItem('adminUser');
      const user = raw ? JSON.parse(raw) : null;
      this.adminName = user?.name || user?.fullName || user?.email || 'Admin';
    } catch { this.adminName = 'Admin'; }
  }

  loadProducts(): void {
    const requestId = ++this.requestId;
    this.loading = true;
    this.listError = '';
    this.changeDetector.markForCheck();
    this.service.getAll({
      page: 1,
      limit: 100,
      query: '',
      category: 'all',
      status: 'all',
    }).subscribe({
      next: result => {
        if (requestId !== this.requestId) return;
        this.allProducts = result.data || [];
        this.stats = result.stats || { ...this.emptyStats };
        this.categories = result.categories || [];
        this.service.cacheList(result);
        this.loading = false;
        this.applyLocalFilters();
        this.changeDetector.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        if (requestId !== this.requestId) return;
        this.loading = false;
        if (error.status === 401 || error.status === 403) { this.logout(); return; }
        this.listError = error.error?.message || 'Không thể tải danh sách sản phẩm.';
        this.changeDetector.markForCheck();
      },
    });
  }

  retryLoading(): void { this.loadProducts(); }

  onFilterChange(): void { this.currentPage = 1; this.applyLocalFilters(); }

  onSearch(value: string): void {
    this.searchText = value;
    this.currentPage = 1;
    this.applyLocalFilters();
  }

  resetFilters(): void {
    this.searchText = '';
    this.categoryFilter = 'all';
    this.statusFilter = 'all';
    this.currentPage = 1;
    this.applyLocalFilters();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.applyLocalFilters();
  }

  private applyLocalFilters(): void {
    const query = this.searchText.trim().toLocaleLowerCase();
    const filtered = this.allProducts.filter(product => {
      const matchesText = !query || [product.name, product.sku, product.category, product.brand]
        .some(value => String(value || '').toLocaleLowerCase().includes(query));
      const matchesCategory = this.categoryFilter === 'all' || product.category === this.categoryFilter;
      const matchesStatus = this.statusFilter === 'all' || this.currentStatus(product) === this.statusFilter;
      return matchesText && matchesCategory && matchesStatus;
    });
    this.total = filtered.length;
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
    const start = (this.currentPage - 1) * this.pageSize;
    this.products = filtered.slice(start, start + this.pageSize);
  }

  private currentStatus(product: AdminProduct): string {
    if (product.status === 'out-of-stock' || product.status === 'inactive' || product.isActive === false) return 'out-of-stock';
    if (product.status === 'active') return 'active';
    return this.stockOf(product) > 0 ? 'active' : 'out-of-stock';
  }

  createProduct(): void { void this.router.navigate(['/products/new']); }
  requestLogoutConfirmation(): void { this.logoutConfirmationVisible = true; }
  cancelLogoutConfirmation(): void { this.logoutConfirmationVisible = false; }
  confirmLogout(): void { this.logoutConfirmationVisible = false; this.logout(); }
  private logout(): void {
    localStorage.removeItem('adminUser');
    localStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminUser');
    sessionStorage.removeItem('adminToken');
    void this.router.navigate(['/admin-login']);
  }
  editProduct(product: AdminProduct): void { void this.router.navigate(['/products', product._id, 'edit']); }
  private selectionId(product: AdminProduct): string { return product._id || product.sku; }
  isProductSelected(product: AdminProduct): boolean { return this.selectedProductIds.has(this.selectionId(product)); }
  toggleProductSelection(product: AdminProduct): void {
    const next = new Set(this.selectedProductIds); const id = this.selectionId(product);
    next.has(id) ? next.delete(id) : next.add(id); this.selectedProductIds = next;
  }
  toggleSelectAllVisible(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked; const next = new Set(this.selectedProductIds);
    this.products.forEach(product => { const id = this.selectionId(product); checked ? next.add(id) : next.delete(id); });
    this.selectedProductIds = next;
  }
  requestDeleteSelected(): void {
    const selected = this.allProducts.filter(product => this.selectedProductIds.has(this.selectionId(product)));
    if (!selected.length) return;
    this.pendingDeleteProducts = selected; this.actionError = '';
  }
  cancelDeleteSelected(): void { if (!this.deletingSelected) this.pendingDeleteProducts = []; }
  confirmDeleteSelected(): void {
    if (!this.pendingDeleteProducts.length || this.deletingSelected) return;
    const products = [...this.pendingDeleteProducts];
    if (products.some(product => !product._id)) { this.actionError = 'Một số sản phẩm thiếu mã định danh nên không thể xóa.'; return; }
    this.deletingSelected = true; this.actionError = '';
    this.service.deleteMany(products.map(product => product._id!)).subscribe({
      next: () => {
        const deletedIds = new Set(products.map(product => this.selectionId(product)));
        this.allProducts = this.allProducts.filter(product => !deletedIds.has(this.selectionId(product)));
        products.forEach(product => { if (product._id) this.service.removeCachedProduct(product._id); });
        this.selectedProductIds = new Set([...this.selectedProductIds].filter(id => !deletedIds.has(id)));
        this.pendingDeleteProducts = []; this.deletingSelected = false;
        if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
        this.applyLocalFilters(); this.loadProducts(); this.changeDetector.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        this.deletingSelected = false;
        this.actionError = error.error?.message || 'Không thể xóa các sản phẩm đã chọn.';
        this.changeDetector.markForCheck();
      },
    });
  }
  imageSource(product: AdminProduct): string {
    const image = product.imageUrl || product.thumbnail;
    if (!image) return '/assets/logo.png';
    if (/^(https?:|data:image\/)/i.test(image) || image.startsWith('/assets/')) return image;
    if (image.startsWith('/products/')) return `https://floralia-1.onrender.com${image}`;
    return `https://floralia-1.onrender.com/products/image/${encodeURIComponent(image)}`;
  }

  stockOf(product: AdminProduct): number { return Number(product.stock) || 0; }
  get categoryOptions(): Array<{ label: string; value: string }> {
    return [{ label: 'Tất cả danh mục', value: 'all' }, ...this.categories.map(category => ({ label: category, value: category }))];
  }
  statusLabel(product: AdminProduct): string {
    return this.currentStatus(product) === 'out-of-stock' ? 'Hết hàng' : 'Đang kinh doanh';
  }
  statusClass(product: AdminProduct): string {
    return this.currentStatus(product) === 'out-of-stock' ? 'status-out' : 'status-active';
  }
  discountOf(product: AdminProduct): number {
    if (product.oldPrice <= product.price || !product.oldPrice) return 0;
    return Math.round((1 - product.price / product.oldPrice) * 100);
  }
  formatPrice(value: number): string { return new Intl.NumberFormat('vi-VN').format(Number(value) || 0) + '₫'; }

  requestDelete(product: AdminProduct): void { this.pendingDelete = product; this.actionError = ''; }
  cancelDelete(): void { if (!this.deleting) this.pendingDelete = null; }
  confirmDelete(): void {
    if (!this.pendingDelete || this.deleting) return;
    this.deleting = true;
    this.actionError = '';
    this.service.delete(this.pendingDelete._id).subscribe({
      next: () => {
        const deletedId = this.pendingDelete?._id;
        this.pendingDelete = null;
        this.deleting = false;
        this.allProducts = this.allProducts.filter(product => product._id !== deletedId);
        if (deletedId) { const selected = new Set(this.selectedProductIds); selected.delete(deletedId); this.selectedProductIds = selected; }
        if (deletedId) this.service.removeCachedProduct(deletedId);
        if (this.products.length === 1 && this.currentPage > 1) this.currentPage--;
        this.changeDetector.markForCheck();
        this.applyLocalFilters();
      },
      error: (error: HttpErrorResponse) => {
        this.deleting = false;
        this.actionError = error.error?.message || 'Không thể xóa sản phẩm.';
        this.changeDetector.markForCheck();
      },
    });
  }

  exportList(): void {
    {
        const rows = this.allProducts.filter(product => {
          const query = this.searchText.trim().toLocaleLowerCase();
          return (!query || [product.name, product.sku, product.category, product.brand].some(value => String(value || '').toLocaleLowerCase().includes(query)))
            && (this.categoryFilter === 'all' || product.category === this.categoryFilter)
            && (this.statusFilter === 'all' || this.currentStatus(product) === this.statusFilter);
        }).map(product => [product.sku, product.name, product.category, product.oldPrice, product.price, product.stock, this.statusLabel(product)]);
        const csv = [['SKU', 'Tên sản phẩm', 'Danh mục', 'Giá gốc', 'Giá bán', 'Tồn kho', 'Trạng thái'], ...rows]
          .map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
        link.download = 'danh-sach-san-pham.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    }
  }
}

