import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component } from '@angular/core';
import { finalize, timeout } from 'rxjs';

interface GuestTrackingOrder {
  id: string;
  code: string;
  status: string;
  statusLabel: string;
  createdAt?: string;
  date?: string;
  time?: string;
  trackingCode: string;
  notice: string;
  trackingTimeline: Array<{ title: string; time: string; completed: boolean }>;
  items: Array<{ name: string; quantity: number; image: string }>;
}

@Component({
  selector: 'app-guest-order-tracking',
  standalone: false,
  templateUrl: './guest-order-tracking.html',
  styleUrl: './guest-order-tracking.css'
})
export class GuestOrderTracking {
  query = '';
  otp = '';
  challengeId = '';
  phoneHint = '';
  loading = false;
  error = '';
  info = '';
  orders: GuestTrackingOrder[] = [];

  private readonly apiUrl = 'http://localhost:3002/api/orders/guest-tracking';

  constructor(
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef
  ) {}

  requestOtp(): void {
    const query = this.query.trim();
    if (!query) {
      this.error = 'Nhập số điện thoại hoặc mã đơn hàng.';
      return;
    }
    this.loading = true;
    this.error = '';
    this.info = 'Đang tra cứu đơn và gửi mã OTP…';
    this.orders = [];
    this.challengeId = '';
    this.http.post<any>(`${this.apiUrl}/request-otp`, { query }).pipe(
      timeout({ first: 8_000 }),
      finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: response => {
        if (response.flowVersion !== 'guest-tracking-otp-v2') {
          this.info = '';
          this.error = 'Backend trên cổng 3002 vẫn đang chạy code cũ. Hãy dừng rồi khởi động lại backend để gửi OTP.';
          return;
        }
        if (response.challengeId) {
          this.challengeId = response.challengeId;
          this.phoneHint = response.phoneHint || '';
          this.info = `Mã xác thực đã được gửi đến ${this.phoneHint}. Mã có hiệu lực trong 5 phút.`;
        } else {
          this.info = response.reason === 'cooldown'
            ? 'Bạn vừa yêu cầu mã gần đây. Đợi một phút rồi gửi lại; OTP chỉ được tạo khi đơn còn đang xử lý hoặc vận chuyển.'
            : 'Chưa gửi OTP: không tìm thấy đơn guest đang xử lý khớp với thông tin này. Kiểm tra lại số điện thoại hoặc mã đơn; đơn đã giao hoặc hủy không tra cứu được.';
        }
        this.cdr.markForCheck();
      },
      error: response => {
        this.info = '';
        this.error = response?.name === 'TimeoutError'
          ? 'Máy chủ phản hồi quá lâu. Hãy kiểm tra backend đang chạy rồi thử lại.'
          : response?.error?.message || 'Không thể gửi mã xác thực. Vui lòng thử lại.';
        this.cdr.markForCheck();
      }
    });
  }

  verifyOtp(): void {
    if (!this.challengeId) return;
    if (!/^\d{6}$/.test(this.otp.trim())) {
      this.error = 'Nhập mã OTP gồm 6 chữ số.';
      return;
    }
    this.loading = true;
    this.error = '';
    this.info = 'Đang xác minh OTP và tải trạng thái đơn…';
    this.http.post<any>(`${this.apiUrl}/verify-otp`, {
      challengeId: this.challengeId,
      otp: this.otp.trim()
    }).pipe(
      timeout({ first: 8_000 }),
      finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: response => {
        if (response.flowVersion !== 'guest-tracking-otp-v2') {
          this.info = '';
          this.error = 'Backend chưa được khởi động lại bằng code OTP mới. Hãy restart backend ở cổng 3002.';
          return;
        }
        this.orders = response.orders || [];
        this.challengeId = '';
        this.otp = '';
        this.info = this.orders.length
          ? ''
          : 'Không có đơn hàng nào đang chờ xử lý hoặc vận chuyển với thông tin này. Đơn đã giao thành công không còn tra cứu được tại đây.';
        this.cdr.markForCheck();
      },
      error: response => {
        this.info = '';
        this.error = response?.name === 'TimeoutError'
          ? 'Máy chủ phản hồi quá lâu. Hãy kiểm tra backend đang chạy rồi thử lại.'
          : response?.error?.message || 'Không thể xác thực mã OTP. Vui lòng thử lại.';
        this.cdr.markForCheck();
      }
    });
  }

  formatDate(order: GuestTrackingOrder): string {
    if (order.createdAt) {
      const date = new Date(order.createdAt);
      if (!Number.isNaN(date.getTime())) return date.toLocaleString('vi-VN');
    }
    return [order.date, order.time].filter(Boolean).join(' · ');
  }
}
