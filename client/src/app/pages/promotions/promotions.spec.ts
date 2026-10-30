import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterModule } from '@angular/router';
import { PromotionsComponent } from './promotions';
import { ProductService } from '../../services/product-service';

describe('PromotionsComponent', () => {
  let component: PromotionsComponent;
  let fixture: ComponentFixture<PromotionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PromotionsComponent],
      imports: [CommonModule, FormsModule, HttpClientTestingModule, RouterModule.forRoot([])],
      providers: [ProductService],
      schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(PromotionsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle wishlist', () => {
    const mockProduct: any = { _id: 'prod123', name: 'Trà hoa cúc', price: 100000 };
    component.toggleWish(mockProduct);
    expect(component.isWished(mockProduct)).toBe(true);
    component.toggleWish(mockProduct);
    expect(component.isWished(mockProduct)).toBe(false);
  });

  it('should save coupon and set copied status', () => {
    component.saveCoupon('FLORA10');
    expect(component.isCouponSaved('FLORA10')).toBe(true);
    expect(component.copiedCode()).toBe('FLORA10');
  });
});
