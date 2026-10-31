import { ChangeDetectorRef, Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProductService } from '../../services/product-service';
import { NewProductReview, ProductReview, ReviewService } from '../../services/review-service';
import { CartService } from '../../services/cart-service';
import { WishlistService } from '../../services/wishlist-service';
import { ProductNavigationService } from '../../services/product-navigation-service';
import { Products } from '../../classes/Products';

interface ProductVariant {
  sku: string;
  label: string;
  type?: string;
  weightGram?: number;
  packCount?: number | null;
  flavorCount?: number | null;
  price: number;
  oldPrice?: number;
  stock: number;
  isDefault?: boolean;
}

interface ProductDetails extends Omit<Partial<Products>, 'variants'> {
  _id?: string;
  id?: string;
  subCategory?: string;
  variantLabel?: string;
  brand?: string;
  color?: string;
  weightGram?: number;
  shelfLifeMonths?: number;
  flavorNote?: string;
  status?: string;
  story?: string;
  usage?: string[];
  instructions?: string[];
  variants?: ProductVariant[];
  images?: string[];
  imageUrl?: string | null;
  isActive?: boolean;
  isMix?: boolean;
  reviewCount?: number;
}

interface QuickAddSelection {
  product: ProductDetails;
  variant: ProductVariant | null;
  quantity: number;
}

interface ReviewAccount {
  fullName: string;
  avatar?: string;
}

