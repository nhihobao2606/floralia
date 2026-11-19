import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ProductService } from './product-service';
import { ReviewService } from './review-service';

describe('ReviewService', () => {
  let service: ReviewService;
  let http: HttpTestingController;
  const cachedProducts = [{
    sku: 'TEA-1',
    ratingAverage: 0,
    ratingCount: 0,
  }];

  beforeEach(() => {
    cachedProducts[0].ratingAverage = 0;
    cachedProducts[0].ratingCount = 0;
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
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{
        provide: ProductService,
        useValue: { getCachedProducts: () => cachedProducts },
      }],
    });
    service = TestBed.inject(ReviewService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads reviews by encoded product SKU', () => {
    let response: unknown;
    service.getReviews('TEA / 1').subscribe((reviews) => response = reviews);

    const request = http.expectOne('https://floralia-1.onrender.com/products/reviews/TEA%20%2F%201');
    request.flush([]);

    expect(response).toEqual([]);
  });

  it('creates a review with the signed-in token and without a client-supplied name', () => {
    localStorage.setItem('token', 'signed-in-token');
    let response: unknown;
    service.createReview({
      productSku: 'TEA-1',
      rating: 5,
      comment: 'Rất thơm.',
    }).subscribe((review) => response = review);

    const request = http.expectOne('https://floralia-1.onrender.com/products/reviews');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer signed-in-token');
    expect(request.request.body).toEqual({
      productSku: 'TEA-1',
      rating: 5,
      comment: 'Rất thơm.',
    });
    request.flush({ productSku: 'TEA-1', userName: 'Thương Trương', rating: 5, comment: 'Rất thơm.' });

    expect(response).toMatchObject({ userName: 'Thương Trương' });
    localStorage.removeItem('token');
  });

  it('publishes rating changes and updates the product cache', () => {
    const updates: Array<{ productSku: string; ratingAverage: number; ratingCount: number }> = [];
    const subscription = service.ratingUpdates.subscribe((update) => updates.push(update));

    service.updateProductRating('TEA-1', 4.7, 3);

    expect(cachedProducts[0]).toMatchObject({ ratingAverage: 4.7, ratingCount: 3 });
    expect(updates).toEqual([{ productSku: 'TEA-1', ratingAverage: 4.7, ratingCount: 3 }]);
    subscription.unsubscribe();
  });
});

