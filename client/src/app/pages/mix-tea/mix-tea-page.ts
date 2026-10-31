import { Component } from '@angular/core';

interface TeaChoice {
  sku: string;
  name: string;
  tastingNote: string;
  image: string;
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
}

@Component({
  selector: 'app-mix-tea-page',
  standalone: false,
  templateUrl: './mix-tea-page.html',
  styleUrl: './mix-tea-page.css',
})
export class MixTeaPage {
  readonly maxChoices = 2;
  readonly batchGrams = 100;
  readonly teas: TeaChoice[] = [
    { sku: 'TTM001', name: 'Hồng Diệp Trà', tastingNote: 'Atiso đỏ · chua thanh, thơm dịu', image: '3.png' },
    { sku: 'TTM003', name: 'Hoàng Cúc Trà', tastingNote: 'Cúc vàng · thanh nhẹ, thơm hoa', image: '31.png' },
    { sku: 'TTM006', name: 'Lệ Hạ Trà', tastingNote: 'Mâm xôi · ngọt nồng, hương hoa', image: '147.png' },
    { sku: 'TTM007', name: 'Kim Tâm Trà', tastingNote: 'Tam thất · đắng nhẹ, hậu ngọt sâu', image: '22.png' },
    { sku: 'TTM008', name: 'Hồng Vân Trà', tastingNote: 'Hoa hồng · hương nồng nàn, thanh nhẹ', image: '26.png' },
    { sku: 'TTM009', name: 'Bạch Cúc An Trà', tastingNote: 'Cúc trắng · thanh mát, dịu nhẹ', image: '4.png' },
    { sku: 'TTM010', name: 'Lam Diệp Trà', tastingNote: 'Hắc kỷ tử · chua ngọt dịu', image: '34.png' },
    { sku: 'TTM011', name: 'Tuyết Liên Trà', tastingNote: 'Hoa sen tuyết · thanh khiết, hương dịu', image: '153.png' },
    { sku: 'TTM012', name: 'Hồng Nhãn Trà', tastingNote: 'Kỷ tử · vị ngọt đượm', image: '49.png' },
    { sku: 'TTM014', name: 'Chi Bản Tịnh Trà', tastingNote: 'Atiso đỏ & hoa hồng · chua thanh', image: '150.png' },
  ];

  readonly sugars: SugarChoice[] = [
    { sku: 'DU001', name: 'Đường phèn vàng', detail: 'Dịu ngọt, vị thanh', image: '202.png' },
    { sku: 'DK030', name: 'Đường nâu viên', detail: 'Ngọt ấm, đậm vị', image: '190.png' },
    { sku: 'DK031', name: 'Đường phèn trắng', detail: 'Ngọt nhẹ, trong vị', image: '195.png' },
    { sku: 'DK032', name: 'Đường Stevia', detail: 'Lựa chọn vị ngọt riêng', image: '198.png' },
    { sku: 'DK033', name: 'Đường dừa', detail: 'Hương vị dịu, thơm nhẹ', image: '43.png' },
    { sku: 'DK034', name: 'Đường phèn mật mía', detail: 'Ngọt đượm, hương mật mía', image: '207.png' },
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

  get selectedTeas(): TeaChoice[] {
    return this.teas.filter((tea) => this.selectedSkus.includes(tea.sku));
  }

  get selectedSugar(): SugarChoice | undefined {
    return this.sugars.find((sugar) => sugar.sku === this.sugarSku);
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

  toggleTea(sku: string): void {
    this.selectionLimitMessage = '';
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
    this.selectedSkus = [...preset.skus];
    this.sugarSku = preset.sugarSku;
    this.sugarGrams = preset.sugarGrams;
    this.teaRatio = 50;
    this.selectionLimitMessage = '';
  }

  chooseSugar(sku: string): void {
    this.sugarSku = sku;
    this.sugarGrams = sku ? (this.sugarGrams || 5) : 0;
  }

  clearSelection(): void {
    this.selectedSkus = [];
    this.sugarSku = '';
    this.sugarGrams = 0;
    this.teaRatio = 50;
    this.selectionLimitMessage = '';
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
}
