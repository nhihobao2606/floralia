import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

export interface ProductNavigationItem {
  slug?: string | null;
  categorySlug?: string | null;
  subCategory?: string | null;
  subCategorySlug?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class ProductNavigationService {
  constructor(private readonly router: Router) {}

  detailRoute(product: ProductNavigationItem | string | null | undefined): string[] | null {
    const item = typeof product === 'string' ? { slug: product } : product;
    if (!item?.slug) return null;

    const categorySlug = item.categorySlug?.trim();
    return categorySlug
      ? ['/', 'products', categorySlug, item.slug]
      : ['/products', item.slug];
  }

  detailUrl(product: ProductNavigationItem | string | null | undefined): string | null {
    const route = this.detailRoute(product);
    return route ? this.router.serializeUrl(this.router.createUrlTree(route)) : null;
  }

  navigateToProduct(
    product: ProductNavigationItem,
    products?: ProductNavigationItem[],
    selectedVariantSku?: string,
  ): Promise<boolean> {
    const route = this.detailRoute(product);
    if (!route) return Promise.resolve(false);

    return this.router.navigate(route, {
      state: {
        product,
        ...(products ? { products } : {}),
        ...(selectedVariantSku ? { selectedVariantSku } : {}),
      },
    });
  }
}
