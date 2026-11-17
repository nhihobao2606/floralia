import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminLogoutDialog } from '../../../components/admin-logout-dialog/admin-logout-dialog';
import { AdminSidebar } from '../../../components/admin-sidebar/admin-sidebar';
import { CustomSelect, CustomSelectOption } from '../../../components/custom-select/custom-select';
import { AdminNotificationService } from '../../../services/admin-notification-service';
import { AdminInventoryService, InventoryProduct } from '../../../services/admin-inventory-service';
import { UnsavedChangesDialog } from '../../../components/unsaved-changes-dialog/unsaved-changes-dialog';

interface ReceiveLine { productSku: string; variantSku: string; quantity: number | null; }

@Component({
  selector: 'app-receive-stock',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminSidebar, AdminLogoutDialog, RouterLink, CustomSelect, UnsavedChangesDialog],
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
  exitPromptVisible = false;
  private lastSavedSnapshot = '';
  private resolveCanDeactivate?: (allowNavigation: boolean) => void;
  private pendingLogout = false;

  constructor(
    private readonly inventoryService: AdminInventoryService,
    private readonly notificationService: AdminNotificationService,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  get unreadNotificationsCount(): number { return this.notificationService.unreadCount; }
  get productOptions(): CustomSelectOption[] { return this.products.map(product => ({ label: product.name, value: product.sku })); }

  ngOnInit(): void {
    this.readAdminName();
    this.loading = true;
    this.inventoryService.getAll().subscribe({
      next: products => { this.products = products || []; this.loading = false; this.lastSavedSnapshot = this.formSnapshot(); this.changeDetector.markForCheck(); },
      error: error => {
        this.loading = false;
        this.lastSavedSnapshot = this.formSnapshot();
        if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) { this.logout(); return; }
        this.loadError = error?.error?.message || 'Không thể tải danh sách sản phẩm.';
        this.changeDetector.markForCheck();
      }
    });
  }

  get totalUnits(): number { return this.lines.reduce((sum, line) => sum + (Number(line.quantity) > 0 ? Number(line.quantity) : 0), 0); }
  get hasUnsavedChanges(): boolean { return !this.loading && !!this.lastSavedSnapshot && this.formSnapshot() !== this.lastSavedSnapshot; }
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

  submitReceipt(exitAfterSave = false): void {
    if (this.saving || this.loading) return;
    if (!this.validLines) { this.errorMessage = 'Vui lòng chọn sản phẩm, phân loại và số lượng hợp lệ cho phiếu nhập.'; return; }
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
        this.lastSavedSnapshot = this.formSnapshot();
        if (exitAfterSave) {
          this.finishLogoutIfNeeded();
          this.resolveExitNavigation(true);
        } else {
          void this.router.navigate(['/inventory']);
        }
      },
      error: error => {
        this.saving = false;
        this.errorMessage = error?.error?.message || 'Không thể lưu phiếu nhập kho.';
        this.changeDetector.markForCheck();
      }
    });
  }

  confirmCanDeactivate(): boolean | Promise<boolean> {
    if (!this.hasUnsavedChanges) { this.finishLogoutIfNeeded(); return true; }
    this.errorMessage = '';
    this.exitPromptVisible = true;
    this.changeDetector.markForCheck();
    return new Promise(resolve => { this.resolveCanDeactivate = resolve; });
  }
  stayOnEditor(): void { this.pendingLogout = false; this.resolveExitNavigation(false); }
  discardChangesAndExit(): void { this.finishLogoutIfNeeded(); this.resolveExitNavigation(true); }
  saveChangesAndExit(): void { this.submitReceipt(true); }
  private formSnapshot(): string { return JSON.stringify({ lines: this.lines, reason: this.reason }); }
  private resolveExitNavigation(allowNavigation: boolean): void {
    this.exitPromptVisible = false;
    const resolve = this.resolveCanDeactivate;
    this.resolveCanDeactivate = undefined;
    this.changeDetector.markForCheck();
    resolve?.(allowNavigation);
  }
  private finishLogoutIfNeeded(): void {
    if (!this.pendingLogout) return;
    localStorage.removeItem('adminUser'); localStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminUser'); sessionStorage.removeItem('adminToken');
    this.pendingLogout = false;
  }
  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.exitPromptVisible && !this.saving) this.stayOnEditor();
    else if (this.logoutConfirmationVisible) this.cancelLogoutConfirmation();
  }

  requestLogoutConfirmation(): void { this.logoutConfirmationVisible = true; }
  cancelLogoutConfirmation(): void { this.logoutConfirmationVisible = false; }
  confirmLogout(): void { this.logoutConfirmationVisible = false; this.logout(); }
  logout(): void { this.pendingLogout = true; void this.router.navigate(['/admin-login']); }
  private readAdminName(): void {
    const stored = localStorage.getItem('adminUser') || sessionStorage.getItem('adminUser');
    try { this.adminName = stored ? (JSON.parse(stored) as { fullName?: string }).fullName || 'Admin' : 'Admin'; }
    catch { this.adminName = 'Admin'; }
  }
}

