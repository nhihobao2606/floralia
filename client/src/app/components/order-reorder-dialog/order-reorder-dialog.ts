import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { OrderItem } from '../../services/order-service';
import { ProductService } from '../../services/product-service';
import { Products } from '../../classes/Products';

interface ReorderSelection {
  item: OrderItem;
  product: Products | null;
  variant: Products['variants'][number] | null;
  quantity: number;
}

@Component({
  selector: 'app-order-reorder-dialog',
  standalone: false,
  templateUrl: './order-reorder-dialog.html',
  styleUrl: './order-reorder-dialog.css'
})
export class OrderReorderDialog implements OnChanges {
  @Input() items: OrderItem[] | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() checkout = new EventEmitter<void>();

  selections: ReorderSelection[] = [];
  loading = false;
  error = '';

  constructor(
    private productService: ProductService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items'] && this.items?.length) {
      this.loadProducts();
    }
  }

  loadProducts(): void {
    if (!this.items?.length) return;
    this.loading = true;
    this.error = '';
    this.selections = this.items.map(item => ({ item, product: null, variant: null, quantity: item.quantity }));

    this.productService.getProducts().subscribe({
      next: products => {
        this.selections = this.selections.map(selection => {
          const product = products.find(candidate =>
            candidate.sku === selection.item.sku ||
            candidate.variants?.some(variant => variant.sku === selection.item.sku)
          ) || null;
          const variant = product?.variants?.find(option => option.sku === selection.item.sku) ||
            product?.variants?.find(option => option.isDefault && option.stock > 0) ||
            product?.variants?.find(option => option.stock > 0) ||
            null;
          const stock = Number(variant?.stock ?? product?.stock ?? 0);
          const quantity = stock > 0 ? Math.min(selection.item.quantity, stock) : selection.item.quantity;
          return { ...selection, product, variant, quantity };
        });
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        console.error('Không thể tải phân loại sản phẩm khi mua lại:', error);
        this.error = 'Không thể tải danh sách phân loại. Vui lòng thử lại.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  selectVariant(selection: ReorderSelection, variant: Products['variants'][number]): void {
    if (variant.stock < 1) return;
    selection.variant = variant;
    selection.quantity = Math.min(selection.quantity, variant.stock);
  }

  changeQuantity(selection: ReorderSelection, delta: number): void {
    const stock = this.stockFor(selection);
    const quantity = selection.quantity + delta;
    if (quantity >= 1 && quantity <= stock) {
      selection.quantity = quantity;
    }
  }

  stockFor(selection: ReorderSelection): number {
    if (selection.product?.variants?.length) {
      return Number(selection.variant?.stock ?? 0);
    }
    return Number(selection.variant?.stock ?? selection.product?.stock ?? 0);
  }

  priceFor(selection: ReorderSelection): number {
    return Number(selection.variant?.price ?? selection.product?.price ?? selection.product?.minPrice ?? selection.item.price ?? 0);
  }

  canContinue(): boolean {
    return !this.loading &&
      !this.error &&
      this.selections.length > 0 &&
      this.selections.every(selection =>
        !selection.product ||
        (this.stockFor(selection) >= selection.quantity &&
          (!selection.product.variants?.length || Boolean(selection.variant && selection.variant.stock > 0)))
      );
  }

  continueToCheckout(): void {
    if (!this.canContinue()) return;

    sessionStorage.setItem('checkout_items', JSON.stringify(this.selections.map(selection => ({
      sku: selection.variant?.sku || selection.item.sku,
      variant: selection.variant?.label || selection.item.variant || '',
      variantLabel: selection.variant?.label || selection.item.variant || '',
      quantity: selection.quantity,
      image: selection.item.image
    }))));
    sessionStorage.removeItem('checkout_shipping_fee');
    this.checkout.emit();
  }
}
