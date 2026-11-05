import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { ProductService } from '../../services/product-service';
import { CartService } from '../../services/cart-service';
import { ProductNavigationService } from '../../services/product-navigation-service';
import { Products } from '../../classes/Products';
import { CouponItem, DEFAULT_COUPONS } from '../../classes/Coupon';
import { WishlistService } from '../../services/wishlist-service';
import { BuyNowService } from '../../services/buy-now-service';

@Component({
  selector: 'app-promotions',
  standalone: false,
  templateUrl: './promotions.html',
  styleUrl: './promotions.css',
})
export class PromotionsComponent implements OnInit, OnDestroy {
  products = signal<Products[]>([]);
  specialPromos = signal<Products[]>([]);
  bigDeals = signal<Products[]>([]);
  loading = signal(true);
  cartPopupProduct: Products | null = null;
  cartPopupVariant: Products['variants'][number] | null = null;
  cartPopupQuantity = 1;

  // Yêu thích
  wishlist = signal<Set<string>>(new Set());

  // Coupons
  savedCoupons = signal<Set<string>>(new Set());
  copiedCode = signal<string | null>(null);
  coupons: CouponItem[] = DEFAULT_COUPONS;

  stars = [1, 2, 3, 4, 5];

  // Countdown timer
  countdown = signal({
    days: '05',
    hours: '13',
    minutes: '51',
    seconds: '05',
  });

  private timerInterval: any;
  private targetTime = Date.now() + (5 * 24 * 3600 + 13 * 3600 + 51 * 60 + 5) * 1000;

  constructor(
    private productService: ProductService,
    readonly cartService: CartService,
    readonly productNavigation: ProductNavigationService,
    private readonly wishlistService: WishlistService,
    readonly buyNowService: BuyNowService,
  ) {}

