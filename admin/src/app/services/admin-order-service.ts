import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import realOrdersJson from './real-orders.json';
import productCatalogJson from './product-catalog.json';

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
  page: number;
  limit: number;
  stats: AdminOrderStats;
}

export interface ProductCatalogVariant {
  label: string;
  sku?: string;
  price: number;
  image?: string;
}

export interface ProductCatalogItem {
  name: string;
  sku?: string;
  category?: string;
  imageUrl?: string;
  variants: ProductCatalogVariant[];
}

function normalizeRawOrder(o: any): AdminOrder {
  const receiver = o.receiver || o.customer || o.sender || {};
  let status = String(o.status || 'pending').toLowerCase();
  if (status === 'waiting') status = 'processing';
  if (status === 'completed') status = 'delivered';

  let statusLabel = o.statusLabel;
  if (!statusLabel || statusLabel === 'Đang giao hàng' || statusLabel === 'Đang chuẩn bị') {
    switch (status) {
      case 'pending': statusLabel = 'Chờ xác nhận'; break;
      case 'processing': statusLabel = 'Chờ lấy hàng'; break;
      case 'shipping': statusLabel = 'Đang vận chuyển'; break;
      case 'delivered': statusLabel = 'Đã giao'; break;
      case 'cancelled': statusLabel = 'Đã hủy'; break;
      case 'refunded': statusLabel = 'Hoàn tiền'; break;
      default: statusLabel = 'Chờ xác nhận';
    }
  }

  let paymentStatus = o.paymentStatus || 'unpaid';
  let paymentStatusLabel = o.paymentStatusLabel;
  if (!paymentStatusLabel) {
    if (paymentStatus === 'paid') paymentStatusLabel = 'Đã thanh toán';
    else if (paymentStatus === 'refunded') paymentStatusLabel = 'Hoàn tiền';
    else paymentStatusLabel = 'Chưa thanh toán';
  }

  const rawId = String(o.id || o._id || '');
  const rawCode = String(o.code || rawId);
  const code = rawCode.startsWith('#') ? rawCode : `#${rawCode}`;

  return {
    _id: o._id ? String(o._id) : undefined,
    id: rawId || code.replace(/^#/, ''),
    code,
    slug: o.slug || `don-hang-${code.replace(/^#/, '').toLowerCase()}`,
    userId: o.userId || null,
    voucherCode: o.voucherCode || '',
    createdAt: o.createdAt || new Date().toISOString(),
    date: o.date || new Date().toLocaleDateString('vi-VN'),
    time: o.time || '10:00',
    status,
    statusLabel,
    step: typeof o.step === 'number' ? o.step : 1,
    notice: o.notice || '',
    paymentMethod: o.paymentMethod || 'COD',
    paymentStatus,
    paymentStatusLabel,
    sender: o.sender || {
      name: 'Floralia Herbal Tea',
      address: '11A Bế Văn Đàn, Dĩ An, Bình Dương',
      email: 'floralia@gmail.com',
      phone: '0901 234 567'
    },
    receiver: {
      name: receiver.name || 'Khách hàng',
      phone: receiver.phone || '',
      address: receiver.address || '',
      email: receiver.email || '',
      customerId: receiver.customerId || (o.userId ? `#KH${String(o.userId).slice(-4).toUpperCase()}` : '')
    },
    items: Array.isArray(o.items) ? o.items.map((it: any) => {
      let img = it.image || '';
      if (img && img.startsWith('/products/image/')) {
        img = `http://localhost:3002${img}`;
      } else if (!img) {
        img = '/assets/images/products/74.png';
      }
      return {
        sku: it.sku || '',
        slug: it.slug || '',
        productId: it.productId || '',
        category: it.category || '',
        name: it.name || it.productName || 'Sản phẩm Floralia',
        variant: it.variant || 'Tiêu chuẩn',
        image: img,
        price: Number(it.price || 0),
        oldPrice: Number(it.oldPrice || it.price || 0),
        quantity: Number(it.quantity || 1),
        total: Number(it.total || (Number(it.price || 0) * Number(it.quantity || 1)))
      };
    }) : [],
    subtotal: Number(o.subtotal || 0),
    discount: Number(o.discount || 0),
    shippingFee: Number(o.shippingFee || 0),
    total: Number(o.total || 0),
    refundAmount: o.refundAmount ? Number(o.refundAmount) : undefined,
    shippingUnit: o.shippingUnit || 'Giao Hàng Nhanh',
    trackingCode: o.trackingCode || '',
    trackingTimeline: Array.isArray(o.trackingTimeline) ? o.trackingTimeline : [],
    notes: Array.isArray(o.notes) ? o.notes : []
  };
}

const DEFAULT_ORDERS: AdminOrder[] = (realOrdersJson as any[]).map(normalizeRawOrder);

@Injectable({ providedIn: 'root' })
export class AdminOrderService {
  private readonly apiUrl = 'http://localhost:3002/api/admin/orders';
  private readonly productsApiUrl = 'http://localhost:3002/products';
  private localOrders: AdminOrder[] = [...DEFAULT_ORDERS];

  readonly pendingCount$ = new BehaviorSubject<number>(
    DEFAULT_ORDERS.filter(o => o.status === 'pending').length
  );

  constructor(private readonly http: HttpClient) {}

  getProductsCatalog(): Observable<ProductCatalogItem[]> {
    return this.http.get<any[]>(this.productsApiUrl).pipe(
      map(prods => {
        if (!Array.isArray(prods) || prods.length === 0) {
          return productCatalogJson as ProductCatalogItem[];
        }
        return prods.map(p => {
          const thumb = p.thumbnail || (p.sku ? `${p.sku}_THUMB` : '');
          const imgUrl = thumb ? `http://localhost:3002/products/image/${thumb}` : '/assets/images/products/74.png';

          const variants: ProductCatalogVariant[] = Array.isArray(p.variants) && p.variants.length > 0
            ? p.variants.map((v: any) => ({
                label: v.label || 'Tiêu chuẩn',
                sku: v.sku || p.sku || '',
                price: Number(v.price || p.price || 0),
                image: imgUrl
              }))
            : [{ label: 'Tiêu chuẩn', sku: p.sku || '', price: Number(p.price || 0), image: imgUrl }];

          return {
            name: p.name || p.title || 'Sản phẩm Floralia',
            sku: p.sku || '',
            category: p.category || 'Trà thảo mộc',
            imageUrl: imgUrl,
            variants
          };
        });
      }),
      catchError(() => of(productCatalogJson as ProductCatalogItem[]))
    );
  }

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
      tap(res => {
        if (res && res.stats) {
          this.pendingCount$.next(res.stats.pending);
        }
      }),
      catchError(() => {
        // Fallback lọc trên bộ nhớ các đơn hàng thực tế
        let list = [...this.localOrders];
        const status = options.status || 'all';
        const payment = options.paymentStatus || 'all';
        const q = (options.query || '').trim().toLowerCase();

        if (status !== 'all') {
          list = list.filter(o => {
            if (status === 'processing') return o.status === 'processing';
            if (status === 'delivered') return o.status === 'delivered';
            if (status === 'cancelled') return o.status === 'cancelled' || o.status === 'refunded';
            return o.status === status;
          });
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
          cancelled: this.localOrders.filter(o => o.status === 'cancelled' || o.status === 'refunded').length,
        };

        this.pendingCount$.next(stats.pending);

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
          o.id === cleanId || o.code === id || o.code === `#${cleanId}` || o.id === id || o.slug === id
        ) || this.localOrders[0];

        return of({ success: true, order: found });
      })
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
    return this.http.patch<{ success: boolean; order: AdminOrder }>(
      `${this.apiUrl}/${encodeURIComponent(id)}/status`,
      { status, statusLabel },
      { headers: this.authHeaders() }
    ).pipe(
      tap(() => {
        const cleanId = id.startsWith('#') ? id.substring(1) : id;
        const found = this.localOrders.find(o => o.id === cleanId || o.code === id || o.code === `#${cleanId}`);
        if (found) {
          found.status = status as OrderStatus;
          if (statusLabel) found.statusLabel = statusLabel;
          const pending = this.localOrders.filter(o => o.status === 'pending').length;
          this.pendingCount$.next(pending);
        }
      }),
      catchError(() => {
        const cleanId = id.startsWith('#') ? id.substring(1) : id;
        const found = this.localOrders.find(o => o.id === cleanId || o.code === id || o.code === `#${cleanId}`);
        if (found) {
          found.status = status as OrderStatus;
          if (statusLabel) found.statusLabel = statusLabel;
          const pending = this.localOrders.filter(o => o.status === 'pending').length;
          this.pendingCount$.next(pending);
        }
        return of({ success: true, order: found || this.localOrders[0] });
      })
    );
  }

  cancelOrder(id: string): Observable<{ success: boolean; order: AdminOrder }> {
    return this.http.patch<{ success: boolean; order: AdminOrder }>(
      `${this.apiUrl}/${encodeURIComponent(id)}/status`,
      { status: 'cancelled', statusLabel: 'Đã hủy' },
      { headers: this.authHeaders() }
    ).pipe(
      tap(() => {
        const cleanId = id.startsWith('#') ? id.substring(1) : id;
        const found = this.localOrders.find(o => o.id === cleanId || o.code === id || o.code === `#${cleanId}`);
        if (found) found.status = 'cancelled';
        this.pendingCount$.next(this.localOrders.filter(o => o.status === 'pending').length);
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
      tap(res => {
        if (res && res.order) {
          this.localOrders.unshift(res.order);
          const pending = this.localOrders.filter(o => o.status === 'pending').length;
          this.pendingCount$.next(pending);
        }
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
        const pending = this.localOrders.filter(o => o.status === 'pending').length;
        this.pendingCount$.next(pending);
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
        const pending = this.localOrders.filter(o => o.status === 'pending').length;
        this.pendingCount$.next(pending);
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
