import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminSidebar } from '../../../components/admin-sidebar/admin-sidebar';
import { AdminNotificationService } from '../../../services/admin-notification-service';
import { AdminInventoryService, InventoryProduct } from '../../../services/admin-inventory-service';

type StockFilter = 'all' | 'low' | 'available' | 'out';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminSidebar],
  templateUrl: './inventory.html',
  styleUrl: './inventory.css',
})
export class Inventory implements OnInit {
  readonly pageSize = 8;
  readonly lowStockThreshold = 10;
  products: InventoryProduct[] = [];
  searchText = '';
  categoryFilter = '';
  stockFilter: StockFilter = 'all';
  currentPage = 1;
  loading = false;
  loadError = '';
  actionError = '';
  actionMessage = '';
  adminName = 'Admin';
  logoutConfirmationVisible = false;
  adjustingProduct: InventoryProduct | null = null;
  adjustmentVariantSku = '';
  adjustmentType: 'add' | 'subtract' = 'add';
  adjustmentAmount = 1;
  adjustmentReason = '';
  saving = false;

  constructor(
    private readonly inventoryService: AdminInventoryService,
    private readonly notificationService: AdminNotificationService,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  get unreadNotificationsCount(): number { return this.notificationService.unreadCount; }

  ngOnInit(): void {
    this.readAdminName();
    this.loadInventory();
  }

  get categories(): string[] {
    return [...new Set(this.products.map(product => product.category).filter((value): value is string => Boolean(value)))].sort();
  }

  get filteredProducts(): InventoryProduct[] {
    const query = this.searchText.trim().toLocaleLowerCase('vi');
    return this.products.filter(product => {
      const matchesQuery = !query || product.name.toLocaleLowerCase('vi').includes(query) || product.sku.toLocaleLowerCase().includes(query);
      const matchesCategory = !this.categoryFilter || product.category === this.categoryFilter;
      const matchesStock = this.stockFilter === 'all' ||
        (this.stockFilter === 'low' && product.stock > 0 && product.stock < this.lowStockThreshold) ||
        (this.stockFilter === 'available' && product.stock >= this.lowStockThreshold) ||
        (this.stockFilter === 'out' && product.stock === 0);
      return matchesQuery && matchesCategory && matchesStock;
    });
  }

  get totalPages(): number { return Math.max(1, Math.ceil(this.filteredProducts.length / this.pageSize)); }
  get visibleProducts(): InventoryProduct[] { return this.filteredProducts.slice((this.currentPage - 1) * this.pageSize, this.currentPage * this.pageSize); }
  get lowStockCount(): number { return this.products.filter(product => product.stock > 0 && product.stock < this.lowStockThreshold).length; }
  get outOfStockCount(): number { return this.products.filter(product => product.stock === 0).length; }
  get availableCount(): number { return this.products.filter(product => product.stock >= this.lowStockThreshold).length; }
  get totalStock(): number { return this.products.reduce((sum, product) => sum + product.stock, 0); }

  loadInventory(): void {
    this.loading = true;
    this.loadError = '';
    this.inventoryService.getAll().subscribe({
      next: products => { this.products = products || []; this.currentPage = 1; this.loading = false; this.changeDetector.markForCheck(); },
      error: error => {
        this.loading = false;
        if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) { this.logout(); return; }
        this.loadError = error?.error?.message || 'Không thể tải dữ liệu tồn kho. Vui lòng thử lại.';
        this.changeDetector.markForCheck();
      }
    });
  }

  onFilterChange(): void { this.currentPage = 1; }
  setStockFilter(filter: StockFilter): void { this.stockFilter = filter; this.onFilterChange(); }
  goToPage(page: number): void { if (page >= 1 && page <= this.totalPages) this.currentPage = page; }
  statusLabel(stock: number | null): string { return stock === null ? 'Chọn phân loại' : stock === 0 ? 'Hết hàng' : stock < this.lowStockThreshold ? 'Sắp hết hàng' : 'Còn hàng'; }

  openAdjustment(product: InventoryProduct, type: 'add' | 'subtract' = 'add'): void {
    this.adjustingProduct = product;
    this.adjustmentVariantSku = '';
    this.adjustmentType = type;
    this.adjustmentAmount = 1;
    this.adjustmentReason = '';
    this.actionError = '';
  }

