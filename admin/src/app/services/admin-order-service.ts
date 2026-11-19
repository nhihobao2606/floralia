import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

export type OrderStatus = 'pending' | 'processing' | 'shipping' | 'delivered' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';

export interface AdminOrderItem {
  sku?: string;
  slug?: string;
  productId?: string;
  category?: string;
  name: string;
  variant?: string;
  image?: string;
  productName?: string;
  price: number;
  oldPrice?: number;
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
  slug?: string;
  userId?: string | number | null;
  voucherCode?: string;
  voucherDiscount?: number;
  createdAt?: string;
  date: string;
  time?: string;
  status: OrderStatus | string;
  statusLabel: string;
  step: number;
  notice?: string;
  paymentMethod: string;
  paymentStatus: PaymentStatus | string;
  paymentStatusLabel: string;
  sender?: {
    name: string;
    address: string;
    email: string;
    phone: string;
  };
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
  page?: number;
  limit?: number;
  stats?: AdminOrderStats;
  createdAt?: string;
  date?: string;
  time?: string;
  receiver?: { name?: string; phone?: string; address?: string; email?: string };
  items?: Array<{ name: string; quantity: number; price?: number; image?: string; productName?: string; variant?: string; sku?: string }>;
  refundReason?: string;
  refundNote?: string;
  refundImages?: string[];
  voucherCode?: string;
  voucherDiscount?: number;
}

export interface ProductCatalogVariant {
  label: string;
  sku?: string;
  price: number;
  stock?: number;
  image?: string;
}

export interface ProductCatalogItem {
  name: string;
  sku?: string;
  category?: string;
  imageUrl?: string;
  variants: ProductCatalogVariant[];
}

function fixOrderImage(img?: string): string {
  if (!img) return '/assets/images/products/74.png';
  if (img.startsWith('http://localhost:3002') || img.startsWith('http://127.0.0.1:3002')) {
    return img.replace(/^http:\/\/(?:localhost|127\.0\.0\.1):3002\/?/, 'https://floralia-1.onrender.com/');
  }
  if (img.startsWith('/products/image/')) {
    return `https://floralia-1.onrender.com${img}`;
  }
  return img;
}

function normalizeAdminOrder(order: AdminOrder): AdminOrder {
  if (!order) return order;
  return {
    ...order,
    items: (order.items || []).map((it) => ({
      ...it,
      image: fixOrderImage(it.image),
    })),
  };
}

@Injectable({ providedIn: 'root' })
export class AdminOrderService {
  private readonly apiUrl = 'https://floralia-1.onrender.com/api/admin/orders';
  private readonly productsApiUrl = 'https://floralia-1.onrender.com/products';
  readonly pendingCount$ = new BehaviorSubject<number>(0);

  constructor(private readonly http: HttpClient) {}

  getProductsCatalog(): Observable<ProductCatalogItem[]> {
    return this.http.get<any[]>(this.productsApiUrl).pipe(
      map(prods => {
        if (!Array.isArray(prods) || prods.length === 0) {
          return [];
        }
        return prods.map(p => {
          const thumb = p.thumbnail || (p.sku ? `${p.sku}_THUMB` : '');
          const imgUrl = thumb ? `https://floralia-1.onrender.com/products/image/${thumb}` : '/assets/images/products/74.png';

          const variants: ProductCatalogVariant[] = Array.isArray(p.variants) && p.variants.length > 0
            ? p.variants.map((v: any) => ({
                label: v.label || 'Tiêu chuẩn',
                sku: v.sku || p.sku || '',
                price: Number(v.price || p.price || 0),
                stock: v.stock == null && p.stock == null ? undefined : Number(v.stock ?? p.stock),
                image: imgUrl
              }))
            : [{ label: 'Tiêu chuẩn', sku: p.sku || '', price: Number(p.price || 0), stock: p.stock == null ? undefined : Number(p.stock), image: imgUrl }];

          return {
            name: p.name || p.title || 'Sản phẩm Floralia',
            sku: p.sku || '',
            category: p.category || 'Trà thảo mộc',
            imageUrl: imgUrl,
            variants
          };
        });
      })
    );
  }

