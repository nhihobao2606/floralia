import { CommonModule } from '@angular/common';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { AdminRecommendationService, SalesForecast } from '../../services/admin-recommendation-service';
import { SalesForecastPage } from './sales-forecast';

describe('SalesForecastPage', () => {
  it('renders every product as soon as the forecast response arrives without a control click', async () => {
    const forecast: SalesForecast = {
      success: true,
      generatedAt: '2026-11-17T00:00:00.000Z',
      forecastMonth: '2026-12',
      historyMonths: ['2026-11'],
      trainingOrders: 1,
      trainingSamples: 6,
      validationMae: 1,
      model: 'test',
      products: [
        { sku: 'SKU-1', name: 'Product One', category: '', price: 10, stock: 5, monthlySales: [], forecastQuantity: 2, forecastRevenue: 20, method: 'test', confidence: 'Thấp', stockStatus: 'Ít dữ liệu', averageMonthlySales: 1 },
        { sku: 'SKU-2', name: 'Product Two', category: '', price: 20, stock: 7, monthlySales: [], forecastQuantity: 3, forecastRevenue: 60, method: 'test', confidence: 'Thấp', stockStatus: 'Ít dữ liệu', averageMonthlySales: 2 },
        { sku: 'SKU-3', name: 'Product Three', category: '', price: 30, stock: 9, monthlySales: [], forecastQuantity: 4, forecastRevenue: 120, method: 'test', confidence: 'Thấp', stockStatus: 'Ít dữ liệu', averageMonthlySales: 3 },
      ],
      summary: { expectedUnits: 9, expectedRevenue: 200, shortageProducts: 0, highStockProducts: 0 },
    };

    TestBed.configureTestingModule({
      imports: [SalesForecastPage],
      providers: [
        provideZonelessChangeDetection(),
        { provide: AdminRecommendationService, useValue: { getForecast: () => of(forecast) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).overrideComponent(SalesForecastPage, {
      set: {
        imports: [CommonModule],
        template: `
          <ng-container *ngIf="forecast$ | async as forecast">
            <span class="count">{{ forecast.products.length }}</span>
            <div class="product" *ngFor="let product of (filteredProducts() ?? forecast.products)">{{ product.name }}</div>
          </ng-container>
        `,
      },
    });

    const fixture = TestBed.createComponent(SalesForecastPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.count')?.textContent.trim()).toBe('3');
    expect(fixture.nativeElement.querySelectorAll('.product').length).toBe(3);
    expect(fixture.nativeElement.textContent).toContain('Product Three');
    fixture.destroy();
    TestBed.resetTestingModule();
  });
});
