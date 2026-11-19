import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { timeout } from 'rxjs';
import { GuestOrder } from '../../classes/guest-order';
import { formatVietnameseDong } from '../../shared/vnd-format';

@Component({
  selector: 'app-guest-order-detail',
  standalone: false,
  templateUrl: './guest-order-detail.html',
  styleUrl: './guest-order-detail.css'
})
export class GuestOrderDetail implements OnInit {
  order: GuestOrder | null = null;
  error = '';
  actionMessage = '';
  showCancelModal = false;
  selectedCancelReason = '';
  otherCancelReason = '';
  isCancelSubmitting = false;
  actionError = '';
  readonly cancelReasons = [
    'Muốn thay đổi địa chỉ giao hàng',
    'Muốn nhập/thay đổi mã giảm giá',
    'Muốn thay đổi sản phẩm (loại trà, dung lượng, số lượng...)',
    'Thủ tục thanh toán quá rắc rối',
    'Tìm thấy giá rẻ hơn ở chỗ khác',
    'Đổi ý, không muốn mua nữa',
    'Khác'
  ];

  private readonly guestTrackingApi = 'https://floralia-1.onrender.com/api/orders/guest-tracking';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly http: HttpClient
  ) {}

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('id');
    const verifiedAt = Number(sessionStorage.getItem('floralia_verified_guest_order_at'));
    const raw = sessionStorage.getItem('floralia_verified_guest_order');
    if (!raw || !verifiedAt || Date.now() - verifiedAt > 30 * 60 * 1000) {
      this.error = 'Phiên tra cứu đã hết hạn. Vui lòng xác minh OTP lại để xem chi tiết đơn hàng.';
      return;
    }

    try {
      const order = JSON.parse(raw) as GuestOrder;
      if (!order || String(order.id) !== String(orderId) || !Array.isArray(order.items)) {
        this.error = 'Không tìm thấy đơn hàng đã được xác minh.';
        return;
      }
      this.order = order;
    } catch {
      this.error = 'Không đọc được thông tin đơn hàng. Vui lòng tra cứu lại.';
    }
  }

  goBack(): void {
    void this.router.navigate(['/guest-order-tracking']);
  }

  formatPrice(value: number): string {
    return formatVietnameseDong(value);
  }

  formatDate(order: GuestOrder): string {
    if (order.createdAt) {
      const date = new Date(order.createdAt);
      if (!Number.isNaN(date.getTime())) return date.toLocaleString('vi-VN');
    }
    return [order.date, order.time].filter(Boolean).join(' · ');
  }

  get canCancel(): boolean {
    return ['pending', 'processing', 'waiting'].includes(this.order?.status || '');
  }

  openCancelModal(): void {
    if (!this.canCancel || this.isCancelSubmitting) return;
    this.actionError = '';
    this.selectedCancelReason = '';
    this.otherCancelReason = '';
    this.showCancelModal = true;
  }

  toggleCancelReason(reason: string): void {
    this.selectedCancelReason = reason;
    this.actionError = '';
    if (reason !== 'Khác') this.otherCancelReason = '';
  }

  closeCancelModal(): void {
    if (this.isCancelSubmitting) return;
    this.showCancelModal = false;
  }

  confirmCancelOrder(): void {
    if (!this.order || !this.canCancel || this.isCancelSubmitting) return;
    if (!this.selectedCancelReason) {
      alert('Vui lòng chọn lý do hủy đơn.');
      return;
    }
    if (this.selectedCancelReason === 'Khác' && !this.otherCancelReason.trim()) {
      alert('Vui lòng nhập lý do khác.');
      return;
    }

    const guestAccessToken = sessionStorage.getItem('floralia_guest_order_access_token');
    if (!guestAccessToken) {
      alert('Phiên xác minh đã hết hạn. Vui lòng tra cứu và xác minh OTP lại.');
      return;
    }

    const order = this.order;
    const paymentMethod = (order.paymentMethod || '').toLowerCase();
    const isPaid = ['paypal', 'vnpay', 'chuyển khoản', 'momo', 'qr'].some(method => paymentMethod.includes(method));
    const cancelReasons = [{
      reason: this.selectedCancelReason,
      ...(this.selectedCancelReason === 'Khác' ? { detail: this.otherCancelReason.trim() } : {})
    }];
    this.isCancelSubmitting = true;
    this.actionError = '';
    this.http.patch<{ success: boolean; order: GuestOrder }>(
      `${this.guestTrackingApi}/${encodeURIComponent(order.id)}/cancel`,
      { cancelReasons },
      { headers: new HttpHeaders({ 'X-Guest-Order-Token': guestAccessToken }) }
    ).pipe(timeout({ first: 8_000 })).subscribe({
      next: response => {
        this.isCancelSubmitting = false;
        if (!response?.success || !response.order) {
          this.actionError = 'Máy chủ chưa xác nhận đã lưu việc hủy đơn. Vui lòng thử lại.';
          return;
        }
        this.order = response.order;
        this.showCancelModal = false;
        this.actionMessage = isPaid
          ? 'Đã hủy đơn hàng. Sẽ sớm hoàn tiền về cho bạn.'
          : 'Đã hủy đơn hàng.';
        sessionStorage.setItem('floralia_verified_guest_order', JSON.stringify(response.order));
      },
      error: requestError => {
        this.isCancelSubmitting = false;
        const message = requestError?.name === 'TimeoutError'
          ? 'Máy chủ phản hồi quá lâu nên chưa xác nhận được việc hủy đơn. Vui lòng kiểm tra lại trạng thái đơn trước khi gửi lại.'
          : requestError?.error?.message || 'Không thể hủy đơn hàng. Vui lòng thử lại.';
        if (requestError?.status === 403) {
          sessionStorage.removeItem('floralia_guest_order_access_token');
          alert(message);
          return;
        }
        alert(message);
      }
    });
  }
}

