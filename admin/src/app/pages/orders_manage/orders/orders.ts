import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AdminSidebar } from '../../../components/admin-sidebar/admin-sidebar';
import {
  AdminOrder,
  AdminOrderItem,
  AdminOrderService,
  AdminOrderStats,
  OrderStatus,
  PaymentStatus,
} from '../../../services/admin-order-service';

const EMPTY_STATS: AdminOrderStats = {
  total: 0,
  pending: 0,
  processing: 0,
  shipping: 0,
  delivered: 0,
  cancelled: 0,
};

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AdminSidebar],
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

  adminName = 'Admin';
  logoutConfirmationVisible = false;

  // Delete modal
  pendingDeleteOrders: AdminOrder[] = [];
  deleteAcknowledged = false;
  deletingOrders = false;
  deleteError = '';

  // Create Order Modal
  createModalVisible = false;
  creatingOrder = false;
  createForm = {
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    customerEmail: '',
    productName: 'Lục Mễ Trà – Trà Xanh Gạo Lứt Rang',
    productVariant: 'Hộp 100g',
    productPrice: 150000,
    productQuantity: 1,
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
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.readAdminName();
    this.loadOrders();
  }

  ngOnDestroy(): void {
    this.loadRequestId += 1;
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
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

  // Status and quick actions
  onQuickStatusChange(order: AdminOrder, newStatus: string): void {
    let label = 'Chờ xác nhận';
    if (newStatus === 'processing') label = 'Đang chuẩn bị';
    else if (newStatus === 'shipping') label = 'Đang giao hàng';
    else if (newStatus === 'delivered') label = 'Đã giao';
    else if (newStatus === 'cancelled') label = 'Đã hủy';

    this.orderService.updateStatus(order.id, newStatus, label).subscribe({
      next: (res) => {
        order.status = newStatus;
        order.statusLabel = label;
        this.flashActionMessage(`Cập nhật đơn hàng ${order.code} thành "${label}"`);
        this.loadOrders();
      },
      error: () => {
        this.actionError = 'Không thể cập nhật trạng thái đơn hàng.';
        this.changeDetector.markForCheck();
      },
    });
  }

  confirmOrder(order: AdminOrder): void {
    this.onQuickStatusChange(order, 'processing');
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

  // Create Order
  openCreateModal(): void {
    this.createForm = {
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      customerEmail: '',
      productName: 'Lục Mễ Trà – Trà Xanh Gạo Lứt Rang',
      productVariant: 'Hộp 100g',
      productPrice: 150000,
      productQuantity: 1,
      paymentMethod: 'COD',
      paymentStatus: 'unpaid',
      status: 'pending',
    };
    this.createModalVisible = true;
  }

  closeCreateModal(): void {
    this.createModalVisible = false;
  }

  submitCreateOrder(): void {
    if (!this.createForm.customerName.trim() || !this.createForm.customerPhone.trim()) {
      alert('Vui lòng điền họ tên và số điện thoại khách hàng.');
      return;
    }

    this.creatingOrder = true;
    const subtotal = this.createForm.productPrice * this.createForm.productQuantity;
    const total = subtotal;

    const newOrderPayload: Partial<AdminOrder> = {
      receiver: {
        name: this.createForm.customerName.trim(),
        phone: this.createForm.customerPhone.trim(),
        address: this.createForm.customerAddress.trim() || 'Hồ Chí Minh',
        email: this.createForm.customerEmail.trim(),
      },
      items: [
        {
          name: this.createForm.productName,
          variant: this.createForm.productVariant,
          price: this.createForm.productPrice,
          quantity: this.createForm.productQuantity,
          total: subtotal,
          image: '/assets/images/products/74.png',
        },
      ],
      subtotal,
      discount: 0,
      shippingFee: 0,
      total,
      paymentMethod: this.createForm.paymentMethod,
      paymentStatus: this.createForm.paymentStatus,
      paymentStatusLabel: this.createForm.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán',
      status: this.createForm.status,
      statusLabel: this.createForm.status === 'pending' ? 'Chờ xác nhận' : 'Đang chuẩn bị',
    };

    this.orderService.createOrder(newOrderPayload).subscribe({
      next: (res) => {
        this.creatingOrder = false;
        this.createModalVisible = false;
        this.flashActionMessage(`Tạo đơn hàng ${res.order.code} thành công.`);
        this.loadOrders();
      },
      error: () => {
        this.creatingOrder = false;
        alert('Không thể tạo đơn hàng. Vui lòng kiểm tra lại kết nối.');
      },
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
