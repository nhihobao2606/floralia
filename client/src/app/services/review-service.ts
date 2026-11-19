import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { ProductService } from './product-service';

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
  rating: number;
  comment: string;
}

export interface ProductRatingUpdate {
  productSku: string;
  ratingAverage: number;
  ratingCount: number;
}

@Injectable({
  providedIn: 'root',
})
export class ReviewService {
  private readonly apiUrl = 'https://floralia-1.onrender.com/products';
  readonly ratingUpdates = new Subject<ProductRatingUpdate>();

  constructor(
    private readonly http: HttpClient,
    private readonly productService: ProductService,
  ) {}

  getReviews(sku: string): Observable<ProductReview[]> {
    return this.http.get<ProductReview[]>(
      `${this.apiUrl}/reviews/${encodeURIComponent(sku)}`,
    );
  }

  createReview(review: NewProductReview): Observable<ProductReview> {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    return this.http.post<ProductReview>(
      `${this.apiUrl}/reviews`,
      review,
      token ? { headers: { Authorization: `Bearer ${token}` } } : {},
    );
  }

  updateProductRating(productSku: string, ratingAverage: number, ratingCount: number): void {
    for (const product of this.productService.getCachedProducts() ?? []) {
      if (product.sku === productSku) {
        product.ratingAverage = ratingAverage;
        product.ratingCount = ratingCount;
      }
    }
    this.ratingUpdates.next({ productSku, ratingAverage, ratingCount });
  }
}

