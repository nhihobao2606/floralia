import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface AdminOrder {
  id: string;
  code: string;
  userId?: string | number | null;
  status: string;
  statusLabel: string;
  paymentMethod: string;
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

@Injectable({ providedIn: 'root' })
export class AdminOrderService {
  private readonly apiUrl = 'http://localhost:3002/api/orders';

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<{ success: boolean; orders: AdminOrder[] }> {
    return this.http.get<{ success: boolean; orders: AdminOrder[] }>(`${this.apiUrl}/admin`, {
      headers: this.authHeaders()
    });
  }

  getForUser(userId: string): Observable<{ success: boolean; orders: AdminOrder[] }> {
    return this.http.get<{ success: boolean; orders: AdminOrder[] }>(
      `${this.apiUrl}/admin/user/${encodeURIComponent(userId)}`,
      { headers: this.authHeaders() }
    );
  }

  updateStatus(id: string, status: string): Observable<{ success: boolean; order: AdminOrder }> {
    return this.http.patch<{ success: boolean; order: AdminOrder }>(
      `${this.apiUrl}/${encodeURIComponent(id)}/admin-status`,
      { status },
      { headers: this.authHeaders() }
    );
  }

  approveRefund(id: string): Observable<{ success: boolean; order: AdminOrder }> {
    return this.http.patch<{ success: boolean; order: AdminOrder }>(
      `${this.apiUrl}/${encodeURIComponent(id)}/approve-refund`,
      {},
      { headers: this.authHeaders() }
    );
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
    return new HttpHeaders({ Authorization: `Bearer ${token || ''}` });
  }
}
