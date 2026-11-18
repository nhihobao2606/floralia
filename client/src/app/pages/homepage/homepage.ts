import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProductService } from '../../services/product-service';
import { ReviewService } from '../../services/review-service';
import { ProductNavigationService } from '../../services/product-navigation-service';
import { BlogService } from '../../services/blog-service';
import { Products } from '../../classes/Products';
import { Blog } from '../../classes/Blog';
import { blogImageSource } from '../../classes/blog-image';
import { blogDetailLink } from '../../classes/blog-url';
import { CartService } from '../../services/cart-service';
import { WishlistService } from '../../services/wishlist-service';
import { BuyNowService } from '../../services/buy-now-service';
import { formatVietnameseDong } from "../../shared/vnd-format";

@Component({
  selector: 'app-homepage',
  standalone: false,
  templateUrl: './homepage.html',
  styleUrl: './homepage.css',
})
export class Homepage implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  products = signal<Products[]>([]);
  featured = signal<Products[]>([]);
  bestSelling = signal<Products[]>([]);
  recommendationTitle = signal('');
  recommendationReasons = signal<Record<string, string>>({});
  recommendationsReady = signal(false);
  recommendationModelStats = signal<{ trainedOrders: number; learnedProducts: number; customerProfileProducts: number; customerViewProducts: number } | null>(null);
  private recommendationRequestId = 0;
  private recommendationRequestPending = false;
  loading = signal(true);

  // Danh sách sản phẩm yêu thích (lưu tạm trong phiên).
  wishlist = signal<Set<string>>(new Set());

  stars = [1, 2, 3, 4, 5];

  banners = [
    '/assets/images/banner.png',
    '/assets/images/banner2.png',
    '/assets/images/banner3.png',
  ];

  needs = [
    { slug: 'thanh-loc', img: '/assets/images/thanhloc.jpg', title: 'Thanh lọc', desc: 'Nhẹ nhàng mỗi ngày' },
    { slug: 'duong-nhan', img: '/assets/images/duongnhan.jpg', title: 'Dưỡng nhan', desc: 'Chăm sóc từ bên trong' },
    { slug: 'giam-stress', img: '/assets/images/giamstress.png', title: 'Giảm stress', desc: 'Thư giãn tâm trí' },
    { slug: 'thanh-tam', img: '/assets/images/thanhtam.png', title: 'Thanh tâm', desc: 'Tìm lại sự an yên' },
    { slug: 'bo-khi-huyet', img: '/assets/images/bokhi.png', title: 'Bổ khí huyết', desc: 'Bồi dưỡng mỗi ngày' },
  ];

  testimonials = [
    {
      img: '/assets/images/kh1.jpg',
      name: 'HỒ BẢO NHI',
      text: 'Mình rất thích Hồng Nhãn Trà của Floralia với hương thanh nhẹ, vị dịu dàng. Một tách trà giúp mình có khoảng thời gian thư giãn sau ngày dài.',
    },
    {
      img: '/assets/images/kh3.jpg',
      name: 'NGUYỄN THU HÀ',
      text: 'Trà rất thơm, đóng gói đẹp. Mình đặc biệt thích trà hoa cúc vì hương thơm nhẹ nhàng, dễ uống.',
    },
    {
      img: '/assets/images/kh2.jpg',
      name: 'TRẦN MINH KHÔI',
      text: 'Hương trà tự nhiên, vị dễ chịu. Mình sẽ tiếp tục ủng hộ Floralia.',
    },
    {
      img: '/assets/images/kh4.jpg',
      name: 'LÊ PHƯƠNG ANH',
      text: 'Mình mua trà làm quà tặng và rất thích cách đóng gói tinh tế của Floralia.',
    },
    {
      img: '/assets/images/kh5.jpg',
      name: 'PHẠM GIA HÂN',
      text: 'Sản phẩm được đóng gói cẩn thận, thông tin rõ ràng và có nhiều lựa chọn.',
    },
  ];

  blogs = signal<Blog[]>([]);
  blogsLoading = signal(true);

  blogDetailLink(blog: Blog): string[] {
    return blogDetailLink(blog);
  }

  constructor(
    private productService: ProductService,
    private blogService: BlogService,
    private reviewService: ReviewService,
    readonly productNavigation: ProductNavigationService,
    readonly cartService: CartService,
    readonly buyNowService: BuyNowService,
    private readonly wishlistService: WishlistService,
  ) {}

  cartPopupProduct: Products | null = null;
  cartPopupVariant: Products['variants'][number] | null = null;
  cartPopupQuantity = 1;

  addToCart(product: Products, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!this.hasStock(product)) return;
    this.cartPopupProduct = product;
    const preferredVariant = this.getDisplayVariant(product);
    this.cartPopupVariant =
      (preferredVariant && preferredVariant.stock > 0 ? preferredVariant : null) ??
      product.variants?.find(option => option.isDefault && option.stock > 0) ??
      product.variants?.find(option => option.stock > 0) ??
      product.variants?.find(option => option.isDefault) ??
      product.variants?.[0] ?? null;
    this.cartPopupQuantity = 1;
  }

  hasStock(product: Products): boolean {
    return product.variants?.length
      ? product.variants.some(variant => variant.stock > 0)
      : product.stock > 0;
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

  changeCartPopupQuantity(delta: number): void {
    const next = this.cartPopupQuantity + delta;
    if (next >= 1 && next <= this.cartPopupStock) this.cartPopupQuantity = next;
  }

  confirmAddToCart(): void {
    const product = this.cartPopupProduct;
    if (!product || this.cartPopupStock < 1) return;
    this.cartService.addProduct(product, this.cartPopupVariant, this.cartPopupQuantity, this.getProductImage(product));
    this.closeCartPopup();
  }

  buyNow(product: Products): void {
    this.buyNowService.open(product, this.getProductImage(product), this.getDisplayVariant(product));
  }

  private sortBySoldCount(products: Products[]): Products[] {
    return [...products].sort((left, right) => Number(right.sold || 0) - Number(left.sold || 0));
  }

  private loadRecommendations(catalog: Products[]): void {
    const requestId = ++this.recommendationRequestId;
    this.recommendationRequestPending = true;
    this.productService.getRecommendations().subscribe({
      next: recommendation => {
        if (requestId !== this.recommendationRequestId) return;
        this.recommendationRequestPending = false;
        const currentProducts = this.products().length ? this.products() : catalog;
        const bySku = new Map(currentProducts.map(product => [String(product.sku), product] as const));
        const recommended = (recommendation.products || [])
          .map(product => bySku.get(String(product.sku)) ?? product);
        this.featured.set(recommended);
        this.bestSelling.set(this.sortBySoldCount(currentProducts).slice(0, 4));
        const title = this.getRecommendationTitle(recommendation.segmentId, recommendation.segmentName);
        this.recommendationTitle.set(title);
        this.saveRecommendationSegment(recommendation.segmentId, recommendation.segmentName);
        this.recommendationReasons.set(Object.fromEntries(
          (recommendation.recommendationReasons || []).map(item => [item.sku, item.reason]),
        ));
        this.recommendationModelStats.set(recommendation.modelStats || null);
        this.recommendationsReady.set(true);
      },
      error: error => {
        if (requestId === this.recommendationRequestId) {
          this.recommendationRequestPending = false;
          console.warn('Could not refresh product recommendations:', error);
          const fallbackCatalog = this.products().length ? this.products() : catalog;
          if (!this.recommendationsReady() && fallbackCatalog.length) {
            const featuredList = fallbackCatalog.filter(product => product.featured === true);
            this.featured.set((featuredList.length ? featuredList : fallbackCatalog).slice(0, 8));
          }
          if (fallbackCatalog.length) this.recommendationsReady.set(true);
        }
      },
    });
  }

  private getRecommendationTitle(segmentId: string | null, segmentName: string): string {
    const hasSignedInAccount = Boolean(localStorage.getItem('token') || sessionStorage.getItem('token'));
    if (segmentId === 'new' && hasSignedInAccount) return 'G\u1ee3i \u00fd cho kh\u00e1ch h\u00e0ng m\u1edbi';
    if (!hasSignedInAccount) return 'G\u1ee3i \u00fd d\u00e0nh ri\u00eang cho b\u1ea1n';
    return `G\u1ee3i \u00fd cho ${segmentName.toLowerCase()}`;
  }

  private recommendationCacheKey(): string {
    const rawUser = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    if (rawUser) {
      try {
        const user = JSON.parse(rawUser);
        const userId = String(user.id || user._id || '').trim();
        if (userId) return `floralia_recommendation_segment_${userId}`;
      } catch { /* Use the guest cache when no readable account ID is available. */ }
    }
    return 'floralia_recommendation_segment_guest';
  }

  private saveRecommendationSegment(segmentId: string | null, segmentName: string): void {
    try {
      localStorage.setItem(this.recommendationCacheKey(), JSON.stringify({ segmentId, segmentName }));
    } catch { /* Recommendations still work when browser storage is unavailable. */ }
  }

  private loadCachedRecommendationTitle(): void {
    try {
      const raw = localStorage.getItem(this.recommendationCacheKey());
      if (!raw) return;
      const cached = JSON.parse(raw) as { segmentId?: string | null; segmentName?: string };
      if (cached.segmentName) {
        this.recommendationTitle.set(this.getRecommendationTitle(cached.segmentId || null, cached.segmentName));
      }
    } catch { /* Use the default title when there is no valid cached segment. */ }
  }

  getRecommendationReason(product: Products): string {
    return this.recommendationReasons()[product.sku] || '';
  }
  

  ngOnInit(): void {
    const hasSignedInAccount = Boolean(localStorage.getItem('token') || sessionStorage.getItem('token'));
    this.recommendationTitle.set(hasSignedInAccount ? 'G\u1ee3i \u00fd cho b\u1ea1n' : 'G\u1ee3i \u00fd d\u00e0nh ri\u00eang cho b\u1ea1n');
    this.loadCachedRecommendationTitle();
    this.loadRecommendations([]);

    this.reviewService.ratingUpdates
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((update) => {
        const applyRating = (products: Products[]) =>
          products.map((product) => product.sku === update.productSku
            ? { ...product, ratingAverage: update.ratingAverage, ratingCount: update.ratingCount }
            : product);

        this.products.update(applyRating);
        this.featured.update(applyRating);
        this.bestSelling.update(applyRating);
      });

    this.productService.recommendationChanges$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const hasSignedInAccount = Boolean(localStorage.getItem('token') || sessionStorage.getItem('token'));
        this.recommendationTitle.set(hasSignedInAccount ? 'G\u1ee3i \u00fd cho b\u1ea1n' : 'G\u1ee3i \u00fd d\u00e0nh ri\u00eang cho b\u1ea1n');
        this.loadCachedRecommendationTitle();
        this.loadRecommendations(this.products());
      });

    this.productService.getAll().subscribe({
      next: (res: any) => {
        let list: Products[] = [];

        if (Array.isArray(res)) list = res;
        else if (Array.isArray(res?.data)) list = res.data;
        else if (Array.isArray(res?.products)) list = res.products;

        list = list.map(product => {
          const defaultVariant = product.variants?.find(variant => variant.isDefault) ?? product.variants?.[0];
          return defaultVariant ? { ...product, price: defaultVariant.price } : product;
        });
        this.products.set(list);
        const bySku = new Map(list.map(product => [String(product.sku), product] as const));
        this.featured.update(recommended => recommended.map(product => bySku.get(String(product.sku)) ?? product));
       

        // Sản phẩm bán chạy: sắp xếp theo số lượng đã bán.
        this.bestSelling.set(this.sortBySoldCount(list).slice(0, 4));

        if (!this.recommendationsReady() && !this.recommendationRequestPending) this.loadRecommendations(list);

        this.loading.set(false);
      },
      error: (err) => {
        console.error('Lỗi lấy sản phẩm Floralia:', err);
        this.products.set([]);
        this.featured.set([]);
        this.bestSelling.set([]);
        this.loading.set(false);
      },
    });
    this.productService.productsChanges$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshProducts());

    // Lấy trực tiếp các bài viết từ cùng API với trang blog.
    this.blogsLoading.set(true);
    this.blogService.getAll({ limit: 3 }).subscribe({
      next: (res) => {
        this.blogs.set(res?.data || []);
        this.blogsLoading.set(false);
      },
      error: (err) => {
        console.warn('Không tải được danh sách blog từ API:', err);
        this.blogs.set([]);
        this.blogsLoading.set(false);
      },
    });
  }

  private refreshProducts(): void {
    this.productService.getAll().subscribe({
      next: (response: any) => {
        const source: Products[] = Array.isArray(response)
          ? response
          : Array.isArray(response?.data) ? response.data
            : Array.isArray(response?.products) ? response.products : [];
        const list = source.map(product => {
          const variant = product.variants?.find(option => option.isDefault) ?? product.variants?.[0];
          return variant ? { ...product, price: variant.price } : product;
        });
        this.products.set(list);
        this.bestSelling.set(this.sortBySoldCount(list).slice(0, 4));
        this.loadRecommendations(list);
      },
      error: error => console.error('Không thể làm mới sản phẩm:', error),
    });
  }

  getBlogImg(blog: Blog): string {
    return blogImageSource(blog);
  }

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
    return this.getDisplayOldPrice(product) > this.getProductPrice(product);
  }

  getOldPrice(product: Products): number {
    const p: any = product;
    return this.getDisplayOldPrice(product);
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

  private getDisplayOldPrice(product: Products): number {
    const variant = this.getDisplayVariant(product);
    const price = Number(variant?.price ?? product.price ?? 0);
    const oldPrice = Number(variant?.oldPrice ?? product.oldPrice ?? 0);
    return oldPrice > price ? oldPrice : 0;
  }

  formatRatingAverage(product: Products): string {
    return Number(product.ratingAverage || 0).toFixed(1);
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

    if (p.imageData) {
      if (p.imageData.startsWith('data:image/')) return p.imageData;
      const mimeType = p.imageMimeType || 'image/webp';
      return `data:${mimeType};base64,${p.imageData}`;
    }

    if (p.imageUrl) {
      return p.imageUrl.startsWith('http://') || p.imageUrl.startsWith('https://')
        ? p.imageUrl
        : `http://localhost:3002${p.imageUrl.startsWith('/') ? '' : '/'}${p.imageUrl}`;
    }

    return '/assets/images/no-image.svg';
  }

  getProductId(product: Products): string {
    const p: any = product;
    return p._id || p.id || p.productId || p.slug || '';
  }

  // Yêu thích sản phẩm.
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
}
