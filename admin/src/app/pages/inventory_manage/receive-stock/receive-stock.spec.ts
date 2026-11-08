import { ChangeDetectorRef } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { ReceiveStock } from './receive-stock';
import { AdminNotificationService } from '../../../services/admin-notification-service';

describe('ReceiveStock', () => {
  const setup = () => {
    const service = { getAll: vi.fn(), receiveStock: vi.fn() };
    const router = { navigate: vi.fn() };
    const detector = { markForCheck: vi.fn() } as unknown as ChangeDetectorRef;
    return { component: new ReceiveStock(service as any, new AdminNotificationService(), router as any, detector), service, router };
  };

  it('tracks quantities and projected stock for multiple selected products', () => {
    const { component } = setup();
    component.products = [
      { sku: 'A', name: 'Trà A', price: 10, stock: 5, variants: [{ sku: 'A-100G', label: 'Hộp 100g', stock: 5 }] },
      { sku: 'B', name: 'Trà B', price: 20, stock: 8, variants: [{ sku: 'B-500G', label: 'Hộp 500g', stock: 8 }] },
    ];
    component.lines = [{ productSku: 'A', variantSku: 'A-100G', quantity: 3 }, { productSku: 'B', variantSku: 'B-500G', quantity: 6 }];
    expect(component.totalUnits).toBe(9);
    expect(component.projectedStock(component.lines[0])).toBe(8);
    expect(component.projectedStock(component.lines[1])).toBe(14);
    expect(component.validLines).toBe(true);
  });

  it('does not allow selecting one product twice in a receipt', () => {
    const { component } = setup();
    component.products = [{ sku: 'A', name: 'Trà A', price: 10, stock: 5 }];
    component.lines = [{ productSku: 'A', variantSku: '', quantity: 1 }, { productSku: 'A', variantSku: '', quantity: 1 }];
    expect(component.validLines).toBe(false);
  });

  it('selects a product before a MongoDB variant and shows that variant stock', () => {
    const { component } = setup();
    component.products = [{
      sku: 'A', name: 'Trà A', price: 100, stock: 12,
      variants: [{ sku: 'A-100G', label: 'Hộp 100g', price: 80, stock: 7 }]
    }];
    const line = { productSku: '', variantSku: '', quantity: 2 };
    component.selectProduct(line, 'A');
    expect(line.variantSku).toBe('');
    expect(component.validLines).toBe(false);
    component.selectVariant(line, 'A-100G');
    component.lines = [line];
    expect(component.currentStock(line)).toBe(7);
    expect(component.validLines).toBe(true);
  });
});
