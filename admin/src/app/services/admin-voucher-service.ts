import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export type VoucherStatus = 'active' | 'upcoming' | 'paused' | 'expired' | 'draft';

export interface AdminVoucher {
  id: string;
  _id?: string;
  code: string;
  name: string;
  description?: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  maxDiscount?: number | null;
  minOrderValue: number;
  usageLimit: number;
  usedCount: number;
  perUserLimit: number;
  startDate?: string | null;
  endDate?: string | null;
  scope: 'all' | 'categories' | 'products';
  categories: string[];
  productIds: string[];
  audience: 'all' | 'new_customer';
  status: VoucherStatus;
  isActive: boolean;
  createdAt?: string;
}

export interface VoucherOrder {
  id?: string;
  code?: string;
  createdAt?: string;
  date?: string;
  status?: string;
  total?: number;
  discount?: number;
  receiver?: { name?: string; email?: string };
  user?: { fullName?: string; email?: string };
}

export interface VoucherSummary {
  total: number;
  active: number;
  upcoming: number;
  paused: number;
  expired: number;
  monthlyUsage: number;
}

@Injectable({ providedIn: 'root' })
export class AdminVoucherService {
  private readonly apiUrl = 'http://localhost:3002/api/vouchers/admin';
  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<{ success: boolean; vouchers: AdminVoucher[]; summary: VoucherSummary }> {
    return this.http.get<{ success: boolean; vouchers: AdminVoucher[]; summary: VoucherSummary }>(this.apiUrl, { headers: this.authHeaders() });
  }

  get(id: string): Observable<{ success: boolean; voucher: AdminVoucher; orders: VoucherOrder[] }> {
    return this.http.get<{ success: boolean; voucher: AdminVoucher; orders: VoucherOrder[] }>(`${this.apiUrl}/${encodeURIComponent(id)}`, { headers: this.authHeaders() });
  }

  create(value: Partial<AdminVoucher>): Observable<{ success: boolean; message: string; voucher: AdminVoucher }> {
    return this.http.post<{ success: boolean; message: string; voucher: AdminVoucher }>(this.apiUrl, value, { headers: this.authHeaders() });
  }

  update(id: string, value: Partial<AdminVoucher>): Observable<{ success: boolean; message: string; voucher: AdminVoucher }> {
    return this.http.put<{ success: boolean; message: string; voucher: AdminVoucher }>(`${this.apiUrl}/${encodeURIComponent(id)}`, value, { headers: this.authHeaders() });
  }

  setStatus(id: string, status: 'active' | 'paused'): Observable<{ success: boolean; message: string; voucher: AdminVoucher }> {
    return this.http.patch<{ success: boolean; message: string; voucher: AdminVoucher }>(`${this.apiUrl}/${encodeURIComponent(id)}/status`, { status }, { headers: this.authHeaders() });
  }

  delete(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${encodeURIComponent(id)}`, { headers: this.authHeaders() });
  }

  clearSession(): void {
    localStorage.removeItem('adminToken'); localStorage.removeItem('adminUser');
    sessionStorage.removeItem('adminToken'); sessionStorage.removeItem('adminUser');
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
    return new HttpHeaders({ Authorization: `Bearer ${token || ''}` });
  }
}
