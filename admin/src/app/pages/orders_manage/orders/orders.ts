import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AdminLogoutDialog } from '../../../components/admin-logout-dialog/admin-logout-dialog';
import { AdminSidebar } from '../../../components/admin-sidebar/admin-sidebar';
import { AdminNotificationService, SimulatedOrderNotification } from '../../../services/admin-notification-service';
import {
  AdminOrder,
  AdminOrderItem,
  AdminOrderService,
  AdminOrderStats,
  OrderStatus,
  PaymentStatus,
  ProductCatalogItem,
  ProductCatalogVariant,
} from '../../../services/admin-order-service';

const EMPTY_STATS: AdminOrderStats = {
  total: 0,
  pending: 0,
  processing: 0,
  shipping: 0,
  delivered: 0,
  cancelled: 0,
};

interface ManualOrderLine {
  productName: string;
  productVariant: string;
  productPrice: number;
  productQuantity: number;
}

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AdminSidebar, AdminLogoutDialog],
  templateUrl: './orders.html',
  styleUrl: './orders.css',
})
export class Orders implements OnInit, OnDestroy {
  readonly pageSize = 5;

  orders: AdminOrder[] = [];
  stats: AdminOrderStats = { ...EMPTY_STATS };
  selectedOrderIds: Set<string> = new Set<string>();

  activeStatusFilter = 'all';
  activePaymentFilter = 'all';
  searchText = '';
  currentPage = 1;
  total = 0;
  loading = false;
  loadError = '';
  actionMessage = '';
  actionError = '';
  cancellingSelectedOrder = false;

  adminName = 'Admin';
  logoutConfirmationVisible = false;

  // Notification count (synced with sidebar)
  notificationCount = 0;
  notificationsOpen = false;
  private pendingSub?: Subscription;

  // Delete modal
  pendingDeleteOrders: AdminOrder[] = [];
  deleteAcknowledged = false;
  deletingOrders = false;
  deleteError = '';

  // Products catalog for Create Order modal
  productCatalog: ProductCatalogItem[] = [];
  orderLines: ManualOrderLine[] = [];
  shippingFee = 30000;
  freeShipping = false;
  manualDiscount = 0;
  customerNote = '';
  orderSource = '';

  // Create Order Modal
  createModalVisible = false;
  creatingOrder = false;
  createForm = {
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    customerEmail: '',
    paymentMethod: 'COD',
    paymentStatus: 'unpaid' as PaymentStatus,
    status: 'pending' as OrderStatus,
  };

  // Invoice Print Modal
  invoiceOrder: AdminOrder | null = null;

  private searchTimeout?: ReturnType<typeof setTimeout>;
  private loadRequestId = 0;

  constructor(
    private readonly orderService: AdminOrderService,
    private readonly notificationService: AdminNotificationService,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.readAdminName();

    this.pendingSub = this.orderService.pendingCount$.subscribe(count => {
      this.notificationCount = count;
      this.changeDetector.markForCheck();
    });

    this.orderService.getProductsCatalog().subscribe(catalog => {
      this.productCatalog = catalog || [];
      if (this.productCatalog.length > 0 && this.orderLines.length === 0) this.orderLines = [this.createLine(this.productCatalog[0])];
    });

    this.loadOrders();
  }

  ngOnDestroy(): void {
    this.loadRequestId += 1;
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    if (this.pendingSub) {
      this.pendingSub.unsubscribe();
    }
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get unreadNotificationsCount(): number {
    return this.notificationService.unreadCount;
  }

  get canCancelSelectedOrder(): boolean {
    if (this.selectedOrderIds.size !== 1) return false;
    const id = this.selectedOrderIds.values().next().value;
    const order = this.orders.find(item => item.id === id);
    return !!order && (order.status === 'pending' || order.status === 'processing');
  }

  cancelSelectedOrder(): void {
    if (!this.canCancelSelectedOrder || this.cancellingSelectedOrder) return;
    const id = this.selectedOrderIds.values().next().value;
    const order = this.orders.find(item => item.id === id);
    if (!order || !window.confirm(`Bạn có chắc chắn muốn hủy đơn hàng ${order.code}?`)) return;

    this.cancellingSelectedOrder = true;
    this.orderService.cancelOrder(order.id).subscribe({
      next: () => {
        order.status = 'cancelled';
        order.statusLabel = 'Đã hủy';
        this.selectedOrderIds.delete(order.id);
        this.cancellingSelectedOrder = false;
        this.flashActionMessage(`Đơn hàng ${order.code} đã chuyển sang trạng thái "Đã hủy".`);
        this.loadOrders();
      },
      error: (error) => {
        this.cancellingSelectedOrder = false;
        this.actionError = error?.error?.message || 'Không thể hủy đơn hàng lúc này.';
        this.changeDetector.markForCheck();
      },
    });
  }

  get orderNotifications(): SimulatedOrderNotification[] { return this.notificationService.notifications; }

  toggleNotifications(): void { this.notificationsOpen = !this.notificationsOpen; }

  markNotificationsRead(): void {
    this.notificationService.markAllRead();
  }

  @HostListener('document:click', ['$event'])
  closeNotificationsOnOutsideClick(event: MouseEvent): void {
    if (!(event.target as HTMLElement | null)?.closest('.notification-wrap')) this.notificationsOpen = false;
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index + 1);
  }

