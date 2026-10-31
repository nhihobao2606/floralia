import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterModule } from '@angular/router';
import { PromotionsComponent } from './promotions';
import { ProductService } from '../../services/product-service';
import { CartService } from '../../services/cart-service';

describe('PromotionsComponent', () => {
  let component: PromotionsComponent;
  let fixture: ComponentFixture<PromotionsComponent>;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();

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
    localStorage.setItem('currentUser', JSON.stringify({ id: 'user-1' }));
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

  it('should add an in-stock promotional product to the cart and notify the header', () => {
    const product: any = {
      sku: 'TEA-1',
      slug: 'tra-hoa',
      name: 'Trà hoa',
      stock: 0,
      variants: [
        { sku: 'TEA-1-100G', label: '100g', price: 210000, stock: 2, isDefault: true },
      ],
      thumbnail: 'tea.jpg',
    };
    let cartUpdated = false;
    const onCartUpdated = () => { cartUpdated = true; };
    window.addEventListener('cart-updated', onCartUpdated);

    component.addToCart(product);

    const cart = TestBed.inject(CartService).getCart();
    expect(cart).toHaveLength(1);
    expect(cart[0].variantSku).toBe('TEA-1-100G');
    expect(cart[0].quantity).toBe(1);
    expect(cartUpdated).toBe(true);

    window.removeEventListener('cart-updated', onCartUpdated);
  });

  it('should disable adding an out-of-stock product', () => {
    const product: any = { sku: 'TEA-2', stock: 0, variants: [] };
    expect(component.hasStock(product)).toBe(false);
  });
});
