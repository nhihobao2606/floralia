import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Blog } from '../../classes/Blog';
import { blogDetailLink } from '../../classes/blog-url';
import { BlogService } from '../../services/blog-service';

@Component({
  selector: 'app-blog-detail',
  standalone: false,
  templateUrl: './blog-detail.html',
  styleUrl: './blog-detail.css',
})
export class BlogDetailComponent implements OnInit {
  blog = signal<Blog | null>(null);
  relatedBlogs = signal<Blog[]>([]);
  featuredBlogs = signal<Blog[]>([]);
  loading = signal(true);
  sidebarOpen = signal(true);
  copied = signal(false);
  private detailRequestId = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private blogService: BlogService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      if (slug) {
        this.loadBlogDetail(slug);
      }
    });

    this.loadFeatured();
  }

  loadBlogDetail(slug: string): void {
    const requestId = ++this.detailRequestId;
    this.loading.set(true);
    this.blog.set(null);
    this.relatedBlogs.set([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.blogService.getByIdentifier(slug).subscribe({
      next: data => {
        if (requestId !== this.detailRequestId) {
          return;
        }

        this.blog.set(data);
        this.loading.set(false);
        if (data?.categorySlug) {
          this.loadRelated(data.categorySlug, data.slug, requestId);
        }
      },
      error: err => {
        if (requestId !== this.detailRequestId) {
          return;
        }

        console.error('Lỗi tải bài viết:', err);
        this.blog.set(null);
        this.relatedBlogs.set([]);
        this.loading.set(false);
      },
    });
  }

  loadRelated(categorySlug: string, currentSlug: string, requestId: number): void {
    this.blogService.getAll({ category: categorySlug, limit: 3 }).subscribe({
      next: res => {
        if (requestId !== this.detailRequestId) {
          return;
        }

        const filtered = (res.data || []).filter(b => b.slug !== currentSlug);
        this.relatedBlogs.set(filtered.slice(0, 2));
      },
      error: err => {
        if (requestId !== this.detailRequestId) {
          return;
        }

        console.error('Lỗi tải bài viết cùng chủ đề:', err);
        this.relatedBlogs.set([]);
      },
    });
  }

  loadFeatured(): void {
    this.blogService.getAll({ featured: true, limit: 4 }).subscribe({
      next: res => {
        this.featuredBlogs.set(res.data || []);
      },
    });
  }

  getBlogImage(b: Blog | null): string {
    if (!b) return '/assets/images/bl1.jpg';
    if (b.imageData) {
      if (b.imageData.startsWith('data:image/')) {
        return b.imageData;
      }
      const mime = b.imageMimeType || 'image/jpeg';
      return `data:${mime};base64,${b.imageData}`;
    }
    return b.image || '/assets/images/bl1.jpg';
  }

  blogDetailLink(blog: Blog): string[] {
    return blogDetailLink(blog);
  }

  toggleSidebar(): void {
    this.sidebarOpen.update(v => !v);
  }

  copyLink(): void {
    navigator.clipboard?.writeText(window.location.href);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }
}
