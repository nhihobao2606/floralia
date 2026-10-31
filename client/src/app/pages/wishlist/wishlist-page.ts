import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Products } from '../../classes/Products';
import { ProductNavigationService } from '../../services/product-navigation-service';
import { ProductService } from '../../services/product-service';
import { WishlistService } from '../../services/wishlist-service';
import { CartService } from '../../services/cart-service';

@Component({
  selector: 'app-wishlist-page',
  standalone: false,
  templateUrl: './wishlist-page.html',
  styleUrl: './wishlist-page.css',
})
export class WishlistPage implements OnInit {
  products = signal<Products[]>([]);
  loading = signal(true);
  errorMessage = signal('');
  user: any = null;
  avatar = '';

  constructor(
    private readonly productService: ProductService,
    readonly wishlistService: WishlistService,
    readonly productNavigation: ProductNavigationService,
    private readonly cartService: CartService,
    private readonly router: Router,
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

  logout(): void {
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

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(Number(price) || 0);
  }

  openProduct(event: MouseEvent, product: Products): void {
    event.preventDefault();
    void this.productNavigation.navigateToProduct(product, this.products());
  }

  hasStock(product: Products): boolean {
    return product.variants?.length
      ? product.variants.some((variant) => variant.stock > 0)
      : Number(product.stock) > 0;
  }

  addToCart(product: Products): void {
    if (!this.hasStock(product)) return;
    const variant = product.variants?.find((option) => option.isDefault && option.stock > 0)
      ?? product.variants?.find((option) => option.stock > 0)
      ?? null;
    this.cartService.addProduct(product, variant, 1, this.getProductImage(product));
  }

  onImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    image.src = '/assets/images/no-image.svg';
  }
}
