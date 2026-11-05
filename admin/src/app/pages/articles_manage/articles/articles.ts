import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  AdminBlogListRow,
  AdminBlogService,
  BlogStats,
  BlogStatus,
} from '../../../services/admin-blog-service';
import { AdminSidebar } from '../../../components/admin-sidebar/admin-sidebar';

type ArticleFilter = 'all' | BlogStatus;

const EMPTY_STATS: BlogStats = { total: 0, published: 0, draft: 0, archived: 0, views: 0 };

@Component({
  selector: 'app-articles',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminSidebar],
  templateUrl: './articles.html',
  styleUrl: './articles.css',
})
export class Articles implements OnInit, OnDestroy {
  readonly pageSize = 5;
  readonly filters: { key: ArticleFilter; label: string }[] = [
    { key: 'all', label: 'Tất cả' },
    { key: 'published', label: 'Đã đăng' },
    { key: 'draft', label: 'Bản nháp' },
    { key: 'archived', label: 'Lưu trữ' },
  ];

  articles: AdminBlogListRow[] = [];
  stats = { ...EMPTY_STATS };
  activeFilter: ArticleFilter = 'all';
  searchText = '';
  currentPage = 1;
  total = 0;
  loading = false;
  loadError = '';
  actionError = '';
  logoutConfirmationVisible = false;
  adminName = 'Admin';
  pendingDeleteArticle: AdminBlogListRow | null = null;
  deleteAcknowledged = false;
  deletingArticle = false;
  deleteError = '';

  private searchTimeout?: ReturnType<typeof setTimeout>;
  private loadRequestId = 0;

  constructor(
    private readonly blogService: AdminBlogService,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.readAdminName();
    this.loadArticles();
  }

  ngOnDestroy(): void {
    this.loadRequestId += 1;
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index + 1);
  }

  get firstVisibleRow(): number {
    return this.total === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  get lastVisibleRow(): number {
    return Math.min(this.currentPage * this.pageSize, this.total);
  }

  loadArticles(): void {
    const requestId = ++this.loadRequestId;
    this.loading = true;
    this.loadError = '';
    this.changeDetector.markForCheck();
    this.blogService.getAll({
      page: this.currentPage,
      limit: this.pageSize,
      status: this.activeFilter,
      query: this.searchText,
    }).subscribe({
      next: response => {
        if (requestId !== this.loadRequestId) {
          return;
        }
        this.articles = response.data;
        this.total = response.total;
        this.stats = response.stats;
        this.loading = false;
        this.changeDetector.markForCheck();
      },
      error: error => {
        if (requestId !== this.loadRequestId) {
          return;
        }
        this.loading = false;
        if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
          this.logout();
          return;
        }
        this.loadError = 'Không thể tải bài viết từ máy chủ. Vui lòng thử lại.';
        this.changeDetector.markForCheck();
      },
    });
  }

  onSearchInput(value: string): void {
    this.searchText = value;
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.searchTimeout = setTimeout(() => {
      this.currentPage = 1;
      this.loadArticles();
    }, 300);
  }

  selectFilter(filter: ArticleFilter): void {
    if (this.activeFilter === filter) {
      return;
    }
    this.activeFilter = filter;
    this.currentPage = 1;
    this.loadArticles();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) {
      return;
    }
    this.currentPage = page;
    this.loadArticles();
  }

  openCreateModal(): void {
    void this.router.navigate(['/articles/new']);
  }

  editArticle(article: AdminBlogListRow): void {
    void this.router.navigate(['/articles', article._id, 'edit']);
  }

  deleteArticle(article: AdminBlogListRow): void {
    this.pendingDeleteArticle = article;
    this.deleteAcknowledged = false;
    this.deleteError = '';
  }

  cancelDelete(): void {
    if (this.deletingArticle) {
      return;
    }
    this.pendingDeleteArticle = null;
    this.deleteAcknowledged = false;
    this.deleteError = '';
  }

  confirmDeleteArticle(): void {
    if (!this.pendingDeleteArticle || !this.deleteAcknowledged || this.deletingArticle) {
      return;
    }

    const article = this.pendingDeleteArticle;
    this.deletingArticle = true;
    this.deleteError = '';
    this.blogService.delete(article._id).subscribe({
      next: () => {
        this.deletingArticle = false;
        this.pendingDeleteArticle = null;
        this.deleteAcknowledged = false;
        if (this.articles.length === 1 && this.currentPage > 1) {
          this.currentPage -= 1;
        }
        this.loadArticles();
      },
      error: error => {
        this.deletingArticle = false;
        if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
          this.logout();
          return;
        }
        this.deleteError = error instanceof HttpErrorResponse
          ? error.error?.message || 'Không thể xóa bài viết.'
          : 'Không thể xóa bài viết.';
        this.changeDetector.markForCheck();
      },
    });
  }

  @HostListener('document:keydown.escape')
  closeDeleteDialogOnEscape(): void {
    if (this.logoutConfirmationVisible) {
      this.cancelLogoutConfirmation();
      return;
    }
    this.cancelDelete();
  }

  formatId(id: string): string {
    return id.slice(-6).toUpperCase();
  }

  formatDate(date: string | Date | null | undefined): string {
    if (!date) {
      return '—';
    }
    const value = new Date(date);
    if (Number.isNaN(value.getTime())) {
      return '—';
    }
    return new Intl.DateTimeFormat('vi-VN').format(value);
  }

  statusLabel(status: BlogStatus): string {
    switch (status) {
      case 'published': return 'Đã đăng';
      case 'draft': return 'Bản nháp';
      case 'archived': return 'Lưu trữ';
    }
  }

  requestLogoutConfirmation(): void {
    this.logoutConfirmationVisible = true;
    this.changeDetector.markForCheck();
  }

  cancelLogoutConfirmation(): void {
    this.logoutConfirmationVisible = false;
    this.changeDetector.markForCheck();
  }

  confirmLogout(): void {
    this.logoutConfirmationVisible = false;
    this.changeDetector.markForCheck();
    this.logout();
  }

  logout(): void {
    localStorage.removeItem('adminUser');
    localStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminUser');
    sessionStorage.removeItem('adminToken');
    void this.router.navigate(['/admin-login']);
  }

  private setActionError(error: unknown, fallback: string): void {
    if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
      this.logout();
      return;
    }
    const message = error instanceof HttpErrorResponse
      ? error.error?.message
      : undefined;
    this.actionError = message || fallback;
    this.changeDetector.markForCheck();
  }

  private readAdminName(): void {
    const storedUser = localStorage.getItem('adminUser') || sessionStorage.getItem('adminUser');
    if (!storedUser) {
      return;
    }
    try {
      const user = JSON.parse(storedUser) as { fullName?: string };
      this.adminName = user.fullName || 'Admin';
    } catch {
      this.adminName = 'Admin';
    }
  }
}
