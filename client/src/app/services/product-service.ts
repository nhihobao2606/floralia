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

  constructor(private http: HttpClient) {}

  getAll(): Observable<Products[]> {
    return this.getProducts();
  }

  getCachedProducts(): Products[] | null {
    return this.productsCache;
  }

  // Lấy danh sách sản phẩm
  getProducts(): Observable<Products[]> {
    if (this.productsCache && Date.now() < this.productsCacheExpiresAt) {
      return of(this.productsCache);
    }

    if (this.productsRequest) {
      return this.productsRequest;
    }

    this.productsRequest = this.http.get<Products[]>(this.apiUrl).pipe(
      tap((products) => {
        this.productsCache = products;
        this.productsCacheExpiresAt = Date.now() + 30_000;
      }),
      catchError((error: unknown) => {
        return throwError(() => error);
      }),
      finalize(() => {
        this.productsRequest = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.productsRequest;
  }

  // Lấy chi tiết 1 sản phẩm theo Slug
  getProductBySlug(slug: string): Observable<Products> {
    return this.http.get<Products>(`${this.apiUrl}/slug/${slug}`);
  }
}
