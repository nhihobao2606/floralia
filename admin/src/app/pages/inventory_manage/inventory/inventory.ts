import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AdminLogoutDialog } from '../../../components/admin-logout-dialog/admin-logout-dialog';
import { AdminSidebar } from '../../../components/admin-sidebar/admin-sidebar';
import { AdminNotificationService } from '../../../services/admin-notification-service';
import { AdminInventoryService, InventoryProduct } from '../../../services/admin-inventory-service';

type StockFilter = 'all' | 'low' | 'available' | 'out';
type AdjustmentLine = { sku: string; label: string; current: number; amount: number; reason: string; productSku?: string };

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminSidebar, AdminLogoutDialog, RouterLink],
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
  adjustmentType: 'add' | 'subtract' | 'set' = 'add';
  adjustmentAmount = 1;
  adjustmentReason = '';
  saving = false;
  expandedSkus = new Set<string>();
  adjustmentLines: AdjustmentLine[] = [];
  singleVariantAdjustment = false;
  selectedVariantKeys = new Set<string>();
  bulkEditOpen = false;
  bulkLines: AdjustmentLine[] = [];
  bulkMode: 'add' | 'subtract' | 'set' = 'add';
  bulkReason = '';

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
      const stocks = this.variantStocks(product);
      const matchesStock = this.stockFilter === 'all' ||
        (this.stockFilter === 'low' && stocks.some(stock => stock > 0 && stock < this.lowStockThreshold)) ||
        (this.stockFilter === 'available' && stocks.some(stock => stock >= this.lowStockThreshold)) ||
        (this.stockFilter === 'out' && stocks.some(stock => stock === 0));
      return matchesQuery && matchesCategory && matchesStock;
    });
  }

  get totalPages(): number { return Math.max(1, Math.ceil(this.filteredProducts.length / this.pageSize)); }
  get pages(): number[] { return Array.from({ length: this.totalPages }, (_, index) => index + 1); }
  get visibleProducts(): InventoryProduct[] { return this.filteredProducts.slice((this.currentPage - 1) * this.pageSize, this.currentPage * this.pageSize); }
  get lowStockCount(): number { return this.products.filter(product => this.variantStocks(product).some(stock => stock > 0 && stock < this.lowStockThreshold)).length; }
  get outOfStockCount(): number { return this.products.filter(product => this.variantStocks(product).some(stock => stock === 0)).length; }
  get availableCount(): number { return this.products.filter(product => this.variantStocks(product).some(stock => stock >= this.lowStockThreshold)).length; }
  get totalStock(): number { return this.products.reduce((sum, product) => sum + product.stock, 0); }
  get selectedVariantCount(): number { return this.selectedVariantKeys.size; }

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

  onFilterChange(): void { this.currentPage = 1; this.expandFilteredAlerts(); }
  setStockFilter(filter: StockFilter): void { this.stockFilter = filter; this.onFilterChange(); }
  goToPage(page: number): void { if (page >= 1 && page <= this.totalPages) this.currentPage = page; }
  statusLabel(stock: number | null): string { return stock === null ? 'Chọn phân loại' : stock === 0 ? 'Hết hàng' : stock < this.lowStockThreshold ? 'Sắp hết hàng' : 'Còn hàng'; }

  private variantStocks(product: InventoryProduct): number[] { return product.variants?.length ? product.variants.map(variant => Number(variant.stock) || 0) : [Number(product.stock) || 0]; }
  hasVariants(product: InventoryProduct): boolean { return (product.variants?.length || 0) > 1; }
  isExpanded(product: InventoryProduct): boolean { return this.expandedSkus.has(product.sku); }
  toggleExpanded(product: InventoryProduct): void { const next = new Set(this.expandedSkus); next.has(product.sku) ? next.delete(product.sku) : next.add(product.sku); this.expandedSkus = next; }
  lowVariantCount(product: InventoryProduct): number { return this.variantStocks(product).filter(stock => stock > 0 && stock < this.lowStockThreshold).length; }
  outVariantCount(product: InventoryProduct): number { return this.variantStocks(product).filter(stock => stock === 0).length; }
  productStatus(product: InventoryProduct): string { return this.variantStocks(product).every(stock => stock === 0) ? 'Hết hàng' : 'Còn hàng'; }
  private expandFilteredAlerts(): void {
    if (this.stockFilter !== 'low' && this.stockFilter !== 'out') return;
    const next = new Set(this.expandedSkus);
    this.filteredProducts.forEach(product => next.add(product.sku));
    this.expandedSkus = next;
  }

  showMultiAdjustment(product: InventoryProduct | null): boolean { return !!product && this.hasVariants(product) && !this.singleVariantAdjustment; }
  private selectionKey(productSku: string, variantSku: string): string { return `${productSku}::${variantSku}`; }
  private productVariants(product: InventoryProduct) { return product.variants?.length ? product.variants : [{ sku: product.sku, label: 'Tiêu chuẩn', stock: product.stock }]; }
  isVariantSelected(product: InventoryProduct, variantSku: string): boolean { return this.selectedVariantKeys.has(this.selectionKey(product.sku, variantSku)); }
  isProductSelected(product: InventoryProduct): boolean { const variants = this.productVariants(product); return variants.length > 0 && variants.every(variant => this.isVariantSelected(product, variant.sku)); }
  isProductPartiallySelected(product: InventoryProduct): boolean { const variants = this.productVariants(product); const selected = variants.filter(variant => this.isVariantSelected(product, variant.sku)).length; return selected > 0 && selected < variants.length; }
  toggleVariantSelection(product: InventoryProduct, sku: string): void {
    const next = new Set(this.selectedVariantKeys); const key = this.selectionKey(product.sku, sku);
    next.has(key) ? next.delete(key) : next.add(key); this.selectedVariantKeys = next;
  }
  toggleProductSelection(product: InventoryProduct): void {
    const next = new Set(this.selectedVariantKeys); const variants = this.productVariants(product); const select = !this.isProductSelected(product);
    variants.forEach(variant => { const key = this.selectionKey(product.sku, variant.sku); select ? next.add(key) : next.delete(key); });
    this.selectedVariantKeys = next;
  }
  clearSelection(): void { this.selectedVariantKeys = new Set<string>(); }
  openBulkAdjustment(): void {
    this.bulkLines = this.products.flatMap(product => this.productVariants(product)
      .filter(variant => this.isVariantSelected(product, variant.sku))
      .map(variant => ({ sku: variant.sku, label: variant.label, current: Number(variant.stock) || 0, amount: 0, reason: '', productSku: product.sku })));
    this.bulkMode = 'add'; this.bulkReason = ''; this.bulkEditOpen = true; this.actionError = '';
  }
  adjustProductStock(product: InventoryProduct): void {
    if (!this.hasVariants(product)) {
      this.openAdjustment(product, 'add');
      return;
    }
    this.selectedVariantKeys = new Set(this.productVariants(product).map(variant => this.selectionKey(product.sku, variant.sku)));
    this.openBulkAdjustment();
  }
  closeBulkAdjustment(): void { if (!this.saving) this.bulkEditOpen = false; }
  applyBulkReason(): void { this.bulkLines = this.bulkLines.map(line => ({ ...line, reason: this.bulkReason })); }
  bulkProjectedStock(line: AdjustmentLine): number {
    if (this.bulkMode === 'set') return Number(line.amount || 0);
    return this.bulkMode === 'add' ? line.current + Number(line.amount || 0) : line.current - Number(line.amount || 0);
  }
  isInvalidBulkLine(line: AdjustmentLine): boolean {
    const amount = Number(line.amount);
    const minimum = this.bulkMode === 'set' ? 0 : 1;
    return line.amount === null || line.amount === undefined || String(line.amount).trim() === '' || !Number.isSafeInteger(amount) || amount < minimum || this.bulkProjectedStock(line) < 0;
  }

  openVariantAdjustment(product: InventoryProduct, variant: { sku: string; label: string; stock: number }): void {
    this.openAdjustment(product, 'add');
    this.singleVariantAdjustment = true;
    this.adjustmentVariantSku = variant.sku;
    this.adjustmentAmount = 1;
  }

  openAdjustment(product: InventoryProduct, type: 'add' | 'subtract' = 'add'): void {
    this.adjustingProduct = product;
    this.adjustmentVariantSku = '';
    this.adjustmentType = type;
    this.adjustmentAmount = 1;
    this.adjustmentReason = '';
    this.singleVariantAdjustment = false;
    this.adjustmentLines = (product.variants?.length ? product.variants : [{ sku: product.sku, label: 'Tiêu chuẩn', stock: product.stock }])
      .map(variant => ({ sku: variant.sku, label: variant.label, current: Number(variant.stock) || 0, amount: 1, reason: '' }));
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
    if (this.adjustingProduct && this.showMultiAdjustment(this.adjustingProduct)) {
      const product = this.adjustingProduct;
      const lines = this.adjustmentLines;
      if (this.saving || !lines.length || lines.some(line => !Number.isSafeInteger(Number(line.amount)) || Number(line.amount) < 1 || this.nextStock(line) < 0)) return;
      this.saving = true;
      this.actionError = '';
      forkJoin(lines.map(line => this.inventoryService.setStock(line.sku, this.nextStock(line), line.reason.trim(), product.sku, line.label, true))).subscribe({
        next: responses => {
          const variants = product.variants!.map(variant => {
            const line = lines.find(candidate => candidate.sku === variant.sku)!;
            return { ...variant, stock: this.nextStock(line) };
          });
          const responseProduct = responses[responses.length - 1].product;
          this.products = this.products.map(item => item.sku === product.sku
            ? { ...item, ...responseProduct, variants, stock: variants.reduce((sum, variant) => sum + variant.stock, 0) }
            : item);
          this.adjustingProduct = null;
          this.saving = false;
          this.actionMessage = `Đã cập nhật tồn kho ${product.name}.`;
          this.changeDetector.markForCheck();
          setTimeout(() => { this.actionMessage = ''; this.changeDetector.markForCheck(); }, 3500);
        },
        error: error => { this.saving = false; this.actionError = error?.error?.message || 'Không thể cập nhật tồn kho.'; this.changeDetector.markForCheck(); }
      });
      return;
    }
    if (!this.adjustingProduct || this.saving || (this.adjustingProduct.variants?.length && !this.adjustingVariant) || !Number.isSafeInteger(Number(this.adjustmentAmount)) || Number(this.adjustmentAmount) < 1 || this.adjustedStock === null || this.adjustedStock < 0) return;
    const target = this.adjustedStock;
    if (target === null) return;
    const sku = this.adjustingVariant?.sku || this.adjustingProduct.sku;
    this.saving = true;
    this.actionError = '';
    this.inventoryService.setStock(sku, target, this.adjustmentReason.trim(), this.adjustingProduct.sku, this.adjustingVariant?.label, true).subscribe({
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

  nextStock(line: AdjustmentLine): number { return this.adjustmentType === 'add' ? line.current + Number(line.amount || 0) : line.current - Number(line.amount || 0); }

  saveBulkAdjustment(): void {
    if (this.saving || !this.bulkLines.length || this.bulkLines.some(line => this.isInvalidBulkLine(line) || (line.reason || this.bulkReason).trim().length > 160)) return;
    const items = this.bulkLines.map(line => ({ sku: line.sku, productSku: line.productSku || '', variantLabel: line.label, reason: (line.reason || this.bulkReason).trim(), stock: this.bulkProjectedStock(line) }));
    this.saving = true; this.actionError = '';
    this.inventoryService.bulkAdjust(items).subscribe({
      next: response => {
        this.products = this.products.map(product => {
          const updated = response.products.find(candidate => candidate.sku === product.sku);
          if (!updated) return product;
          const variants = product.variants?.map(variant => {
            const fresh = updated.variants?.find(candidate => candidate.sku === variant.sku);
            return { ...variant, ...fresh, label: variant.label };
          });
          return { ...product, ...updated, variants: variants?.length ? variants : updated.variants, imageUrl: updated.imageUrl || product.imageUrl };
        });
        this.saving = false; this.bulkEditOpen = false; this.clearSelection();
        this.actionMessage = `Đã cập nhật ${items.length} phân loại · Phiếu ${response.batchCode}.`;
        this.changeDetector.markForCheck();
        setTimeout(() => { this.actionMessage = ''; this.changeDetector.markForCheck(); }, 4500);
      },
      error: error => { this.saving = false; this.actionError = error?.error?.message || 'Không thể cập nhật hàng loạt tồn kho.'; this.changeDetector.markForCheck(); }
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
