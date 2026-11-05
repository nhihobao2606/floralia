import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
  private readonly onWindowFocus = () => {
    this.invalidateCache();
    this.changesSubject.next();
  };

  readonly productsChanges$: Observable<void> = new Observable<void>((subscriber) => {
    this.ensureEventStream();
    const sub = this.changesSubject.subscribe(subscriber);
    return () => sub.unsubscribe();
  });

  constructor(private http: HttpClient, private ngZone: NgZone) {
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', this.onWindowFocus);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this.onWindowFocus);
    }
    this.eventSource?.close();
    this.eventSource = null;
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
    if (this.productsCache && Date.now() < this.productsCacheExpiresAt) {
      return of(this.productsCache);
    }

    if (this.productsRequest) {
      return this.productsRequest;
    }

    const requestVersion = this.cacheVersion;
    let request: Observable<Products[]>;
    request = this.http.get<Products[]>(this.apiUrl).pipe(
      tap((products) => {
        if (requestVersion === this.cacheVersion) {
          this.productsCache = products;
          this.productsCacheExpiresAt = Date.now() + 1_000;
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
    return this.http.get<Products>(`${this.apiUrl}/slug/${slug}`);
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
