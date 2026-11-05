import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ProductService } from './product-service';

describe('ProductService', () => {
  let service: ProductService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(ProductService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('fetches updated product data after invalidating the cache', () => {
    let firstSoldCount = 0;
    service.getProducts().subscribe((products) => {
      firstSoldCount = products[0].sold;
    });
    httpMock.expectOne('http://localhost:3002/products').flush([{ sku: 'TEA-1', sold: 4 }]);

    service.invalidateCache();

    let refreshedSoldCount = 0;
    service.getProducts().subscribe((products) => {
      refreshedSoldCount = products[0].sold;
    });
    httpMock.expectOne('http://localhost:3002/products').flush([{ sku: 'TEA-1', sold: 5 }]);

    expect(firstSoldCount).toBe(4);
    expect(refreshedSoldCount).toBe(5);
  });
});
