import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export type OrderStatus = 'pending' | 'processing' | 'shipping' | 'delivered' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';

export interface AdminOrderItem {
  sku?: string;
  name: string;
  variant?: string;
  image?: string;
  price: number;
  quantity: number;
  total: number;
}

export interface AdminOrderReceiver {
  name: string;
  phone: string;
  address: string;
  email?: string;
  customerId?: string;
}

export interface AdminOrderTimelineItem {
  title: string;
  time: string;
  completed: boolean;
}

export interface AdminOrderNote {
  text: string;
  author: string;
  date: string;
}

export interface AdminOrder {
  _id?: string;
  id: string;
  code: string;
  date: string;
  time?: string;
  status: OrderStatus | string;
  statusLabel: string;
  step: number;
  paymentMethod: string;
  paymentStatus: PaymentStatus | string;
  paymentStatusLabel: string;
  receiver: AdminOrderReceiver;
  items: AdminOrderItem[];
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  refundAmount?: number;
  shippingUnit?: string;
  trackingCode?: string;
  trackingTimeline?: AdminOrderTimelineItem[];
  notes?: AdminOrderNote[];
}

export interface AdminOrderStats {
  total: number;
  pending: number;
  processing: number;
  shipping: number;
  delivered: number;
  cancelled: number;
}

export interface AdminOrderListResponse {
  success: boolean;
  orders: AdminOrder[];
  total: number;
  page: number;
  limit: number;
  stats: AdminOrderStats;
}

