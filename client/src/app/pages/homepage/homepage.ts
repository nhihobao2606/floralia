import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProductService } from '../../services/product-service';
import { ReviewService } from '../../services/review-service';
import { ProductNavigationService } from '../../services/product-navigation-service';
import { BlogService } from '../../services/blog-service';
import { Products } from '../../classes/Products';
import { Blog } from '../../classes/Blog';
import { CartService } from '../../services/cart-service';
import { Router } from '@angular/router';

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

  blogs = signal<any[]>([
    {
      img: '/assets/images/bl1.jpg',
      date: '29 Tháng 5, 2026',
      link: '/blog',
      title: 'Pha Trà Thảo Mộc Chuẩn Floralia',
      desc: 'Khám phá cách pha trà thảo mộc để tận hưởng hương thơm và vị trà trọn vẹn.',
    },
    {
      img: '/assets/images/bl2.jpg',
      date: '31 Tháng 5, 2026',
      link: '/blog',
      title: 'Bắt Đầu Ngày Mới Với Một Tách Trà',
      desc: 'Một thói quen nhỏ để bạn dành thời gian cho bản thân giữa nhịp sống bận rộn.',
    },
    {
      img: '/assets/images/bl3.jpg',
      date: '2 Tháng 6, 2026',
      link: '/blog',
      title: 'Trà Hoa Cúc Cho Khoảng Thời Gian Thư Giãn',
      desc: 'Tìm hiểu hương vị thanh nhẹ của trà hoa cúc và cách thưởng thức tại nhà.',
    },
  ]);

  constructor(
    private productService: ProductService,
    private blogService: BlogService,
    private reviewService: ReviewService,
    readonly productNavigation: ProductNavigationService,
    private cartService: CartService,
    private router: Router
  ) {}

  addedSku = signal<string | null>(null);
  addedProductMessage = signal<string | null>(null);
  private messageTimeout: any = null;

  addToCart(product: Products, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const variant = product.variants?.find(v => (v.stock ?? 0) > 0) || product.variants?.[0] || null;
    const price = Number(variant?.price ?? product.price ?? product.minPrice ?? 0);
    const image = this.getProductImage(product);

    // 1. Tự động thêm vào giỏ hàng
    this.cartService.addProduct(product, variant, 1, image);

    // 2. KHÔNG chuyển trang để người xem tiếp tục lướt xem sản phẩm mà không cần tua về!
    const name = product.name || 'Sản phẩm';
    this.addedSku.set(product.sku);
    this.addedProductMessage.set(`Đã thêm "${name}" vào giỏ hàng!`);

    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }
    this.messageTimeout = setTimeout(() => {
      this.addedProductMessage.set(null);
      this.addedSku.set(null);
    }, 2500);
  }
  

  ngOnInit(): void {
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

    this.productService.getAll().subscribe({
      next: (res: any) => {
        let list: Products[] = [];

        if (Array.isArray(res)) list = res;
        else if (Array.isArray(res?.data)) list = res.data;
        else if (Array.isArray(res?.products)) list = res.products;

        this.products.set(list);
       

        // Sản phẩm nổi bật (nếu chưa đánh dấu thì lấy các sản phẩm đầu).
        const featuredList = list.filter((p: any) => p.featured === true);
        this.featured.set((featuredList.length ? featuredList : list).slice(0, 8));

        // Sản phẩm bán chạy: sắp xếp theo số lượng đã bán.
        const bestList = [...list].sort(
          (a: any, b: any) => Number(b.sold || 0) - Number(a.sold || 0)
        );
        this.bestSelling.set(bestList.slice(0, 4));

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

    // Tải bài viết blog nổi bật từ máy chủ
    this.blogService.getAll({ limit: 3 }).subscribe({
      next: (res) => {
        if (res?.data && res.data.length > 0) {
          const mapped = res.data.map((b: Blog) => ({
            img: this.getBlogImg(b),
            date: b.date || 'Gần đây',
            link: `/blog/${b.slug}`,
            title: b.title,
            desc: b.excerpt || '',
          }));
          this.blogs.set(mapped);
        }
      },
      error: (err) => {
        console.warn('Không tải được blog từ API, dùng dữ liệu mặc định:', err);
      },
    });
  }

  private getBlogImg(blog: Blog): string {
    if (blog.imageData) {
      if (blog.imageData.startsWith('data:image/')) return blog.imageData;
      const mime = blog.imageMimeType || 'image/jpeg';
      return `data:${mime};base64,${blog.imageData}`;
    }
    return blog.image || '/assets/images/bl1.jpg';
  }

  getProductName(product: Products): string {
    const p: any = product;
    return p.name || p.productName || p.product_name || p.title || 'Trà thảo mộc Floralia';
  }

  getProductPrice(product: Products): number {
    const p: any = product;
    return Number(p.price ?? p.minPrice ?? p.productPrice ?? 0);
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
    return Number(p.oldPrice || 0);
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
        : `http://localhost:3002${p.imageUrl}`;
    }

    return '/assets/images/no-image.svg';
  }

  getProductId(product: Products): string {
    const p: any = product;
    return p._id || p.id || p.productId || p.slug || '';
  }

  // Yêu thích sản phẩm.
  isWished(product: Products): boolean {
    return this.wishlist().has(this.getProductId(product));
  }

  toggleWish(product: Products): void {
    const id = this.getProductId(product);
    const next = new Set(this.wishlist());
    next.has(id) ? next.delete(id) : next.add(id);
    this.wishlist.set(next);
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.onerror = null;
    img.src = '/assets/images/no-image.svg';
  }
}
