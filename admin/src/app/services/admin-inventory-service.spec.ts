import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AdminInventoryService } from './admin-inventory-service';

describe('AdminInventoryService', () => {
  let service: AdminInventoryService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AdminInventoryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads inventory from the MongoDB backed endpoint', () => {
    service.getAll().subscribe(products => expect(products[0].stock).toBe(12));
    http.expectOne('https://floralia-1.onrender.com/products/admin/inventory').flush([
      { sku: 'SP1', name: 'Trà hoa cúc', price: 85000, stock: 12 }
    ]);
    http.expectOne('https://floralia-1.onrender.com/products').flush([]);
  });

  it('fills variant classifications from the MongoDB product catalog', () => {
    service.getAll().subscribe(products => {
      expect(products[0].variants?.map(variant => variant.label)).toEqual(['Hộp 100g', 'Hộp 20 gói']);
      expect(products[0].variants?.map(variant => variant.stock)).toEqual([4, 8]);
    });
    http.expectOne('https://floralia-1.onrender.com/products/admin/inventory').flush([
      { sku: 'SP1', name: 'Trà hoa cúc', price: 85000, stock: 12, variants: [{ sku: 'SP1-100G', label: '', stock: 4 }] }
    ]);
    http.expectOne('https://floralia-1.onrender.com/products').flush([
      { sku: 'SP1', name: 'Trà hoa cúc', price: 85000, stock: 12, variants: [
        { sku: 'SP1-100G', label: 'Hộp 100g', stock: 3 },
        { sku: 'SP1-G20', label: 'Hộp 20 gói', stock: 8 },
      ] }
    ]);
  });

  it('updates stock for a product SKU', () => {
    service.setStock('SP 1', 20).subscribe(response => expect(response.product.stock).toBe(20));
    const request = http.expectOne('https://floralia-1.onrender.com/products/admin/inventory/SP%201');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ stock: 20, reason: '' });
    request.flush({ success: true, product: { sku: 'SP 1', name: 'Trà', price: 1, stock: 20 } });
  });

  it('receives selected variants through the same stock endpoint used by adjustments', () => {
    service.receiveStock([{ sku: 'SP1-100G', stock: 14 }, { sku: 'SP2-500G', stock: 27 }], 'Nhập nhà cung cấp')
      .subscribe(response => expect(response.products).toHaveLength(2));
    const first = http.expectOne('https://floralia-1.onrender.com/products/admin/inventory/SP1-100G');
    const second = http.expectOne('https://floralia-1.onrender.com/products/admin/inventory/SP2-500G');
    expect(first.request.method).toBe('PATCH');
    expect(first.request.body).toEqual({ stock: 14, reason: 'Nhập nhà cung cấp' });
    expect(second.request.body).toEqual({ stock: 27, reason: 'Nhập nhà cung cấp' });
    first.flush({ success: true, product: { sku: 'SP1', name: 'Trà 1', price: 10, stock: 14 } });
    second.flush({ success: true, product: { sku: 'SP2', name: 'Trà 2', price: 20, stock: 27 } });
  });
});

