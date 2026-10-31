import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { afterEach, vi } from 'vitest';
import { WishlistService } from './wishlist-service';

function mockStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

describe('WishlistService', () => {
  let service: WishlistService;

  afterEach(() => vi.restoreAllMocks());

  beforeEach(() => {
    const storage = mockStorage();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [{ provide: Router, useValue: { navigate: vi.fn() } }],
    });
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    service = TestBed.inject(WishlistService);
  });

  it('persists a product and matches its identifiers', () => {
    localStorage.setItem('currentUser', JSON.stringify({ id: 'user-1' }));
    const product = { _id: 'product-1', slug: 'herbal-tea', sku: 'TEA-1' };

    expect(service.toggle(product)).toBe(true);
    expect(service.isSaved({ slug: 'herbal-tea' })).toBe(true);
    expect(JSON.parse(localStorage.getItem('wishlist') || '[]')).toContain('product-1');
  });

  it('removes saved products from storage and the current state', () => {
    localStorage.setItem('currentUser', JSON.stringify({ id: 'user-1' }));
    const product = { _id: 'product-2', slug: 'flower-tea' };
    service.toggle(product);

    service.remove(product);

    expect(service.isSaved(product)).toBe(false);
    expect(service.ids().size).toBe(0);
  });

  it('does not save favorites for guests', () => {
    expect(service.toggle({ _id: 'guest-product' })).toBe(false);
    expect(service.ids().size).toBe(0);
  });
});
