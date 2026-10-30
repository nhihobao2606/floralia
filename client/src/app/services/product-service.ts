import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, catchError, finalize, of, shareReplay, tap, throwError } from 'rxjs';
import { Products } from '../classes/Products';

export interface ProductReview {
  productSku?: string;
  userName: string;
  userAvatar?: string | null;
  rating: number;
  comment: string;
  createdAt?: string | Date;
  isApproved?: boolean;
}

export interface NewProductReview {
  productSku: string;
  userName: string;
  rating: number;
  comment: string;
}

export interface ProductRatingUpdate {
  productSku: string;
  ratingAverage: number;
  ratingCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = 'http://localhost:3002/products';
  private productsCache: Products[] | null = null;
  private productsCacheExpiresAt = 0;
  private productsRequest: Observable<Products[]> | null = null;
  readonly ratingUpdates = new Subject<ProductRatingUpdate>();

  constructor(private http: HttpClient) {}

  getAll(): Observable<Products[]> {
    return this.getProducts();
  }

  getCachedProducts(): Products[] | null {
    return this.productsCache;
  }

  updateProductRating(productSku: string, ratingAverage: number, ratingCount: number): void {
    const update = { productSku, ratingAverage, ratingCount };
    for (const product of this.productsCache ?? []) {
      if (product.sku === productSku) {
        product.ratingAverage = ratingAverage;
        product.ratingCount = ratingCount;
      }
    }
    this.ratingUpdates.next(update);
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

  getReviews(sku: string): Observable<ProductReview[]> {
    return this.http.get<ProductReview[]>(
      `${this.apiUrl}/reviews/${encodeURIComponent(sku)}`,
    );
  }

  createReview(review: NewProductReview): Observable<ProductReview> {
    return this.http.post<ProductReview>(`${this.apiUrl}/reviews`, review);
  }
}
