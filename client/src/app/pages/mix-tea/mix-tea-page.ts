import { Component, OnInit, Optional } from '@angular/core';
import { Products } from '../../classes/Products';
import { ProductService } from '../../services/product-service';

interface TeaChoice {
  sku: string;
  name: string;
  tastingNote: string;
  image: string;
  available: boolean;
}

interface TeaPreset {
  name: string;
  description: string;
  skus: string[];
  sugarSku: string;
  sugarGrams: number;
}

interface SugarChoice {
  sku: string;
  name: string;
  detail: string;
  image: string;
  available: boolean;
}

@Component({
  selector: 'app-mix-tea-page',
  standalone: false,
  templateUrl: './mix-tea-page.html',
  styleUrl: './mix-tea-page.css',
})
export class MixTeaPage implements OnInit {
  readonly maxChoices = 2;
  readonly batchGrams = 100;
  readonly teas: TeaChoice[] = [
    { sku: 'TTM001', name: 'Hồng Diệp Trà', tastingNote: 'Atiso đỏ · chua thanh, thơm dịu', image: '/assets/images/no-image.svg', available: true },
    { sku: 'TTM003', name: 'Hoàng Cúc Trà', tastingNote: 'Cúc vàng · thanh nhẹ, thơm hoa', image: '/assets/images/no-image.svg', available: true },
    { sku: 'TTM006', name: 'Lệ Hạ Trà', tastingNote: 'Mâm xôi · ngọt nồng, hương hoa', image: '/assets/images/no-image.svg', available: true },
    { sku: 'TTM007', name: 'Kim Tâm Trà', tastingNote: 'Tam thất · đắng nhẹ, hậu ngọt sâu', image: '/assets/images/no-image.svg', available: true },
    { sku: 'TTM008', name: 'Hồng Vân Trà', tastingNote: 'Hoa hồng · hương nồng nàn, thanh nhẹ', image: '/assets/images/no-image.svg', available: true },
    { sku: 'TTM009', name: 'Bạch Cúc An Trà', tastingNote: 'Cúc trắng · thanh mát, dịu nhẹ', image: '/assets/images/no-image.svg', available: true },
    { sku: 'TTM010', name: 'Lam Diệp Trà', tastingNote: 'Hắc kỷ tử · chua ngọt dịu', image: '/assets/images/no-image.svg', available: true },
    { sku: 'TTM011', name: 'Tuyết Liên Trà', tastingNote: 'Hoa sen tuyết · thanh khiết, hương dịu', image: '/assets/images/no-image.svg', available: true },
    { sku: 'TTM012', name: 'Hồng Nhãn Trà', tastingNote: 'Kỷ tử · vị ngọt đượm', image: '/assets/images/no-image.svg', available: true },
    { sku: 'TTM014', name: 'Chi Bản Tịnh Trà', tastingNote: 'Atiso đỏ & hoa hồng · chua thanh', image: '/assets/images/no-image.svg', available: true },
  ];

  readonly sugars: SugarChoice[] = [
    { sku: 'DU001', name: 'Đường phèn vàng', detail: 'Dịu ngọt, vị thanh', image: '/assets/images/no-image.svg', available: true },
    { sku: 'DK030', name: 'Đường nâu viên', detail: 'Ngọt ấm, đậm vị', image: '/assets/images/no-image.svg', available: true },
    { sku: 'DK031', name: 'Đường phèn trắng', detail: 'Ngọt nhẹ, trong vị', image: '/assets/images/no-image.svg', available: true },
    { sku: 'DK032', name: 'Đường Stevia', detail: 'Lựa chọn vị ngọt riêng', image: '/assets/images/no-image.svg', available: true },
    { sku: 'DK033', name: 'Đường dừa', detail: 'Hương vị dịu, thơm nhẹ', image: '/assets/images/no-image.svg', available: true },
    { sku: 'DK034', name: 'Đường phèn mật mía', detail: 'Ngọt đượm, hương mật mía', image: '/assets/images/no-image.svg', available: true },
  ];

