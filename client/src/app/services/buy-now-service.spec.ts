import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { CartService } from './cart-service';
import { BuyNowService } from './buy-now-service';

describe('BuyNowService', () => {
  let service: BuyNowService;
  let addProduct: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;

  const product = {
    _id: 'tea-1',
    sku: 'TEA-1',
    name: 'Trà hoa',
    stock: 0,
    price: 120000,
    variants: [
      { sku: 'TEA-1-100G', label: '100g', price: 100000, stock: 0, isDefault: true },
      { sku: 'TEA-1-200G', label: '200g', price: 180000, stock: 3, isDefault: false },
      { sku: 'TEA-1-300G', label: '300g', price: 300000, stock: 5, isDefault: false },
    ],
  };

  beforeEach(() => {
    addProduct = vi.fn(() => true);
    navigate = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [
        BuyNowService,
        { provide: CartService, useValue: { addProduct, cartMessage: signal('') } },
        { provide: Router, useValue: { navigate } },
      ],
    });
    service = TestBed.inject(BuyNowService);
    sessionStorage.removeItem('checkout_items');
  });

  it('selects an available variant when opening the purchase picker', () => {
    service.open(product, '/tea.jpg');

    expect(service.request()?.product).toBe(product);
    expect(service.selectedVariant()?.sku).toBe('TEA-1-200G');
    expect(service.price).toBe(180000);
    expect(service.stock).toBe(3);
  });

  it('only adds the chosen variant and quantity before navigating to checkout', async () => {
    service.open(product, '/tea.jpg');
    service.selectVariant(product.variants[2]);
    service.changeQuantity(1);

    await service.confirmPurchase();

    expect(addProduct).toHaveBeenCalledWith(
      product,
      product.variants[2],
      2,
      '/tea.jpg',
    );
    expect(JSON.parse(sessionStorage.getItem('checkout_items') || '[]')).toEqual([
      expect.objectContaining({
        productId: 'tea-1',
        sku: 'TEA-1-300G',
        variantLabel: '300g',
        price: 300000,
        quantity: 2,
        total: 600000,
      }),
    ]);
    expect(navigate).toHaveBeenCalledWith(['/checkout']);
    expect(service.request()).toBeNull();
  });

  it('does not navigate if the selected product cannot be added', async () => {
    addProduct.mockReturnValue(false);
    service.open(product, '/tea.jpg');

    await service.confirmPurchase();

    expect(navigate).not.toHaveBeenCalled();
    expect(service.request()).not.toBeNull();
    expect(service.error()).toContain('Không thể mua');
  });
});
