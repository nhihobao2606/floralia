import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { formatVietnameseDong } from '../shared/vnd-format';

export interface OrderItem {
  sku: string;
  slug?: string;
  name: string;
  image: string;
  variant?: string;
  price: number;
  oldPrice?: number;
  salePrice?: number;
  productDiscount?: number;
  quantity: number;
  total: number;
}

export interface CancelReason {
  reason: string;
  detail?: string;
}

export interface OrderAddress {
  name: string;
  address: string;
  email: string;
  phone: string;
}

export interface Order {
  id: string;
  code: string;
  slug?: string;
  date: string;
  time?: string;
  createdAt?: string;
  status: 'pending' | 'shipping' | 'waiting' | 'completed' | 'delivered' | 'cancelled' | 'refunded' | 'processing' | 'refund_pending' | 'refund_approved';
  statusLabel: string;
  step: number; // 1: Đã ghi nhận, 2: Chờ xác nhận, 3: Chờ lấy hàng, 4: Đang giao, 5: Đã giao
  paymentStatus?: string;
  paymentStatusLabel?: string;
  trackingTimeline?: Array<{
    title: string;
    time: string;
    completed: boolean;
  }>;
  shippingUnit?: string;
  trackingCode?: string;
  notes?: string[];
  notice?: string;
  customerNote?: string;
  cancelReason?: string;
  cancelReasons?: CancelReason[];
  voucherCode?: string;
  cancelledItems?: Array<OrderItem & {
    cancelReason: string;
    cancelReasons?: CancelReason[];
    cancelledAt?: string;
  }>;
  refundReason?: string;
  refundNote?: string;
  refundImages?: string[];
  userId?: string;
  isDemo?: boolean;
  guestOrder?: boolean;
  paymentMethod: string;
  sender?: OrderAddress;
  receiver?: OrderAddress;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  productDiscount?: number;
  voucherDiscount?: number;
  shippingFee: number;
  total: number;
  refundAmount?: number;
}

function normalizeOrderShipping(order: Order): Order {
  return {
    ...order,
    shippingUnit: order.shippingUnit || '',
    trackingCode: order.trackingCode || ''
  };
}


export function getOrderSlug(order: Pick<Order, 'id' | 'code' | 'slug'>): string {
  if (order.slug) return order.slug;
  const identifier = (order.code || order.id).replace(/^#/, '');
  const slug = identifier
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `don-hang-${slug || order.id.toLowerCase()}`;
}

export function parseOrderTimestamp(order: Partial<Order> & { createdAt?: string | Date }): number {
  if (order.createdAt) {
    const t = new Date(order.createdAt).getTime();
    if (!isNaN(t)) return t;
  }
  if (order.date) {
    const parts = String(order.date).split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      let hours = 0;
      let minutes = 0;
      let seconds = 0;
      if (order.time) {
        const timeParts = String(order.time).split(':');
        hours = parseInt(timeParts[0], 10) || 0;
        minutes = parseInt(timeParts[1], 10) || 0;
        seconds = parseInt(timeParts[2], 10) || 0;
      }
      const t = new Date(year, month, day, hours, minutes, seconds).getTime();
      if (!isNaN(t)) return t;
    }
    const directTime = new Date(order.date).getTime();
    if (!isNaN(directTime)) return directTime;
  }
  return 0;
}

