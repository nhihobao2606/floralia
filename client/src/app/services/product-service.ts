import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, Subject, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { Products } from '../classes/Products';

export interface PublicCategoryItem {
  _id: string;
  code: string;
  name: string;
  slug: string;
}

export interface PublicBenefitItem {
  label: string;
  slug: string;
  values: string[];
  parentSlugs: string[];
}

export interface PublicCategoriesResponse {
  mainCategories: PublicCategoryItem[];
  benefits: PublicBenefitItem[];
}

export interface ProductRecommendationsResponse {
  success: boolean;
  segmentId: string | null;
  segmentName: string;
  modelVersion: string;
  modelStats?: { trainedOrders: number; learnedProducts: number; customerProfileProducts: number; customerViewProducts: number };
  recommendationReasons?: { sku: string; reason: string }[];
  products: Products[];
}

export interface CheckoutProduct {
  sku: string;
  name: string;
  imageUrl: string | null;
  variant: string;
  price: number;
  oldPrice: number;
  stock: number;
  productDiscount: number;
}

export interface ValidatedVoucher {
  code: string;
  discount: number;
}

export interface AvailableVoucher extends ValidatedVoucher {
  name: string;
  description: string;
  discountType: 'fixed' | 'percent';
  discountValue: number;
  maxDiscount: number | null;
  minOrderValue: number;
  endDate: string | null;
}

export interface PublicPromoVoucher {
  code: string;
  name: string;
  description: string;
  discountType: 'fixed' | 'percent';
  discountValue: number;
  maxDiscount: number | null;
  minOrderValue: number;
  startDate: string | null;
  endDate: string | null;
  audience: string;
  scope: string;
  categories: string[];
  perUserLimit: number;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService implements OnDestroy {
  private apiUrl = 'http://localhost:3002/products';
  private productsCache: Products[] | null = null;
  private productsCacheExpiresAt = 0;
  private productsRequest: Observable<Products[]> | null = null;
  private cacheVersion = 0;
  private readonly changesSubject = new Subject<void>();
  private eventSource: EventSource | null = null;
  private readonly recommendationChangesSubject = new Subject<void>();
  private recommendationEventSource: EventSource | null = null;
  private recommendationRanks = new Map<string, number>();
  private readonly onWindowFocus = () => {
    this.invalidateCache();
    this.changesSubject.next();
  };
  private readonly onAuthChanged = () => {
    this.invalidateCache();
    this.recommendationRanks.clear();
    this.changesSubject.next();
    this.recommendationChangesSubject.next();
  };
  private readonly onStorageChanged = (event: StorageEvent) => {
    if (event.key === 'token' || event.key === 'currentUser' || event.key === null) {
      this.onAuthChanged();
    }
  };

  readonly productsChanges$: Observable<void> = new Observable<void>((subscriber) => {
    this.ensureEventStream();
    const sub = this.changesSubject.subscribe(subscriber);
    return () => sub.unsubscribe();
  });
  readonly recommendationChanges$: Observable<void> = new Observable<void>((subscriber) => {
    this.ensureRecommendationEventStream();
    const sub = this.recommendationChangesSubject.subscribe(subscriber);
    return () => sub.unsubscribe();
  });

  constructor(private http: HttpClient, private ngZone: NgZone) {
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', this.onWindowFocus);
      window.addEventListener('auth-changed', this.onAuthChanged);
      window.addEventListener('storage', this.onStorageChanged);
    }
  }

  getRecommendations(): Observable<ProductRecommendationsResponse> {
    return this.http.get<ProductRecommendationsResponse>(`${this.apiUrl}/recommendations`, {
      params: new HttpParams().set('visitorId', this.getRecommendationVisitorId()),
    }).pipe(tap(recommendation => {
      this.recommendationRanks = new Map((recommendation.products || []).map((product, index) => [String(product.sku), index]));
    }));
  }

  personalizeProducts(products: Products[]): Products[] {
    return [...products].sort((left, right) => {
      const leftRank = this.recommendationRanks.get(String(left.sku));
      const rightRank = this.recommendationRanks.get(String(right.sku));
      if (leftRank !== undefined || rightRank !== undefined) {
        return (leftRank ?? Number.MAX_SAFE_INTEGER) - (rightRank ?? Number.MAX_SAFE_INTEGER);
      }
      return 0;
    });
  }

