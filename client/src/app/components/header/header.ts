import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProductService } from '../../services/product-service';

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

  // Giỏ hàng, người dùng
  cartOpen = false;
  cart: any[] = [];
  user: any = null;
  userOpen = false;

  // Giao diện
  scrolled = false;
  showFloat = false;
  showInvite = false;

  private subs = new Subscription();
  private timers: any[] = [];

  constructor(private productService: ProductService, private router: Router) {}

  ngOnInit(): void {
    this.loadUser();
    this.loadCart();
    this.onScroll();

    // Mỗi lần chuyển trang: đóng các khung, cập nhật user và giỏ hàng (vd. vừa đăng nhập xong).
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

    // Bong bóng mời "mix trà" tự hiện định kỳ.
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
    this.closePanels();
    this.closeCart();
  }

  // Giỏ hàng/đăng nhập thay đổi ở tab khác hoặc do code khác phát sự kiện 'cart-updated'.
  @HostListener('window:storage')
  @HostListener('window:cart-updated')
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

  // Tìm kiếm không phân biệt hoa thường và dấu tiếng Việt
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

  // Lấy URL ảnh tương thích với API mới và dữ liệu cũ
  getSearchProductImage(product: any): string {
    const thumbnail = product.thumbnail;

    // Đường dẫn ảnh từ API mới
    if (product.imageUrl) {
      if (
        product.imageUrl.startsWith('http://') ||
        product.imageUrl.startsWith('https://')
      ) {
        return product.imageUrl;
      }

      return `http://localhost:3002${product.imageUrl}`;
    }

  // URL ảnh đầy đủ hoặc ảnh Base64
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

  // Ảnh lưu trong thư mục assets
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

  // Dữ liệu Base64 từ API cũ
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

  /* ================= TÀI KHOẢN ================= */
  private loadUser(): void {
    const raw = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    try { this.user = raw ? JSON.parse(raw) : null; } catch { this.user = null; }
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
    this.router.navigate(['/login']);
  }

  /* ================= GIỎ HÀNG ================= */
  private get cartKey(): string {
    return this.user ? `cart_user_${this.user.email || this.user.id}` : 'cart_guest';
  }

  private loadCart(): void {
    try { this.cart = JSON.parse(localStorage.getItem(this.cartKey) || '[]'); } catch { this.cart = []; }
  }

  private saveCart(): void {
    localStorage.setItem(this.cartKey, JSON.stringify(this.cart));
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
    item.quantity = Number(item.quantity || 0) + delta;
    if (item.quantity < 1) { this.removeItem(item); return; }
    this.saveCart();
  }

  removeItem(item: any): void {
    this.cart = this.cart.filter((i) => i !== item);
    this.saveCart();
  }

  cartImage(it: any): string {
    return this.resolveImage(it.image || it.thumbnail || it.img);
  }

  /* ================= HÀM HỖ TRỢ SẢN PHẨM ================= */
  getId(p: any): string { return p._id || p.id || p.productId || p.slug || ''; }
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