  getAll(options: { page?: number; limit?: number; status?: string; paymentStatus?: string; query?: string }): Observable<AdminOrderListResponse> {
    let params = new HttpParams()
      .set('page', String(options.page || 1))
      .set('limit', String(options.limit || 5))
      .set('status', options.status || 'all')
      .set('paymentStatus', options.paymentStatus || 'all');
    if (options.query && options.query.trim()) params = params.set('q', options.query.trim());
    return this.http.get<AdminOrderListResponse>(this.apiUrl, { headers: this.authHeaders(), params }).pipe(
      map(res => ({
        ...res,
        orders: (res.orders || []).map(normalizeAdminOrder)
      })),
      tap(response => {
        if (response?.stats) this.pendingCount$.next(response.stats.pending);
      })
    );
  }

  getById(id: string): Observable<{ success: boolean; order: AdminOrder }> {
    return this.http.get<{ success: boolean; order: AdminOrder }>(this.apiUrl + '/' + encodeURIComponent(id), { headers: this.authHeaders() }).pipe(
      map(res => ({
        ...res,
        order: normalizeAdminOrder(res.order)
      }))
    );
  }

  getForUser(userId: string | number): Observable<{ success: boolean; orders: AdminOrder[] }> {
    const params = new HttpParams().set('userId', String(userId));

    return this.http.get<AdminOrderListResponse>(this.apiUrl, {
      headers: this.authHeaders(),
      params,
    }).pipe(
      map(response => ({ success: response.success, orders: response.orders })),
    );
  }

  updateStatus(id: string, status: string, statusLabel?: string): Observable<{ success: boolean; order: AdminOrder }> {
    return this.http.patch<{ success: boolean; order: AdminOrder }>(this.apiUrl + '/' + encodeURIComponent(id) + '/status', { status, statusLabel }, { headers: this.authHeaders() });
  }

  cancelOrder(id: string): Observable<{ success: boolean; order: AdminOrder }> {
    return this.http.patch<{ success: boolean; order: AdminOrder }>(this.apiUrl + '/' + encodeURIComponent(id) + '/status', { status: 'cancelled', statusLabel: 'Đã hủy' }, { headers: this.authHeaders() });
  }

  updateOrder(id: string, data: Partial<AdminOrder>): Observable<{ success: boolean; order: AdminOrder }> {
    return this.http.patch<{ success: boolean; order: AdminOrder }>(
      `${this.apiUrl}/${encodeURIComponent(id)}`,
      data,
      { headers: this.authHeaders() }
    );
  }

  addNote(id: string, text: string, author = 'Admin'): Observable<{ success: boolean; note: AdminOrderNote; order?: AdminOrder }> {
    return this.http.post<{ success: boolean; note: AdminOrderNote; order?: AdminOrder }>(this.apiUrl + '/' + encodeURIComponent(id) + '/notes', { text, author }, { headers: this.authHeaders() });
  }

  createOrder(order: Partial<AdminOrder>): Observable<{ success: boolean; order: AdminOrder }> {
    return this.http.post<{ success: boolean; order: AdminOrder }>(this.apiUrl, order, { headers: this.authHeaders() });
  }

  deleteOrder(id: string): Observable<{ success: boolean; message?: string }> {
    return this.http.delete<{ success: boolean; message?: string }>(this.apiUrl + '/' + encodeURIComponent(id), { headers: this.authHeaders() });
  }

  bulkDelete(ids: string[]): Observable<{ success: boolean; message?: string }> {
    return this.http.post<{ success: boolean; message?: string }>(this.apiUrl + '/bulk-delete', { ids }, { headers: this.authHeaders() });
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

