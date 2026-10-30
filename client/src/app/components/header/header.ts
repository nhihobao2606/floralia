import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProductService } from '../../services/product-service';
import { CartItem, CartVariant, CartService } from '../../services/cart-service';
import { ProductNavigationService } from '../../services/product-navigation-service';
import { Products } from '../../classes/Products';

@Component({
  selector: 'app-header',
  standalone: false,
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header implements OnInit, OnDestroy {
  @ViewChild('searchBox') searchBox?: ElementRef<HTMLInputElement>;

  // Tìm kiếm
  searchOpen = false;
  searchLoading = false;
  keyword = '';
  results: any[] = [];
  private allProducts: any[] = [];
  private loaded = false;

  // Giỏ hàng, người dùng (Customer Header)
  cartOpen = false;
  cart: CartItem[] = [];
  variantPickerItem: CartItem | null = null;
  variantOptions: CartVariant[] = [];
  selectedVariant: CartVariant | null = null;
  variantPickerQuantity = 1;
  variantPickerLoading = false;
  variantPickerError = '';
  private variantPickerRequestId = 0;
  user: any = null;
  userOpen = false;

  // Giao diện
  scrolled = false;
  showFloat = false;
  showInvite = false;

  private subs = new Subscription();
  private timers: any[] = [];

  constructor(
    private productService: ProductService,
    private router: Router,
    private cartService: CartService,
    readonly productNavigation: ProductNavigationService,
  ) {}

  ngOnInit(): void {
    this.loadUser();
    this.loadCart();
    this.onScroll();

    this.subs.add(
      this.router.events.subscribe((e) => {
        if (e instanceof NavigationEnd) {
          this.searchOpen = false;
          this.userOpen = false;
          this.closeCart();
          this.loadUser();
          this.loadCart();
        }
      })
    );

    this.timers.push(
      setTimeout(() => this.popInvite(), 6000),
      setInterval(() => this.popInvite(), 25000)
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
    document.body.style.overflow = '';
  }

  private popInvite(): void {
    this.showInvite = true;
    setTimeout(() => (this.showInvite = false), 5000);
  }

  /* ================= SỰ KIỆN CHUNG ================= */
  @HostListener('window:scroll')
  onScroll(): void {
    const y = window.scrollY || 0;
    this.scrolled = y > 20;
    this.showFloat = y > 200;
  }

  @HostListener('document:click')
  closePanels(): void {
    this.searchOpen = false;
    this.userOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.closeVariantPicker();
    this.closePanels();
    this.closeCart();
  }

  @HostListener('window:storage')
  @HostListener('window:cart-updated')
  @HostListener('window:auth-changed')
  onStorageChange(): void {
    this.loadUser();
    this.loadCart();
  }

  scrollTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ================= TÌM KIẾM ================= */
  toggleSearch(e: Event): void {
    e.stopPropagation();
    this.userOpen = false;
    this.searchOpen = !this.searchOpen;

    if (this.searchOpen) {
      this.ensureProducts();
      setTimeout(() => this.searchBox?.nativeElement.focus(), 50);
    }
  }

  private ensureProducts(): void {
    if (this.loaded || this.searchLoading) return;

    this.searchLoading = true;

    this.productService.getAll().subscribe({
      next: (res: any) => {
        const list = Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.products)
              ? res.products
              : [];

        this.allProducts = list
          .filter((p: any) => p.isActive !== false)
          .map((p: any) => ({
            ...p,
            searchName: this.normalize(this.getName(p)),
          }));

        this.loaded = true;
        this.searchLoading = false;
        this.filter();
      },
      error: (err) => {
        console.error('Lỗi tải sản phẩm tìm kiếm:', err);
        this.searchLoading = false;
      },
    });
  }

  onSearch(value: string): void {
    this.keyword = value;
    this.filter();
  }

  private filter(): void {
    const q = this.normalize(this.keyword.trim());

    if (!q) {
      this.results = [];
      return;
    }

    this.results = this.allProducts
      .filter((p: any) => p.searchName.includes(q))
      .slice(0, 5);
  }

  private normalize(value: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .toLowerCase();
  }

  getSearchProductImage(product: any): string {
    const thumbnail = product.thumbnail;

    if (product.imageUrl) {
      if (
        product.imageUrl.startsWith('http://') ||
        product.imageUrl.startsWith('https://')
      ) {
        return product.imageUrl;
      }

      return `http://localhost:3002${product.imageUrl}`;
    }

    if (
      typeof thumbnail === 'string' &&
      (
        thumbnail.startsWith('http://') ||
        thumbnail.startsWith('https://') ||
        thumbnail.startsWith('data:image/')
      )
    ) {
      return thumbnail;
    }

    if (
      typeof thumbnail === 'string' &&
      /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(thumbnail)
    ) {
      if (thumbnail.startsWith('/assets/')) return thumbnail;

      if (thumbnail.startsWith('assets/')) {
        return `/${thumbnail}`;
      }

      return `/assets/images/${thumbnail}`;
    }

    if (product.imageData) {
      if (product.imageData.startsWith('data:image/')) {
        return product.imageData;
      }

      return `data:${product.imageMimeType || 'image/jpeg'};base64,${product.imageData}`;
    }

    return '/assets/images/no-image.svg';
  }

  submitSearch(e: Event): void {
    e.preventDefault();
    const q = this.keyword.trim();
    this.searchOpen = false;
    this.router.navigate(['/products'], { queryParams: q ? { q } : {} });
  }

  /* ================= TÀI KHOẢN (CUSTOMER) ================= */
  private loadUser(): void {
    const raw = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    try { this.user = raw ? JSON.parse(raw) : null; } catch { this.user = null; }
  }

  get userInitial(): string {
    const name = (this.user?.fullName || this.user?.name || '').trim();
    if (!name) return '';
    const parts = name.split(/\s+/);
    return parts[parts.length - 1].charAt(0).toUpperCase();
  }

  toggleUser(e: Event): void {
    e.stopPropagation();
    this.searchOpen = false;
    this.userOpen = !this.userOpen;
  }

  logout(e: Event): void {
    e.preventDefault();
    localStorage.removeItem('currentUser');
    sessionStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    this.user = null;
    this.userOpen = false;
    this.loadCart();
    window.dispatchEvent(new Event('auth-changed'));
    window.dispatchEvent(new Event('cart-updated'));
    this.router.navigate(['/login']);
  }

  /* ================= GIỎ HÀNG ================= */
  private loadCart(): void {
    this.cart = this.cartService.getCart();
  }

  get cartCount(): number {
    return this.cart.reduce((s, i) => s + Number(i.quantity || 0), 0);
  }

  get cartTotal(): number {
    return this.cart.reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || 0), 0);
  }

  openCart(e: Event): void {
    e.stopPropagation();
    this.closePanels();
    this.loadCart();
    this.cartOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeCart(): void {
    this.cartOpen = false;
    document.body.style.overflow = '';
  }

  changeQty(item: any, delta: number): void {
    this.cartService.changeQuantity(item, delta);
  }

  removeItem(item: any): void {
    this.cartService.removeItem(item);
  }

  openVariantPicker(item: CartItem): void {
    const requestId = ++this.variantPickerRequestId;
    this.variantPickerItem = item;
    this.variantPickerQuantity = Math.max(1, Number(item.quantity || 1));
    this.variantPickerError = '';
    this.variantPickerLoading = false;

    const cachedProduct = this.findCartProduct(item, this.productService.getCachedProducts() ?? []);
    const immediateVariants = item.variants?.length ? item.variants : cachedProduct?.variants ?? [];
    if (immediateVariants.length) {
      this.applyVariantOptions(immediateVariants, item);
      return;
    }

    this.variantOptions = [];
    this.selectedVariant = null;
    this.variantPickerLoading = true;

    this.productService.getProducts().subscribe({
      next: (products) => {
        if (requestId !== this.variantPickerRequestId) return;

        const product = this.findCartProduct(item, products);
        this.applyVariantOptions(product?.variants ?? [], item);
        this.variantPickerLoading = false;
      },
      error: (error: unknown) => {
        if (requestId !== this.variantPickerRequestId) return;

        console.error('Không thể tải phân loại sản phẩm:', error);
        this.variantPickerError = 'Không thể tải phân loại. Vui lòng thử lại.';
        this.variantPickerLoading = false;
      },
    });
  }

  private findCartProduct(item: CartItem, products: Products[]): Products | undefined {
    return products.find((candidate) => {
      const identifiers = candidate as Products & { _id?: string; id?: string };
      return candidate.sku === item.productSku ||
        candidate.slug === item.slug ||
        candidate.sku === item.productId ||
        identifiers._id === item.productId ||
        identifiers.id === item.productId ||
        candidate.variants.some((variant) => variant.sku === item.variantSku);
    });
  }

  private applyVariantOptions(variants: CartVariant[], item: CartItem): void {
    this.variantOptions = variants;
    this.selectedVariant =
      variants.find((variant) => variant.sku === item.variantSku) ??
      variants.find((variant) => 'isDefault' in variant && variant.isDefault) ??
      variants[0] ??
      null;
    if (this.selectedVariant) {
      this.variantPickerQuantity = Math.min(
        this.variantPickerQuantity,
        Math.max(this.selectedVariant.stock ?? 0, 1),
      );
    }
    if (variants.length < 2) {
      this.variantPickerError = 'Sản phẩm không có phân loại khác để đổi.';
    }
  }

  selectVariant(variant: CartVariant): void {
    this.selectedVariant = variant;
    this.variantPickerQuantity = Math.min(
      this.variantPickerQuantity,
      Math.max(variant.stock ?? 0, 1),
    );
    this.variantPickerError = '';
  }

  changeVariantPickerQuantity(delta: number): void {
    const nextQuantity = this.variantPickerQuantity + delta;
    if (nextQuantity >= 1 && nextQuantity <= (this.selectedVariant?.stock ?? 0)) {
      this.variantPickerQuantity = nextQuantity;
    }
  }

  get variantPickerPrice(): number {
    return this.selectedVariant?.price ?? 0;
  }

  confirmVariantChange(): void {
    if (!this.variantPickerItem || !this.selectedVariant) return;
    if (this.cartService.changeVariant(
      this.variantPickerItem,
      this.selectedVariant,
      this.variantPickerQuantity,
    )) {
      this.loadCart();
      this.closeVariantPicker();
    } else {
      this.variantPickerError = this.cartService.cartMessage();
    }
  }

  closeVariantPicker(): void {
    this.variantPickerRequestId++;
    this.variantPickerItem = null;
    this.variantOptions = [];
    this.selectedVariant = null;
    this.variantPickerQuantity = 1;
    this.variantPickerError = '';
    this.variantPickerLoading = false;
  }

  cartImage(it: any): string {
    return this.resolveImage(it.image || it.thumbnail || it.img);
  }

  /* ================= HÀM HỖ TRỢ SẢN PHẨM ================= */
  getName(p: any): string { return p.name || p.productName || p.product_name || p.title || ''; }
  getPrice(p: any): number { return Number(p.price ?? p.minPrice ?? p.productPrice ?? 0); }
  getImage(p: any): string {
    if (p.imageData && !String(p.thumbnail || '').startsWith('http')) {
      return p.imageData.startsWith('data:image/') ? p.imageData : `data:${p.imageMimeType || 'image/webp'};base64,${p.imageData}`;
    }
    return this.resolveImage(p.thumbnail);
  }

  private resolveImage(src: any): string {
    if (typeof src !== 'string' || !src) return '/assets/images/no-image.svg';
    if (/^(https?:|data:image\/)/.test(src)) return src;
    if (src.startsWith('/assets/')) return src;
    if (src.startsWith('assets/')) return `/${src}`;
    return `/assets/images/${src}`;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN').format(price) + '₫';
  }

  onImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.onerror = null;
    img.src = '/assets/images/no-image.svg';
  }
}
