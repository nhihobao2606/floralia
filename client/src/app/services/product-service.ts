import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, finalize, of, shareReplay, tap, throwError } from 'rxjs';
import { Products } from '../classes/Products';

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
    return this.http.get<Products>(`${this.apiUrl}/slug/${slug}`);
  }
}