const DEFAULT_ORDERS: AdminOrder[] = [
  {
    id: 'FL0011',
    code: '#FL0011',
    date: '10/10/2026',
    time: '11:53',
    status: 'pending',
    statusLabel: 'Chờ xác nhận',
    step: 1,
    paymentMethod: 'COD',
    paymentStatus: 'unpaid',
    paymentStatusLabel: 'Chưa thanh toán',
    receiver: {
      name: 'Minh Hoàng',
      phone: '0909 050 909',
      address: '341 Cao Đạt, Q.5, TP.HCM',
      email: 'minhhoang@gmail.com',
      customerId: '#KH101',
    },
    items: [
      {
        sku: 'THC001',
        name: 'Trà hoa cúc',
        variant: 'Hộp 50g',
        price: 50000,
        quantity: 2,
        total: 100000,
        image: '/assets/images/products/74.png',
      },
      {
        sku: 'TAT002',
        name: 'Trà Atisô đỏ',
        variant: 'Hộp 50g',
        price: 85000,
        quantity: 1,
        total: 85000,
        image: '/assets/images/products/34.png',
      },
    ],
    subtotal: 185000,
    discount: 0,
    shippingFee: 0,
    total: 185000,
    shippingUnit: 'Giao Hàng Nhanh',
    trackingCode: 'GHN8845',
    trackingTimeline: [
      { title: 'Chờ xác nhận đơn hàng', time: '10/10 - 11:53', completed: true },
    ],
    notes: [
      { text: 'Gọi điện trước khi giao', author: 'Khách hàng', date: '10/10' },
    ],
  },
  {
    id: 'FL0010',
    code: '#FL0010',
    date: '09/10/2026',
    time: '16:20',
    status: 'processing',
    statusLabel: 'Đang chuẩn bị',
    step: 2,
    paymentMethod: 'Chuyển khoản',
    paymentStatus: 'paid',
    paymentStatusLabel: 'Đã thanh toán',
    receiver: {
      name: 'Lan Phương',
      phone: '0912 345 678',
      address: '12 Nguyễn Trãi, Q.1, TP.HCM',
      email: 'lanphuong@gmail.com',
      customerId: '#KH100',
    },
    items: [
      {
        sku: 'THC001',
        name: 'Trà hoa cúc',
        variant: 'Hộp 100g',
        price: 80000,
        quantity: 3,
        total: 240000,
        image: '/assets/images/products/74.png',
      },
    ],
    subtotal: 240000,
    discount: 0,
    shippingFee: 0,
    total: 240000,
    shippingUnit: 'Giao Hàng Nhanh',
    trackingCode: 'GHN8843',
    trackingTimeline: [
      { title: 'Đang chuẩn bị hàng', time: '09/10 - 16:30', completed: true },
      { title: 'Đã xác nhận đơn', time: '09/10 - 16:20', completed: true },
    ],
    notes: [],
  },
  {
    id: 'FL0009',
    code: '#FL0009',
    date: '09/10/2026',
    time: '09:05',
    status: 'shipping',
    statusLabel: 'Đang giao hàng',
    step: 3,
    paymentMethod: 'VNPay',
    paymentStatus: 'paid',
    paymentStatusLabel: 'Đã thanh toán',
    receiver: {
      name: 'Thu Hà',
      phone: '0987 654 321',
      address: '88 Lê Lợi, TP. Thủ Đức, TP.HCM',
      email: 'thuha@email.com',
      customerId: '#KH102',
    },
    items: [
      {
        sku: 'TTM004',
        name: 'Lục Mễ Trà',
        variant: 'Hộp 50g',
        price: 95000,
        quantity: 1,
        total: 95000,
        image: '/assets/images/products/74.png',
      },
      {
        sku: 'TTM001',
        name: 'Lam hoa trà',
        variant: 'Hộp 100g',
        price: 75000,
        quantity: 1,
        total: 75000,
        image: '/assets/images/products/82.png',
      },
      {
        sku: 'TTM009',
        name: 'Liên hoa trà',
        variant: 'Túi lọc 20 gói',
        price: 90000,
        quantity: 2,
        total: 180000,
        image: '/assets/images/products/85.png',
      },
    ],
    subtotal: 350000,
    discount: 0,
    shippingFee: 0,
    total: 350000,
    shippingUnit: 'Giao Hàng Nhanh',
    trackingCode: 'GHN8842',
    trackingTimeline: [
      { title: 'Đang giao đến khách', time: '10/10 - 08:40', completed: true },
      { title: 'Đã đến kho Thủ Đức', time: '09/10 - 21:10', completed: true },
      { title: 'Đã bàn giao vận chuyển', time: '09/10 - 14:00', completed: true },
      { title: 'Đang chuẩn bị hàng', time: '09/10 - 10:30', completed: true },
      { title: 'Đã xác nhận đơn', time: '09/10 - 09:20', completed: true },
    ],
    notes: [
      { text: 'Yêu cầu gói quà, giao giờ hành chính.', author: 'Khách hàng', date: '09/10' },
    ],
  },
  {
    id: 'FL0008',
    code: '#FL0008',
    date: '07/10/2026',
    time: '14:41',
    status: 'delivered',
    statusLabel: 'Đã giao',
    step: 4,
    paymentMethod: 'COD',
    paymentStatus: 'paid',
    paymentStatusLabel: 'Đã thanh toán',
    receiver: {
      name: 'Quốc Bảo',
      phone: '0933 221 100',
      address: '5 Hai Bà Trưng, Q.3, TP.HCM',
      email: 'quocbao@gmail.com',
      customerId: '#KH103',
    },
    items: [
      {
        sku: 'TTM004',
        name: 'Lục Mễ Trà',
        variant: 'Hộp 50g',
        price: 75000,
        quantity: 2,
        total: 150000,
        image: '/assets/images/products/74.png',
      },
    ],
    subtotal: 150000,
    discount: 0,
    shippingFee: 0,
    total: 150000,
    shippingUnit: 'Giao Hàng Nhanh',
    trackingCode: 'GHN8840',
    trackingTimeline: [
      { title: 'Giao hàng thành công', time: '08/10 - 15:30', completed: true },
      { title: 'Đang giao đến khách', time: '08/10 - 09:00', completed: true },
      { title: 'Đã bàn giao vận chuyển', time: '07/10 - 17:00', completed: true },
      { title: 'Đã xác nhận đơn', time: '07/10 - 14:45', completed: true },
    ],
    notes: [],
  },
  {
    id: 'FL0007',
    code: '#FL0007',
    date: '06/10/2026',
    time: '20:12',
    status: 'cancelled',
    statusLabel: 'Đã hủy',
    step: 0,
    paymentMethod: 'Chuyển khoản',
    paymentStatus: 'refunded',
    paymentStatusLabel: 'Hoàn tiền',
    receiver: {
      name: 'Ngọc Anh',
      phone: '0966 778 899',
      address: '27 Võ Văn Tần, Q.3, TP.HCM',
      email: 'ngocanh@gmail.com',
      customerId: '#KH104',
    },
    items: [
      {
        sku: 'TTM021',
        name: 'Huyết Ngọc Trà',
        variant: 'Hộp 50g',
        price: 95000,
        quantity: 1,
        total: 95000,
        image: '/assets/images/products/79.png',
      },
    ],
    subtotal: 95000,
    discount: 0,
    shippingFee: 0,
    total: 95000,
    refundAmount: 95000,
    shippingUnit: 'Giao Hàng Nhanh',
    trackingCode: 'GHN8839',
    trackingTimeline: [
      { title: 'Đơn hàng đã bị hủy', time: '06/10 - 21:00', completed: true },
    ],
    notes: [
      { text: 'Khách đổi ý, yêu cầu hoàn tiền chuyển khoản.', author: 'Admin', date: '06/10' },
    ],
  },
];

