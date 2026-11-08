import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { ActivatedRoute, CanDeactivateFn, Router } from '@angular/router';
import { AdminProduct, AdminProductService, AdminProductVariant, ProductFormValue, ProductImageUpload } from '../../../services/admin-product-service';
import { AdminCategoryService } from '../../../services/admin-category-service';

@Component({
  selector: 'app-product-editor',
  standalone: false,
  styleUrl: './product-editor.css',
  templateUrl: './product-editor.html',
})
export class ProductEditor implements OnInit {
  categoryOptions = ['Trà thảo mộc', 'Trà thảo mộc mix', 'Đồ uống kèm trà', 'Ấm trà', 'Set quà tặng'];
  subcategoryOptions: string[] = [];
  readonly variantGroupOptions = ['Quy cách', 'Khối lượng', 'Dung tích', 'Loại trà'];
  readonly variantNameOptions = [
    'Hộp 10 gói (5g/gói)', 'Hộp 10 gói · 3 vị', 'Hộp 10 gói · 5 vị', 'Hộp 10 gói · 7 vị',
    'Hộp 10 túi lọc (2g/túi)', 'Hộp 100g', 'Hộp 150g', 'Hộp 20 gói (5g/gói)',
    'Hộp 20 gói · 3 vị', 'Hộp 20 gói · 5 vị', 'Hộp 20 gói · 7 vị', 'Hộp 20 túi lọc (2g/túi)',
    'Hộp 200g', 'Hộp 250g', 'Hộp 300g', 'Hộp 500g', 'Túi 1kg', 'Túi 200g', 'Túi 300g', 'Túi 350g', 'Túi 500g',
  ];
  readonly businessStatusOptions = [
    { label: 'Đang kinh doanh', value: 'active' },
    { label: 'Hết hàng', value: 'out-of-stock' },
  ];
  readonly packagingOptions = [
    { label: 'Khối lượng', value: 'weight' },
    { label: 'Dạng gói', value: 'sachet' },
    { label: 'Túi lọc', value: 'teabag' },
  ];
  adminName = 'Admin Floralia';
  isEdit = false;
  productId = '';
  loading = false;
  saving = false;
  error = '';
  successMessage = '';
  logoutConfirmationVisible = false;
  exitPromptVisible = false;
  private lastSavedSnapshot = '';
  private resolveCanDeactivate?: (allowNavigation: boolean) => void;
  private pendingLogout = false;
  selectedTab: 'basic' | 'details' = 'basic';
  benefitInputVisible = false;
  newBenefitText = '';
  editingBenefitIndex: number | null = null;
  tagInputVisible = false;
  newTagText = '';
  editingTagIndex: number | null = null;
  imagePreviews: string[] = [];
  imageUploads: ProductImageUpload[] = [];
  instructionsText = '';
  replaceImages = false;
  form: ProductFormValue = this.emptyForm();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly service: AdminProductService,
    private readonly categoryService: AdminCategoryService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.readAdminName();
    this.productId = this.route.snapshot.paramMap.get('id') || '';
    this.isEdit = Boolean(this.productId);
    this.loadSubcategories();
    if (this.isEdit) {
      this.loadProduct();
    } else {
      this.lastSavedSnapshot = this.createFormSnapshot();
    }
  }

  private emptyForm(): ProductFormValue {
    return {
      sku: '', slug: '', name: '', brand: 'Floralia Tea', category: '', categorySlug: '', subCategory: '', status: 'active', isActive: true,
      price: 0, oldPrice: 0, minPrice: 0, discount: 0, stock: 20, thumbnail: '', images: [], description: '', story: '',
      usage: [], instructions: [], benefits: [], tags: [], variants: [], featured: false, isSale: false,
      isMix: false, flavorNote: '', color: '', shelfLifeMonths: 24, variantLabel: 'Quy cách', hasVariants: false,
      weightGram: 0, packCount: 0, flavorCount: 0, imageUploads: [], replaceImages: false,
    };
  }

  get availableSubcategories(): string[] {
    const options = this.subcategoryOptions;
    return this.form.subCategory && !options.includes(this.form.subCategory)
      ? [this.form.subCategory, ...options]
      : options;
  }

  optionsWithCurrent(options: string[], current: string): string[] {
    return current && !options.includes(current) ? [current, ...options] : options;
  }

  private loadSubcategories(): void {
    this.categoryService.getAll().subscribe({
      next: catList => {
        const mains = (catList.data || []).filter(item => item.level === 'main').map(item => item.name);
        if (mains.length) {
          this.categoryOptions = [...new Set([...mains, ...this.categoryOptions])];
        }
        const subs = (catList.data || [])
          .filter(item => item.level === 'sub' && (!this.form.category || !item.parentName || item.parentName === this.form.category))
          .map(item => item.name.trim())
          .filter(Boolean);
        if (subs.length) {
          this.subcategoryOptions = [...new Set([...subs, ...this.subcategoryOptions])].sort((a, b) => a.localeCompare(b, 'vi'));
        }
        this.changeDetector.markForCheck();
      },
      error: () => {},
    });
    this.service.getAll({ page: 1, limit: 100, query: '', category: this.form.category || 'all', status: 'all' }).subscribe({
      next: result => {
        const fromProducts = (result.data || []).map(product => product.subCategory?.trim()).filter((value): value is string => Boolean(value));
        this.subcategoryOptions = [...new Set([...this.subcategoryOptions, ...fromProducts])].sort((a, b) => a.localeCompare(b, 'vi'));
        this.changeDetector.markForCheck();
      },
      error: () => { this.subcategoryOptions = this.form.subCategory ? [this.form.subCategory] : this.subcategoryOptions; },
    });
  }
  private readAdminName(): void {
    try {
      const raw = localStorage.getItem('adminUser') || sessionStorage.getItem('adminUser');
      const user = raw ? JSON.parse(raw) : null;
      this.adminName = user?.name || user?.fullName || user?.email || 'Admin Floralia';
    } catch {
      this.adminName = 'Admin Floralia';
    }
  }

  private loadProduct(): void {
    const cached = this.service.getCachedProduct(this.productId);
    if (cached) {
      this.applyProduct(cached);
      this.loading = false;
    } else this.loading = true;
    this.service.getById(this.productId).subscribe({
      next: product => {
        this.applyProduct(product);
        this.service.upsertCachedProduct(product);
        this.loading = false;
        this.changeDetector.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        if (error.status === 401 || error.status === 403) { this.forceLogout(); return; }
        this.error = error.error?.message || 'Không thể tải thông tin sản phẩm.';
        this.changeDetector.markForCheck();
      },
    });
  }

  private applyProduct(product: AdminProduct): void {
    const initialImages = product.images?.length
      ? [...product.images]
      : product.thumbnail
        ? [product.thumbnail]
        : [];
    this.form = {
      ...this.emptyForm(),
      ...product,
      status: product.status === 'inactive' || product.status === 'out-of-stock' ? 'out-of-stock' : 'active',
      images: initialImages,
      thumbnail: initialImages[0] || '',
      benefits: [...(product.benefits || [])],
      tags: [...(product.tags || [])],
      usage: [...(product.usage || [])],
      instructions: [...(product.instructions || [])],
      variants: (product.variants || []).map(variant => ({ ...variant })),
      imageUploads: [],
      replaceImages: false,
    };
    this.instructionsText = (this.form.instructions || []).join('\n');
    this.loadSubcategories();
    this.imagePreviews = initialImages.map(image => this.imageUrl(image));
    this.lastSavedSnapshot = this.createFormSnapshot();
  }

  private createFormSnapshot(): string {
    return JSON.stringify({
      form: this.form,
      instructionsText: this.instructionsText,
      imageUploadsCount: this.imageUploads.length,
      replaceImages: this.replaceImages,
    });
  }

  get hasUnsavedChanges(): boolean {
    if (this.loading || !this.lastSavedSnapshot) {
      return false;
    }
    return this.createFormSnapshot() !== this.lastSavedSnapshot;
  }

  confirmCanDeactivate(): boolean | Promise<boolean> {
    if (!this.hasUnsavedChanges) {
      this.finishLogoutIfNeeded();
      return true;
    }
    this.error = '';
    this.exitPromptVisible = true;
    this.changeDetector.markForCheck();
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
    this.save(true);
  }

  private resolveExitNavigation(allowNavigation: boolean): void {
    this.exitPromptVisible = false;
    const resolve = this.resolveCanDeactivate;
    this.resolveCanDeactivate = undefined;
    this.changeDetector.markForCheck();
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

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.logoutConfirmationVisible) {
      this.cancelLogoutConfirmation();
    } else if (this.exitPromptVisible && !this.saving) {
      this.stayOnEditor();
    }
  }

  private imageUrl(value: string): string {
    if (!value) return '';
    if (/^(https?:|data:image\/)/i.test(value) || value.startsWith('/assets/')) return value;
    return `http://localhost:3002/products/image/${encodeURIComponent(value)}`;
  }

  onImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (!files.length) return;
    const invalid = files.find(file => !file.type.startsWith('image/'));
    if (invalid) {
      this.error = `${invalid.name}: định dạng tệp không phải hình ảnh hợp lệ.`;
      input.value = '';
      return;
    }
    this.error = '';
    this.successMessage = '';
    const readers = files.map(file => new Promise<ProductImageUpload>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ dataUrl: String(reader.result), name: file.name, type: file.type });
      reader.onerror = () => reject(new Error(`Không thể đọc ảnh ${file.name}.`));
      reader.readAsDataURL(file);
    }));
    Promise.all(readers).then(images => {
      this.imageUploads = [...this.imageUploads, ...images];
      this.form.imageUploads = this.imageUploads;
      this.form.replaceImages = this.replaceImages;
      this.imagePreviews = [...this.imagePreviews, ...images.map(image => image.dataUrl)];
      this.changeDetector.markForCheck();
    }).catch(error => {
      this.error = error.message || 'Không thể đọc ảnh.';
      this.changeDetector.markForCheck();
    });
    input.value = '';
  }

  removeImage(index: number): void {
    if (index < 0 || index >= this.imagePreviews.length) return;
    const existingCount = this.form.images.length;
    if (index < existingCount) {
      this.form.images = this.form.images.filter((_, current) => current !== index);
    } else {
      const uploadIndex = index - existingCount;
      this.imageUploads = this.imageUploads.filter((_, current) => current !== uploadIndex);
      this.form.imageUploads = this.imageUploads;
    }
    this.imagePreviews = this.imagePreviews.filter((_, current) => current !== index);
    this.form.thumbnail = this.form.images[0] || '';
    if (!this.form.images.length && !this.imageUploads.length) {
      this.replaceImages = true;
      this.form.replaceImages = true;
    }
  }

  clearImages(): void {
    this.imagePreviews = [];
    this.imageUploads = [];
    this.form.imageUploads = [];
    this.replaceImages = true;
    this.form.replaceImages = true;
    this.form.thumbnail = '';
    this.form.images = [];
  }

  addVariant(): void {
    const defaultStock = this.form.status === 'out-of-stock' ? 0 : 20;
    const variant: AdminProductVariant = {
      sku: this.form.sku ? `${this.form.sku}-${this.form.variants.length + 1}` : '',
      label: '', price: this.form.price, oldPrice: this.form.oldPrice, stock: defaultStock,
      isDefault: this.form.variants.length === 0,
    };
    this.form.variants = [...this.form.variants, variant];
    this.onVariantStockChange();
  }

  removeVariant(index: number): void {
    this.form.variants = this.form.variants.filter((_, current) => current !== index);
    if (this.form.variants.length && !this.form.variants.some(variant => variant.isDefault)) this.form.variants[0].isDefault = true;
    if (this.form.variants.length) this.onVariantStockChange();
  }

  setDefaultVariant(index: number): void {
    this.form.variants = this.form.variants.map((variant, current) => ({ ...variant, isDefault: current === index }));
    const def = this.form.variants[index];
    if (def) {
      this.form.price = def.price;
      this.form.oldPrice = def.oldPrice;
    }
  }

  onStatusChange(status: 'active' | 'out-of-stock'): void {
    if (status === 'out-of-stock') {
      this.form.stock = 0;
      this.form.variants = this.form.variants.map(variant => ({ ...variant, stock: 0 }));
    } else {
      if (this.form.variants.length) {
        const total = this.form.variants.reduce((sum, variant) => sum + (Number(variant.stock) || 0), 0);
        if (total <= 0) {
          this.form.variants = this.form.variants.map(variant => ({ ...variant, stock: 20 }));
        }
        this.form.stock = this.form.variants.reduce((sum, variant) => sum + (Number(variant.stock) || 0), 0);
      } else if ((Number(this.form.stock) || 0) <= 0) {
        this.form.stock = 20;
      }
    }
  }

  onVariantStockChange(): void {
    if (!this.form.variants.length) return;
    const total = this.form.variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock) || 0), 0);
    this.form.stock = total;
    this.form.status = total > 0 ? 'active' : 'out-of-stock';
  }

  onBaseStockChange(stock: number): void {
    this.form.status = (Number(stock) || 0) > 0 ? 'active' : 'out-of-stock';
  }

  formatPriceInput(value: number | null | undefined): string {
    const num = Math.max(0, Math.floor(Number(value) || 0));
    return num > 0 ? new Intl.NumberFormat('vi-VN').format(num) : '';
  }

  private parsePriceInput(raw: string | number | null | undefined): number {
    const digits = String(raw ?? '').replace(/\D+/g, '');
    return digits ? Math.max(0, Number.parseInt(digits, 10) || 0) : 0;
  }

  onBasePriceInput(raw: string): void {
    const price = this.parsePriceInput(raw);
    this.form.price = price;
    this.onBasePriceChange(price);
  }

  onBaseOldPriceInput(raw: string): void {
    this.form.oldPrice = this.parsePriceInput(raw);
  }

  onVariantPriceInput(index: number, raw: string): void {
    const price = this.parsePriceInput(raw);
    const variant = this.form.variants[index];
    if (!variant) return;
    variant.price = price;
    this.onVariantPriceChange(index, price);
  }

  onVariantOldPriceInput(index: number, raw: string): void {
    const variant = this.form.variants[index];
    if (!variant) return;
    variant.oldPrice = this.parsePriceInput(raw);
  }

  onBasePriceChange(price: number): void {
    if (!this.form.variants.length) return;
    const defaultVariant = this.form.variants.find(variant => variant.isDefault) || this.form.variants[0];
    if (defaultVariant) defaultVariant.price = Number(price) || 0;
  }

  onVariantPriceChange(index: number, price: number): void {
    const variant = this.form.variants[index];
    if (variant && (variant.isDefault || index === 0)) {
      this.form.price = Number(price) || 0;
    }
  }

  openBenefitInput(): void {
    this.editingBenefitIndex = null;
    this.newBenefitText = '';
    this.benefitInputVisible = true;
  }

  editBenefit(index: number): void {
    const current = this.form.usage[index];
    if (current === undefined) return;
    this.editingBenefitIndex = index;
    this.newBenefitText = current;
    this.benefitInputVisible = true;
  }

  saveBenefit(): void {
    const items = this.newBenefitText
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    if (!items.length) {
      if (this.editingBenefitIndex !== null) {
        this.removeBenefit(this.editingBenefitIndex);
      }
      this.cancelBenefitInput();
      return;
    }

    if (this.editingBenefitIndex !== null) {
      const nextUsage = [...this.form.usage];
      nextUsage.splice(this.editingBenefitIndex, 1, ...items);
      const uniqueUsage: string[] = [];
      for (const item of nextUsage) {
        if (!uniqueUsage.some(existing => existing.toLocaleLowerCase() === item.toLocaleLowerCase())) {
          uniqueUsage.push(item);
        }
      }
      this.form.usage = uniqueUsage;
    } else {
      const nextUsage = [...this.form.usage];
      for (const item of items) {
        if (!nextUsage.some(existing => existing.toLocaleLowerCase() === item.toLocaleLowerCase())) {
          nextUsage.push(item);
        }
      }
      this.form.usage = nextUsage;
    }

    this.form.benefits = [...new Set(this.form.usage.map(item => this.slugify(item)).filter(Boolean))];
    this.cancelBenefitInput();
  }

  cancelBenefitInput(): void {
    this.newBenefitText = '';
    this.editingBenefitIndex = null;
    this.benefitInputVisible = false;
  }

  removeBenefit(index: number): void {
    this.form.usage = this.form.usage.filter((_, current) => current !== index);
    this.form.benefits = [...new Set(this.form.usage.map(item => this.slugify(item)).filter(Boolean))];
    if (this.editingBenefitIndex === index) {
      this.cancelBenefitInput();
    } else if (this.editingBenefitIndex !== null && this.editingBenefitIndex > index) {
      this.editingBenefitIndex--;
    }
  }

  openTagInput(): void {
    this.editingTagIndex = null;
    this.newTagText = '';
    this.tagInputVisible = true;
  }

  editTag(index: number): void {
    const current = this.form.tags[index];
    if (current === undefined) return;
    this.editingTagIndex = index;
    this.newTagText = current;
    this.tagInputVisible = true;
  }

  saveTag(): void {
    const items = this.newTagText
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    if (!items.length) {
      if (this.editingTagIndex !== null) {
        this.removeTag(this.editingTagIndex);
      }
      this.cancelTagInput();
      return;
    }

    if (this.editingTagIndex !== null) {
      const nextTags = [...this.form.tags];
      nextTags.splice(this.editingTagIndex, 1, ...items);
      const uniqueTags: string[] = [];
      for (const item of nextTags) {
        if (!uniqueTags.some(existing => existing.toLocaleLowerCase() === item.toLocaleLowerCase())) {
          uniqueTags.push(item);
        }
      }
      this.form.tags = uniqueTags;
    } else {
      const nextTags = [...this.form.tags];
      for (const item of items) {
        if (!nextTags.some(existing => existing.toLocaleLowerCase() === item.toLocaleLowerCase())) {
          nextTags.push(item);
        }
      }
      this.form.tags = nextTags;
    }

    this.cancelTagInput();
  }

  cancelTagInput(): void {
    this.newTagText = '';
    this.editingTagIndex = null;
    this.tagInputVisible = false;
  }

  removeTag(index: number): void {
    this.form.tags = this.form.tags.filter((_, current) => current !== index);
    if (this.editingTagIndex === index) {
      this.cancelTagInput();
    } else if (this.editingTagIndex !== null && this.editingTagIndex > index) {
      this.editingTagIndex--;
    }
  }

  setInstructions(value: string): void {
    this.instructionsText = value;
    this.form.instructions = value.split('\n').map(item => item.trim()).filter(Boolean);
  }

  onCategoryChange(category: string): void {
    this.form.categorySlug = this.slugify(category);
    this.form.subCategory = '';
    this.subcategoryOptions = [];
    this.service.getAll({ page: 1, limit: 100, query: '', category: category || 'all', status: 'all' }).subscribe({
      next: result => {
        this.subcategoryOptions = [...new Set((result.data || []).map(product => product.subCategory?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'vi'));
        this.changeDetector.markForCheck();
      },
      error: () => this.changeDetector.markForCheck(),
    });
  }

  slugify(value: string): string {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  formatPrice(value: number): string { return new Intl.NumberFormat('vi-VN').format(Number(value) || 0) + '₫'; }
  cancel(): void { void this.router.navigate(['/products']); }
  requestLogoutConfirmation(): void { this.logoutConfirmationVisible = true; }
  cancelLogoutConfirmation(): void { this.logoutConfirmationVisible = false; }
  confirmLogout(): void { this.logoutConfirmationVisible = false; this.logout(); }
  private logout(): void {
    this.pendingLogout = true;
    void this.router.navigate(['/admin-login']);
  }
  private forceLogout(): void {
    this.lastSavedSnapshot = '';
    this.pendingLogout = true;
    this.finishLogoutIfNeeded();
    void this.router.navigate(['/admin-login']);
  }

  private validateForm(): boolean {
    if (!this.form.name.trim() || !this.form.sku.trim() || !this.form.category.trim()) {
      this.error = 'Vui lòng nhập tên sản phẩm, SKU và danh mục.';
      return false;
    }
    if (this.form.oldPrice > 0 && this.form.price > this.form.oldPrice) {
      this.error = 'Giá bán không được cao hơn giá gốc.';
      return false;
    }
    const skuSet = new Set<string>();
    for (const variant of this.form.variants) {
      if (!variant.label.trim() || !variant.sku.trim()) {
        this.error = 'Vui lòng nhập SKU và tên cho tất cả phân loại.';
        return false;
      }
      if (skuSet.has(variant.sku.trim().toUpperCase())) {
        this.error = 'SKU phân loại không được trùng nhau.';
        return false;
      }
      skuSet.add(variant.sku.trim().toUpperCase());
      if (variant.price > variant.oldPrice && variant.oldPrice > 0) {
        this.error = `Giá bán của ${variant.label} không được cao hơn giá gốc.`;
        return false;
      }
    }
    return true;
  }

  save(exitAfterSave = false): void {
    if (this.saving) {
      return;
    }
    if (!this.validateForm()) {
      this.changeDetector.markForCheck();
      return;
    }
    this.error = '';
    this.saving = true;
    this.form.slug = this.form.slug || this.slugify(this.form.name);
    this.form.categorySlug = this.form.categorySlug || this.slugify(this.form.category);
    this.form.imageUploads = this.imageUploads;
    this.form.replaceImages = this.replaceImages;
    this.form.isActive = this.form.status === 'active';
    this.form.instructions = this.instructionsText.split('\n').map(item => item.trim()).filter(Boolean);
    const request = this.isEdit ? this.service.update(this.productId, this.form) : this.service.create(this.form);
    request.subscribe({
      next: product => {
        this.saving = false;
        this.imageUploads = [];
        this.replaceImages = false;
        this.applyProduct(product);
        this.service.upsertCachedProduct(product);
        if (exitAfterSave) {
          this.finishLogoutIfNeeded();
          this.resolveExitNavigation(true);
          return;
        }
        this.successMessage = this.isEdit ? 'Đã lưu thay đổi. Bạn có thể tiếp tục chỉnh sửa sản phẩm.' : 'Đã thêm sản phẩm. Bạn có thể tiếp tục chỉnh sửa tại đây.';
        if (!this.isEdit && product._id) {
          this.isEdit = true;
          this.productId = product._id;
          void this.router.navigate(['/products', product._id, 'edit'], { replaceUrl: true });
        }
        this.changeDetector.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        if (error.status === 401 || error.status === 403) { this.forceLogout(); return; }
        this.error = error.error?.message || 'Không thể lưu sản phẩm.';
        this.changeDetector.markForCheck();
      },
    });
  }
}

export const canDeactivateProductEditor: CanDeactivateFn<ProductEditor> =
  component => component.confirmCanDeactivate();
