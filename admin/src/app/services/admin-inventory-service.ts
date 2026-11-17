import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';

export interface InventoryProduct {
  _id?: string;
  sku: string;
  name: string;
  category?: string;
  price: number;
  stock: number;
  imageUrl?: string | null;
  variants?: InventoryProductVariant[];
}

export interface InventoryProductVariant {
  sku: string;
  label: string;
  stock: number;
  price?: number;
  isDefault?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminInventoryService {
  private readonly apiUrl = 'http://localhost:3002/products/admin/inventory';
  private readonly catalogUrl = 'http://localhost:3002/products';

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<InventoryProduct[]> {
    return forkJoin({
      inventory: this.http.get<InventoryProduct[]>(this.apiUrl, { headers: this.authHeaders() }),
      catalog: this.http.get<InventoryProduct[]>(this.catalogUrl),
    }).pipe(map(({ inventory, catalog }) => {
      const catalogBySku = new Map((catalog || []).map(product => [product.sku, product]));
      return (inventory || []).map(product => {
        const catalogProduct = catalogBySku.get(product.sku);
        if (!catalogProduct?.variants?.length) {
          return {
            ...product,
            variants: [{ sku: product.sku, label: 'Tiêu chuẩn', stock: product.stock }],
          };
        }
        const inventoryVariants = new Map((product.variants || []).map(variant => [variant.sku, variant]));
        return {
          ...product,
          variants: catalogProduct.variants.map(variant => ({
            ...variant,
            ...inventoryVariants.get(variant.sku),
            label: variant.label,
            sku: variant.sku,
          })),
        };
      });
    }));
  }

  setStock(sku: string, stock: number, reason = '', productSku?: string, variantLabel?: string, recordAdjustment = false): Observable<{ success: boolean; product: InventoryProduct }> {
    const body = { stock, reason, recordAdjustment, ...(productSku ? { productSku } : {}), ...(variantLabel ? { variantLabel } : {}) };
    return this.http.patch<{ success: boolean; product: InventoryProduct }>(
      `${this.apiUrl}/${encodeURIComponent(sku)}`,
      body,
      { headers: this.authHeaders() }
    );
  }

  bulkAdjust(items: Array<{ sku: string; stock: number; reason: string; productSku: string; variantLabel: string }>): Observable<{ success: boolean; batchCode: string; products: InventoryProduct[] }> {
    return this.http.patch<{ success: boolean; batchCode: string; products: InventoryProduct[] }>(
      `${this.apiUrl}/adjust-bulk`, { items }, { headers: this.authHeaders() }
    );
  }

  receiveStock(items: Array<{ sku: string; stock: number; productSku?: string; variantLabel?: string }>, reason = ''): Observable<{ success: boolean; products: InventoryProduct[] }> {
    return forkJoin(items.map(item => this.setStock(item.sku, item.stock, reason, item.productSku, item.variantLabel))).pipe(
      map(responses => ({
        success: responses.every(response => response.success),
        products: responses.map((response, index) => ({ ...response.product, sku: items[index].sku }))
      }))
    );
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
    return new HttpHeaders({ Authorization: `Bearer ${token || ''}` });
  }
}
