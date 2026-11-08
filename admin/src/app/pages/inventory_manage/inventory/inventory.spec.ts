import { ChangeDetectorRef } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { Inventory } from './inventory';
import { AdminNotificationService } from '../../../services/admin-notification-service';

describe('Inventory', () => {
  const setup = () => {
    const service = { getAll: vi.fn(), setStock: vi.fn() };
    const router = { navigate: vi.fn() };
    const detector = { markForCheck: vi.fn() } as unknown as ChangeDetectorRef;
    return { component: new Inventory(service as any, new AdminNotificationService(), router as any, detector), service };
  };

  it('counts and filters products by stock status', () => {
    const { component } = setup();
    component.products = [
      { sku: 'A', name: 'Trà A', price: 10, stock: 0 },
      { sku: 'B', name: 'Trà B', price: 10, stock: 9 },
      { sku: 'C', name: 'Trà C', price: 10, stock: 10 },
      { sku: 'D', name: 'Trà D', price: 10, stock: 20 },
    ];
    expect(component.outOfStockCount).toBe(1);
    expect(component.lowStockCount).toBe(1);
    expect(component.statusLabel(0)).toBe('Hết hàng');
    expect(component.statusLabel(9)).toBe('Sắp hết hàng');
    expect(component.statusLabel(10)).toBe('Còn hàng');
    component.setStockFilter('low');
    expect(component.filteredProducts.map(product => product.sku)).toEqual(['B']);
  });

  it('computes the resulting stock for add and subtract adjustments', () => {
    const { component } = setup();
    component.openAdjustment({ sku: 'A', name: 'Trà A', price: 10, stock: 5 }, 'add');
    component.adjustmentAmount = 3;
    expect(component.adjustedStock).toBe(8);
    component.adjustmentType = 'subtract';
    expect(component.adjustedStock).toBe(2);
  });

  it('requires the admin to choose a MongoDB variant before adjusting its stock', () => {
    const { component } = setup();
    component.openAdjustment({
      sku: 'A', name: 'Trà A', price: 100, stock: 15,
      variants: [{ sku: 'A-100G', label: 'Hộp 100g', stock: 5 }, { sku: 'A-500G', label: 'Hộp 500g', stock: 10, isDefault: true }]
    });
    expect(component.adjustmentVariantSku).toBe('');
    expect(component.adjustingVariant).toBeNull();
    expect(component.adjustingStock).toBeNull();
    component.selectAdjustmentVariant('A-500G');
    expect(component.adjustingVariant?.label).toBe('Hộp 500g');
    expect(component.adjustingStock).toBe(10);
  });

  it('shows a selectable standard classification when a product has no MongoDB variants', () => {
    const { component } = setup();
    component.openAdjustment({
      sku: 'AT021', name: 'Ấm gốm', price: 450000, stock: 15,
      variants: [{ sku: 'AT021', label: 'Tiêu chuẩn', stock: 15 }],
    });
    expect(component.adjustmentVariantSku).toBe('');
    expect(component.adjustingStock).toBeNull();
    component.selectAdjustmentVariant('AT021');
    expect(component.adjustingVariant?.label).toBe('Tiêu chuẩn');
    expect(component.adjustingStock).toBe(15);
  });
});
