import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

export interface ProductNavigationItem {
  slug?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class ProductNavigationService {
  constructor(private readonly router: Router) {}

  detailRoute(slug: string | null | undefined): string[] | null {
    return slug ? ['/product', slug] : null;
  }

  detailUrl(slug: string | null | undefined): string | null {
    const route = this.detailRoute(slug);
    return route ? this.router.serializeUrl(this.router.createUrlTree(route)) : null;
  }

  navigateToProduct(
    product: ProductNavigationItem,
    products?: ProductNavigationItem[],
  ): Promise<boolean> {
    const route = this.detailRoute(product.slug);
    if (!route) return Promise.resolve(false);

    return this.router.navigate(route, {
      state: {
        product,
        ...(products ? { products } : {}),
      },
    });
  }
}
