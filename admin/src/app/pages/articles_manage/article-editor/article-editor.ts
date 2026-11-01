import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, CanDeactivateFn, Router, RouterLink } from '@angular/router';
import {
  AdminBlogService,
  BlogCategory,
  BlogFormValue,
  BlogStatus,
} from '../../../services/admin-blog-service';
import { AdminSidebar } from '../../../components/admin-sidebar/admin-sidebar';

function emptyArticle(): BlogFormValue {
  return {
    title: '',
    excerpt: '',
    content: '',
    author: '',
    category: '',
    categorySlug: '',
    image: '/assets/images/bl1.jpg',
    imageAlt: '',
    status: 'draft',
    featured: false,
    publishedAt: new Date().toISOString().slice(0, 10),
    metaTitle: '',
    metaDescription: '',
    tags: [],
  };
}

interface CalendarDay {
  date: Date;
  dayNumber: number;
  inCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
}

@Component({
  selector: 'app-article-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AdminSidebar],
  templateUrl: './article-editor.html',
  styleUrl: './article-editor.css',
})
export class ArticleEditor implements OnInit, OnDestroy {
  readonly id: string | null;
  readonly editing: boolean;
  currentId: string | null;
  article = emptyArticle();
  categories: BlogCategory[] = [];
  authors: string[] = [];
  newCategory = '';
  addingCategory = false;
  tagInput = '';
  imagePreview = '';
  inlineImages: string[] = [];
  articleInfo: { createdAt: string | Date | null; updatedAt: string | Date | null; views: number } | null = null;
  draggingCover = false;
  statusDropdownOpen = false;
  authorDropdownOpen = false;
  blockFormatDropdownOpen = false;
  activeBlockFormat = 'H2';
  datePickerOpen = false;
  previewVisible = false;
  exitPromptVisible = false;
  logoutConfirmationVisible = false;
  deleteConfirmationVisible = false;
  deleteAcknowledged = false;
  deletingArticle = false;
  calendarMonth = new Date();
  adminName = 'Admin';
  loading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';
  loadError = '';
  private autoSaveInterval?: ReturnType<typeof setInterval>;
  private successMessageTimeout?: ReturnType<typeof setTimeout>;
  private lastSavedSnapshot = '';
  private lastAutoSavedSnapshot = '';
  private editorSelection: Range | null = null;
  private resolveCanDeactivate?: (allowNavigation: boolean) => void;
  private pendingLogout = false;
  readonly statusOptions: { value: BlogStatus; label: string }[] = [
    { value: 'draft', label: 'Bản nháp' },
    { value: 'published', label: 'Đã đăng' },
    { value: 'archived', label: 'Lưu trữ' },
  ];
  readonly blockFormatOptions = [
    { value: 'H2', label: 'Tiêu đề' },
    { value: 'P', label: 'Nội dung' },
    { value: 'H3', label: 'Tiêu đề nhỏ' },
    { value: 'BLOCKQUOTE', label: 'Trích dẫn' },
  ];
  readonly weekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly blogService: AdminBlogService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {
    this.id = this.route.snapshot.paramMap.get('id');
    this.currentId = this.id;
    this.editing = Boolean(this.id);
  }

  ngOnInit(): void {
    this.readAdminName();
    this.lastSavedSnapshot = JSON.stringify(this.article);
    this.lastAutoSavedSnapshot = this.lastSavedSnapshot;
    this.loadCategories();
    this.loadAuthors();
    if (this.id) {
      this.loadArticle(this.id);
    }
    this.autoSaveInterval = setInterval(() => this.autoSaveDraft(), 30_000);
  }

  ngOnDestroy(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    if (this.successMessageTimeout) {
      clearTimeout(this.successMessageTimeout);
    }
  }

  get slugPreview(): string {
    return this.slugify(this.article.title) || 'ten-bai-viet';
  }

  get articleCode(): string {
    return this.currentId ? `#BV-${this.currentId.slice(-6).toUpperCase()}` : '—';
  }

