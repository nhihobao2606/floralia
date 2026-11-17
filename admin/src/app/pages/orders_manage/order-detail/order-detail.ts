import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AdminLogoutDialog } from '../../../components/admin-logout-dialog/admin-logout-dialog';
import { AdminSidebar } from '../../../components/admin-sidebar/admin-sidebar';
import {
  AdminOrder,
  AdminOrderNote,
  AdminOrderService,
  AdminOrderTimelineItem,
  OrderStatus,
} from '../../../services/admin-order-service';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AdminSidebar, AdminLogoutDialog],
  templateUrl: './order-detail.html',
  styleUrl: './order-detail.css',
})
export class OrderDetail implements OnInit, OnDestroy {
  orderId = '';
  order: AdminOrder | null = null;
  loading = false;
  loadError = '';
  actionMessage = '';
  actionError = '';
  adminName = 'Admin';

  // Notification count (synced with sidebar)
  notificationCount = 0;
  private pendingSub?: Subscription;

  // Notes
  newNoteText = '';
  addingNote = false;

  // Modals
  invoiceModalVisible = false;
  cancelModalVisible = false;
  cancellingOrder = false;
  logoutConfirmationVisible = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly orderService: AdminOrderService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.readAdminName();

    this.pendingSub = this.orderService.pendingCount$.subscribe(count => {
      this.notificationCount = count;
      this.changeDetector.markForCheck();
    });

    this.route.paramMap.subscribe((params) => {
      this.orderId = params.get('id') || '';
      if (this.orderId) {
        this.loadOrder();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.pendingSub) {
      this.pendingSub.unsubscribe();
    }
  }

  get canCancelOrder(): boolean {
    return this.order?.status === 'pending' || this.order?.status === 'processing';
  }

  loadOrder(): void {
    this.loading = true;
    this.loadError = '';
    this.changeDetector.markForCheck();

    this.orderService.getById(this.orderId).subscribe({
      next: (res) => {
        this.loading = false;
        if (res && res.order) {
          this.order = res.order;
          this.ensureTimelineAndNotes();
        } else {
          this.loadError = 'Không tìm thấy thông tin đơn hàng.';
        }
        this.changeDetector.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        if (err instanceof HttpErrorResponse && (err.status === 401 || err.status === 403)) {
          this.logout();
          return;
        }
        this.loadError = 'Không thể tải chi tiết đơn hàng. Vui lòng thử lại sau.';
        this.changeDetector.markForCheck();
      },
    });
  }

  private ensureTimelineAndNotes(): void {
    if (!this.order) return;
    if (!this.order.trackingTimeline) this.order.trackingTimeline = [];
    if (!this.order.notes) {
      this.order.notes = [];
    }
  }

  onStatusChange(newStatus: string): void {
    if (!this.order) return;
    let label = 'Chờ xác nhận';
    if (newStatus === 'processing') label = 'Chờ lấy hàng';
    else if (newStatus === 'shipping') label = 'Đang vận chuyển';
    else if (newStatus === 'delivered') label = 'Đã giao';
    else if (newStatus === 'cancelled') label = 'Đã hủy';

    this.orderService.updateStatus(this.order.id, newStatus, label).subscribe({
      next: () => {
        if (this.order) {
          this.order.status = newStatus as OrderStatus;
          this.order.statusLabel = label;
          this.flashMessage(`Đã cập nhật trạng thái đơn hàng sang "${label}".`);
        }
      },
      error: () => {
        this.actionError = 'Không thể cập nhật trạng thái đơn hàng.';
        this.changeDetector.markForCheck();
      },
    });
  }

  confirmOrder(): void {
    this.onStatusChange('processing');
  }

  requestCancelOrder(): void {
    if (!this.canCancelOrder || this.cancellingOrder) return;
    this.cancelModalVisible = true;
  }

  dismissCancelOrder(): void {
    this.cancelModalVisible = false;
  }

  confirmCancelOrder(): void {
    if (!this.order) return;
    this.cancellingOrder = true;
    this.orderService.cancelOrder(this.order.id).subscribe({
      next: () => {
        this.cancellingOrder = false;
        this.cancelModalVisible = false;
        if (this.order) {
          this.order.status = 'cancelled';
          this.order.statusLabel = 'Đã hủy';
        }
      },
      error: () => {
        this.cancellingOrder = false;
        this.cancelModalVisible = false;
        alert('Không thể hủy đơn hàng lúc này.');
      },
    });
  }

  submitAddNote(): void {
    if (!this.order || !this.newNoteText.trim() || this.addingNote) return;

    const text = this.newNoteText.trim();
    this.addingNote = true;

    this.orderService.addNote(this.order.id, text, 'Admin').subscribe({
      next: (res) => {
        this.addingNote = false;
        this.newNoteText = '';
        if (this.order) {
          this.order.notes = this.order.notes || [];
          this.order.notes.push(res.note);
          this.flashMessage('Đã thêm ghi chú mới vào đơn hàng.');
        }
      },
      error: () => {
        this.addingNote = false;
        alert('Không thể thêm ghi chú. Vui lòng thử lại.');
      },
    });
  }

  openInvoiceModal(): void {
    this.invoiceModalVisible = true;
  }

  closeInvoiceModal(): void {
    this.invoiceModalVisible = false;
  }

  printInvoice(): void {
    window.print();
  }

  formatPrice(num: number): string {
    return (num || 0).toLocaleString('vi-VN') + 'đ';
  }

  private flashMessage(msg: string): void {
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
    if (this.invoiceModalVisible) {
      this.closeInvoiceModal();
      return;
    }
    if (this.cancelModalVisible) {
      this.dismissCancelOrder();
      return;
    }
    if (this.logoutConfirmationVisible) {
      this.cancelLogoutConfirmation();
    }
  }
}
