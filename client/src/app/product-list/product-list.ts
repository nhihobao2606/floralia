import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProductService } from '../services/product-service';
import { Products } from '../classes/Products';

@Component({
  selector: 'app-product-list',
  standalone: false,
  templateUrl: './product-list.html',
  styleUrls: ['./product-list.css']
})
export class ProductListComponent implements OnInit {
  products: Products[] = [];
  filteredProducts: Products[] = [];
  loading: boolean = true;
  isSidebarCollapsed: boolean = false;

  // Trạng thái lọc
  selectedCategory: string = 'all';
  selectedPriceRange: string = 'all';
  selectedTag: string = '';
  currentPage = 1;
  wishlist = new Set<string>();

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

  benefitsList = [
    { label: 'Thanh lọc – Mát gan', values: ['thanh-loc', 'mat-gan'] },
    { label: 'Dưỡng nhan – Cân bằng nội tiết', values: ['duong-nhan', 'can-bang-noi-tiet'] },
    { label: 'Thanh tâm – Dưỡng thần', values: ['thanh-tam', 'duong-than'] },
    { label: 'Giảm stress – Ngủ ngon', values: ['giam-stress', 'ngu-ngon'] },
    { label: 'Bổ khí huyết – Dưỡng sinh', values: ['bo-khi-huyet', 'duong-sinh'] }
  ];

  constructor(
    private productService: ProductService,
    private route: ActivatedRoute,
    private changeDetector: ChangeDetectorRef
  ) {}

  get pageSize(): number {
    return this.isSidebarCollapsed ? 16 : 12;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredProducts.length / this.pageSize));
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
    this.fetchProducts();
  }

  fetchProducts(): void {
    this.loading = true;
    this.productService.getProducts().subscribe({
      next: (data) => {
        this.products = data || [];
        
        // Gán giá hiển thị mặc định từ variants cho từng sản phẩm
        this.products.forEach((p: any) => {
          if (p.variants && p.variants.length > 0) {
            const defaultVar = p.variants.find((v: any) => v.isDefault) || p.variants[0];
            p.price = defaultVar ? defaultVar.price : 0;
          } else if (!p.price) {
            p.price = 0;
          }
        });

        // Lắng nghe category parameter từ URL header menu
        this.route.queryParams.subscribe(params => {
          if (params['category']) {
            this.selectedCategory = params['category'];
          } else {
            this.selectedCategory = 'all';
          }
          this.applyFilters();
        });

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
    this.applyFilters();
  }

  onSelectPrice(value: string): void {
    this.selectedPriceRange = value;
    this.applyFilters();
  }

  onSelectTag(tag: string): void {
    this.selectedTag = this.selectedTag === tag ? '' : tag; // Toggle chọn / bỏ chọn
    this.applyFilters();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getProductId(product: Products): string {
    return product.slug || product.sku;
  }

  isWished(product: Products): boolean {
    return this.wishlist.has(this.getProductId(product));
  }

  toggleWish(product: Products): void {
    const id = this.getProductId(product);
    if (this.wishlist.has(id)) {
      this.wishlist.delete(id);
    } else {
      this.wishlist.add(id);
    }
  }

  private normalizeBenefit(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  getProductImage(product: Products): string {
    const thumbnail = product.thumbnail;

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
        (item.categorySlug && item.categorySlug.toLowerCase() === this.selectedCategory.toLowerCase());

      // 2. Lọc theo Giá
      let matchPrice = true;
      if (this.selectedPriceRange !== 'all') {
        const [min, max] = this.selectedPriceRange.split('-').map(Number);
        const itemPrice = item.price ?? 0;
        matchPrice = itemPrice >= min && itemPrice <= max;
      }

      // 3. Lọc theo Tag Công dụng
      let matchTag = true;
      if (this.selectedTag) {
        const selectedBenefit = this.benefitsList.find(benefit => benefit.label === this.selectedTag);
        const searchableBenefits = [...(item.benefits ?? []), ...(item.tags ?? [])]
          .map(value => this.normalizeBenefit(value));
        matchTag = selectedBenefit?.values.some(value =>
          searchableBenefits.includes(this.normalizeBenefit(value))
        ) ?? false;
      }

      return matchCat && matchPrice && matchTag;
    });
    this.currentPage = 1;
  }
}