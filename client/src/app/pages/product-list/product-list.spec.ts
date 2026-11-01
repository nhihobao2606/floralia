import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { of, Subject } from 'rxjs';
import { ProductListComponent } from './product-list';
import { ProductService } from '../../services/product-service';
import { ReviewService } from '../../services/review-service';
import { Products } from '../../classes/Products';

describe('ProductListComponent', () => {
  let component: ProductListComponent;
  let fixture: ComponentFixture<ProductListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule, FormsModule, RouterModule.forRoot([])],
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

  it('filters products by parent category and subcategory slugs', () => {
    component.products = [
      { categorySlug: 'tra-thao-moc', subCategory: 'Nguyên chất' },
      { categorySlug: 'tra-thao-moc', subCategory: 'Hỗn hợp' },
      { categorySlug: 'am-tra', subCategory: 'Ấm sứ' },
    ] as Products[];
    component.selectedCategory = 'tra-thao-moc';
    component.selectedSubCategory = 'nguyen-chat';

    component.applyFilters();

    expect(component.filteredProducts).toHaveLength(1);
    expect(component.filteredProducts[0].subCategory).toBe('Nguyên chất');
  });
});