@Component({
  selector: 'app-product-detail',
  standalone: false,
  styleUrl: './product-detail.css',
  templateUrl: './product-detail.html',
})
export class ProductDetail implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private productLoadRequestId = 0;
  relatedProductsLoading = false;
  private reviewLoadRequestId = 0;
  private reviewSubmitRequestId = 0;

  product: ProductDetails | null = null;
  allProducts: ProductDetails[] = [];
  selectedVariant: ProductVariant | null = null;
  galleryImages: string[] = [];
  reviews: ProductReview[] = [];
  reviewsLoaded = false;
  reviewsLoading = false;
  reviewsError = '';
  reviewComment = '';
  reviewRating = 0;
  reviewAccount: ReviewAccount | null = null;
  reviewFormOpen = false;
  reviewSubmitting = false;
  reviewSubmitError = '';
  reviewSubmitMessage = '';
  activeImage = '';
  quantity = 1;
  activeTab: 'info' | 'detail' | 'review' = 'info';
  loading = true;
  errorMessage = '';
  quickAdd: QuickAddSelection | null = null;
  quickAddError = '';
  favorite = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly productService: ProductService,
    private readonly reviewService: ReviewService,
    readonly productNavigation: ProductNavigationService,
    readonly cartService: CartService,
    private readonly wishlistService: WishlistService,
  ) {}

  ngOnInit(): void {
    this.syncReviewAccount();
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const slug = params.get('slug');
        if (slug) {
          window.scrollTo(0, 0);
          this.loadProduct(slug);
        }
      });
  }

  @HostListener('window:auth-changed')
  @HostListener('window:storage')
  syncReviewAccount(): void {
    const rawUser = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!rawUser || !token) {
      this.reviewAccount = null;
      this.reviewFormOpen = false;
      return;
    }

    try {
      const user = JSON.parse(rawUser) as Partial<ReviewAccount>;
      this.reviewAccount = typeof user.fullName === 'string' && user.fullName.trim()
        ? { fullName: user.fullName.trim(), avatar: user.avatar || '' }
        : null;
    } catch (error) {
      console.error('Không đọc được thông tin tài khoản để đánh giá:', error);
      this.reviewAccount = null;
      this.reviewFormOpen = false;
    }
  }

  get canSubmitReview(): boolean {
    return Boolean(this.reviewAccount);
  }

  get reviewAvatar(): string {
    return this.reviewAccount?.avatar || '';
  }

  private loadProduct(slug: string): void {
    const requestId = ++this.productLoadRequestId;
    const navigationState = window.history.state as {
      product?: ProductDetails;
      products?: ProductDetails[];
    } | undefined;
    const navigationProduct = navigationState?.product;
    const navigationProducts = Array.isArray(navigationState?.products)
      ? navigationState.products
      : null;
    const cachedProducts = this.productService.getCachedProducts();
    const initialProduct = (navigationProduct?.slug === slug || navigationProduct?.sku === slug || (navigationProduct as any)?.id === slug || (navigationProduct as any)?._id === slug) && navigationProduct?.isActive !== false
      ? navigationProduct
      : null;

    if (navigationProducts?.length) {
      this.allProducts = navigationProducts;
    } else if (cachedProducts?.length) {
      this.allProducts = cachedProducts;
    } else if (initialProduct && !this.allProducts.length) {
      this.allProducts = [initialProduct];
    }
    this.relatedProductsLoading = this.allProducts.length === 0;

    this.loading = !initialProduct;
    this.errorMessage = '';
    if (initialProduct) {
      this.setProduct(initialProduct);
    } else {
      this.product = null;
    }

    this.productService.getAll().subscribe({
      next: (response: unknown) => {
        if (requestId !== this.productLoadRequestId) return;

        const products = Array.isArray(response)
          ? response as ProductDetails[]
          : [];
        this.allProducts = products;
        this.relatedProductsLoading = false;
        const product = products.find((item) => (item.slug === slug || item.sku === slug || (item as any)._id === slug || (item as any).id === slug) && item.isActive !== false);

        if (!product) {
          if (!initialProduct) {
            this.errorMessage = 'Không tìm thấy sản phẩm này.';
            this.loading = false;
          }
          return;
        }

        this.setProduct(product);
      },
      error: (error: unknown) => {
        if (requestId !== this.productLoadRequestId) return;

        console.error('Không thể tải thông tin sản phẩm:', error);
        this.relatedProductsLoading = false;
        if (!initialProduct) {
          this.errorMessage = 'Không thể tải sản phẩm. Vui lòng thử lại sau.';
          this.loading = false;
        }
      },
    });
  }

  private setProduct(product: ProductDetails): void {
    const sameProduct = this.product?.slug === product.slug;
    this.product = product;
    this.favorite = this.isProductFavorite(product);
    if (!sameProduct) {
      this.reviewSubmitRequestId++;
      this.reviewComment = '';
      this.reviewRating = 0;
      this.reviewFormOpen = false;
      this.reviewSubmitting = false;
      this.reviewSubmitError = '';
      this.reviewSubmitMessage = '';
      this.activeTab = 'info';
      this.loadReviews(product.sku || '');
      this.selectedVariant =
        product.variants?.find((variant) => variant.isDefault) ??
        product.variants?.[0] ??
        null;
      this.quantity = 1;
    }
    this.galleryImages = this.getGalleryImages(product);
    if (!this.galleryImages.includes(this.activeImage)) {
      this.activeImage = this.galleryImages[0] || '/assets/images/no-image.svg';
    }
    this.loading = false;
  }

  private loadReviews(sku: string): void {
    const requestId = ++this.reviewLoadRequestId;
    this.reviews = [];
    this.reviewsLoaded = false;
    this.reviewsError = '';

    if (!sku) {
      this.reviews = [];
      this.reviewsLoaded = true;
      this.reviewsLoading = false;
      this.updateDisplayedProductRating();
      return;
    }

    this.reviewsLoading = true;
    this.reviewsError = '';
    this.reviewService.getReviews(sku).subscribe({
      next: (reviews) => {
        if (requestId !== this.reviewLoadRequestId) return;

        this.reviews = reviews;
        this.reviewsLoaded = true;
        this.reviewsLoading = false;
        this.updateDisplayedProductRating();
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        if (requestId !== this.reviewLoadRequestId) return;

        console.error('Không thể tải đánh giá sản phẩm:', error);
        this.reviewsError = 'Không thể tải đánh giá lúc này.';
        this.reviewsLoading = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  private getGalleryImages(product: ProductDetails): string[] {
    const thumbnail = product.thumbnail || product.imageUrl;
    const secondaryImages = Array.isArray(product.images) ? [...product.images] : [];

    // The image-processing script stores the thumbnail source again as IMG_1.
    if (product.sku && secondaryImages[0] === `${product.sku}_IMG_1`) {
      secondaryImages.shift();
    }

    const sources = [thumbnail, ...secondaryImages];

    return [...new Set(
      sources
        .filter((source): source is string => typeof source === 'string' && source.length > 0)
        .map((source) => this.resolveImage(source)),
    )];
  }

  private resolveImage(source: string): string {
    if (/^(https?:|data:image\/)/i.test(source)) return source;
    if (source.startsWith('/assets/')) return source;
    if (source.startsWith('assets/')) return `/${source}`;
    if (source.startsWith('/products/')) return `http://localhost:3002${source}`;
    if (/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(source)) {
      return `/assets/images/${source}`;
    }

    const imagePath = `/products/image/${encodeURIComponent(source)}`;
    return `http://localhost:3002${imagePath}`;
  }

  get relatedProducts(): ProductDetails[] {
    if (!this.product) return [];

    const sameCategory = this.allProducts.filter((item) =>
      item.slug !== this.product?.slug &&
      item.isActive !== false &&
      item.categorySlug === this.product?.categorySlug
    );
    const others = this.allProducts.filter((item) =>
      item.slug !== this.product?.slug &&
      item.isActive !== false &&
      item.categorySlug !== this.product?.categorySlug
    );

    return [...sameCategory, ...others].slice(0, 4);
  }

  get displayedRatingAverage(): number {
    const average = !this.reviewsLoaded
      ? Number(this.product?.ratingAverage ?? 0)
      : this.reviews.length
        ? this.reviews.reduce((sum, review) => sum + review.rating, 0) / this.reviews.length
        : 0;
    return Number(average.toFixed(1));
  }

  get displayedRatingCount(): number {
    if (this.reviewsLoaded) return this.reviews.length;
    return Number(this.product?.reviewCount ?? this.product?.ratingCount ?? 0);
  }

  get displayedRatingAverageLabel(): string {
    return this.displayedRatingAverage.toFixed(1);
  }

  get displayedRoundedRating(): number {
    return Math.round(this.displayedRatingAverage);
  }

  formatRatingAverage(ratingAverage: number | null | undefined): string {
    return Number(ratingAverage ?? 0).toFixed(1);
  }

  getRoundedRatingAverage(ratingAverage: number | null | undefined): number {
    return Math.round(Number(ratingAverage ?? 0));
  }

  getLowestPriceVariant(product: ProductDetails): ProductVariant | null {
    const variants = product.variants ?? [];
    if (!variants.length) return null;

    return variants.reduce(
      (lowest, variant) => variant.price < lowest.price ? variant : lowest,
    );
  }

  getRelatedPrice(product: ProductDetails): number {
    return Number(
      this.getLowestPriceVariant(product)?.price ??
      product.minPrice ??
      product.price ??
      0,
    );
  }

  private updateDisplayedProductRating(): void {
    const product = this.product;
    const productSku = product?.sku;
    if (!product || !productSku || !this.reviewsLoaded) return;

    const ratingCount = this.reviews.length;
    const ratingAverage = ratingCount
      ? this.reviews.reduce((sum, review) => sum + review.rating, 0) / ratingCount
      : 0;

    product.ratingAverage = ratingAverage;
    product.ratingCount = ratingCount;
    product.reviewCount = ratingCount;
    this.reviewService.updateProductRating(productSku, ratingAverage, ratingCount);
  }

  get currentPrice(): number {
    return Number(this.selectedVariant?.price ?? this.product?.price ?? this.product?.minPrice ?? 0);
  }

  get currentOldPrice(): number {
    return Number(this.selectedVariant?.oldPrice ?? this.product?.oldPrice ?? 0);
  }

  get currentStock(): number {
    return Number(this.selectedVariant?.stock ?? this.product?.stock ?? 0);
  }

  get currentSku(): string {
    return this.selectedVariant?.sku || this.product?.sku || '';
  }

  get discountPercent(): number {
    if (this.currentOldPrice <= this.currentPrice || this.currentOldPrice <= 0) return 0;
    return Math.round((1 - this.currentPrice / this.currentOldPrice) * 100);
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN').format(price) + '₫';
  }

  formatVariantType(type: string): string {
    const labels: Record<string, string> = {
      weight: 'Theo khối lượng',
      sachet: 'Dạng gói',
      teabag: 'Dạng túi lọc',
    };
    return labels[type] || type;
  }

  formatReviewDate(value?: string | Date): string {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? ''
      : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(date);
  }

  selectVariant(variant: ProductVariant): void {
    this.selectedVariant = variant;
    this.quantity = Math.min(this.quantity, Math.max(variant.stock, 1));
  }

  openQuickAdd(product: ProductDetails): void {
    const variant =
      this.getLowestPriceVariant(product) ??
      product.variants?.find((option) => option.isDefault && option.stock > 0) ??
      product.variants?.find((option) => option.stock > 0) ??
      product.variants?.find((option) => option.isDefault) ??
      product.variants?.[0] ??
      null;
    this.quickAdd = { product, variant, quantity: 1 };
    this.quickAddError = '';
  }

  navigateToRelatedProduct(event: MouseEvent, product: ProductDetails): void {
    if (!product.slug || event.ctrlKey || event.metaKey || event.shiftKey || event.button === 1) return;
    event.preventDefault();
    if (product.slug === this.product?.slug) return;

    this.setProduct(product);
    const lowestPriceVariant = this.getLowestPriceVariant(product);
    if (lowestPriceVariant) this.selectVariant(lowestPriceVariant);
    void this.productNavigation.navigateToProduct(product, this.allProducts);
  }

  closeQuickAdd(): void {
    this.quickAdd = null;
    this.quickAddError = '';
  }

  selectQuickAddVariant(variant: ProductVariant): void {
    if (!this.quickAdd) return;
    this.quickAdd.variant = variant;
    this.quickAdd.quantity = Math.min(this.quickAdd.quantity, Math.max(variant.stock, 1));
    this.quickAddError = '';
  }

  changeQuickAddQuantity(delta: number): void {
    if (!this.quickAdd) return;
    const stock = this.quickAdd.variant?.stock ?? this.quickAdd.product.stock ?? 0;
    const quantity = this.quickAdd.quantity + delta;
    if (quantity >= 1 && quantity <= stock) this.quickAdd.quantity = quantity;
  }

  addQuickAddToCart(): void {
    if (!this.quickAdd) return;
    const { product, variant, quantity } = this.quickAdd;
    const stock = variant?.stock ?? product.stock ?? 0;
    if (stock < 1) {
      this.quickAddError = 'Sản phẩm đang hết hàng.';
      return;
    }

    const added = this.cartService.addProduct(product, variant, quantity, this.productImage(product));
    if (!added) return;
    this.closeQuickAdd();
  }

  selectImage(image: string): void {
    this.activeImage = image;
  }

  moveGalleryImage(direction: -1 | 1): void {
    if (this.galleryImages.length < 2) return;
    const currentIndex = this.galleryImages.indexOf(this.activeImage);
    const nextIndex = (currentIndex + direction + this.galleryImages.length) % this.galleryImages.length;
    this.activeImage = this.galleryImages[nextIndex];
  }

  setReviewRating(rating: number): void {
    this.reviewRating = rating;
    this.reviewSubmitError = '';
    this.reviewSubmitMessage = '';
  }

  submitReview(event: Event): void {
    event.preventDefault();
    if (!this.canSubmitReview) {
      this.router.navigate(['/login']);
      return;
    }

    const productSku = this.product?.sku?.trim();
    const userName = this.reviewAccount?.fullName.trim() || '';
    const comment = this.reviewComment.trim();

    if (this.reviewSubmitting) return;
    if (!productSku || !userName || !comment || this.reviewRating < 1 || this.reviewRating > 5) {
      this.reviewSubmitError = 'Vui lòng chọn số sao và viết bình luận.';
      return;
    }

    const rating = this.reviewRating;
    const review: NewProductReview = {
      productSku,
      rating,
      comment
    };
    const requestId = ++this.reviewSubmitRequestId;
    const optimisticReview: ProductReview = {
      ...review,
      userName,
      userAvatar: this.reviewAvatar || null,
      createdAt: new Date(),
      isApproved: true,
    };
    this.reviews = [optimisticReview, ...this.reviews];
    this.reviewsLoaded = true;
    this.updateDisplayedProductRating();
    this.changeDetector.markForCheck();
    this.reviewSubmitting = true;
    this.reviewSubmitError = '';
    this.reviewSubmitMessage = '';
    this.reviewFormOpen = false;

    this.reviewService.createReview(review).subscribe({
      next: (savedReview) => {
        if (requestId !== this.reviewSubmitRequestId || savedReview.productSku !== this.product?.sku) return;
        this.reviews = this.reviews.map((item) => item === optimisticReview ? savedReview : item);
        this.updateDisplayedProductRating();
        this.reviewComment = '';
        this.reviewRating = 0;
        this.reviewSubmitMessage = 'Cảm ơn bạn đã gửi đánh giá!';
        this.reviewSubmitting = false;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        if (requestId !== this.reviewSubmitRequestId) return;

        console.error('Không thể gửi đánh giá sản phẩm:', error);
        this.reviews = this.reviews.filter((item) => item !== optimisticReview);
        this.updateDisplayedProductRating();
        this.reviewSubmitError = 'Chưa gửi được đánh giá. Vui lòng thử lại.';
        this.reviewSubmitting = false;
        this.reviewFormOpen = true;
        this.changeDetector.markForCheck();
      }
    });
  }

  toggleReviewForm(): void {
    if (!this.canSubmitReview) {
      this.router.navigate(['/login']);
      return;
    }

    this.reviewFormOpen = !this.reviewFormOpen;
    if (this.reviewFormOpen) {
      this.reviewSubmitError = '';
      this.reviewSubmitMessage = '';
    }
  }

  changeQuantity(delta: number): void {
    const nextQuantity = this.quantity + delta;
    if (nextQuantity >= 1 && nextQuantity <= this.currentStock) {
      this.quantity = nextQuantity;
    }
  }

  setTab(tab: 'info' | 'detail' | 'review'): void {
    this.activeTab = tab;
  }

  addToCart(): void {
    if (!this.product || this.currentStock < 1) return;

    this.cartService.addProduct(this.product, this.selectedVariant, this.quantity, this.activeImage);
  }

  buyNow(): void {
    if (!this.product) return;
    const variant = this.selectedVariant;
    const price = Number(variant?.price ?? this.product.price ?? this.product.minPrice ?? 0);
    const qty = Math.max(1, this.quantity || 1);
    const image = this.activeImage || this.productImage(this.product);

    this.cartService.addProduct(this.product, variant, qty, image);

    const checkoutItem = {
      id: variant?.sku || this.product.sku || this.product._id || 'PROD',
      productId: this.product._id || this.product.id || this.product.sku,
      sku: variant?.sku || this.product.sku || 'PROD',
      name: this.product.name,
      title: this.product.name,
      image: image,
      thumbnail: image,
      variant: variant?.label || '',
      variantLabel: variant?.label || '',
      price: price,
      quantity: qty,
      total: price * qty
    };
    sessionStorage.setItem('checkout_items', JSON.stringify([checkoutItem]));

    this.router.navigate(['/checkout']);
  }

  isProductFavorite(product: ProductDetails): boolean {
    return this.wishlistService.isSaved(product);
  }

  toggleFavorite(): void {
    if (!this.product) return;
    this.favorite = this.wishlistService.toggle(this.product);
  }

  productImage(product: ProductDetails): string {
    const source = product.imageUrl || product.thumbnail || product.images?.[0];
    return source ? this.resolveImage(source) : '/assets/images/no-image.svg';
  }

  onImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    image.src = '/assets/images/no-image.svg';
  }

  goToProducts(): void {
    this.router.navigate(['/products']);
  }
}