@Injectable({ providedIn: 'root' })
export class AdminOrderService {
  private readonly apiUrl = 'http://localhost:3002/api/admin/orders';
  private localOrders: AdminOrder[] = [...DEFAULT_ORDERS];

  constructor(private readonly http: HttpClient) {}

  getAll(options: {
    page?: number;
    limit?: number;
    status?: string;
    paymentStatus?: string;
    query?: string;
  }): Observable<AdminOrderListResponse> {
    let params = new HttpParams()
      .set('page', String(options.page || 1))
      .set('limit', String(options.limit || 5))
      .set('status', options.status || 'all')
      .set('paymentStatus', options.paymentStatus || 'all');

    if (options.query && options.query.trim()) {
      params = params.set('q', options.query.trim());
    }

    return this.http.get<AdminOrderListResponse>(this.apiUrl, {
      headers: this.authHeaders(),
      params,
    }).pipe(
      catchError(() => {
        // Fallback filtering on memory
        let list = [...this.localOrders];
        const status = options.status || 'all';
        const payment = options.paymentStatus || 'all';
        const q = (options.query || '').trim().toLowerCase();

        if (status !== 'all') {
          list = list.filter(o => o.status === status);
        }
        if (payment !== 'all') {
          list = list.filter(o => o.paymentStatus === payment);
        }
        if (q) {
          list = list.filter(o =>
            o.code.toLowerCase().includes(q) ||
            o.id.toLowerCase().includes(q) ||
            o.receiver.name.toLowerCase().includes(q) ||
            o.receiver.phone.toLowerCase().includes(q) ||
            o.items.some(i => i.name.toLowerCase().includes(q))
          );
        }

        const stats: AdminOrderStats = {
          total: this.localOrders.length,
          pending: this.localOrders.filter(o => o.status === 'pending').length,
          processing: this.localOrders.filter(o => o.status === 'processing').length,
          shipping: this.localOrders.filter(o => o.status === 'shipping').length,
          delivered: this.localOrders.filter(o => o.status === 'delivered').length,
          cancelled: this.localOrders.filter(o => o.status === 'cancelled').length,
        };

        const page = options.page || 1;
        const limit = options.limit || 5;
        const total = list.length;
        const start = (page - 1) * limit;
        const paginated = list.slice(start, start + limit);

        return of({
          success: true,
          orders: paginated,
          total,
          page,
          limit,
          stats,
        });
      })
    );
  }

  getById(id: string): Observable<{ success: boolean; order: AdminOrder }> {
    return this.http.get<{ success: boolean; order: AdminOrder }>(
      `${this.apiUrl}/${encodeURIComponent(id)}`,
      { headers: this.authHeaders() }
    ).pipe(
      catchError(() => {
        const cleanId = id.startsWith('#') ? id.substring(1) : id;
        const found = this.localOrders.find(o =>
          o.id === cleanId || o.code === id || o.code === `#${cleanId}`
        ) || this.localOrders[0];

        return of({ success: true, order: found });
      })
    );
  }

  updateStatus(id: string, status: string, statusLabel?: string): Observable<{ success: boolean; order: AdminOrder }> {
    return this.http.patch<{ success: boolean; order: AdminOrder }>(
      `${this.apiUrl}/${encodeURIComponent(id)}/status`,
      { status, statusLabel },
      { headers: this.authHeaders() }
    ).pipe(
      catchError(() => {
        const cleanId = id.startsWith('#') ? id.substring(1) : id;
        const found = this.localOrders.find(o => o.id === cleanId || o.code === id || o.code === `#${cleanId}`);
        if (found) {
          found.status = status as OrderStatus;
          if (statusLabel) found.statusLabel = statusLabel;
        }
        return of({ success: true, order: found || this.localOrders[0] });
      })
    );
  }

  updateOrder(id: string, data: Partial<AdminOrder>): Observable<{ success: boolean; order: AdminOrder }> {
    return this.http.patch<{ success: boolean; order: AdminOrder }>(
      `${this.apiUrl}/${encodeURIComponent(id)}`,
      data,
      { headers: this.authHeaders() }
    );
  }

