import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminSidebar } from '../../../components/admin-sidebar/admin-sidebar';
import { AdminNotificationService } from '../../../services/admin-notification-service';
import { AdminInventoryService, InventoryProduct } from '../../../services/admin-inventory-service';

interface ReceiveLine { productSku: string; variantSku: string; quantity: number | null; }

@Component({
  selector: 'app-receive-stock',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminSidebar, RouterLink],
  templateUrl: './receive-stock.html',
  styleUrl: './receive-stock.css',
})
export class ReceiveStock implements OnInit {
  products: InventoryProduct[] = [];
  lines: ReceiveLine[] = [{ productSku: '', variantSku: '', quantity: 1 }];
  reason = '';
  adminName = 'Admin';
  loading = false;
  saving = false;
  errorMessage = '';
  loadError = '';
  logoutConfirmationVisible = false;

  constructor(
    private readonly inventoryService: AdminInventoryService,
    private readonly notificationService: AdminNotificationService,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  get unreadNotificationsCount(): number { return this.notificationService.unreadCount; }

  ngOnInit(): void {
    this.readAdminName();
    this.loading = true;
    this.inventoryService.getAll().subscribe({
      next: products => { this.products = products || []; this.loading = false; this.changeDetector.markForCheck(); },
      error: error => {
        this.loading = false;
        if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) { this.logout(); return; }
        this.loadError = error?.error?.message || 'Không thể tải danh sách sản phẩm.';
        this.changeDetector.markForCheck();
      }
    });
  }

  get totalUnits(): number { return this.lines.reduce((sum, line) => sum + (Number(line.quantity) > 0 ? Number(line.quantity) : 0), 0); }
  get validLines(): boolean {
    return this.lines.length > 0 && this.lines.every(line => {
      const product = this.productFor(line);
      const hasRequiredVariant = !product?.variants?.length || Boolean(this.variantFor(line));
      return Boolean(product) && hasRequiredVariant && Number.isSafeInteger(Number(line.quantity)) && Number(line.quantity) > 0;
    }) &&
      new Set(this.lines.map(line => this.lineSku(line)).filter(Boolean)).size === this.lines.length;
  }

  productFor(line: ReceiveLine): InventoryProduct | undefined { return this.products.find(product => product.sku === line.productSku); }
  variantFor(line: ReceiveLine) { return this.productFor(line)?.variants?.find(variant => variant.sku === line.variantSku); }
  lineSku(line: ReceiveLine): string { return this.variantFor(line)?.sku || this.productFor(line)?.sku || ''; }
  selectProduct(line: ReceiveLine, sku: string): void {
    line.productSku = sku;
    line.variantSku = '';
  }
  selectVariant(line: ReceiveLine, sku: string): void {
    line.variantSku = sku;
  }
  currentStock(line: ReceiveLine): number | null {
    const product = this.productFor(line);
    if (product?.variants?.length && !this.variantFor(line)) return null;
    return this.variantFor(line)?.stock ?? product?.stock ?? 0;
  }
  projectedStock(line: ReceiveLine): number { return (this.currentStock(line) ?? 0) + (Number(line.quantity) || 0); }
  imageUrl(path?: string | null): string { return path ? `http://localhost:3002${path}` : '/assets/images/products/74.png'; }

  addLine(): void { this.lines = [...this.lines, { productSku: '', variantSku: '', quantity: 1 }]; }
  removeLine(index: number): void {
    if (this.lines.length === 1) { this.lines = [{ productSku: '', variantSku: '', quantity: 1 }]; return; }
    this.lines = this.lines.filter((_, lineIndex) => lineIndex !== index);
  }
  cancel(): void { void this.router.navigate(['/inventory']); }

  submitReceipt(): void {
    if (!this.validLines || this.saving || this.loading) return;
    this.saving = true;
    this.errorMessage = '';
    this.inventoryService.receiveStock(
      this.lines.map(line => ({
        sku: this.lineSku(line),
        stock: this.projectedStock(line),
        productSku: this.productFor(line)?.sku,
        variantLabel: this.variantFor(line)?.label,
      })),
      this.reason.trim()
    ).subscribe({
      next: () => {
        this.saving = false;
        void this.router.navigate(['/inventory']);
      },
      error: error => {
        this.saving = false;
        this.errorMessage = error?.error?.message || 'Không thể lưu phiếu nhập kho.';
        this.changeDetector.markForCheck();
      }
    });
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