  get firstVisibleRow(): number {
    return this.total === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  get lastVisibleRow(): number {
    return Math.min(this.currentPage * this.pageSize, this.total);
  }

  loadOrders(): void {
    const requestId = ++this.loadRequestId;
    this.loading = true;
    this.loadError = '';
    this.changeDetector.markForCheck();

    this.orderService.getAll({
      page: this.currentPage,
      limit: this.pageSize,
      status: this.activeStatusFilter,
      paymentStatus: this.activePaymentFilter,
      query: this.searchText,
    }).subscribe({
      next: (response) => {
        if (requestId !== this.loadRequestId) return;
        this.orders = response.orders || [];
        this.total = response.total;
        this.stats = response.stats || { ...EMPTY_STATS };
        this.notificationCount = this.stats.pending;
        this.loading = false;
        this.changeDetector.markForCheck();
      },
      error: (error) => {
        if (requestId !== this.loadRequestId) return;
        this.loading = false;
        if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
          this.logout();
          return;
        }
        this.loadError = 'Không thể tải danh sách đơn hàng. Vui lòng thử lại.';
        this.changeDetector.markForCheck();
      },
    });
  }

  onSearchInput(value: string): void {
    this.searchText = value;
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.searchTimeout = setTimeout(() => {
      this.currentPage = 1;
      this.loadOrders();
    }, 300);
  }

  filterByStatus(status: string): void {
    if (this.activeStatusFilter === status) {
      this.activeStatusFilter = 'all';
    } else {
      this.activeStatusFilter = status;
    }
    this.currentPage = 1;
    this.loadOrders();
  }

  onStatusFilterChange(value: string): void {
    this.activeStatusFilter = value;
    this.currentPage = 1;
    this.loadOrders();
  }

  onPaymentFilterChange(value: string): void {
    this.activePaymentFilter = value;
    this.currentPage = 1;
    this.loadOrders();
  }