  recordProductView(sku: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.apiUrl}/recommendations/views`, {
      sku,
      visitorId: this.getRecommendationVisitorId(),
    });
  }

  private getRecommendationVisitorId(): string {
    if (typeof window === 'undefined') return '';
    const storageKey = 'floralia-recommendation-visitor';
    let visitorId = window.localStorage.getItem(storageKey);
    if (!visitorId) {
      visitorId = typeof window.crypto?.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(storageKey, visitorId);
    }
    return visitorId;
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this.onWindowFocus);
      window.removeEventListener('auth-changed', this.onAuthChanged);
      window.removeEventListener('storage', this.onStorageChanged);
    }
    this.eventSource?.close();
    this.eventSource = null;
    this.recommendationEventSource?.close();
    this.recommendationEventSource = null;
  }

  private ensureEventStream(): void {
    if (this.eventSource || typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return;
    }
    this.ngZone.runOutsideAngular(() => {
      try {
        const es = new EventSource(`${this.apiUrl}/events`);
        let isInitialMessage = true;
        es.onmessage = () => {
          if (isInitialMessage) {
            isInitialMessage = false;
            return;
          }
          this.ngZone.run(() => {
            this.invalidateCache();
            this.changesSubject.next();
          });
        };
        es.onerror = () => {
          // Browser EventSource automatically reconnects
        };
        this.eventSource = es;
      } catch {
        this.eventSource = null;
      }
    });
  }

  private ensureRecommendationEventStream(): void {
    if (this.recommendationEventSource || typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    this.ngZone.runOutsideAngular(() => {
      try {
        const source = new EventSource(`${this.apiUrl}/recommendations/events`);
        let initialMessage = true;
        source.onmessage = () => {
          if (initialMessage) {
            initialMessage = false;
            return;
          }
          this.ngZone.run(() => {
            this.recommendationChangesSubject.next();
          });
        };
        source.onerror = () => undefined;
        this.recommendationEventSource = source;
      } catch {
        this.recommendationEventSource = null;
      }
    });
  }

  getAll(): Observable<Products[]> {
    return this.getProducts();
  }

  getCachedProducts(): Products[] | null {
    return this.productsCache;
  }

  invalidateCache(): void {
    this.cacheVersion += 1;
    this.productsCache = null;
    this.productsCacheExpiresAt = 0;
    this.productsRequest = null;
  }

  // Lấy danh sách sản phẩm
  getProducts(): Observable<Products[]> {
    if (this.productsRequest) {
      return this.productsRequest;
    }

    const requestVersion = this.cacheVersion;
    let request: Observable<Products[]>;
    request = this.http.get<Products[]>(this.apiUrl, {
      params: new HttpParams().set('visitorId', this.getRecommendationVisitorId()),
    }).pipe(
      tap((products) => {
        if (requestVersion === this.cacheVersion) {
          this.productsCache = products;
          // Keep the last response available to components that need a snapshot,
          // but never serve it as the next product request.
          this.productsCacheExpiresAt = 0;
        }
      }),
      catchError((error: unknown) => {
        return throwError(() => error);
      }),
      finalize(() => {
        if (this.productsRequest === request) {
          this.productsRequest = null;
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.productsRequest = request;
    return request;
  }

  // Lấy chi tiết 1 sản phẩm theo Slug
  getProductBySlug(slug: string): Observable<Products> {
    return this.http.get<Products>(`${this.apiUrl}/slug/${encodeURIComponent(slug)}`);
  }

  getProductBySku(sku: string, variant?: string): Observable<CheckoutProduct> {
    return this.http.get<CheckoutProduct>(`${this.apiUrl}/sku/${encodeURIComponent(sku)}`, {
      params: variant ? { variant } : {}
    });
  }

  getAvailableVouchers(subtotal: number, items: Array<{ sku: string; quantity: number; variant?: string }> = []): Observable<{ success: boolean; vouchers: AvailableVoucher[] }> {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    return this.http.post<{ success: boolean; vouchers: AvailableVoucher[] }>(
      'http://localhost:3002/api/vouchers/available',
      { subtotal, items },
      { headers: new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {}) }
    );
  }

  getPublicPromoVouchers(): Observable<{ success: boolean; vouchers: PublicPromoVoucher[] }> {
    return this.http.get<{ success: boolean; vouchers: PublicPromoVoucher[] }>(
      'http://localhost:3002/api/vouchers/public'
    );
  }

  validateVoucher(code: string, subtotal: number, items: Array<{ sku: string; quantity: number; variant?: string }> = []): Observable<{ success: boolean; voucher: ValidatedVoucher }> {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    return this.http.post<{ success: boolean; voucher: ValidatedVoucher }>(
      'http://localhost:3002/api/vouchers/validate',
      { code, subtotal, items },
      { headers: new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {}) }
    );
  }

  getCategories(): Observable<PublicCategoriesResponse> {
    return this.http.get<PublicCategoriesResponse>(`${this.apiUrl}/categories`).pipe(
      catchError(() =>
        this.getProducts().pipe(
          map((products) => {
            const defaultOrder = ['Trà thảo mộc', 'Trà thảo mộc mix', 'Đồ uống kèm trà', 'Ấm trà', 'Set quà tặng'];
            const seen = new Map<string, PublicCategoryItem>();
            for (const name of defaultOrder) {
              const slug = this.slugify(name);
              seen.set(slug, { _id: slug, code: '', name, slug });
            }
            for (const p of products || []) {
              const name = String(p.category || '').trim();
              const slug = this.slugify(p.categorySlug || name);
              if (name && name !== 'Chưa phân loại' && slug && !seen.has(slug)) {
                seen.set(slug, { _id: slug, code: '', name, slug });
              }
            }
            return {
              mainCategories: Array.from(seen.values()),
              benefits: [
                { label: 'Thanh lọc – Mát gan', slug: 'thanh-loc-mat-gan', values: ['thanh-loc', 'mat-gan'], parentSlugs: ['tra-thao-moc', 'tra-thao-moc-mix'] },
                { label: 'Dưỡng nhan – Cân bằng nội tiết', slug: 'duong-nhan-can-bang-noi-tiet', values: ['duong-nhan', 'can-bang-noi-tiet'], parentSlugs: ['tra-thao-moc', 'tra-thao-moc-mix'] },
                { label: 'Thanh tâm – Dưỡng thần', slug: 'thanh-tam-duong-than', values: ['thanh-tam', 'duong-than'], parentSlugs: ['tra-thao-moc', 'tra-thao-moc-mix'] },
                { label: 'Giảm stress – Ngủ ngon', slug: 'giam-stress-ngu-ngon', values: ['giam-stress', 'ngu-ngon'], parentSlugs: ['tra-thao-moc', 'tra-thao-moc-mix'] },
                { label: 'Bổ khí huyết – Dưỡng sinh', slug: 'bo-khi-huyet-duong-sinh', values: ['bo-khi-huyet', 'duong-sinh'], parentSlugs: ['tra-thao-moc', 'tra-thao-moc-mix'] },
              ],
            };
          })
        )
      )
    );
  }

  private slugify(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