  readonly presets: TeaPreset[] = [
    { name: 'Hương hoa dịu', description: 'Cúc trắng · hoa hồng · phèn trắng', skus: ['TTM009', 'TTM008'], sugarSku: 'DK031', sugarGrams: 5 },
    { name: 'Chua thanh', description: 'Atiso đỏ · điểm hương hoa', skus: ['TTM001', 'TTM008'], sugarSku: 'DK034', sugarGrams: 10 },
    { name: 'Hương vị êm', description: 'Sen tuyết · kỷ tử · đường nâu', skus: ['TTM011', 'TTM012'], sugarSku: 'DK030', sugarGrams: 8 },
  ];

  selectedSkus: string[] = [];
  sugarSku = '';
  sugarGrams = 0;
  teaRatio = 50;
  selectionLimitMessage = '';
  catalogMessage = '';
  recipeMessage = '';

  constructor(@Optional() private readonly productService: ProductService | null) {
    for (const choice of this.teas) {
      choice.image = this.getAssetImage(`${choice.sku}_THUMB`);
    }
    for (const choice of this.sugars) {
      choice.image = this.getAssetImage(`${choice.sku}_THUMB`);
    }
  }

  ngOnInit(): void {
    if (!this.productService) return;
    this.productService.getProducts().subscribe({
      next: products => this.applyCatalog(products),
      error: () => {
        this.catalogMessage = 'Chưa tải được tồn kho mới nhất. Bạn vẫn có thể gửi công thức để Floralia xác nhận.';
      }
    });
  }

  private applyCatalog(products: Products[]): void {
    const bySku = new Map(products.map(product => [product.sku, product]));
    for (const choice of [...this.teas, ...this.sugars]) {
      const product = bySku.get(choice.sku);
      if (!product) {
        choice.available = false;
        continue;
      }
      choice.name = product.name || choice.name;
      choice.available = product.isActive !== false && Number(product.stock) > 0;
      const productImage = this.getProductImage(product);
      if (productImage !== '/assets/images/no-image.svg') choice.image = productImage;
    }

    const unavailable = this.selectedSkus.filter(sku => !this.teas.find(tea => tea.sku === sku)?.available);
    this.selectedSkus = this.selectedSkus.filter(sku => !unavailable.includes(sku));
    if (this.sugarSku && !this.sugars.find(sugar => sugar.sku === this.sugarSku)?.available) {
      this.sugarSku = '';
      this.sugarGrams = 0;
    }
    if (unavailable.length || [...this.teas, ...this.sugars].some(choice => !choice.available)) {
      this.catalogMessage = 'Một số nguyên liệu đang hết hàng hoặc không còn kinh doanh.';
    }
  }

  private getProductImage(product: Products): string {
    const source = product.imageUrl || '';
    if (source) {
      if (/^(https?:|data:)/i.test(source)) return source;
      const configured = (window as Window & { FLORALIA_API_ORIGIN?: string }).FLORALIA_API_ORIGIN?.trim();
      const apiOrigin = configured || `${window.location.protocol}//${window.location.hostname}:3002`;
      return `${apiOrigin}${source.startsWith('/') ? '' : '/'}${source}`;
    }
    const thumbnail = product.thumbnail || '';
    if (/^(https?:|data:)/i.test(thumbnail)) return thumbnail;
    return /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(thumbnail)
      ? (thumbnail.startsWith('/') ? thumbnail : `/assets/images/${thumbnail}`)
      : '/assets/images/no-image.svg';
  }

