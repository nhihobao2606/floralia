import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface SimulatedOrderNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminNotificationService {
  readonly notifications: SimulatedOrderNotification[] = [
    { id: 'pending-1048', title: 'Đơn hàng chờ xác nhận', message: 'Đơn #FL-1048 vừa được tạo và đang chờ xác nhận.', time: 'Vừa xong', read: false },
    { id: 'pending-1047', title: 'Có đơn hàng mới', message: 'Đơn #FL-1047 cần được kiểm tra thông tin giao hàng.', time: '5 phút trước', read: false },
    { id: 'pending-1046', title: 'Nhắc xử lý đơn hàng', message: 'Đơn #FL-1046 vẫn đang ở trạng thái chờ xác nhận.', time: '12 phút trước', read: false },
  ];

  private readonly unreadCountSubject = new BehaviorSubject<number>(this.notifications.length);
  readonly unreadCount$ = this.unreadCountSubject.asObservable();

  get unreadCount(): number { return this.unreadCountSubject.value; }

  markAllRead(): void {
    this.notifications.forEach(notification => notification.read = true);
    this.unreadCountSubject.next(0);
  }
}
