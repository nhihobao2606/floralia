import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { of, Subject } from 'rxjs';
import { ProductListComponent } from './product-list';
import { ProductService } from '../../services/product-service';
import { ReviewService } from '../../services/review-service';

describe('ProductListComponent', () => {
  let component: ProductListComponent;
  let fixture: ComponentFixture<ProductListComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [CommonModule, RouterModule.forRoot([])],
      declarations: [ProductListComponent],
      providers: [
        { provide: ProductService, useValue: { getProducts: () => of([]) } },
        { provide: ReviewService, useValue: { ratingUpdates: new Subject() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('filters products by the benefit selected from the homepage', () => {
    component.products = [
      {
        sku: 'TEA-1',
        slug: 'tea-1',
        name: 'Trà thanh lọc',
        category: 'Trà thảo mộc',
        categorySlug: 'tra-thao-moc',
        price: 100000,
        benefits: ['thanh-loc'],
        tags: [],
      } as any,
      {
        sku: 'TEA-2',
        slug: 'tea-2',
        name: 'Trà dưỡng nhan',
        category: 'Trà thảo mộc',
        categorySlug: 'tra-thao-moc',
        price: 100000,
        benefits: ['duong-nhan'],
        tags: [],
      } as any,
    ];
    component.selectedTag = 'Thanh lọc – Mát gan';

    component.applyFilters();

    expect(component.filteredProducts.map(product => product.sku)).toEqual(['TEA-1']);
  });
});