  private getAssetImage(assetId: string): string {
    const configured = typeof window !== 'undefined'
      ? (window as Window & { FLORALIA_API_ORIGIN?: string }).FLORALIA_API_ORIGIN?.trim()
      : '';
    const apiOrigin = configured || (typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:3002`
      : 'http://localhost:3002');
    return `${apiOrigin}/products/image/${encodeURIComponent(assetId)}`;
  }

  onImageError(event: Event): void {
    const image = event.target as HTMLImageElement | null;
    if (image && !image.src.endsWith('/assets/images/no-image.svg')) {
      image.src = '/assets/images/no-image.svg';
    }
  }

  get selectedTeas(): TeaChoice[] {
    return this.selectedSkus
      .map(sku => this.teas.find(tea => tea.sku === sku))
      .filter((tea): tea is TeaChoice => Boolean(tea));
  }

  get selectedSugar(): SugarChoice | undefined {
    return this.sugars.find((sugar) => sugar.sku === this.sugarSku);
  }

  get flavorProfile(): string {
    const selected = this.selectedTeas;
    if (!selected.length) return 'Chọn cốt trà để xem gợi ý hương vị cho mẻ trà của bạn.';

    const notes = selected.map(tea => {
      const parts = tea.tastingNote.split('·');
      return (parts.length > 1 ? parts.slice(1).join('·') : parts[0]).trim();
    });
    let teaProfile = notes[0];
    if (notes.length === 2) {
      const dominantIndex = this.teaRatio >= 50 ? 0 : 1;
      const supportingIndex = dominantIndex === 0 ? 1 : 0;
      teaProfile = `${notes[dominantIndex]} làm vị chủ đạo, hòa cùng ${notes[supportingIndex]}`;
    }

    if (!this.selectedSugar || this.sugarGrams <= 0) {
      return `${teaProfile}. Không thêm đường nên giữ vị trà rõ, hậu vị tự nhiên.`;
    }

    const sweetness = this.sugarGrams <= 5 ? 'ngọt nhẹ' : this.sugarGrams <= 12 ? 'ngọt dịu' : 'ngọt đậm';
    return `${teaProfile}. ${this.selectedSugar.detail}; với ${this.sugarGrams}g đường, vị trà sẽ ${sweetness}.`;
  }

  get jarFillPercent(): number {
    return this.selectedSkus.length ? 48 + (this.selectedSkus.length - 1) * 12 + (this.sugarSku ? 8 : 0) : 8;
  }

  get jarColor(): string {
    const selected = this.selectedTeas;
    if (!selected.length) return 'rgba(177, 190, 147, .55)';
    const colors: Record<string, string> = {
      TTM001: '#a86863', TTM003: '#d1ad52', TTM006: '#a96f73', TTM007: '#779167',
      TTM008: '#b87985', TTM009: '#e0c982', TTM010: '#766f75', TTM011: '#d4c5a0',
      TTM012: '#bd8465', TTM014: '#ad7776',
    };
    const first = colors[selected[0].sku] || '#92a87e';
    if (selected.length === 1) return first;
    const second = colors[selected[1].sku] || '#92a87e';
    return this.sugarGrams > 0
      ? `linear-gradient(180deg, ${first} 0%, ${second} 72%, #c6a66c 100%)`
      : `linear-gradient(180deg, ${first}, ${second})`;
  }

  getTeaGrams(sku: string): number {
    const teaWeight = this.batchGrams - this.sugarGrams;
    if (this.selectedTeas.length < 2) return teaWeight;
    const primary = Math.round((teaWeight * this.teaRatio / 100) / 5) * 5;
    return this.selectedSkus[0] === sku ? primary : teaWeight - primary;
  }

  isSelected(sku: string): boolean {
    return this.selectedSkus.includes(sku);
  }

  isPresetSelected(preset: TeaPreset): boolean {
    return preset.skus.length === this.selectedSkus.length
      && preset.skus.every((sku) => this.isSelected(sku))
      && this.sugarSku === preset.sugarSku
      && this.sugarGrams === preset.sugarGrams;
  }

  isPresetAvailable(preset: TeaPreset): boolean {
    return preset.skus.every(sku => this.teas.find(tea => tea.sku === sku)?.available)
      && Boolean(this.sugars.find(sugar => sugar.sku === preset.sugarSku)?.available);
  }

  toggleTea(sku: string): void {
    this.selectionLimitMessage = '';
    this.recipeMessage = '';
    if (!this.teas.find(tea => tea.sku === sku)?.available) {
      this.selectionLimitMessage = 'Nguyên liệu này hiện đang hết hàng.';
      return;
    }
    if (this.isSelected(sku)) {
      this.selectedSkus = this.selectedSkus.filter((item) => item !== sku);
      if (this.selectedSkus.length < 2) this.teaRatio = 50;
      return;
    }
    if (this.selectedSkus.length >= this.maxChoices) {
      this.selectionLimitMessage = `Bạn có thể chọn tối đa ${this.maxChoices} vị trà cho một công thức.`;
      return;
    }
    this.selectedSkus = [...this.selectedSkus, sku];
  }

  applyPreset(preset: TeaPreset): void {
    const allAvailable = preset.skus.every(sku => this.teas.find(tea => tea.sku === sku)?.available)
      && Boolean(this.sugars.find(sugar => sugar.sku === preset.sugarSku)?.available);
    if (!allAvailable) {
      this.selectionLimitMessage = 'Công thức này có nguyên liệu đang hết hàng. Hãy chọn công thức khác.';
      return;
    }
    this.selectedSkus = [...preset.skus];
    this.sugarSku = preset.sugarSku;
    this.sugarGrams = preset.sugarGrams;
    this.teaRatio = 50;
    this.selectionLimitMessage = '';
    this.recipeMessage = '';
  }

  chooseSugar(sku: string): void {
    if (sku && !this.sugars.find(sugar => sugar.sku === sku)?.available) {
      this.selectionLimitMessage = 'Đường này hiện đang hết hàng.';
      return;
    }
    this.selectionLimitMessage = '';
    this.recipeMessage = '';
    this.sugarSku = sku;
    this.sugarGrams = sku ? (this.sugarGrams || 5) : 0;
  }

  clearSelection(): void {
    this.selectedSkus = [];
    this.sugarSku = '';
    this.sugarGrams = 0;
    this.teaRatio = 50;
    this.selectionLimitMessage = '';
    this.recipeMessage = '';
  }

  sendRecipe(): void {
    if (!this.selectedTeas.length) return;
    const recipe = this.selectedTeas.map((tea) => `• ${tea.name}: ${this.getTeaGrams(tea.sku)}g`).join('\n');
    const sugar = this.selectedSugar ? `• ${this.selectedSugar.name}: ${this.sugarGrams}g` : '• Không thêm đường';
    const subject = 'Tư vấn công thức trà Floralia tự phối';
    const ratio = this.selectedTeas.length > 1 ? `\nTỷ lệ cốt trà: ${this.teaRatio}% / ${100 - this.teaRatio}%` : '';
    const body = `Xin chào Floralia,\n\nMình muốn được tư vấn công thức phối trà 100g gồm:\n${recipe}\n${sugar}${ratio}\n\nMong Floralia tư vấn thêm giúp mình.\n\nCảm ơn!`;
    window.location.href = `mailto:floralia@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  async copyRecipe(): Promise<void> {
    if (!this.selectedTeas.length) return;
    const ingredients = this.selectedTeas.map(tea => `• ${tea.name}: ${this.getTeaGrams(tea.sku)}g`);
    ingredients.push(this.selectedSugar
      ? `• ${this.selectedSugar.name}: ${this.sugarGrams}g`
      : '• Không thêm đường: 0g');
    if (this.selectedTeas.length > 1) {
      ingredients.push(`Tỷ lệ cốt trà: ${this.teaRatio}% / ${100 - this.teaRatio}%`);
    }
    try {
      await navigator.clipboard.writeText([`Công thức trà Floralia - mẻ phối ${this.batchGrams}g`, ...ingredients].join('\n'));
      this.recipeMessage = 'Đã sao chép công thức. Bạn có thể dán vào tin nhắn để gửi Floralia.';
    } catch {
      this.recipeMessage = 'Trình duyệt không cho phép sao chép tự động. Hãy dùng nút gửi email để chuyển công thức.';
    }
  }
}
