import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, finalize, of, shareReplay, tap, throwError } from 'rxjs';
import { Products } from '../classes/Products';

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

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = 'http://localhost:3002/products';
  private productsCache: Products[] | null = null;
  private productsCacheExpiresAt = 0;
  private productsRequest: Observable<Products[]> | null = null;
  private cacheVersion = 0;

  constructor(private http: HttpClient) {}

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
          this.productsCacheExpiresAt = Date.now() + 30_000;
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

  validateVoucher(code: string, subtotal: number, items: Array<{ sku: string; quantity: number; variant?: string }> = []): Observable<{ success: boolean; voucher: ValidatedVoucher }> {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    return this.http.post<{ success: boolean; voucher: ValidatedVoucher }>(
      'http://localhost:3002/api/vouchers/validate',
      { code, subtotal, items },
      { headers: new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {}) }
    );
  }
}
