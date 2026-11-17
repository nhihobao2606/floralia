import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Products } from '../../classes/Products';
import { ProductNavigationService } from '../../services/product-navigation-service';
import { ProductService } from '../../services/product-service';
import { WishlistService } from '../../services/wishlist-service';
import { CartService } from '../../services/cart-service';
import { BuyNowService } from '../../services/buy-now-service';
import { formatVietnameseDong } from "../../shared/vnd-format";

@Component({
  selector: 'app-wishlist-page',
  standalone: false,
  templateUrl: './wishlist-page.html',
  styleUrl: './wishlist-page.css',
})
export class WishlistPage implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  showLogoutConfirm = false;
  products = signal<Products[]>([]);
  loading = signal(true);
  errorMessage = signal('');
  removeMessage = signal('');
  cartPopupProduct: Products | null = null;
  cartPopupVariant: Products['variants'][number] | null = null;
  cartPopupQuantity = 1;
  user: any = null;
  avatar = '';

  constructor(
    private readonly productService: ProductService,
    readonly wishlistService: WishlistService,
    readonly productNavigation: ProductNavigationService,
    readonly cartService: CartService,
    private readonly router: Router,
    readonly buyNowService: BuyNowService,
  ) {}

  ngOnInit(): void {
    this.loadUser();
    if (!this.wishlistService.isAuthenticated()) {
      this.loading.set(false);
      this.wishlistService.promptLogin();
      return;
    }

    this.productService.getAll().subscribe({
      next: (response: any) => {
        const list = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];
        this.products.set(list.filter((product: Products) => this.wishlistService.isSaved(product)));
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Chưa tải được danh sách sản phẩm. Vui lòng thử lại sau.');
        this.loading.set(false);
      },
    });
    this.productService.productsChanges$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshProducts());
  }

  private refreshProducts(): void {
    this.productService.getAll().subscribe({
      next: (response: any) => {
        const list = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];
        this.products.set(list.filter((product: Products) => this.wishlistService.isSaved(product)));
      },
      error: error => console.error('Không thể làm mới danh sách yêu thích:', error),
    });
  }

  private loadUser(): void {
    try {
      const raw = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
      this.user = raw ? JSON.parse(raw) : null;
      this.avatar = this.user?.avatar || '';
    } catch {
      this.user = null;
      this.avatar = '';
    }
  }

  get initial(): string {
    const name = String(this.user?.fullName || '').trim();
    return name ? name.split(/\s+/).at(-1)!.charAt(0).toUpperCase() : 'F';
  }

  requestLogout(): void {
    this.showLogoutConfirm = true;
  }

  confirmLogout(): void {
    this.showLogoutConfirm = false;
    ['currentUser', 'token'].forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    window.dispatchEvent(new Event('auth-changed'));
    window.dispatchEvent(new Event('cart-updated'));
    void this.router.navigate(['/login']);
  }

  remove(product: Products): void {
    this.wishlistService.remove(product);
    this.products.update((items) => items.filter((item) => item !== product));
    this.removeMessage.set('Đã xóa sản phẩm khỏi danh sách yêu thích thành công!');
    window.setTimeout(() => this.removeMessage.set(''), 5000);
  }

  getProductImage(product: Products): string {
    const thumbnail = product.thumbnail || '';
    if (/^(https?:\/\/|data:image\/)/i.test(thumbnail)) return thumbnail;
    if (/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(thumbnail)) {
      return thumbnail.startsWith('/assets/')
        ? thumbnail
        : thumbnail.startsWith('assets/')
          ? `/${thumbnail}`
          : `/assets/images/${thumbnail}`;
    }
    if (product.imageUrl) {
      return /^https?:\/\//i.test(product.imageUrl)
        ? product.imageUrl
        : `http://localhost:3002${product.imageUrl.startsWith('/') ? '' : '/'}${product.imageUrl}`;
    }
    if (product.imageData) {
      return product.imageData.startsWith('data:image/')
        ? product.imageData
        : `data:${product.imageMimeType || 'image/webp'};base64,${product.imageData}`;
    }
    return '/assets/images/no-image.svg';
  }

  rating(product: Products): number {
    return Math.max(0, Math.min(5, Math.round(Number(product.ratingAverage) || 0)));
  }

  ratingText(product: Products): string {
    return `${(Number(product.ratingAverage) || 0).toFixed(1)} (${Number(product.ratingCount) || 0})`;
  }

  displayVariant(product: Products): Products['variants'][number] | null {
    const variants = product.variants ?? [];
    if (!variants.length) return null;
    const inStock = variants.filter((variant) => Number(variant.stock) > 0);
    const pool = inStock.length ? inStock : variants;
    return pool.reduce((lowest, variant) =>
      Number(variant.price) < Number(lowest.price) ? variant : lowest, pool[0]);
  }

  displayVariantLabel(product: Products): string {
    return this.displayVariant(product)?.label || '';
  }

  displayPrice(product: Products): number {
    return Number(this.displayVariant(product)?.price ?? product.price ?? 0);
  }

  displayOldPrice(product: Products): number {
    const variant = this.displayVariant(product);
    const oldPrice = Number(variant?.oldPrice ?? product.oldPrice ?? 0);
    return oldPrice > this.displayPrice(product) ? oldPrice : 0;
  }

  displayDiscount(product: Products): number {
    const configuredDiscount = Number(product.discount || 0);
    if (!product.variants?.length && configuredDiscount > 0) return configuredDiscount;
    const oldPrice = this.displayOldPrice(product);
    const price = this.displayPrice(product);
    return oldPrice > price && oldPrice > 0 ? Math.round((1 - price / oldPrice) * 100) : 0;
  }

  shouldShowFromPrefix(product: Products): boolean {
    return (product.variants?.length ?? 0) > 1;
  }

  formatPrice(price: number): string {
    return formatVietnameseDong(price);
  }

  openProduct(event: MouseEvent, product: Products): void {
    event.preventDefault();
    void this.productNavigation.navigateToProduct(
      product,
      this.products(),
      this.displayVariant(product)?.sku,
    );
  }

  hasStock(product: Products): boolean {
    return product.variants?.length
      ? product.variants.some((variant) => variant.stock > 0)
      : Number(product.stock) > 0;
  }

  addToCart(product: Products): void {
    if (!this.hasStock(product)) return;
    this.cartPopupProduct = product;
    const preferredVariant = this.displayVariant(product);
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
    this.cartPopupVariant = variant;
    this.cartPopupQuantity = Math.min(this.cartPopupQuantity, Math.max(variant.stock, 1));
  }

  get cartPopupStock(): number {
    return this.cartPopupVariant?.stock ?? this.cartPopupProduct?.stock ?? 0;
  }

  get cartPopupPrice(): number {
    return this.cartPopupVariant?.price ?? this.cartPopupProduct?.price ?? 0;
  }

  get cartPopupOldPrice(): number {
    return this.cartPopupVariant?.oldPrice ?? this.cartPopupProduct?.oldPrice ?? 0;
  }

  changeCartPopupQuantity(delta: number): void {
    const quantity = this.cartPopupQuantity + delta;
    if (quantity >= 1 && quantity <= this.cartPopupStock) this.cartPopupQuantity = quantity;
  }

  confirmAddToCart(): void {
    if (!this.cartPopupProduct || this.cartPopupStock < 1) return;
    const added = this.cartService.addProduct(
      this.cartPopupProduct,
      this.cartPopupVariant,
      this.cartPopupQuantity,
      this.getProductImage(this.cartPopupProduct),
    );
    if (added) this.closeCartPopup();
  }

  buyNow(product: Products): void {
    this.buyNowService.open(product, this.getProductImage(product), this.displayVariant(product));
  }

  onImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    image.src = '/assets/images/no-image.svg';
  }
}
