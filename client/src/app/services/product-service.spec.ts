import { TestBed } from '@angular/core/testing';
import { ProductService } from './product-service';

describe('ProductService', () => {
  let service: ProductService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProductService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('publishes product rating updates for list views', () => {
    const updates: Array<{ productSku: string; ratingAverage: number; ratingCount: number }> = [];
    const subscription = service.ratingUpdates.subscribe((update) => updates.push(update));

    service.updateProductRating('TEA-1', 4.7, 3);

    expect(updates).toEqual([{ productSku: 'TEA-1', ratingAverage: 4.7, ratingCount: 3 }]);
    subscription.unsubscribe();
  });
});