  addNote(id: string, text: string, author = 'Admin'): Observable<{ success: boolean; note: AdminOrderNote; order?: AdminOrder }> {
    return this.http.post<{ success: boolean; note: AdminOrderNote; order?: AdminOrder }>(
      `${this.apiUrl}/${encodeURIComponent(id)}/notes`,
      { text, author },
      { headers: this.authHeaders() }
    ).pipe(
      catchError(() => {
        const newNote: AdminOrderNote = {
          text,
          author,
          date: new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
        };
        const cleanId = id.startsWith('#') ? id.substring(1) : id;
        const found = this.localOrders.find(o => o.id === cleanId || o.code === id || o.code === `#${cleanId}`);
        if (found) {
          found.notes = found.notes || [];
          found.notes.push(newNote);
        }
        return of({ success: true, note: newNote, order: found });
      })
    );
  }

  createOrder(order: Partial<AdminOrder>): Observable<{ success: boolean; order: AdminOrder }> {
    return this.http.post<{ success: boolean; order: AdminOrder }>(
      this.apiUrl,
      order,
      { headers: this.authHeaders() }
    ).pipe(
      catchError(() => {
        const num = String(this.localOrders.length + 15).padStart(4, '0');
        const newOrder: AdminOrder = {
          id: `FL${num}`,
          code: `#FL${num}`,
          date: new Date().toLocaleDateString('vi-VN'),
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          status: (order.status as OrderStatus) || 'pending',
          statusLabel: order.statusLabel || 'Chờ xác nhận',
          step: 1,
          paymentMethod: order.paymentMethod || 'COD',
          paymentStatus: (order.paymentStatus as PaymentStatus) || 'unpaid',
          paymentStatusLabel: order.paymentStatusLabel || 'Chưa thanh toán',
          receiver: order.receiver || {
            name: 'Khách hàng',
            phone: '0900 000 000',
            address: 'Hồ Chí Minh',
          },
          items: order.items || [],
          subtotal: order.subtotal || 0,
          discount: order.discount || 0,
          shippingFee: order.shippingFee || 0,
          total: order.total || 0,
          shippingUnit: 'Giao Hàng Nhanh',
          trackingCode: `GHN${Math.floor(1000 + Math.random() * 9000)}`,
          trackingTimeline: [{ title: 'Tạo đơn thành công', time: 'Hôm nay', completed: true }],
          notes: [],
        };
        this.localOrders.unshift(newOrder);
        return of({ success: true, order: newOrder });
      })
    );
  }

  deleteOrder(id: string): Observable<{ success: boolean; message?: string }> {
    return this.http.delete<{ success: boolean; message?: string }>(
      `${this.apiUrl}/${encodeURIComponent(id)}`,
      { headers: this.authHeaders() }
    ).pipe(
      catchError(() => {
        const cleanId = id.startsWith('#') ? id.substring(1) : id;
        this.localOrders = this.localOrders.filter(o => o.id !== cleanId && o.code !== id && o.code !== `#${cleanId}`);
        return of({ success: true, message: 'Đã xóa đơn hàng thành công.' });
      })
    );
  }

  bulkDelete(ids: string[]): Observable<{ success: boolean; message?: string }> {
    return this.http.post<{ success: boolean; message?: string }>(
      `${this.apiUrl}/bulk-delete`,
      { ids },
      { headers: this.authHeaders() }
    ).pipe(
      catchError(() => {
        const cleanSet = new Set(ids.map(i => i.startsWith('#') ? i.substring(1) : i));
        this.localOrders = this.localOrders.filter(o => !cleanSet.has(o.id) && !ids.includes(o.code));
        return of({ success: true, message: `Đã xóa ${ids.length} đơn hàng thành công.` });
      })
    );
  }

  exportToCsv(orders: AdminOrder[]): void {
    const headers = [
      'Mã đơn hàng',
      'Ngày đặt',
      'Giờ đặt',
      'Khách hàng',
      'Số điện thoại',
      'Địa chỉ',
      'Sản phẩm',
      'Số lượng',
      'Tổng tiền (VND)',
      'Phương thức thanh toán',
      'Trạng thái thanh toán',
      'Trạng thái đơn hàng',
    ];

    const rows = orders.map(o => [
      `"${o.code}"`,
      `"${o.date}"`,
      `"${o.time || ''}"`,
      `"${o.receiver.name}"`,
      `"${o.receiver.phone}"`,
      `"${o.receiver.address.replace(/"/g, '""')}"`,
      `"${o.items.map(i => i.name).join('; ')}"`,
      `"${o.items.map(i => i.quantity).join(' · ')}"`,
      o.total,
      `"${o.paymentMethod}"`,
      `"${o.paymentStatusLabel}"`,
      `"${o.statusLabel}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `danh_sach_don_hang_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  formatPrice(num: number): string {
    return (num || 0).toLocaleString('vi-VN') + 'đ';
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
    return new HttpHeaders({ Authorization: `Bearer ${token || ''}` });
  }
}
