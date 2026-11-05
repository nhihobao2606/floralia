import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Blog } from '../../classes/Blog';
import { blogDetailLink } from '../../classes/blog-url';
import { BlogService } from '../../services/blog-service';

@Component({
  selector: 'app-blog',
  standalone: false,
  templateUrl: './blog.html',
  styleUrl: './blog.css',
})
export class BlogComponent implements OnInit {
  blogs = signal<Blog[]>([]);
  featuredBlogs = signal<Blog[]>([]);
  loading = signal(true);
  featuredLoading = signal(true);

  // Pagination
  currentPage = signal(1);
  pageSize = signal(6);
  totalBlogs = signal(0);
  totalPages = signal(1);
  pages = signal<number[]>([1]);

  // Filters
  selectedCategory = signal<string>('all');
  searchQuery = signal<string>('');

  // Sidebar accordion toggle
  sidebarOpen = signal(true);
  private blogRequestId = 0;

  categories = [
    { label: 'TẤT CẢ', slug: 'all' },
    { label: 'BÍ QUYẾT PHA TRÀ', slug: 'bi-quyet-pha-tra' },
    { label: 'PHONG CÁCH SỐNG', slug: 'phong-cach-song' },
    { label: 'THẢO MỘC TRỊ LIỆU', slug: 'thao-moc-tri-lieu' },
    { label: 'VĂN HÓA TRÀ', slug: 'van-hoa-tra' },
  ];

  constructor(
    private blogService: BlogService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadFeatured();
    this.route.paramMap.subscribe(params => {
      const categorySlug = params.get('categorySlug') || 'all';
      this.selectedCategory.set(categorySlug);
      this.currentPage.set(1);
      this.loadBlogs();
    });
  }

  loadBlogs(): void {
    this.loading.set(true);
    const requestId = ++this.blogRequestId;
    const cat = this.selectedCategory();
    const query = this.searchQuery();
    const page = this.currentPage();
    const limit = this.pageSize();

    this.blogService
      .getAll({
        category: cat !== 'all' ? cat : undefined,
        q: query ? query : undefined,
        page,
        limit,
      })
      .subscribe({
        next: res => {
          if (requestId !== this.blogRequestId) {
            return;
          }

          this.blogs.set(res.data || []);
          this.totalBlogs.set(res.total || 0);

          const totalP = Math.max(1, Math.ceil((res.total || 0) / limit));
          this.totalPages.set(totalP);

          const pageArr: number[] = [];
          for (let i = 1; i <= totalP; i++) {
            pageArr.push(i);
          }
          this.pages.set(pageArr);
          this.loading.set(false);
        },
        error: err => {
          if (requestId !== this.blogRequestId) {
            return;
          }

          console.error('Lỗi khi tải danh sách blog:', err);
          this.blogs.set([]);
          this.totalBlogs.set(0);
          this.totalPages.set(1);
          this.pages.set([1]);
          this.loading.set(false);
        },
      });
  }

  loadFeatured(): void {
    this.featuredLoading.set(true);
    this.blogService.getAll({ featured: true, limit: 4 }).subscribe({
      next: res => {
        this.featuredBlogs.set(res.data || []);
        this.featuredLoading.set(false);
      },
      error: err => {
        console.error('Lỗi khi tải tin tức nổi bật:', err);
        this.featuredLoading.set(false);
      },
    });
  }

  setCategory(slug: string): void {
    const route = slug === 'all' ? ['/blog'] : ['/blog', slug];
    if (this.selectedCategory() === slug) {
      this.currentPage.set(1);
      this.loadBlogs();
      return;
    }

    void this.router.navigate(route);
  }

  onSearchChange(text: string): void {
    this.searchQuery.set(text);
    this.currentPage.set(1);
    this.loadBlogs();
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) {
      return;
    }
    this.currentPage.set(page);
    this.loadBlogs();
    window.scrollTo({ top: 160, behavior: 'smooth' });
  }

  prevPage(): void {
    this.changePage(this.currentPage() - 1);
  }

  nextPage(): void {
    this.changePage(this.currentPage() + 1);
  }

  toggleSidebar(): void {
    this.sidebarOpen.update(v => !v);
  }

  getBlogImage(blog: Blog): string {
    if (blog.imageData) {
      if (blog.imageData.startsWith('data:image/')) {
        return blog.imageData;
      }
      const mime = blog.imageMimeType || 'image/jpeg';
      return `data:${mime};base64,${blog.imageData}`;
    }
    if (blog.image) {
      return blog.image;
    }
    return '/assets/images/bl1.jpg';
  }

  blogDetailLink(blog: Blog): string[] {
    return blogDetailLink(blog);
  }
}
