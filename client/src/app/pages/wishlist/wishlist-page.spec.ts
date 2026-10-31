import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { ProductService } from '../../services/product-service';
import { WishlistPage } from './wishlist-page';

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

describe('WishlistPage', () => {
  let fixture: ComponentFixture<WishlistPage>;

  beforeEach(async () => {
    const storage = mockStorage();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
    localStorage.setItem('currentUser', JSON.stringify({ id: 'user-1' }));
    localStorage.setItem('wishlist', JSON.stringify(['saved-tea']));

    await TestBed.configureTestingModule({
      declarations: [WishlistPage],
      imports: [CommonModule, RouterTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: ProductService,
          useValue: {
            getAll: () => of([
              { _id: 'saved-tea', slug: 'saved-tea', name: 'Trà hoa', category: 'Trà thảo mộc', price: 120000, thumbnail: 'tea.png' },
              { _id: 'other-tea', slug: 'other-tea', name: 'Trà khác', category: 'Trà thảo mộc', price: 90000, thumbnail: 'other.png' },
            ]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WishlistPage);
    fixture.detectChanges();
  });

  it('shows only products saved in the wishlist', () => {
    expect(fixture.componentInstance.products()).toHaveLength(1);
    expect(fixture.componentInstance.products()[0].slug).toBe('saved-tea');
  });

  it('removes a product from the page and saved list', () => {
    const page = fixture.componentInstance;
    const product = page.products()[0];

    page.remove(product);

    expect(page.products()).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem('wishlist') || '[]')).toEqual([]);
  });
});
