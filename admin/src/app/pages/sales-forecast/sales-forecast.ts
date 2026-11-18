import { CommonModule } from '@angular/common';
import { Component, DestroyRef, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminSidebar } from '../../components/admin-sidebar/admin-sidebar';
import { AdminLogoutDialog } from '../../components/admin-logout-dialog/admin-logout-dialog';
import { AdminRecommendationService, SalesForecast, SalesForecastRow } from '../../services/admin-recommendation-service';
import { catchError, map, of, startWith, Subject, switchMap } from 'rxjs';

@Component({
  selector: 'app-sales-forecast',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AdminSidebar, AdminLogoutDialog],
  templateUrl: './sales-forecast.html',
  styleUrl: './sales-forecast.css',
})
export class SalesForecastPage {
  adminName = 'Admin Floralia';
  logoutConfirmationVisible = false;
  readonly activeMetric = signal<'units' | 'revenue' | 'shortage' | 'highStock' | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly query = signal('');
  readonly statusFilter = signal('all');
  readonly allProducts = signal<SalesForecastRow[]>([]);
  readonly filteredProducts = signal<SalesForecastRow[] | null>(null);
  readonly forecast = signal<SalesForecast | null>(null);
  private readonly reloadRequests = new Subject<void>();

  constructor(
    private readonly service: AdminRecommendationService,
    private readonly router: Router,
    destroyRef: DestroyRef,
  ) {
    const saved = localStorage.getItem('adminUser') || sessionStorage.getItem('adminUser');
    if (saved) {
      try {
        const user = JSON.parse(saved);
        this.adminName = user.fullName || user.name || 'Admin Floralia';
      } catch {
        this.adminName = 'Admin Floralia';
      }
    }
    this.reloadRequests.pipe(
      startWith(undefined),
      switchMap(() => {
        this.loading.set(true);
        this.error.set('');
        return this.service.getForecast().pipe(
          map(data => this.normalizeForecast(data)),
          catchError(error => {
            this.error.set(error.error?.message || 'Không tải được dữ liệu dự báo.');
            return of(null);
          }),
        );
      }),
      takeUntilDestroyed(destroyRef),
    ).subscribe(forecast => {
      this.forecast.set(forecast);
      this.allProducts.set(forecast?.products ?? []);
      this.filteredProducts.set(null);
      this.loading.set(false);
    });
  }

  refresh(): void { this.reloadRequests.next(); }

  private normalizeForecast(data: SalesForecast): SalesForecast {
    const products = Array.isArray(data?.products)
      ? data.products
          .filter(product => product && typeof product === 'object' && String(product.sku || '').trim())
          .map(product => ({
            ...product,
            sku: String(product.sku).trim(),
            name: String(product.name || product.sku).trim(),
            category: String(product.category || ''),
            monthlySales: Array.isArray(product.monthlySales) ? product.monthlySales : [],
          }))
      : [];
    return { ...data, products };
  }

  updateQuery(value: string): void {
    this.query.set(value);
    this.applyFilters();
  }

  updateStatus(value: string): void {
    this.statusFilter.set(value);
    this.applyFilters();
  }

  selectMetric(metric: 'units' | 'revenue' | 'shortage' | 'highStock'): void {
    this.activeMetric.set(this.activeMetric() === metric ? null : metric);
    this.applyFilters();
  }

  private applyFilters(): void {
    const query = this.query().trim().toLocaleLowerCase('vi');
    const status = this.statusFilter();
    const metric = this.activeMetric();
    const products = this.allProducts().filter(product =>
      (!query || `${product.name} ${product.sku} ${product.category}`.toLocaleLowerCase('vi').includes(query)) &&
      (status === 'all' || product.stockStatus === status) &&
      (metric !== 'units' || product.forecastQuantity > 0) &&
      (metric !== 'revenue' || product.forecastRevenue > 0) &&
      (metric !== 'shortage' || product.forecastQuantity > product.stock) &&
      (metric !== 'highStock' || (product.forecastQuantity > 0 && product.stock > product.forecastQuantity * 3))
    );
    if (metric === 'revenue') products.sort((a, b) => b.forecastRevenue - a.forecastRevenue);
    else if (metric === 'shortage') products.sort((a, b) => (b.forecastQuantity - b.stock) - (a.forecastQuantity - a.stock));
    else if (metric === 'highStock') products.sort((a, b) => b.stock - a.stock);
    else products.sort((a, b) => b.forecastQuantity - a.forecastQuantity);
    this.filteredProducts.set(products);
  }

  barHeight(row: SalesForecastRow, quantity: number): string {
    const max = Math.max(1, ...row.monthlySales.map(month => month.quantity));
    return `${Math.max(quantity > 0 ? 8 : 2, Math.round(quantity / max * 100))}%`;
  }

  soldLastSixMonths(row: SalesForecastRow): number {
    return row.monthlySales.reduce((total, month) => total + month.quantity, 0);
  }

  monthLabel(month: string): string {
    const [year, index] = month.split('-').map(Number);
    return `T${index}/${String(year).slice(-2)}`;
  }

  requestLogoutConfirmation(): void { this.logoutConfirmationVisible = true; }
  cancelLogoutConfirmation(): void { this.logoutConfirmationVisible = false; }
  confirmLogout(): void { this.logoutConfirmationVisible = false; this.logout(); }

  logout(): void {
    for (const storage of [localStorage, sessionStorage]) {
      storage.removeItem('adminToken'); storage.removeItem('adminUser'); storage.removeItem('adminAuthSource');
    }
    void this.router.navigate(['/admin-login']);
  }
}
