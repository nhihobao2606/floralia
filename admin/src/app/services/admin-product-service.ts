import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';

export type ProductStatus = 'active' | 'inactive' | 'out-of-stock';

export interface AdminProductVariant {
  sku: string;
  label: string;
  price: number;
  oldPrice: number;
  stock: number;
  isDefault: boolean;
  type?: string;
  weightGram?: number | null;
  packCount?: number | null;
  flavorCount?: number | null;
}

export interface AdminProduct {
  _id: string;
  sku: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  categorySlug: string;
  subCategory: string;
  status: ProductStatus;
  isActive?: boolean;
  price: number;
  oldPrice: number;
  minPrice?: number;
  discount: number;
  stock: number;
  sold: number;
  thumbnail: string;
  images: string[];
  imageUrl?: string | null;
  description: string;
  story: string;
  usage: string[];
  instructions: string[];
  benefits: string[];
  tags: string[];
  variants: AdminProductVariant[];
  variantLabel?: string;
  hasVariants?: boolean;
  weightGram?: number;
  packCount?: number;
  flavorCount?: number;
  featured: boolean;
  isSale: boolean;
  [key: string]: unknown;
}

export interface ProductImageUpload {
  dataUrl: string;
  name: string;
  type: string;
}

export interface ProductFormValue {
  sku: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  categorySlug: string;
  subCategory: string;
  status: ProductStatus;
  isActive: boolean;
  price: number;
  oldPrice: number;
  minPrice: number;
  discount: number;
  stock: number;
  thumbnail: string;
  images: string[];
  description: string;
  story: string;
  usage: string[];
  instructions: string[];
  benefits: string[];
  tags: string[];
  variants: AdminProductVariant[];
  variantLabel: string;
  hasVariants: boolean;
  weightGram: number;
  packCount: number;
  flavorCount: number;
  featured: boolean;
  isSale: boolean;
  isMix: boolean;
  flavorNote: string;
  color: string;
  shelfLifeMonths: number;
  imageUploads: ProductImageUpload[];
  replaceImages: boolean;
  [key: string]: unknown;
}

export interface AdminProductStats {
  total: number;
  active: number;
  inactive: number;
}

export interface AdminProductList {
  data: AdminProduct[];
  total: number;
  page: number;
  limit: number;
  stats: AdminProductStats;
  categories: string[];
}

@Injectable({ providedIn: 'root' })
export class AdminProductService {
  private readonly apiUrl = 'https://floralia-1.onrender.com/api/admin/products';
  private productListCache: AdminProductList | null = null;

  constructor(private readonly http: HttpClient) {}

  getCachedList(): AdminProductList | null { return this.productListCache; }
  getCachedProduct(id: string): AdminProduct | undefined { return this.productListCache?.data.find(product => product._id === id); }
  cacheList(list: AdminProductList): void { this.productListCache = list; }

  upsertCachedProduct(product: AdminProduct): void {
    if (!this.productListCache) return;
    const data = [...this.productListCache.data];
    const index = data.findIndex(item => item._id === product._id);
    if (index >= 0) data[index] = product;
    else data.unshift(product);
    const total = Math.max(this.productListCache.total, data.length);
    this.productListCache = {
      ...this.productListCache,
      data,
      total,
      categories: [...new Set([...this.productListCache.categories, product.category].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')),
      stats: {
        total,
        active: data.filter(item => item.status === 'active').length,
        inactive: data.filter(item => item.status === 'out-of-stock' || item.status === 'inactive').length,
      },
    };
  }

  removeCachedProduct(id: string): void {
    if (!this.productListCache) return;
    const data = this.productListCache.data.filter(product => product._id !== id);
    this.productListCache = { ...this.productListCache, data, total: Math.max(0, this.productListCache.total - 1) };
  }

  getAll(options: { page: number; limit: number; query: string; category: string; status: string }): Observable<AdminProductList> {
    let params = new HttpParams()
      .set('page', options.page)
      .set('limit', options.limit)
      .set('category', options.category)
      .set('status', options.status);
    if (options.query.trim()) params = params.set('q', options.query.trim());
    return this.http.get<AdminProductList>(this.apiUrl, { headers: this.authHeaders(), params }).pipe(timeout({ first: 15000 }));
  }

  getById(id: string): Observable<AdminProduct> {
    return this.http.get<AdminProduct>(`${this.apiUrl}/${encodeURIComponent(id)}`, { headers: this.authHeaders() });
  }

  create(product: ProductFormValue): Observable<AdminProduct> {
    return this.http.post<AdminProduct>(this.apiUrl, product, { headers: this.authHeaders() });
  }

  update(id: string, product: ProductFormValue): Observable<AdminProduct> {
    return this.http.put<AdminProduct>(`${this.apiUrl}/${encodeURIComponent(id)}`, product, { headers: this.authHeaders() });
  }

  delete(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/${encodeURIComponent(id)}`, { headers: this.authHeaders() });
  }

  deleteMany(ids: string[]): Observable<{ success: boolean; deletedCount: number }> {
    return this.http.delete<{ success: boolean; deletedCount: number }>(`${this.apiUrl}/bulk`, { headers: this.authHeaders(), body: { ids } });
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
    return new HttpHeaders({ Authorization: `Bearer ${token || ''}` });
  }
}

