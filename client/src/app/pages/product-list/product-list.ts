import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductService } from '../../services/product-service';
import { ReviewService } from '../../services/review-service';
import { ProductNavigationService } from '../../services/product-navigation-service';
import { CartService } from '../../services/cart-service';
import { WishlistService } from '../../services/wishlist-service';
import { Products } from '../../classes/Products';
import { BuyNowService } from '../../services/buy-now-service';

@Component({
  selector: 'app-product-list',
  standalone: false,
  templateUrl: './product-list.html',
  styleUrls: ['./product-list.css']
})
export class ProductListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  products: Products[] = [];
  filteredProducts: Products[] = [];
  loading: boolean = true;
  isSidebarCollapsed: boolean = false;

  // Trạng thái lọc
  selectedCategory: string = 'all';
  selectedSubCategory = '';
  selectedPriceRange: string = 'all';
  selectedTag: string = '';
  currentPage = 1;
  wishlist = new Set<string>();
  cartPopupProduct: Products | null = null;
  cartPopupVariant: Products['variants'][number] | null = null;
  cartPopupQuantity = 1;

  categories = [
    { name: 'Trà thảo mộc', slug: 'tra-thao-moc' },
    { name: 'Trà thảo mộc mix', slug: 'tra-thao-moc-mix' },
    { name: 'Đồ uống kèm trà', slug: 'do-uong-kem-tra' },
    { name: 'Ấm trà', slug: 'am-tra' },
    { name: 'Set quà tặng', slug: 'set-qua-tang' }
  ];

  priceRanges = [
    { label: 'Dưới 100.000đ', value: '0-100000' },
    { label: '100.000đ - 200.000đ', value: '100000-200000' },
    { label: '200.000đ - 600.000đ', value: '200000-600000' },
    { label: '600.000đ - 1.000.000đ', value: '600000-1000000' }
  ];

  private allBenefits: Array<{ label: string; values: string[]; parentSlugs?: string[] }> = [];
  benefitsList: Array<{ label: string; values: string[]; parentSlugs?: string[] }> = [
    { label: 'Thanh lọc – Mát gan', values: ['thanh-loc', 'mat-gan'] },
    { label: 'Dưỡng nhan – Cân bằng nội tiết', values: ['duong-nhan', 'can-bang-noi-tiet'] },
    { label: 'Thanh tâm – Dưỡng thần', values: ['thanh-tam', 'duong-than'] },
    { label: 'Giảm stress – Ngủ ngon', values: ['giam-stress', 'ngu-ngon'] },
    { label: 'Bổ khí huyết – Dưỡng sinh', values: ['bo-khi-huyet', 'duong-sinh'] }
  ];

  constructor(
    private productService: ProductService,
    private reviewService: ReviewService,
    readonly productNavigation: ProductNavigationService,
    private route: ActivatedRoute,
    private router: Router,
    private changeDetector: ChangeDetectorRef,
    readonly cartService: CartService,
    private readonly wishlistService: WishlistService,
    readonly buyNowService: BuyNowService,
  ) {}

  get pageSize(): number {
    return this.isSidebarCollapsed ? 16 : 12;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredProducts.length / this.pageSize));
  }

  get hasActiveFilters(): boolean {
    return this.selectedCategory !== 'all' ||
      this.selectedSubCategory !== '' ||
      this.selectedPriceRange !== 'all' ||
      this.selectedTag !== '';
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index + 1);
  }

  get paginatedProducts(): Products[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredProducts.slice(start, start + this.pageSize);
  }

  get promotionProducts(): Products[] {
    return this.products
      .filter(product => product.isSale || product.discount > 0)
      .slice(0, 3);
  }

  formatRatingAverage(ratingAverage: number | null | undefined): string {
    return Number(ratingAverage ?? 0).toFixed(1);
  }

  getRoundedRatingAverage(ratingAverage: number | null | undefined): number {
    return Math.round(Number(ratingAverage ?? 0));
  }

  get pageItems(): Array<number | 'ellipsis'> {
    if (this.totalPages <= 7) {
      return this.pageNumbers;
    }

    if (this.currentPage <= 4) {
      return [1, 2, 3, 4, 5, 'ellipsis', this.totalPages];
    }

    if (this.currentPage >= this.totalPages - 3) {
      return [1, 'ellipsis', this.totalPages - 4, this.totalPages - 3, this.totalPages - 2, this.totalPages - 1, this.totalPages];
    }

    return [1, 'ellipsis', this.currentPage - 1, this.currentPage, this.currentPage + 1, 'ellipsis', this.totalPages];
  }

  ngOnInit(): void {
    this.reviewService.ratingUpdates
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((update) => {
        const product = this.products.find((item) => item.sku === update.productSku);
        if (!product) return;

        product.ratingAverage = update.ratingAverage;
        product.ratingCount = update.ratingCount;
        this.changeDetector.markForCheck();
      });

    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncCategoryFromRoute());
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncCategoryFromRoute());
    this.route.queryParamMap.subscribe(params => {
      this.selectedCategory = params.get('category') || 'all';
        const benefitSlug = this.normalizeSlug(params.get('congdung') || '');
        this.selectedTag = this.benefitsList.find(benefit =>
          benefit.values.some(value => this.normalizeSlug(value) === benefitSlug)
        )?.label ?? '';
        this.applyFilters();
        this.changeDetector.markForCheck();
      });
    this.productService.productsChanges$
      ?.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadPublicCategories();
        this.fetchProducts(false);
      });
    this.loadPublicCategories();
    this.fetchProducts(true);
  }

  private loadPublicCategories(): void {
    this.productService.getCategories().subscribe({
      next: (res) => {
        if (Array.isArray(res?.mainCategories)) {
          this.categories = res.mainCategories.map((cat) => ({ name: cat.name, slug: cat.slug }));
        }
        if (Array.isArray(res?.benefits)) {
          this.allBenefits = res.benefits.map((b) => ({
            label: b.label,
            values: b.values?.length ? b.values : [b.slug],
            parentSlugs: b.parentSlugs || [],
          }));
          this.syncBenefitsForSelectedCategory();
        }
        this.applyFilters();
        this.changeDetector.markForCheck();
      },
      error: () => {},
    });
  }

  private syncBenefitsForSelectedCategory(): void {
    if (this.selectedCategory === 'all') {
      this.benefitsList = [...this.allBenefits];
      return;
    }
    const matching = this.allBenefits.filter(
      (b) => !b.parentSlugs?.length || b.parentSlugs.includes(this.selectedCategory)
    );
    this.benefitsList = matching.length ? matching : [...this.allBenefits];
  }

  private syncCategoryFromRoute(): void {
    this.selectedCategory = this.route.snapshot.queryParamMap.get('category') || 'all';
    this.selectedSubCategory = this.route.snapshot.queryParamMap.get('subCategory') || '';
    this.syncBenefitsForSelectedCategory();
    this.applyFilters();
    this.changeDetector.markForCheck();
  }

  fetchProducts(showSpinner = true): void {
    if (showSpinner && !this.products.length) {
      this.loading = true;
    }
    const savedPage = this.currentPage;
    this.productService.getProducts().subscribe({
      next: (data) => {
        this.products = data || [];
        
        // Gán giá hiển thị mặc định (thấp nhất) từ variants cho từng sản phẩm
        this.products.forEach((p: any) => {
          if (p.variants && p.variants.length > 0) {
            const lowestVar = p.variants.reduce((minVar: any, curVar: any) =>
              (curVar.price ?? 0) < (minVar.price ?? 0) ? curVar : minVar, p.variants[0]
            );
            p.price = lowestVar ? lowestVar.price : 0;
            p.oldPrice = lowestVar ? (lowestVar.oldPrice ?? p.oldPrice ?? 0) : (p.oldPrice ?? 0);
          } else if (!p.price) {
            p.price = 0;
          }
        });

        this.applyFilters();
        if (!showSpinner) {
          this.currentPage = Math.min(savedPage, this.totalPages);
        }
        this.loading = false;
        this.changeDetector.markForCheck();
      },
      error: (err) => {
        console.error('Lỗi API:', err);
        this.loading = false;
        this.changeDetector.markForCheck();
      }
    });
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
    this.currentPage = 1;
  }

  onSelectCategory(slug: string): void {
    this.selectedCategory = slug;
    this.syncBenefitsForSelectedCategory();
    this.selectedSubCategory = '';
    this.applyFilters();
    this.selectedTag = '';
    this.applyFilters();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        category: slug === 'all' ? null : slug,
        subCategory: null,
        congdung: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  clearFilters(): void {
    this.selectedCategory = 'all';
    this.selectedSubCategory = '';
    this.selectedPriceRange = 'all';
    this.selectedTag = '';
    this.applyFilters();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        category: null,
        subCategory: null,
        congdung: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onSelectPrice(value: string): void {
    this.selectedPriceRange = value;
    this.applyFilters();
  }

  onSelectTag(tag: string): void {
    this.selectedTag = this.selectedTag === tag ? '' : tag; // Toggle chọn / bỏ chọn
    this.applyFilters();
    const benefit = this.benefitsList.find(item => item.label === this.selectedTag);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { congdung: benefit?.values[0] ?? null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      window.requestAnimationFrame(() => {
        document.getElementById('product-list')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      });
    }
  }

  getProductId(product: Products): string {
    return product.slug || product.sku;
  }

  hasStock(product: Products): boolean {
    if (product.status === 'out-of-stock' || product.status === 'inactive' || product.isActive === false) {
      return false;
    }
    return product.variants?.length
      ? product.variants.some((variant) => variant.stock > 0)
      : product.stock > 0;
  }

  getMatchingVariants(product: Products): Products['variants'] {
    const variants = product.variants ?? [];
    if (!variants.length) return [];
    if (this.selectedPriceRange === 'all') return variants;
    const [min, max] = this.selectedPriceRange.split('-').map(Number);
    const matched = variants.filter((variant) => {
      const price = variant.price ?? 0;
      return price >= min && price <= max;
    });
    return matched.length ? matched : variants;
  }

  getDisplayVariant(product: Products): Products['variants'][number] | null {
    const matching = this.getMatchingVariants(product);
    if (!matching.length) return null;
    const inStockMatching = matching.filter((variant) => (variant.stock ?? 0) > 0);
    const pool = inStockMatching.length ? inStockMatching : matching;
    return pool.reduce((lowest, variant) =>
      (variant.price ?? 0) < (lowest.price ?? 0) ? variant : lowest, pool[0]
    );
  }

  shouldShowFromPrefix(product?: Products): boolean {
    return this.selectedPriceRange === 'all' && (product?.variants?.length ?? 0) > 1;
  }

  getDisplayVariantLabel(product: Products): string {
    return this.getDisplayVariant(product)?.label || '';
  }

  getDisplayPrice(product: Products): number {
    return this.getDisplayVariant(product)?.price ?? product.price ?? 0;
  }

  getDisplayOldPrice(product: Products): number {
    const variant = this.getDisplayVariant(product);
    const price = this.getDisplayPrice(product);
    const oldPrice = variant ? Number(variant.oldPrice ?? 0) : Number(product.oldPrice ?? 0);
    return oldPrice > price ? oldPrice : 0;
  }

  getDisplayDiscount(product: Products): number {
    const price = this.getDisplayPrice(product);
    const oldPrice = this.getDisplayOldPrice(product);
    if (oldPrice > price && oldPrice > 0) {
      return Math.round((1 - price / oldPrice) * 100);
    }
    return !product.variants?.length && product.discount > 0 ? product.discount : 0;
  }

  addToCart(product: Products): void {
    this.cartPopupProduct = product;
    const preferred = this.getDisplayVariant(product);
    this.cartPopupVariant =
      (preferred && preferred.stock > 0 ? preferred : null) ??
      product.variants?.find((option) => option.isDefault && option.stock > 0) ??
      product.variants?.find((option) => option.stock > 0) ??
      preferred ??
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

  get cartPopupOldPrice(): number {
    return this.cartPopupVariant?.oldPrice ?? this.cartPopupProduct?.oldPrice ?? 0;
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

  openBuyNowPopup(product: Products): void {
    this.buyNowService.open(product, this.getProductImage(product), this.getDisplayVariant(product));
  }

  isWished(product: Products): boolean {
    return this.wishlistService.isSaved(product);
  }

  toggleWish(product: Products): void {
    this.wishlistService.toggle(product);
    this.wishlist = new Set(this.wishlistService.ids());
  }

  private normalizeSlug(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  getProductImage(product: Products): string {
    const imageUrl = product.imageUrl;

    if (imageUrl) {
      return imageUrl.startsWith('http://') || imageUrl.startsWith('https://')
        ? imageUrl
        : `http://localhost:3002${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
    }

    const thumbnail = product.thumbnail || '';

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

    if (product.imageData) {
      if (product.imageData.startsWith('data:image/')) return product.imageData;
      return `data:${product.imageMimeType || 'image/webp'};base64,${product.imageData}`;
    }

    return '/assets/images/no-image.svg';
  }

  applyFilters(): void {
    if (!this.products) return;

    this.filteredProducts = this.products.filter(item => {
      // 1. Lọc theo Danh mục
      const matchCat = this.selectedCategory === 'all' ||
        [item.categorySlug, item.category]
          .some(category => this.normalizeSlug(category ?? '') === this.selectedCategory.toLowerCase());
      const matchSubCategory = !this.selectedSubCategory ||
        this.normalizeSlug(item.subCategory ?? '') === this.selectedSubCategory.toLowerCase();

      // 2. Lọc theo Giá (xét tất cả các phân loại của sản phẩm theo giá bán đã giảm)
      let matchPrice = true;
      if (this.selectedPriceRange !== 'all') {
        const [min, max] = this.selectedPriceRange.split('-').map(Number);
        if (item.variants?.length) {
          matchPrice = item.variants.some((variant) => {
            const vPrice = variant.price ?? 0;
            return vPrice >= min && vPrice <= max;
          });
        } else {
          const itemPrice = item.price ?? 0;
          matchPrice = itemPrice >= min && itemPrice <= max;
        }
      }

      // 3. Lọc theo Tag Công dụng
      let matchTag = true;
      if (this.selectedTag) {
        const selectedBenefit = this.benefitsList.find(benefit => benefit.label === this.selectedTag);
        const searchableBenefits = [...(item.benefits ?? []), ...(item.tags ?? [])]
          .map(value => this.normalizeSlug(value));
        matchTag = selectedBenefit?.values.some(value =>
          searchableBenefits.includes(this.normalizeSlug(value))
        ) ?? false;
      }

      return matchCat && matchSubCategory && matchPrice && matchTag;
    });
    this.currentPage = 1;
  }
}
