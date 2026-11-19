import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

export interface DashboardSummary {
  totalRevenue: number;
  deliveredRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  processingOrders: number;
  shippingOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  completionRate: number;
  totalProducts: number;
  inStockProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  totalCustomers: number;
  activeCustomers: number;
  totalBlogs: number;
  totalVouchers: number;
}

export interface RevenueTimelineItem {
  date: string;
  revenue: number;
  ordersCount: number;
}

export interface RecentOrderOverview {
  id: string;
  code: string;
  date: string;
  time: string;
  customerName: string;
  customerPhone: string;
  firstItemName: string;
  firstItemImage?: string;
  firstItemProductId?: string;
  itemCount: number;
  total: number;
  status: string;
  statusLabel: string;
  paymentStatus: string;
  paymentStatusLabel: string;
}

export interface TopProductOverview {
  id?: string;
  sku: string;
  name: string;
  category: string;
  image: string;
  unitsSold: number;
  totalRevenue: number;
}

export interface LowStockAlert {
  id: string;
  sku: string;
  variantLabel?: string;
  name: string;
  category: string;
  stock: number;
  price: number;
  imageUrl: string;
  statusText: string;
  statusClass: string;
}

export interface StatusDistributionItem {
  status: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface DashboardData {
  summary: DashboardSummary;
  revenueTimeline: RevenueTimelineItem[];
  recentOrders: RecentOrderOverview[];
  topProducts: TopProductOverview[];
  lowStockAlerts: LowStockAlert[];
  statusDistribution: StatusDistributionItem[];
}

export interface DashboardApiResponse {
  success: boolean;
  data: DashboardData;
  message?: string;
}

export const INITIAL_DASHBOARD_DATA: DashboardData = {
  summary: {
    totalRevenue: 4261000,
    deliveredRevenue: 1254000,
    totalOrders: 18,
    pendingOrders: 4,
    processingOrders: 3,
    shippingOrders: 1,
    deliveredOrders: 3,
    cancelledOrders: 7,
    completionRate: 27.3,
    totalProducts: 38,
    inStockProducts: 34,
    lowStockProducts: 3,
    outOfStockProducts: 1,
    totalCustomers: 14,
    activeCustomers: 14,
    totalBlogs: 9,
    totalVouchers: 12,
  },
  revenueTimeline: [],
  recentOrders: [],
  topProducts: [],
  lowStockAlerts: [],
  statusDistribution: [
    { status: 'pending', label: 'Chờ xác nhận', count: 4, percentage: 22.2, color: '#e6a23c' },
    { status: 'processing', label: 'Chờ lấy hàng', count: 3, percentage: 16.7, color: '#3498db' },
    { status: 'shipping', label: 'Đang vận chuyển', count: 1, percentage: 5.6, color: '#8e44ad' },
    { status: 'delivered', label: 'Đã giao hàng', count: 3, percentage: 16.7, color: '#18543b' },
    { status: 'cancelled', label: 'Đã hủy', count: 7, percentage: 38.9, color: '#b5453f' },
  ],
};

@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  private readonly apiUrl = 'https://floralia-1.onrender.com/api/admin/dashboard';
  private cachedData: Map<string, DashboardData> = new Map();

  constructor(private readonly http: HttpClient) {}

  getCachedData(period: string = 'all'): DashboardData | null {
    if (this.cachedData.has(period)) {
      return this.cachedData.get(period)!;
    }
    try {
      const raw = localStorage.getItem(`floralia_dashboard_cache_${period}`);
      if (raw) {
        const parsed = JSON.parse(raw) as DashboardData;
        this.cachedData.set(period, parsed);
        return parsed;
      }
    } catch {
      // Ignore storage errors
    }
    return null;
  }

  getDashboardData(period: 'all' | '7days' | '30days' | 'month' = 'all'): Observable<DashboardData> {
    const params = new HttpParams().set('period', period);
    return this.http.get<DashboardApiResponse>(this.apiUrl, { params }).pipe(
      map((res) => res.data),
      tap((data) => {
        if (data) {
          this.cachedData.set(period, data);
          try {
            localStorage.setItem(`floralia_dashboard_cache_${period}`, JSON.stringify(data));
          } catch {
            // Ignore storage errors
          }
        }
      }),
    );
  }
}