  get adjustingVariant() {
    return this.adjustingProduct?.variants?.find(variant => variant.sku === this.adjustmentVariantSku) || null;
  }

  selectAdjustmentVariant(sku: string): void {
    this.adjustmentVariantSku = sku;
  }

  get adjustingStock(): number | null {
    if (this.adjustingProduct?.variants?.length && !this.adjustingVariant) return null;
    return this.adjustingVariant?.stock ?? this.adjustingProduct?.stock ?? 0;
  }

  get adjustedStock(): number | null {
    const current = this.adjustingStock;
    if (current === null) return null;
    return this.adjustmentType === 'add' ? current + Number(this.adjustmentAmount || 0) : current - Number(this.adjustmentAmount || 0);
  }

  saveAdjustment(): void {
    if (!this.adjustingProduct || this.saving || (this.adjustingProduct.variants?.length && !this.adjustingVariant) || !Number.isSafeInteger(Number(this.adjustmentAmount)) || Number(this.adjustmentAmount) < 1 || this.adjustedStock === null || this.adjustedStock < 0) return;
    const target = this.adjustedStock;
    if (target === null) return;
    const sku = this.adjustingVariant?.sku || this.adjustingProduct.sku;
    this.saving = true;
    this.actionError = '';
    this.inventoryService.setStock(sku, target, this.adjustmentReason.trim(), this.adjustingProduct.sku, this.adjustingVariant?.label).subscribe({
      next: response => {
        const currentProduct = this.products.find(product => product.sku === response.product.sku);
        const responseVariants = response.product.variants || [];
        const mergedVariants = currentProduct?.variants?.map(variant => {
          const updatedVariant = responseVariants.find(candidate => candidate.sku === variant.sku);
          return { ...variant, ...updatedVariant, label: variant.label };
        });
        this.products = this.products.map(product => product.sku === response.product.sku
          ? { ...product, ...response.product, variants: mergedVariants?.length ? mergedVariants : responseVariants, imageUrl: response.product.imageUrl || product.imageUrl }
          : product);
        this.adjustingProduct = null;
        this.saving = false;
        this.actionMessage = `Đã cập nhật tồn kho ${response.product.name}.`;
        this.changeDetector.markForCheck();
        setTimeout(() => { this.actionMessage = ''; this.changeDetector.markForCheck(); }, 3500);
      },
      error: error => { this.saving = false; this.actionError = error?.error?.message || 'Không thể cập nhật tồn kho.'; this.changeDetector.markForCheck(); }
    });
  }

  goToReceiveStock(): void { void this.router.navigate(['/inventory/receive']); }

  closeAdjustment(): void { if (!this.saving) this.adjustingProduct = null; }
  formatPrice(price: number): string { return `${Number(price || 0).toLocaleString('vi-VN')}₫`; }
  imageUrl(path?: string | null): string { return path ? `http://localhost:3002${path}` : '/assets/images/products/74.png'; }

  exportCsv(): void {
    const rows = [['SKU', 'Tên sản phẩm', 'Danh mục', 'Tồn kho', 'Trạng thái'], ...this.filteredProducts.map(product => [product.sku, product.name, product.category || '', String(product.stock), this.statusLabel(product.stock)])];
    const csv = '\uFEFF' + rows.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'bao-cao-ton-kho.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  requestLogoutConfirmation(): void { this.logoutConfirmationVisible = true; }
  cancelLogoutConfirmation(): void { this.logoutConfirmationVisible = false; }
  confirmLogout(): void { this.logoutConfirmationVisible = false; this.logout(); }
  logout(): void {
    localStorage.removeItem('adminUser'); localStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminUser'); sessionStorage.removeItem('adminToken');
    void this.router.navigate(['/admin-login']);
  }
  private readAdminName(): void {
    const stored = localStorage.getItem('adminUser') || sessionStorage.getItem('adminUser');
    try { this.adminName = stored ? (JSON.parse(stored) as { fullName?: string }).fullName || 'Admin' : 'Admin'; }
    catch { this.adminName = 'Admin'; }
  }
}
