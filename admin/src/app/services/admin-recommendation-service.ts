import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, timeout } from 'rxjs';

export interface RecommendationProduct { sku: string; name: string; price: number; thumbnail?: string; category?: string; }
export interface RecommendationCustomer { id: string; fullName: string; email: string; orderCount: number; totalSpent: number; lastOrderAt: string | null; }
export interface RecommendationSegment { id: string; name: string; description: string; customerCount: number; customers: RecommendationCustomer[]; productSkus: string[]; }
export interface RecommendationOverview { success: boolean; segments: RecommendationSegment[]; products: RecommendationProduct[]; }
export interface SalesForecastRow {
  sku: string; name: string; category: string; price: number; stock: number;
  monthlySales: { month: string; quantity: number }[]; forecastQuantity: number;
  forecastRevenue: number; method: string; confidence: string; stockStatus: string;
  averageMonthlySales: number;
}
export interface SalesForecast {
  success: boolean; generatedAt: string; forecastMonth: string; historyMonths: string[];
  trainingOrders: number; trainingSamples: number; validationMae: number | null; model: string; products: SalesForecastRow[];
  summary: { expectedUnits: number; expectedRevenue: number; shortageProducts: number; highStockProducts: number };
}

@Injectable({ providedIn: 'root' })
export class AdminRecommendationService {
  private readonly apiUrl = 'http://localhost:3002/api/admin/recommendations';
  constructor(private readonly http: HttpClient) {}
  getOverview(): Observable<RecommendationOverview> {
    return this.http.get<RecommendationOverview>(this.apiUrl, { headers: this.authHeaders() }).pipe(timeout({ first: 12000 }));
  }
  save(segmentId: string, productSkus: string[]): Observable<{ success: boolean; productSkus: string[] }> {
    return this.http.put<{ success: boolean; productSkus: string[] }>(`${this.apiUrl}/${encodeURIComponent(segmentId)}`, { productSkus }, { headers: this.authHeaders() });
  }
  getForecast(): Observable<SalesForecast> {
    return this.http.get<SalesForecast>(`${this.apiUrl}/forecast`, { headers: this.authHeaders() }).pipe(timeout({ first: 20000 }));
  }
  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
    return new HttpHeaders({ Authorization: `Bearer ${token || ''}` });
  }
}
