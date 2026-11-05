import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CartService } from './cart-service';

describe('CartService', () => {
  let service: CartService;

  beforeEach(() => {
    const values = new Map<string, string>();
    const storage: Storage = {
      get length() { return values.size; },
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => Array.from(values.keys())[index] ?? null,
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, String(value)),
    };
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage });
    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
    Object.defineProperty(window, 'sessionStorage', { configurable: true, value: storage });
    TestBed.configureTestingModule({});
    service = TestBed.inject(CartService);
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('adds a product to the guest cart and notifies listeners', () => {
    const onCartUpdated = vi.fn();
    window.addEventListener('cart-updated', onCartUpdated);

    const added = service.addProduct(
      { _id: 'product-1', sku: 'TEA-1', name: 'Trà thử nghiệm', stock: 5 },
      { sku: 'TEA-1-100G', label: 'Hộp 100g', price: 100000, stock: 3 },
      2,
      '/assets/tea.jpg',
    );

    expect(added).toBe(true);
    expect(service.getCart()).toEqual([expect.objectContaining({
      productId: 'product-1',
      variantSku: 'TEA-1-100G',
      quantity: 2,
      price: 100000,
      image: '/assets/tea.jpg',
    })]);
    expect(service.cartMessage()).toBe('Đã thêm sản phẩm vào giỏ hàng.');
    expect(onCartUpdated).toHaveBeenCalledOnce();
    window.removeEventListener('cart-updated', onCartUpdated);
  });

  it('merges the same product variant without exceeding stock', () => {
    service.addProduct(
      { _id: 'product-1', name: 'Trà thử nghiệm', stock: 4 },
      { sku: 'TEA-1-100G', price: 100000, stock: 3 },
      2,
      '/assets/tea.jpg',
    );
    service.addProduct(
      { _id: 'product-1', name: 'Trà thử nghiệm', stock: 4 },
      { sku: 'TEA-1-100G', price: 100000, stock: 3 },
      2,
      '/assets/tea.jpg',
    );

    expect(service.getCart()).toHaveLength(1);
    expect(service.getCart()[0].quantity).toBe(3);
  });

  it('writes to the current user cart when signed in', () => {
    localStorage.setItem('currentUser', JSON.stringify({ email: 'tea@example.com' }));

    service.addProduct(
      { _id: 'product-1', name: 'Trà thử nghiệm', stock: 2 },
      null,
      1,
      '/assets/tea.jpg',
    );

    expect(localStorage.getItem('cart_user_tea@example.com')).not.toBeNull();
    expect(localStorage.getItem('cart_guest')).toBeNull();
  });

  it('updates and removes cart items through shared methods', () => {
    service.addProduct(
      { _id: 'product-1', name: 'Trà thử nghiệm', stock: 4 },
      null,
      2,
      '/assets/tea.jpg',
    );
    const item = service.getCart()[0];

    service.changeQuantity(item, 1);
    expect(service.getCart()[0].quantity).toBe(3);

    service.removeItem(item);
    expect(service.getCart()).toEqual([]);
  });

  it('removes only the items passed to removeItems', () => {
    service.addProduct(
      { _id: 'product-1', name: 'Trà thứ nhất', stock: 4 },
      null,
      1,
      '/assets/tea-1.jpg',
    );
    service.addProduct(
      { _id: 'product-2', name: 'Trà thứ hai', stock: 4 },
      null,
      1,
      '/assets/tea-2.jpg',
    );
    const [selectedItem] = service.getCart();

    service.removeItems([selectedItem]);

    expect(service.getCart()).toHaveLength(1);
    expect(service.getCart()[0].productId).toBe('product-2');
  });

  it('changes a cart item variant and updates its price and quantity cap', () => {
    service.addProduct(
      {
        _id: 'product-1',
        sku: 'TEA-1',
        slug: 'test-tea',
        name: 'Trà thử nghiệm',
        variants: [
          { sku: 'TEA-1-100G', label: '100g', price: 100000, stock: 5 },
          { sku: 'TEA-1-200G', label: '200g', price: 180000, stock: 2 },
        ],
      },
      { sku: 'TEA-1-100G', label: '100g', price: 100000, stock: 5 },
      4,
      '/assets/tea.jpg',
    );
    const item = service.getCart()[0];

    expect(service.changeVariant(item, {
      sku: 'TEA-1-200G',
      label: '200g',
      price: 180000,
      oldPrice: 200000,
      stock: 2,
    })).toBe(true);

    expect(service.getCart()).toEqual([expect.objectContaining({
      productId: 'product-1',
      variantSku: 'TEA-1-200G',
      sku: 'TEA-1-200G',
      variantLabel: '200g',
      price: 180000,
      oldPrice: 200000,
      quantity: 2,
    })]);
  });

  it('stores product variants in the cart so the picker can open without a request', () => {
    service.addProduct(
      {
        _id: 'product-1',
        sku: 'TEA-1',
        name: 'Trà thử nghiệm',
        variants: [
          { sku: 'TEA-1-100G', label: '100g', price: 100000, stock: 5 },
          { sku: 'TEA-1-200G', label: '200g', price: 180000, stock: 2 },
        ],
      },
      { sku: 'TEA-1-100G', label: '100g', price: 100000, stock: 5 },
      1,
      '/assets/tea.jpg',
    );

    expect(service.getCart()[0].variants).toEqual([
      { sku: 'TEA-1-100G', label: '100g', price: 100000, stock: 5 },
      { sku: 'TEA-1-200G', label: '200g', price: 180000, stock: 2 },
    ]);
  });

  it('merges into an existing target variant when changing cart variant', () => {
    service.addProduct(
      { _id: 'product-1', sku: 'TEA-1', name: 'Trà thử nghiệm' },
      { sku: 'TEA-1-100G', price: 100000, stock: 5 },
      2,
      '/assets/tea.jpg',
    );
    service.addProduct(
      { _id: 'product-1', sku: 'TEA-1', name: 'Trà thử nghiệm' },
      { sku: 'TEA-1-200G', price: 180000, stock: 5 },
      3,
      '/assets/tea.jpg',
    );
    const [source] = service.getCart();

    service.changeVariant(source, {
      sku: 'TEA-1-200G',
      label: '200g',
      price: 180000,
      stock: 4,
    });

    expect(service.getCart()).toHaveLength(1);
    expect(service.getCart()[0]).toMatchObject({
      variantSku: 'TEA-1-200G',
      quantity: 4,
    });
  });

  it('updates the quantity when confirming the currently selected variant', () => {
    service.addProduct(
      { _id: 'product-1', sku: 'TEA-1', name: 'Trà thử nghiệm' },
      { sku: 'TEA-1-100G', price: 100000, stock: 5 },
      2,
      '/assets/tea.jpg',
    );
    const [item] = service.getCart();

    expect(service.changeVariant(item, {
      sku: 'TEA-1-100G',
      label: '100g',
      price: 100000,
      stock: 5,
    }, 4)).toBe(true);

    expect(service.getCart()[0].quantity).toBe(4);
  });
});