  resetFilters(): void {
    this.activeStatusFilter = 'all';
    this.activePaymentFilter = 'all';
    this.searchText = '';
    this.currentPage = 1;
    this.selectedOrderIds.clear();
    this.loadOrders();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) {
      return;
    }
    this.currentPage = page;
    this.loadOrders();
  }

  // Row navigation to order detail
  goToDetail(order: AdminOrder): void {
    void this.router.navigate(['/orders', order.id]);
  }

  // Checkbox selection
  isAllSelected(): boolean {
    return this.orders.length > 0 && this.orders.every(o => this.selectedOrderIds.has(o.id));
  }

  toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.orders.forEach(o => this.selectedOrderIds.add(o.id));
    } else {
      this.orders.forEach(o => this.selectedOrderIds.delete(o.id));
    }
  }

  toggleSelect(order: AdminOrder): void {
    if (this.selectedOrderIds.has(order.id)) {
      this.selectedOrderIds.delete(order.id);
    } else {
      this.selectedOrderIds.add(order.id);
    }
  }

  isSelected(order: AdminOrder): boolean {
    return this.selectedOrderIds.has(order.id);
  }

  // Quick action: Xác nhận đơn -> chuyển sang "Chờ lấy hàng" (processing)
  confirmOrder(order: AdminOrder): void {
    this.orderService.updateStatus(order.id, 'processing', 'Chờ lấy hàng').subscribe({
      next: () => {
        order.status = 'processing';
        order.statusLabel = 'Chờ lấy hàng';
        this.flashActionMessage(`Đơn hàng ${order.code} đã chuyển sang "Chờ lấy hàng".`);
        this.loadOrders();
      },
      error: () => {
        this.actionError = 'Không thể cập nhật trạng thái đơn hàng.';
        this.changeDetector.markForCheck();
      },
    });
  }

  printInvoice(order: AdminOrder): void {
    this.invoiceOrder = order;
  }

  closeInvoice(): void {
    this.invoiceOrder = null;
  }

  printCurrentInvoice(): void {
    window.print();
  }

  exportList(): void {
    this.orderService.exportToCsv(this.orders);
  }

  // Create Order handling
  createLine(product?: ProductCatalogItem): ManualOrderLine {
    const item = product || this.productCatalog[0];
    const variant = item?.variants?.[0];
    return { productName: item?.name || '', productVariant: variant?.label || '', productPrice: variant?.price || 0, productQuantity: 1 };
  }

  variantsForLine(line: ManualOrderLine): ProductCatalogVariant[] {
    return this.productCatalog.find(item => item.name === line.productName)?.variants || [];
  }

  onProductSelected(line: ManualOrderLine, name: string): void {
    const product = this.productCatalog.find(item => item.name === name);
    Object.assign(line, this.createLine(product));
  }

  onVariantSelected(line: ManualOrderLine, label: string): void {
    line.productVariant = label;
    line.productPrice = this.variantsForLine(line).find(item => item.label === label)?.price || 0;
  }

  addOrderLine(): void { this.orderLines = [...this.orderLines, this.createLine()]; }
  removeOrderLine(index: number): void { if (this.orderLines.length > 1) this.orderLines.splice(index, 1); }
  selectedVariant(line: ManualOrderLine): ProductCatalogVariant | undefined { return this.variantsForLine(line).find(v => v.label === line.productVariant); }
  lineSku(line: ManualOrderLine): string { const product = this.productCatalog.find(p => p.name === line.productName); return this.selectedVariant(line)?.sku || product?.sku || ''; }
  lineStock(line: ManualOrderLine): number | undefined { return this.selectedVariant(line)?.stock; }
  get createSubtotal(): number { return this.orderLines.reduce((sum, line) => sum + line.productPrice * Math.max(0, Number(line.productQuantity) || 0), 0); }
  get effectiveShippingFee(): number { return this.freeShipping ? 0 : Math.max(0, Number(this.shippingFee) || 0); }
  get createTotal(): number { return Math.max(0, this.createSubtotal - Math.max(0, Number(this.manualDiscount) || 0)) + this.effectiveShippingFee; }

  openCreateModal(): void {
    this.createForm = { customerName: '', customerPhone: '', customerAddress: '', customerEmail: '', paymentMethod: 'COD', paymentStatus: 'unpaid', status: 'pending' };
    this.orderLines = [this.createLine()];
    this.shippingFee = 30000;
    this.freeShipping = false;
    this.manualDiscount = 0;
    this.customerNote = '';
    this.orderSource = '';
    this.createModalVisible = true;
  }

  closeCreateModal(): void { this.createModalVisible = false; }

  submitCreateOrder(): void {
    if (!this.createForm.customerName.trim() || !this.createForm.customerPhone.trim() || !this.createForm.customerAddress.trim()) {
      alert('Vui lòng nhập tên, số điện thoại và địa chỉ giao hàng.'); return;
    }
    if (!this.orderLines.length || this.orderLines.some(line => !line.productName || !line.productVariant || !Number.isInteger(Number(line.productQuantity)) || Number(line.productQuantity) < 1)) {
      alert('Vui lòng chọn sản phẩm, phân loại và số lượng hợp lệ cho từng dòng.'); return;
    }
    const overStock = this.orderLines.find(line => this.lineStock(line) !== undefined && Number(line.productQuantity) > Number(this.lineStock(line)));
    if (overStock) { alert(`Tồn kho phân loại ${overStock.productVariant} không đủ (còn ${this.lineStock(overStock)}).`); return; }
    if (Number(this.manualDiscount) > this.createSubtotal) { alert('Giảm giá không thể lớn hơn tạm tính.'); return; }
    this.creatingOrder = true;
    const items: AdminOrderItem[] = this.orderLines.map(line => {
      const product = this.productCatalog.find(p => p.name === line.productName);
      const variant = this.selectedVariant(line);
      return { sku: variant?.sku || product?.sku || '', name: line.productName, variant: line.productVariant, price: line.productPrice, quantity: Number(line.productQuantity), total: line.productPrice * Number(line.productQuantity), image: variant?.image || product?.imageUrl || '/assets/images/products/74.png' };
    });
    const payload: Partial<AdminOrder> & { customerNote?: string; source?: string } = {
      receiver: { name: this.createForm.customerName.trim(), phone: this.createForm.customerPhone.trim(), address: this.createForm.customerAddress.trim(), email: this.createForm.customerEmail.trim() },
      items, subtotal: this.createSubtotal, discount: Number(this.manualDiscount) || 0, shippingFee: this.effectiveShippingFee, total: this.createTotal,
      customerNote: this.customerNote.trim(), source: this.orderSource,
      paymentMethod: this.createForm.paymentMethod, paymentStatus: this.createForm.paymentStatus,
      paymentStatusLabel: this.createForm.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán',
      status: this.createForm.status, statusLabel: this.createForm.status === 'pending' ? 'Chờ xác nhận' : 'Chờ lấy hàng',
    };
    this.orderService.createOrder(payload).subscribe({
      next: res => { this.creatingOrder = false; this.createModalVisible = false; this.flashActionMessage(`Tạo đơn hàng ${res.order.code} thành công.`); this.loadOrders(); },
      error: error => { this.creatingOrder = false; alert(error?.error?.message || 'Không thể lưu đơn hàng. Vui lòng thử lại.'); },
    });
  }

  // Deletion
  requestDeleteSelected(): void {
    const selected = this.orders.filter(o => this.selectedOrderIds.has(o.id));
    if (selected.length === 0) return;
    this.pendingDeleteOrders = selected;
    this.deleteAcknowledged = false;
    this.deleteError = '';
  }

  cancelDelete(): void {
    if (this.deletingOrders) return;
    this.pendingDeleteOrders = [];
    this.deleteAcknowledged = false;
    this.deleteError = '';
  }

  confirmDelete(): void {
    if (this.pendingDeleteOrders.length === 0 || !this.deleteAcknowledged || this.deletingOrders) {
      return;
    }

    this.deletingOrders = true;
    this.deleteError = '';
    const ids = this.pendingDeleteOrders.map(o => o.id);

    this.orderService.bulkDelete(ids).subscribe({
      next: () => {
        this.deletingOrders = false;
        this.pendingDeleteOrders.forEach(o => this.selectedOrderIds.delete(o.id));
        this.pendingDeleteOrders = [];
        this.deleteAcknowledged = false;
        this.flashActionMessage(`Đã xóa ${ids.length} đơn hàng thành công.`);
        this.loadOrders();
      },
      error: (error) => {
        this.deletingOrders = false;
        this.deleteError = error instanceof HttpErrorResponse
          ? error.error?.message || 'Không thể xóa đơn hàng.'
          : 'Không thể xóa đơn hàng.';
        this.changeDetector.markForCheck();
      },
    });
  }

  // Helpers
  formatPrice(num: number): string {
    return (num || 0).toLocaleString('vi-VN') + 'đ';
  }

  getItemsQuantities(items: AdminOrderItem[]): string {
    if (!items || items.length === 0) return '0';
    return items.map(i => i.quantity).join(' · ');
  }

  private flashActionMessage(msg: string): void {
    this.actionMessage = msg;
    this.changeDetector.markForCheck();
    setTimeout(() => {
      this.actionMessage = '';
      this.changeDetector.markForCheck();
    }, 4000);
  }

  // Logout
  requestLogoutConfirmation(): void {
    this.logoutConfirmationVisible = true;
    this.changeDetector.markForCheck();
  }

  cancelLogoutConfirmation(): void {
    this.logoutConfirmationVisible = false;
    this.changeDetector.markForCheck();
  }

  confirmLogout(): void {
    this.logoutConfirmationVisible = false;
    this.changeDetector.markForCheck();
    this.logout();
  }

  logout(): void {
    localStorage.removeItem('adminUser');
    localStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminUser');
    sessionStorage.removeItem('adminToken');
    void this.router.navigate(['/admin-login']);
  }

  private readAdminName(): void {
    const storedUser = localStorage.getItem('adminUser') || sessionStorage.getItem('adminUser');
    if (!storedUser) return;
    try {
      const user = JSON.parse(storedUser) as { fullName?: string };
      this.adminName = user.fullName || 'Admin';
    } catch {
      this.adminName = 'Admin';
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.notificationsOpen) {
      this.notificationsOpen = false;
      return;
    }
    if (this.invoiceOrder) {
      this.closeInvoice();
      return;
    }
    if (this.createModalVisible) {
      this.closeCreateModal();
      return;
    }
    if (this.pendingDeleteOrders.length > 0) {
      this.cancelDelete();
      return;
    }
    if (this.logoutConfirmationVisible) {
      this.cancelLogoutConfirmation();
    }
  }
}