  ngOnInit(): void {
    this.loadProducts();
    this.startCountdown();
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  loadProducts(): void {
    this.loading.set(true);
    this.productService.getAll().subscribe({
      next: (res: any) => {
        let list: Products[] = [];
        if (Array.isArray(res)) list = res;
        else if (Array.isArray(res?.data)) list = res.data;
        else if (Array.isArray(res?.products)) list = res.products;

        this.products.set(list);

        // Khuyến mãi đặc biệt: Các sản phẩm có giảm giá
        const discounted = list.filter((p: any) => this.hasDiscount(p) || p.isSale);
        const specialList = discounted.length >= 8 ? discounted.slice(0, 8) : list.slice(0, 8);
        this.specialPromos.set(specialList);

        // Những ưu đãi lớn: Chỉ lấy các sản phẩm giảm >= 20% (sắp xếp giảm dần)
        const bigDealsList = list
          .filter((p: any) => this.getDiscount(p) >= 20)
          .sort((a, b) => this.getDiscount(b) - this.getDiscount(a));

        this.bigDeals.set(bigDealsList);

        this.loading.set(false);
      },
      error: (err) => {
        console.error('Lỗi tải sản phẩm khuyến mãi:', err);
        this.loading.set(false);
      },
    });
  }

  private startCountdown(): void {
    this.updateTimer();
    this.timerInterval = setInterval(() => {
      this.updateTimer();
    }, 1000);
  }

  private updateTimer(): void {
    const diff = Math.max(0, this.targetTime - Date.now());
    const totalSec = Math.floor(diff / 1000);
    const d = Math.floor(totalSec / (24 * 3600));
    const h = Math.floor((totalSec % (24 * 3600)) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;

    this.countdown.set({
      days: String(d).padStart(2, '0'),
      hours: String(h).padStart(2, '0'),
      minutes: String(m).padStart(2, '0'),
      seconds: String(s).padStart(2, '0'),
    });
  }

  /* ============ HELPER METHODS (ĐỒNG BỘ VỚI HOMEPAGE) ============ */
  getProductName(product: Products): string {
    const p: any = product;
    return p.name || p.productName || p.product_name || p.title || 'Trà thảo mộc Floralia';
  }

  getProductPrice(product: Products): number {
    const p: any = product;
    const defaultVariant = p.variants?.find((variant: any) => variant.isDefault) ?? p.variants?.[0];
    return Number(defaultVariant?.price ?? p.price ?? p.minPrice ?? p.productPrice ?? 0);
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  }

  hasDiscount(product: Products): boolean {
    const p: any = product;
    return Number(p.oldPrice || 0) > this.getProductPrice(product);
  }

  getOldPrice(product: Products): number {
    const p: any = product;
    const defaultVariant = p.variants?.find((variant: any) => variant.isDefault) ?? p.variants?.[0];
    return Number(defaultVariant?.oldPrice ?? p.oldPrice ?? 0);
  }

  getDiscount(product: Products): number {
    const p: any = product;
    if (p.discount) return Number(p.discount);

    const oldPrice = this.getOldPrice(product);
    const price = this.getProductPrice(product);
    if (oldPrice > price && oldPrice > 0) {
      return Math.round(((oldPrice - price) / oldPrice) * 100);
    }
    return 0;
  }

  getRating(product: Products): number {
    const p: any = product;
    return Math.round(Number(p.ratingAverage || 0));
  }

  getRatingCount(product: Products): number {
    const p: any = product;
    return Number(p.ratingCount || 0);
  }

  formatRatingAverage(product: Products): string {
    const p: any = product;
    return Number(p.ratingAverage || 0).toFixed(1);
  }

  getProductImage(product: Products): string {
    const p: any = product;
    const thumbnail = p.thumbnail;

    if (typeof thumbnail === 'string') {
      if (
        thumbnail.startsWith('http://') ||
        thumbnail.startsWith('https://') ||
        thumbnail.startsWith('data:image/')
      ) {
        return thumbnail;
      }

      if (/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(thumbnail)) {
        return thumbnail.startsWith('/assets/')
          ? thumbnail
          : thumbnail.startsWith('assets/')
            ? `/${thumbnail}`
            : `/assets/images/${thumbnail}`;
      }
    }

    if (p.imageUrl) {
      return p.imageUrl.startsWith('http://') || p.imageUrl.startsWith('https://')
        ? p.imageUrl
        : `http://localhost:3002${p.imageUrl}`;
    }

    if (p.imageData) {
      if (p.imageData.startsWith('data:image/')) return p.imageData;
      const mimeType = p.imageMimeType || 'image/webp';
      return `data:${mimeType};base64,${p.imageData}`;
    }

    return '/assets/images/no-image.svg';
  }

  getProductId(product: Products): string {
    const p: any = product;
    return p._id || p.id || p.productId || p.slug || '';
  }

  hasStock(product: Products): boolean {
    return product.variants?.length
      ? product.variants.some((variant) => variant.stock > 0)
      : product.stock > 0;
  }

  addToCart(product: Products): void {
    if (!this.hasStock(product)) return;
    this.cartPopupProduct = product;
    this.cartPopupVariant =
      product.variants?.find((option) => option.isDefault && option.stock > 0) ??
      product.variants?.find((option) => option.stock > 0) ??
      product.variants?.find((option) => option.isDefault) ??
      product.variants?.[0] ??
      null;
    this.cartPopupQuantity = 1;
  }

  closeCartPopup(): void {
    this.cartPopupProduct = null;
    this.cartPopupVariant = null;
    this.cartPopupQuantity = 1;
  }

  selectCartPopupVariant(variant: Products['variants'][number]): void {
    if (variant.stock < 1) return;
    this.cartPopupVariant = variant;
    this.cartPopupQuantity = Math.min(this.cartPopupQuantity, variant.stock);
  }

  changeCartPopupQuantity(delta: number): void {
    const quantity = this.cartPopupQuantity + delta;
    if (quantity >= 1 && quantity <= this.cartPopupStock) {
      this.cartPopupQuantity = quantity;
    }
  }

  get cartPopupStock(): number {
    return this.cartPopupVariant?.stock ?? this.cartPopupProduct?.stock ?? 0;
  }

  get cartPopupPrice(): number {
    return this.cartPopupVariant?.price ?? this.cartPopupProduct?.price ?? 0;
  }

  confirmAddToCart(): void {
    const product = this.cartPopupProduct;
    if (!product || this.cartPopupStock < 1) return;

    if (this.cartService.addProduct(
      product,
      this.cartPopupVariant,
      this.cartPopupQuantity,
      this.getProductImage(product),
    )) {
      this.closeCartPopup();
    }
  }

  openBuyNowPopup(product: Products): void {
    this.buyNowService.open(product, this.getProductImage(product));
  }

  isWished(product: Products): boolean {
    return this.wishlistService.isSaved(product);
  }

  toggleWish(product: Products): void {
    this.wishlistService.toggle(product);
    this.wishlist.set(new Set(this.wishlistService.ids()));
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.onerror = null;
    img.src = '/assets/images/no-image.svg';
  }

  saveCoupon(code: string): void {
    navigator.clipboard?.writeText(code);
    this.savedCoupons.update((set) => {
      const next = new Set(set);
      next.add(code);
      return next;
    });

    this.copiedCode.set(code);
    setTimeout(() => {
      if (this.copiedCode() === code) {
        this.copiedCode.set(null);
      }
    }, 2500);
  }

  isCouponSaved(code: string): boolean {
    return this.savedCoupons().has(code);
  }
}
