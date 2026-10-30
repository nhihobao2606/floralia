import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule, convertToParamMap } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProductDetail } from './product-detail';
import { ProductService } from '../services/product-service';
import { ReviewService } from '../services/review-service';
import { CartService } from '../services/cart-service';

describe('ProductDetail', () => {
  let component: ProductDetail;
  let fixture: ComponentFixture<ProductDetail>;
  let scrollToSpy: ReturnType<typeof vi.fn>;
  let reviewServiceMock: {
    ratingUpdates: Subject<any>;
    getReviews: ReturnType<typeof vi.fn>;
    updateProductRating: ReturnType<typeof vi.fn>;
    createReview: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    scrollToSpy = vi.fn();
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: scrollToSpy });
    const values = new Map<string, string>();
    const storage: Storage = {
      get length() { return values.size; },
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => Array.from(values.keys())[index] ?? null,
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, String(value)),
    };
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage });
    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
    Object.defineProperty(window, 'sessionStorage', { configurable: true, value: storage });
    localStorage.clear();
    const products = [
      {
        _id: 'product-1',
        sku: 'TEA-1',
        slug: 'test-product',
        name: 'Trà thử nghiệm',
        price: 120000,
        oldPrice: 150000,
        stock: 8,
        isActive: true,
        categorySlug: 'tra-thao-moc',
        variants: [
          { sku: 'TEA-1-100G', label: 'Hộp 100g', price: 100000, oldPrice: 120000, stock: 4, isDefault: true },
          { sku: 'TEA-1-200G', label: 'Hộp 200g', price: 180000, oldPrice: 210000, stock: 6, isDefault: false },
        ],
        thumbnail: 'TEA-1_THUMB',
        images: ['TEA-1_IMG_1', 'TEA-1_IMG_2'],
      },
      {
        _id: 'product-2',
        sku: 'TEA-2',
        slug: 'related-tea',
        name: 'Trà liên quan',
        price: 80000,
        stock: 5,
        isActive: true,
        categorySlug: 'tra-thao-moc',
        variants: [],
      },
    ];
    reviewServiceMock = {
      ratingUpdates: new Subject(),
      getReviews: vi.fn(() => of([{
        productSku: 'TEA-1',
        userName: 'Người mua',
        rating: 5,
        comment: 'Trà thơm, đóng gói cẩn thận.',
      }])),
      updateProductRating: vi.fn(),
      createReview: vi.fn((review) => of({
        ...review,
        userName: 'Thương Trương',
        userAvatar: 'data:image/png;base64,avatar',
        createdAt: new Date(),
        isApproved: true,
      })),
    };
    await TestBed.configureTestingModule({
      declarations: [ProductDetail],
      imports: [CommonModule, RouterModule.forRoot([])],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ slug: 'test-product' })) },
        },
        {
          provide: ProductService,
          useValue: {
            getAll: () => of(products),
            getCachedProducts: () => products,
          },
        },
        { provide: ReviewService, useValue: reviewServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function signInForReviewTests(): void {
    localStorage.setItem('currentUser', JSON.stringify({
      id: 'user-1',
      fullName: 'Thương Trương',
      avatar: 'data:image/png;base64,avatar',
    }));
    localStorage.setItem('token', 'valid-test-token');
    component.syncReviewAccount();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('scrolls to the top when the product detail route loads', () => {
    expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
  });

  it('shows a related product immediately and navigates to its detail route', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const related = {
      sku: 'TEA-2',
      slug: 'related-tea',
      name: 'Trà liên quan',
      variants: [],
    };
    const event = new MouseEvent('click', { cancelable: true });

    component.navigateToRelatedProduct(event, related);

    expect(event.defaultPrevented).toBe(true);
    expect(component.product?.slug).toBe('related-tea');
    expect(navigateSpy).toHaveBeenCalledWith(['/product', 'related-tea'], {
      state: { product: related, products: component.allProducts },
    });
  });

  it('updates the displayed price and stock when a variant is selected', () => {
    expect(component.currentPrice).toBe(100000);
    component.selectVariant(component.product!.variants![1]);
    expect(component.currentPrice).toBe(180000);
    expect(component.currentStock).toBe(6);
  });

  it('skips the duplicate thumbnail and supports previous/next gallery navigation', () => {
    expect(component.galleryImages).toHaveLength(2);
    const firstImage = component.galleryImages[0];
    const secondImage = component.galleryImages[1];

    component.moveGalleryImage(1);
    expect(component.activeImage).toBe(secondImage);
    component.moveGalleryImage(1);
    expect(component.activeImage).toBe(firstImage);
    component.moveGalleryImage(-1);
    expect(component.activeImage).toBe(secondImage);
  });

  it('loads the product review', () => {
    expect(component.reviews).toHaveLength(1);
    expect(component.reviews[0].comment).toBe('Trà thơm, đóng gói cẩn thận.');
    expect(component.displayedRatingCount).toBe(1);
    expect(component.product?.ratingAverage).toBe(5);
    expect(component.product?.ratingCount).toBe(1);
    expect(reviewServiceMock.updateProductRating).toHaveBeenCalledWith('TEA-1', 5, 1);
  });

  it('rounds average ratings to one decimal place', () => {
    component.reviews = [
      { productSku: 'TEA-1', userName: 'A', rating: 5, comment: 'Tốt' },
      { productSku: 'TEA-1', userName: 'B', rating: 5, comment: 'Tốt' },
      { productSku: 'TEA-1', userName: 'C', rating: 4, comment: 'Ổn' },
    ];
    component.reviewsLoaded = true;
    fixture.detectChanges();

    expect(component.displayedRatingAverage).toBe(4.7);
    expect(component.displayedRatingAverageLabel).toBe('4.7');
    expect(component.displayedRoundedRating).toBe(5);
  });

  it('shows related products on the initial product detail load', () => {
    expect(component.relatedProducts).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Sản phẩm bạn có thể thích');
    expect(fixture.nativeElement.textContent).toContain('Trà liên quan');
    expect(fixture.nativeElement.textContent).not.toContain('Đang tải sản phẩm gợi ý');
  });

  it('saves and immediately displays a new review', () => {
    signInForReviewTests();
    component.reviewRating = 4;
    component.reviewComment = 'Trà thơm và dễ uống.';
    const event = new Event('submit', { cancelable: true });

    component.submitReview(event);

    expect(event.defaultPrevented).toBe(true);
    expect(component.reviews).toHaveLength(2);
    expect(component.reviews[0]).toMatchObject({
      productSku: 'TEA-1',
      userName: 'Thương Trương',
      userAvatar: 'data:image/png;base64,avatar',
      rating: 4,
      comment: 'Trà thơm và dễ uống.',
      isApproved: true,
    });
    expect(component.reviewSubmitMessage).toBe('Cảm ơn bạn đã gửi đánh giá!');
    expect(component.reviewComment).toBe('');
    expect(component.reviewRating).toBe(0);
    expect(component.displayedRatingAverage).toBe(4.5);
    expect(component.displayedRatingCount).toBe(2);
    expect(reviewServiceMock.updateProductRating).toHaveBeenLastCalledWith('TEA-1', 4.5, 2);
  });

  it('shows the review before the API responds and keeps the form collapsed', () => {
    signInForReviewTests();
    const pendingSave = new Subject<any>();
    reviewServiceMock.createReview.mockReturnValue(pendingSave);
    component.reviewRating = 5;
    component.reviewComment = 'Rất thơm.';
    const event = new Event('submit', { cancelable: true });

    component.submitReview(event);
    fixture.detectChanges();

    expect(component.reviews[0]).toMatchObject({
      userName: 'Thương Trương',
      rating: 5,
      comment: 'Rất thơm.',
    });
    expect(component.reviewFormOpen).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Đang gửi...');
    expect(fixture.nativeElement.querySelector('.review-form')).toBeNull();

    pendingSave.next({
      productSku: 'TEA-1',
      userName: 'Thương Trương',
      rating: 5,
      comment: 'Rất thơm.',
      userAvatar: 'data:image/png;base64,avatar',
      createdAt: new Date(),
      isApproved: true,
    });
    pendingSave.complete();
  });

  it('opens the review form only after activating the review prompt', () => {
    signInForReviewTests();
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLButtonElement>;
    const reviewTab = tabs[2];
    reviewTab.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.review-form')).toBeNull();

    const reviewPrompt = fixture.nativeElement.querySelector('.review-form-trigger') as HTMLButtonElement;
    reviewPrompt.click();
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('.review-form') as HTMLFormElement;
    expect(form).not.toBeNull();
    expect(form.querySelector('input')).toBeNull();
    expect(form.querySelector('textarea')).not.toBeNull();
    expect(reviewPrompt.textContent).toContain('Bình luận dưới tên Thương Trương');
  });

  it('redirects guests to login instead of opening the review form', () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    component.syncReviewAccount();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();

    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLButtonElement>;
    tabs[2].click();
    fixture.detectChanges();
    const reviewPrompt = fixture.nativeElement.querySelector('.review-form-trigger') as HTMLButtonElement;
    expect(reviewPrompt.textContent?.trim()).toBe('Bình luận');

    reviewPrompt.click();

    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
    expect(component.reviewFormOpen).toBe(false);
    expect(fixture.nativeElement.querySelector('.review-form')).toBeNull();
  });

  it('removes an optimistic review and reopens the form if saving fails', () => {
    signInForReviewTests();
    reviewServiceMock.createReview.mockReturnValue(
      throwError(() => new Error('network error')),
    );
    component.reviewRating = 4;
    component.reviewComment = 'Đánh giá thử.';

    component.submitReview(new Event('submit', { cancelable: true }));

    expect(component.reviews).toHaveLength(1);
    expect(component.displayedRatingAverage).toBe(5);
    expect(component.displayedRatingCount).toBe(1);
    expect(reviewServiceMock.updateProductRating).toHaveBeenLastCalledWith('TEA-1', 5, 1);
    expect(component.reviewFormOpen).toBe(true);
    expect(component.reviewSubmitError).toBe('Chưa gửi được đánh giá. Vui lòng thử lại.');
    expect(component.reviews).toHaveLength(1);
  });

  it('adds the selected variant to the shared guest cart', () => {
    let cartUpdated = false;
    const onCartUpdated = () => { cartUpdated = true; };
    window.addEventListener('cart-updated', onCartUpdated);

    component.addToCart();

    const cart = JSON.parse(localStorage.getItem('cart_guest') || '[]');
    expect(cart).toHaveLength(1);
    expect(cart[0].variantSku).toBe('TEA-1-100G');
    expect(cart[0].price).toBe(100000);
    expect(cartUpdated).toBe(true);
    expect(TestBed.inject(CartService).cartMessage()).toBe('Đã thêm sản phẩm vào giỏ hàng.');

    window.removeEventListener('cart-updated', onCartUpdated);
  });

  it('lets the user choose a related-product variant and quantity before adding it', () => {
    const related = {
      _id: 'product-2',
      sku: 'TEA-2',
      slug: 'related-tea',
      name: 'Trà liên quan',
      stock: 5,
      variants: [
        { sku: 'TEA-2-50G', label: 'Gói 50g', price: 60000, stock: 5 },
        { sku: 'TEA-2-100G', label: 'Hộp 100g', price: 110000, stock: 3 },
      ],
    };

    component.openQuickAdd(related);
    expect(component.quickAdd?.variant?.sku).toBe('TEA-2-50G');
    component.selectQuickAddVariant(related.variants[1]);
    component.changeQuickAddQuantity(1);
    component.addQuickAddToCart();

    const cart = JSON.parse(localStorage.getItem('cart_guest') || '[]');
    expect(cart).toHaveLength(1);
    expect(cart[0].productId).toBe('product-2');
    expect(cart[0].variantSku).toBe('TEA-2-100G');
    expect(cart[0].quantity).toBe(2);
    expect(cart[0].price).toBe(110000);
    expect(component.quickAdd).toBeNull();
  });

  it('adds a related product without variants at its product-level price', () => {
    component.openQuickAdd({
      _id: 'product-3',
      sku: 'TEA-3',
      slug: 'simple-tea',
      name: 'Trà không phân loại',
      price: 75000,
      stock: 2,
    });
    component.addQuickAddToCart();

    const cart = JSON.parse(localStorage.getItem('cart_guest') || '[]');
    expect(cart[0].variantSku).toBe('');
    expect(cart[0].price).toBe(75000);
  });

  it('toggles and persists the current product favorite', () => {
    component.toggleFavorite();

    expect(component.favorite).toBe(true);
    expect(JSON.parse(localStorage.getItem('wishlist') || '[]')).toContain('product-1');

    component.toggleFavorite();
    expect(component.favorite).toBe(false);
    expect(JSON.parse(localStorage.getItem('wishlist') || '[]')).not.toContain('product-1');
  });
});
