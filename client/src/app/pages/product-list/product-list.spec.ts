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
});
