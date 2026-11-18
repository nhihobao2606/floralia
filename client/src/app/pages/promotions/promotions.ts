import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ProductService } from '../../services/product-service';
import { CartService } from '../../services/cart-service';
import { ProductNavigationService } from '../../services/product-navigation-service';
import { Products } from '../../classes/Products';
import { PublicPromoVoucher } from '../../services/product-service';
import { WishlistService } from '../../services/wishlist-service';
import { BuyNowService } from '../../services/buy-now-service';
import { formatVietnameseDong } from "../../shared/vnd-format";

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
  featuredVouchers = signal<PublicPromoVoucher[]>([]);
  coupons = signal<PublicPromoVoucher[]>([]);
  vouchersLoading = signal(true);
  vouchersError = signal('');

  private readonly promotionVoucherCodes = [
    'FREESHIPTEA', 'NEWBIE50K', 'NEWBIE20',
    'FLORALIA10', 'WELCOMEHERBAL', 'TRATHAOMOC', 'NEWBIE15',
  ];

  stars = [1, 2, 3, 4, 5];

  // Countdown timer
  countdown = signal({
    days: '05',
    hours: '13',
    minutes: '51',
    seconds: '05',
  });

  private timerInterval: any;
  private productChangesSubscription?: Subscription;
  private recommendationChangesSubscription?: Subscription;
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
    this.productChangesSubscription = this.productService.productsChanges$.subscribe(() => this.loadProducts());
    this.loadVouchers();
    this.productService.getRecommendations().subscribe({ next: () => this.applyPersonalizedOrder(), error: () => undefined });
    this.recommendationChangesSubscription = this.productService.recommendationChanges$.subscribe(() => {
      this.productService.getRecommendations().subscribe({ next: () => this.loadProducts(), error: () => this.loadProducts() });
    });
    this.startCountdown();
  }

  loadVouchers(): void {
    this.vouchersLoading.set(true);
    this.vouchersError.set('');
    this.productService.getPublicPromoVouchers().subscribe({
      next: response => {
        const byCode = new Map((response?.vouchers || []).map(voucher => [voucher.code.toUpperCase(), voucher]));
        const selected = this.promotionVoucherCodes
          .map(code => byCode.get(code))
          .filter((voucher): voucher is PublicPromoVoucher => Boolean(voucher));
        this.featuredVouchers.set(selected.slice(0, 3));
        this.coupons.set(selected.slice(3, 7));
        this.vouchersLoading.set(false);
      },
      error: error => {
        console.error('Lỗi tải voucher từ MongoDB:', error);
        this.vouchersError.set('Chưa thể tải danh sách voucher. Vui lòng thử lại sau.');
        this.featuredVouchers.set([]);
        this.coupons.set([]);
        this.vouchersLoading.set(false);
      },
    });
  }

  getVoucherTag(voucher: PublicPromoVoucher): string {
    if (voucher.audience === 'new_customer') return 'DÀNH CHO KHÁCH MỚI';
    if (voucher.scope === 'categories') return 'ƯU ĐÃI THEO DANH MỤC';
    return 'ƯU ĐÃI ĐẶC BIỆT';
  }

  getVoucherBadge(voucher: PublicPromoVoucher): string {
    if (voucher.code.toUpperCase() === 'FREESHIPTEA') return 'MIỄN PHÍ SHIP';
    return voucher.discountType === 'percent'
      ? `GIẢM ${voucher.discountValue}%`
      : `GIẢM ${this.formatPrice(voucher.discountValue)}`;
  }

  getVoucherMinimum(voucher: PublicPromoVoucher): string {
    return voucher.minOrderValue > 0
      ? `Đơn hàng từ ${this.formatPrice(voucher.minOrderValue)}`
      : 'Không yêu cầu giá trị đơn tối thiểu';
  }

  getVoucherExtra(voucher: PublicPromoVoucher): string {
    const details: string[] = [];
    if (voucher.maxDiscount && voucher.maxDiscount > 0) {
      details.push(`Giảm tối đa ${this.formatPrice(voucher.maxDiscount)}`);
    }
    details.push(voucher.endDate ? `Hạn đến ${this.getVoucherExpiry(voucher)}` : 'Không thời hạn');
    return details.join(' · ');
  }

  getVoucherDescription(voucher: PublicPromoVoucher): string {
    const parts = [voucher.description || voucher.name];
    if (voucher.maxDiscount && voucher.maxDiscount > 0) {
      parts.push(`Giảm tối đa ${this.formatPrice(voucher.maxDiscount)}.`);
    }
    if (voucher.audience === 'new_customer') parts.push('Dành cho khách hàng mới.');
    if (voucher.perUserLimit > 0) parts.push('Cần đăng nhập để sử dụng.');
    return parts.join(' ');
  }

  getVoucherExpiry(voucher: PublicPromoVoucher): string {
    if (!voucher.endDate) return 'Không thời hạn';
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(voucher.endDate);
    const date = dateOnly
      ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
      : new Date(voucher.endDate);
    return Number.isNaN(date.getTime()) ? 'Không thời hạn' : date.toLocaleDateString('vi-VN');
  }

  private applyPersonalizedOrder(): void {
    this.specialPromos.set(this.productService.personalizeProducts(this.specialPromos()));
    this.bigDeals.set(this.productService.personalizeProducts(this.bigDeals()));
  }

  ngOnDestroy(): void {
    this.productChangesSubscription?.unsubscribe();
    this.recommendationChangesSubscription?.unsubscribe();
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
        this.applyPersonalizedOrder();

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
    return Number(this.getDisplayVariant(product)?.price ?? p.price ?? p.minPrice ?? p.productPrice ?? 0);
  }

  formatPrice(price: number): string {
    return formatVietnameseDong(price);
  }

  hasDiscount(product: Products): boolean {
    return this.getOldPrice(product) > this.getProductPrice(product);
  }

  getOldPrice(product: Products): number {
    const p: any = product;
    const variant = this.getDisplayVariant(product);
    const price = Number(variant?.price ?? p.price ?? 0);
    const oldPrice = Number(variant?.oldPrice ?? p.oldPrice ?? 0);
    return oldPrice > price ? oldPrice : 0;
  }

  getDisplayVariant(product: Products): Products['variants'][number] | null {
    const variants = product.variants ?? [];
    if (!variants.length) return null;
    const inStock = variants.filter(variant => Number(variant.stock) > 0);
    const pool = inStock.length ? inStock : variants;
    return pool.reduce((lowest, variant) =>
      Number(variant.price) < Number(lowest.price) ? variant : lowest, pool[0]);
  }

  getDisplayVariantLabel(product: Products): string {
    return this.getDisplayVariant(product)?.label || '';
  }

  shouldShowFromPrefix(product: Products): boolean {
    return (product.variants?.length ?? 0) > 1;
  }

  getDiscount(product: Products): number {
    const p: any = product;
    if (!p.variants?.length && p.discount) return Number(p.discount);

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
    const preferredVariant = this.getDisplayVariant(product);
    this.cartPopupVariant =
      (preferredVariant && preferredVariant.stock > 0 ? preferredVariant : null) ??
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
    this.buyNowService.open(product, this.getProductImage(product), this.getDisplayVariant(product));
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
