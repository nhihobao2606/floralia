import { TestBed } from '@angular/core/testing';
import { Router, RouterModule } from '@angular/router';
import { vi } from 'vitest';
import { ProductNavigationService } from './product-navigation-service';

describe('ProductNavigationService', () => {
  let service: ProductNavigationService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([])],
    });
    service = TestBed.inject(ProductNavigationService);
    router = TestBed.inject(Router);
  });

  it('builds a detail route from the product slug', () => {
    expect(service.detailRoute('herbal-tea')).toEqual(['/product', 'herbal-tea']);
    expect(service.detailUrl('herbal-tea')).toBe('/product/herbal-tea');
    expect(service.detailRoute('')).toBeNull();
    expect(service.detailUrl('')).toBeNull();
  });

  it('builds a detail route from category and product slugs', () => {
    const product = {
      slug: 'hong-diep-tra',
      categorySlug: 'tra-thao-moc',
      subCategory: 'Trà hoa',
    };

    expect(service.detailRoute(product)).toEqual(['/', 'tra-thao-moc', 'hong-diep-tra']);
    expect(service.detailUrl(product)).toBe('/tra-thao-moc/hong-diep-tra');
  });

  it('navigates to a product detail page with shared product state', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const product = {
      slug: 'herbal-tea',
      sku: 'TEA-1',
      categorySlug: 'tra-thao-moc',
      subCategory: 'Trà hoa',
    };
    const products = [product];

    await service.navigateToProduct(product, products);

    expect(navigate).toHaveBeenCalledWith(['/', 'tra-thao-moc', 'herbal-tea'], {
      state: { product, products },
    });
  });
});