  formatArticleInfoDate(value: string | Date | null, withTime = false): string {
    if (!value) {
      return '—';
    }

    const dateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
    const parsedDate = dateOnly
      ? this.parseDate(value)
      : value instanceof Date
        ? value
        : new Date(value);
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
      return '—';
    }

    const options: Intl.DateTimeFormatOptions = withTime
      ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
      : { day: '2-digit', month: '2-digit', year: 'numeric' };
    return new Intl.DateTimeFormat('vi-VN', options).format(parsedDate);
  }

  formatArticleViews(views: number): string {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(views) || 0);
  }

  get contentWordCount(): number {
    return this.article.content.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  }

  get statusLabel(): string {
    return this.statusOptions.find(option => option.value === this.article.status)?.label || 'Chọn trạng thái';
  }

  get activeBlockFormatLabel(): string {
    return this.blockFormatOptions.find(option => option.value === this.activeBlockFormat)?.label || 'Nội dung';
  }

  get authorLabel(): string {
    return this.article.author || 'Chọn tác giả';
  }

  get publishedDateLabel(): string {
    const date = this.parseDate(this.article.publishedAt);
    return date
      ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
      : 'Chọn ngày';
  }

  get calendarMonthLabel(): string {
    return new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(this.calendarMonth);
  }

  get previewDate(): Date | null {
    return this.parseDate(this.article.publishedAt);
  }

  get previewDateLabel(): string {
    const date = this.previewDate;
    return date
      ? new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
      : '';
  }

  get calendarDays(): CalendarDay[] {
    const firstOfMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth(), 1);
    const firstVisibleDate = new Date(firstOfMonth);
    firstVisibleDate.setDate(firstVisibleDate.getDate() - firstOfMonth.getDay());
    const selectedDate = this.article.publishedAt;
    const today = this.toDateValue(new Date());
    const visibleDays = Math.ceil((firstOfMonth.getDay() + new Date(
      this.calendarMonth.getFullYear(),
      this.calendarMonth.getMonth() + 1,
      0,
    ).getDate()) / 7) * 7;

    return Array.from({ length: visibleDays }, (_, index) => {
      const date = new Date(firstVisibleDate);
      date.setDate(firstVisibleDate.getDate() + index);
      const value = this.toDateValue(date);
      return {
        date,
        dayNumber: date.getDate(),
        inCurrentMonth: date.getMonth() === this.calendarMonth.getMonth(),
        isSelected: value === selectedDate,
        isToday: value === today,
      };
    });
  }

  @HostListener('document:click', ['$event'])
  closeStatusDropdownOutside(event: MouseEvent): void {
    if (event.target instanceof Element && !event.target.closest('.custom-select')) {
      this.statusDropdownOpen = false;
      this.authorDropdownOpen = false;
    }
    if (event.target instanceof Element && !event.target.closest('.toolbar-format-select')) {
      this.blockFormatDropdownOpen = false;
    }
    if (event.target instanceof Element && !event.target.closest('.date-picker')) {
      this.datePickerOpen = false;
    }
  }

  get hasUnsavedChanges(): boolean {
    if (this.loading || !this.lastSavedSnapshot) {
      return false;
    }
    const editor = document.querySelector<HTMLElement>('.rich-editor');
    if (editor) {
      this.article.content = editor.innerHTML;
    }
    return JSON.stringify(this.article) !== this.lastSavedSnapshot;
  }

  confirmCanDeactivate(): boolean | Promise<boolean> {
    if (!this.hasUnsavedChanges) {
      this.finishLogoutIfNeeded();
      return true;
    }
    this.exitPromptVisible = true;
    return new Promise(resolve => {
      this.resolveCanDeactivate = resolve;
    });
  }

  stayOnEditor(): void {
    this.pendingLogout = false;
    this.resolveExitNavigation(false);
  }

  discardChangesAndExit(): void {
    this.finishLogoutIfNeeded();
    this.resolveExitNavigation(true);
  }

  saveChangesAndExit(): void {
    if (this.saving || !this.validateArticle()) {
      return;
    }

    this.saving = true;
    const status = this.currentId ? this.article.status : 'draft';
    this.article.status = status;
    const request = this.currentId
      ? this.blogService.update(this.currentId, this.article)
      : this.blogService.create(this.article);

    request.subscribe({
      next: savedArticle => {
        this.currentId = savedArticle._id;
        this.lastSavedSnapshot = JSON.stringify(this.article);
        this.lastAutoSavedSnapshot = this.lastSavedSnapshot;
        this.saving = false;
        this.finishLogoutIfNeeded();
        this.resolveExitNavigation(true);
        this.changeDetector.markForCheck();
      },
      error: error => {
        this.saving = false;
        this.handleError(error, 'Không thể lưu bài viết trước khi rời trang.');
      },
    });
  }

  toggleDatePicker(): void {
    this.datePickerOpen = !this.datePickerOpen;
    if (this.datePickerOpen) {
      this.calendarMonth = this.parseDate(this.article.publishedAt) || new Date();
      this.statusDropdownOpen = false;
      this.authorDropdownOpen = false;
    }
  }

  changeCalendarMonth(offset: number): void {
    this.calendarMonth = new Date(
      this.calendarMonth.getFullYear(),
      this.calendarMonth.getMonth() + offset,
      1,
    );
  }

  selectPublishedDate(date: Date): void {
    this.article.publishedAt = this.toDateValue(date);
    this.datePickerOpen = false;
  }

  setPublishedDateToToday(): void {
    this.article.publishedAt = this.toDateValue(new Date());
    this.calendarMonth = new Date();
    this.datePickerOpen = false;
  }

  clearPublishedDate(): void {
    this.article.publishedAt = '';
    this.datePickerOpen = false;
  }

  toggleAuthorDropdown(): void {
    this.authorDropdownOpen = !this.authorDropdownOpen;
    this.statusDropdownOpen = false;
    this.blockFormatDropdownOpen = false;
  }

  toggleBlockFormatDropdown(): void {
    this.captureEditorSelection();
    this.blockFormatDropdownOpen = !this.blockFormatDropdownOpen;
    this.statusDropdownOpen = false;
    this.authorDropdownOpen = false;
  }

  applyBlockFormat(format: string): void {
    this.activeBlockFormat = format;
    this.blockFormatDropdownOpen = false;
    const editor = document.querySelector<HTMLElement>('.rich-editor');
    if (!editor) {
      return;
    }

    editor.focus();
    if (this.editorSelection && editor.contains(this.editorSelection.commonAncestorContainer)) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(this.editorSelection);
    }
    document.execCommand('formatBlock', false, format);
    this.article.content = editor.innerHTML;
    this.editorSelection = null;
  }

  selectStatus(status: BlogStatus): void {
    this.article.status = status;
    this.statusDropdownOpen = false;
  }

  selectAuthor(author: string): void {
    this.article.author = author;
    this.authorDropdownOpen = false;
  }

  private parseDate(value?: string): Date | null {
    if (!value) {
      return null;
    }
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) {
      return null;
    }
    return new Date(year, month - 1, day);
  }

  private toDateValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  loadCategories(): void {
    this.blogService.getCategories().subscribe({
      next: categories => {
        this.categories = categories;
        if (!this.article.category && !this.editing && categories.length) {
          this.selectCategory(categories[0], true);
        }
        if (this.article.category && !this.categories.some(category => category.name === this.article.category)) {
          this.categories = [...categories, {
            name: this.article.category,
            slug: this.article.categorySlug || this.slugify(this.article.category),
          }];
        }
        this.changeDetector.markForCheck();
      },
      error: error => this.handleError(error, 'Không thể tải danh mục từ cơ sở dữ liệu.'),
    });
  }

  loadAuthors(): void {
    this.blogService.getAuthors().subscribe({
      next: authors => {
        this.authors = authors;
        if (!this.article.author && !this.editing && authors.length) {
          const wasClean = !this.hasUnsavedChanges;
          this.article.author = authors[0];
          if (wasClean) {
            this.lastSavedSnapshot = JSON.stringify(this.article);
            this.lastAutoSavedSnapshot = this.lastSavedSnapshot;
          }
        }
        this.ensureCurrentAuthor();
        this.changeDetector.markForCheck();
      },
      error: error => this.handleError(error, 'Không thể tải danh sách tác giả từ cơ sở dữ liệu.'),
    });
  }

  loadArticle(id: string): void {
    this.loading = true;
    this.blogService.getById(id).subscribe({
      next: article => {
        this.articleInfo = {
          createdAt: article.createdAt || null,
          updatedAt: article.updatedAt || null,
          views: article.views || 0,
        };
        this.article = {
          title: article.title,
          excerpt: article.excerpt,
          content: article.content,
          author: article.author,
          category: article.category,
          categorySlug: article.categorySlug,
          image: article.image,
          imageAlt: article.imageAlt || '',
          imageData: article.imageData || undefined,
          imageMimeType: article.imageMimeType || undefined,
          status: article.status,
          featured: Boolean(article.featured),
          publishedAt: article.publishedAt
            ? new Date(article.publishedAt).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10),
          metaTitle: article.metaTitle || article.title,
          metaDescription: article.metaDescription || article.excerpt,
          tags: article.tags || [],
        };
        this.syncInlineImagesFromContent();
        this.imagePreview = this.getImageUrl();
        this.loading = false;
        if (this.article.category && !this.categories.some(category => category.name === this.article.category)) {
          this.categories = [...this.categories, {
            name: this.article.category,
            slug: this.article.categorySlug || this.slugify(this.article.category),
          }];
        }
        this.ensureCurrentAuthor();
        this.lastSavedSnapshot = JSON.stringify(this.article);
        this.lastAutoSavedSnapshot = this.lastSavedSnapshot;
        this.changeDetector.markForCheck();
        setTimeout(() => {
          const editor = document.querySelector<HTMLElement>('.rich-editor');
          if (editor) {
            editor.innerHTML = this.article.content;
          }
        });
      },
      error: error => {
        this.loading = false;
        this.handleError(error, 'Không thể tải nội dung bài viết.');
      },
    });
  }

  selectCategory(category: BlogCategory, initial = false): void {
    const wasClean = !this.hasUnsavedChanges;
    this.article.category = category.name;
    this.article.categorySlug = category.slug;
    if (initial && !this.editing && wasClean) {
      this.lastSavedSnapshot = JSON.stringify(this.article);
      this.lastAutoSavedSnapshot = this.lastSavedSnapshot;
    }
  }

  addCategory(): void {
    const name = this.newCategory.trim();
    if (!name || this.categories.some(category => category.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      return;
    }
    const category = { name, slug: this.slugify(name) };
    this.categories = [...this.categories, category];
    this.selectCategory(category);
    this.newCategory = '';
    this.addingCategory = false;
  }

  cancelAddCategory(): void {
    this.newCategory = '';
    this.addingCategory = false;
  }

  onContentInput(event: Event): void {
    const element = event.currentTarget;
    if (element instanceof HTMLElement) {
      this.article.content = element.innerHTML;
      this.syncInlineImagesFromContent();
    }
  }

  removeInlineImage(index: number): void {
    const editor = document.querySelector<HTMLElement>('.rich-editor');
    const images = editor?.querySelectorAll('img');
    if (editor && images?.[index]) {
      images[index].remove();
      this.article.content = editor.innerHTML;
    } else {
      const content = new DOMParser().parseFromString(this.article.content, 'text/html');
      content.querySelectorAll('img')[index]?.remove();
      this.article.content = content.body.innerHTML;
    }
    this.syncInlineImagesFromContent();
  }

  formatText(command: string, value?: string): void {
    document.execCommand(command, false, value);
    const editor = document.querySelector<HTMLElement>('.rich-editor');
    if (editor) {
      this.article.content = editor.innerHTML;
      editor.focus();
    }
  }

  async onCoverSelected(event: Event): Promise<void> {
    const input = event.currentTarget;
    const file = input instanceof HTMLInputElement ? input.files?.[0] : undefined;
    if (!file) {
      return;
    }
    await this.loadCoverFile(file);
    if (input instanceof HTMLInputElement) {
      input.value = '';
    }
  }

  onCoverDragOver(event: DragEvent): void {
    event.preventDefault();
    this.draggingCover = true;
  }

  onCoverDragLeave(event: DragEvent): void {
    event.preventDefault();
    const target = event.currentTarget;
    if (target instanceof HTMLElement && event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) {
      return;
    }
    this.draggingCover = false;
  }

  async onCoverDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.draggingCover = false;
    const file = event.dataTransfer?.files[0];
    if (file) {
      await this.loadCoverFile(file);
    }
  }

  private async loadCoverFile(file: File): Promise<void> {
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 2_000_000) {
      this.errorMessage = 'Ảnh bìa phải là JPG hoặc PNG và dưới 2 MB.';
      this.changeDetector.markForCheck();
      return;
    }

    try {
      const dataUrl = await this.readFileAsDataUrl(file);
      const separator = dataUrl.indexOf(',');
      this.article.imageData = dataUrl.slice(separator + 1);
      this.article.imageMimeType = file.type;
      this.article.imageFileName = file.name;
      this.article.clearImageData = false;
      this.imagePreview = dataUrl;
      this.errorMessage = '';
      this.changeDetector.markForCheck();
    } catch {
      this.errorMessage = 'Không thể đọc ảnh đã chọn. Vui lòng thử lại.';
      this.changeDetector.markForCheck();
    }
  }

  removeCover(): void {
    this.article.imageData = undefined;
    this.article.imageMimeType = undefined;
    this.article.imageFileName = undefined;
    this.article.image = '/assets/images/bl1.jpg';
    this.article.imageAlt = '';
    this.imagePreview = '';
    this.article.clearImageData = true;
  }

  addTag(): void {
    const value = this.tagInput.trim().replace(/^#/, '');
    const tags = this.article.tags || [];
    if (value && !tags.some(tag => tag.toLocaleLowerCase() === value.toLocaleLowerCase()) && tags.length < 20) {
      this.article.tags = [...tags, value];
    }
    this.tagInput = '';
  }

  removeTag(tag: string): void {
    this.article.tags = (this.article.tags || []).filter(item => item !== tag);
  }

  save(status: BlogStatus): void {
    if (this.saving || !this.validateArticle()) {
      this.changeDetector.markForCheck();
      return;
    }

    this.article.status = status;
    this.saving = true;
    const request = this.currentId
      ? this.blogService.update(this.currentId, this.article)
      : this.blogService.create(this.article);

    request.subscribe({
      next: savedArticle => {
        this.saving = false;
        this.currentId = savedArticle._id;
        this.lastSavedSnapshot = JSON.stringify(this.article);
        this.lastAutoSavedSnapshot = this.lastSavedSnapshot;
        if (this.editing) {
          this.successMessage = this.article.status === 'published'
            ? 'Cập nhật bài viết thành công. Nội dung mới đã được cập nhật trên trang khách hàng.'
            : 'Cập nhật bài viết thành công. Bài viết chưa hiển thị trên trang khách hàng vì chưa ở trạng thái Đã đăng.';
          if (this.successMessageTimeout) {
            clearTimeout(this.successMessageTimeout);
          }
          this.successMessageTimeout = setTimeout(() => {
            this.successMessage = '';
            this.successMessageTimeout = undefined;
            this.changeDetector.markForCheck();
          }, 3000);
          this.changeDetector.markForCheck();
          return;
        }
        this.changeDetector.markForCheck();
        void this.router.navigate(['/articles']);
      },
      error: error => {
        this.saving = false;
        this.handleError(error, 'Không thể lưu bài viết.');
      },
    });
  }

  confirmDeleteArticle(): void {
    if (!this.currentId || !this.deleteAcknowledged || this.deletingArticle) {
      return;
    }

    this.deletingArticle = true;
    this.errorMessage = '';
    this.blogService.delete(this.currentId).subscribe({
      next: () => {
        this.deletingArticle = false;
        this.deleteConfirmationVisible = false;
        this.lastSavedSnapshot = JSON.stringify(this.article);
        this.lastAutoSavedSnapshot = this.lastSavedSnapshot;
        void this.router.navigate(['/articles']);
      },
      error: error => {
        this.deletingArticle = false;
        this.handleError(error, 'Không thể xóa bài viết.');
      },
    });
  }

  closeDeleteConfirmation(): void {
    if (this.deletingArticle) {
      return;
    }
    this.deleteConfirmationVisible = false;
    this.deleteAcknowledged = false;
    this.errorMessage = '';
  }

  previewArticle(): void {
    const editor = document.querySelector<HTMLElement>('.rich-editor');
    if (editor) {
      this.article.content = editor.innerHTML;
      this.syncInlineImagesFromContent();
    }
    this.previewVisible = true;
  }

  closePreview(): void {
    this.previewVisible = false;
  }

  @HostListener('document:keydown.escape')
  closePreviewOnEscape(): void {
    if (this.logoutConfirmationVisible) {
      this.cancelLogoutConfirmation();
    } else if (this.deleteConfirmationVisible) {
      this.closeDeleteConfirmation();
    } else if (this.exitPromptVisible) {
      this.stayOnEditor();
    } else {
      this.closePreview();
    }
  }

  logout(): void {
    this.pendingLogout = true;
    void this.router.navigate(['/admin-login']);
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

  cancel(): void {
    void this.router.navigate(['/articles']);
  }

  private validateArticle(): boolean {
    this.errorMessage = '';
    if (!this.article.category) {
      this.errorMessage = 'Vui lòng chọn một danh mục.';
    } else if (!this.article.content.replace(/<[^>]*>/g, '').trim()) {
      this.errorMessage = 'Vui lòng nhập nội dung bài viết.';
    } else if (!this.article.title.trim()) {
      this.errorMessage = 'Vui lòng nhập tiêu đề bài viết.';
    } else if (!this.article.excerpt.trim()) {
      this.errorMessage = 'Vui lòng nhập tóm tắt bài viết.';
    } else if (!this.article.author.trim()) {
      this.errorMessage = 'Vui lòng nhập tên tác giả.';
    }
    if (this.errorMessage) {
      this.changeDetector.markForCheck();
      return false;
    }
    return true;
  }

  private resolveExitNavigation(allowNavigation: boolean): void {
    this.exitPromptVisible = false;
    const resolve = this.resolveCanDeactivate;
    this.resolveCanDeactivate = undefined;
    resolve?.(allowNavigation);
  }

  private finishLogoutIfNeeded(): void {
    if (!this.pendingLogout) {
      return;
    }
    localStorage.removeItem('adminUser');
    localStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminUser');
    sessionStorage.removeItem('adminToken');
    this.pendingLogout = false;
  }

  private getImageUrl(): string {
    if (this.article.imageData) {
      return `data:${this.article.imageMimeType || 'image/jpeg'};base64,${this.article.imageData}`;
    }
    if (this.article.image?.startsWith('/assets/')) {
      return `http://localhost:4200${this.article.image}`;
    }
    return this.article.image || '';
  }

  private autoSaveDraft(): void {
    if (
      this.saving
      || this.loading
      || !this.article.title.trim()
      || !this.article.excerpt.trim()
      || !this.article.content.replace(/<[^>]*>/g, '').trim()
      || !this.article.author
      || !this.article.category
      || (!this.currentId && this.article.status !== 'draft')
    ) {
      return;
    }

    const editor = document.querySelector<HTMLElement>('.rich-editor');
    if (editor) {
      this.article.content = editor.innerHTML;
    }

    const snapshot = JSON.stringify(this.article);
    if (snapshot === this.lastAutoSavedSnapshot) {
      return;
    }

    this.saving = true;
    const request = this.currentId
      ? this.blogService.update(this.currentId, this.article)
      : this.blogService.create(this.article);
    request.subscribe({
      next: savedArticle => {
        this.currentId = savedArticle._id;
        this.lastAutoSavedSnapshot = snapshot;
        this.saving = false;
        this.changeDetector.markForCheck();
      },
      error: error => {
        this.saving = false;
        this.handleError(error, 'Không thể tự động lưu bản nháp.');
      },
    });
  }

  captureEditorSelection(): void {
    const editor = document.querySelector<HTMLElement>('.rich-editor');
    const selection = window.getSelection();
    if (editor && selection?.rangeCount && editor.contains(selection.anchorNode)) {
      this.editorSelection = selection.getRangeAt(0).cloneRange();
    }
  }

  async onInlineImageSelected(event: Event): Promise<void> {
    const input = event.currentTarget;
    const file = input instanceof HTMLInputElement ? input.files?.[0] : undefined;
    if (!file) {
      return;
    }
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 2_000_000) {
      this.errorMessage = 'Ảnh chèn phải là JPG hoặc PNG và dưới 2 MB.';
      this.changeDetector.markForCheck();
      return;
    }

    try {
      const dataUrl = await this.readFileAsDataUrl(file);
      const editor = document.querySelector<HTMLElement>('.rich-editor');
      if (!editor) {
        throw new Error('Article editor is unavailable');
      }

      editor.focus();
      if (this.editorSelection && editor.contains(this.editorSelection.commonAncestorContainer)) {
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(this.editorSelection);
      }
      document.execCommand('insertImage', false, dataUrl);
      this.article.content = editor.innerHTML;
      this.syncInlineImagesFromContent();
      this.editorSelection = null;
      this.errorMessage = '';
      this.changeDetector.markForCheck();
    } catch {
      this.errorMessage = 'Không thể chèn ảnh vào nội dung. Vui lòng thử lại.';
      this.changeDetector.markForCheck();
    }
  }

  private ensureCurrentAuthor(): void {
    if (this.article.author && !this.authors.includes(this.article.author)) {
      this.authors = [...this.authors, this.article.author];
    }
  }

  private slugify(value: string): string {
    return value.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private readAdminName(): void {
    const storedUser = localStorage.getItem('adminUser') || sessionStorage.getItem('adminUser');
    if (!storedUser) {
      return;
    }
    try {
      this.adminName = (JSON.parse(storedUser) as { fullName?: string }).fullName || 'Admin';
    } catch {
      this.adminName = 'Admin';
    }
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid image'));
      reader.onerror = () => reject(reader.error || new Error('Image read failed'));
      reader.readAsDataURL(file);
    });
  }

  private syncInlineImagesFromContent(): void {
    const parsedContent = new DOMParser().parseFromString(this.article.content, 'text/html');
    this.inlineImages = Array.from(parsedContent.querySelectorAll('img'))
      .map(image => image.getAttribute('src') || '')
      .filter(Boolean);
  }

  private handleError(error: unknown, fallback: string): void {
    if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
      this.logout();
      return;
    }
    this.errorMessage = error instanceof HttpErrorResponse ? error.error?.message || fallback : fallback;
    this.changeDetector.markForCheck();
  }
}

export const canDeactivateArticleEditor: CanDeactivateFn<ArticleEditor> =
  component => component.confirmCanDeactivate();