export function sortOrdersNewestFirst(orders: Order[]): Order[] {
  if (!Array.isArray(orders)) return [];
  return [...orders].sort((a, b) => {
    const diff = parseOrderTimestamp(b) - parseOrderTimestamp(a);
    if (diff !== 0) return diff;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private readonly apiUrl = 'http://localhost:3002/api/orders';
  private ordersCache: Order[] = [];
  private ordersCacheOwner: string | null = null;

  constructor(private http: HttpClient) {
    localStorage.removeItem('floralia_orders');
  }

  getOrders(status?: string, query?: string): Observable<Order[]> {
    const owner = this.currentUserKey();
    return this.http.get<{ success: boolean; orders: Order[] }>(this.apiUrl, {
      params: {
        ...(status && status !== 'all' ? { status } : {}),
        ...(query ? { q: query } : {})
      },
      headers: this.authHeaders()
    }).pipe(
      map(res => {
        // Demo orders are shared. Every real order must have this account's userId;
        // receiver email is never used to infer ownership.
        const orders = (res.orders || []).filter(order =>
          order.isDemo || (!order.guestOrder && order.userId != null && String(order.userId) === owner)
        ).map(normalizeOrderShipping);
        this.ordersCache = orders;
        this.ordersCacheOwner = owner;
        return this.ordersCache;
      })
    );
  }

  getOrderByIdSync(id: string): Order | null {
    if (!id) return null;
    const cleanId = id.startsWith('#') ? id.substring(1) : id;
    const cachedOrder = this.ordersCacheOwner === this.currentUserKey()
      ? this.ordersCache.find(order =>
        order.id === cleanId || order.id === id || order.code === id || order.code === `#${cleanId}` || order.slug === id
      )
      : null;
    if (cachedOrder) return cachedOrder;

    for (const lookupId of new Set([id, cleanId])) {
      try {
        const raw = sessionStorage.getItem(this.orderDetailCacheKey(lookupId));
        if (!raw) continue;
        const order = JSON.parse(raw) as Order;
        if (order && typeof order.id === 'string' && Array.isArray(order.items)) return order;
        sessionStorage.removeItem(this.orderDetailCacheKey(lookupId));
      } catch (error) {
        console.warn('Không thể đọc bộ nhớ tạm chi tiết đơn hàng:', error);
      }
    }

    return null;
  }

  saveOrderLocal(order: Order): Order {
    order = normalizeOrderShipping(order);
    const owner = this.currentUserKey();
    if (this.ordersCacheOwner !== owner) {
      this.ordersCache = [];
      this.ordersCacheOwner = owner;
    }
    const index = this.ordersCache.findIndex(existing => existing.id === order.id);
    if (index >= 0) {
      this.ordersCache[index] = order;
    } else {
      this.ordersCache.unshift(order);
    }
    this.ordersCache = sortOrdersNewestFirst(this.ordersCache);
    this.cacheOrderDetail(order);
    return order;
  }

  getOrderById(id: string): Observable<Order | null> {
    const cleanId = id.startsWith('#') ? id.substring(1) : id;
    return this.http.get<{ success: boolean; order: Order }>(`${this.apiUrl}/${encodeURIComponent(cleanId)}`, {
      headers: this.authHeaders()
    }).pipe(
      map(res => res.order ? this.saveOrderLocal(res.order) : null)
    );
  }

  getDefaultOrders(): Order[] {
    return this.ordersCacheOwner === this.currentUserKey() ? [...this.ordersCache] : [];
  }

  createOrder(orderData: Partial<Order>): Observable<{ success: boolean; order: Order; persisted: boolean }> {
    return this.http.post<{ success: boolean; order: Order; persisted?: boolean }>(this.apiUrl, orderData, {
      headers: this.authHeaders()
    }).pipe(
      timeout({ first: 20_000 }),
      map(res => {
        if (res.order?.id) this.saveOrderLocal(res.order);
        return { ...res, persisted: res.persisted ?? Boolean(res.order?.id) };
      })
    );
  }

  updateOrderStatus(
    id: string,
    status: Order['status'],
    statusLabel: string,
    details: Partial<Order> = {}
  ): Observable<{ success: boolean; order: Order }> {
    return this.http.patch<{ success: boolean; order: Order }>(
      `${this.apiUrl}/${encodeURIComponent(id)}`,
      { status, statusLabel, ...details },
      { headers: this.authHeaders() }
    ).pipe(
      tap(res => {
        if (res.order) this.saveOrderLocal(res.order);
      })
    );
  }

  private currentUserKey(): string {
    const rawUser = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    if (rawUser) {
      try {
        const user = JSON.parse(rawUser);
        const identity = user.id || user._id || user.email;
        if (identity) return String(identity).toLowerCase();
      } catch {
        return localStorage.getItem('token') || sessionStorage.getItem('token') || 'anonymous';
      }
    }
    return localStorage.getItem('token') || sessionStorage.getItem('token') || 'anonymous';
  }

  private orderDetailCacheKey(id: string): string {
    return `floralia_order_detail_${encodeURIComponent(this.currentUserKey())}_${encodeURIComponent(id)}`;
  }

  private cacheOrderDetail(order: Order): void {
    const identifiers = new Set([order.id, order.code, order.code?.replace(/^#/, ''), order.slug]);
    for (const id of identifiers) {
      if (!id) continue;
      try {
        sessionStorage.setItem(this.orderDetailCacheKey(id), JSON.stringify(order));
      } catch (error) {
        console.warn('Không thể lưu bộ nhớ tạm chi tiết đơn hàng:', error);
        return;
      }
    }
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  formatPrice(num: number): string {
    return formatVietnameseDong(num);
  }
}
