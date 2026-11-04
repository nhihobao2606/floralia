import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CartProduct, CartService, CartVariant } from './cart-service';

export interface BuyNowRequest {
  product: CartProduct;
  image: string;
}

@Injectable({ providedIn: 'root' })
export class BuyNowService {
  readonly request = signal<BuyNowRequest | null>(null);
  readonly selectedVariant = signal<CartVariant | null>(null);
  readonly quantity = signal(1);
  readonly error = signal('');
  readonly isSubmitting = signal(false);

  constructor(
    private readonly cartService: CartService,
    private readonly router: Router,
  ) {}

  open(
    product: CartProduct,
    image: string,
    preferredVariant: CartVariant | null = null,
    quantity = 1,
  ): void {
    if (this.isSubmitting() || !this.hasStock(product)) return;

    const variants = product.variants ?? [];
    const selected = preferredVariant && Number(preferredVariant.stock ?? 0) > 0
      ? preferredVariant
      : variants.find((variant) => variant.isDefault && Number(variant.stock ?? 0) > 0) ??
        variants.find((variant) => Number(variant.stock ?? 0) > 0) ??
        preferredVariant ??
        variants.find((variant) => variant.isDefault) ??
        variants[0] ??
        null;

    this.request.set({ product, image });
    this.selectedVariant.set(selected);
    this.quantity.set(Math.max(1, Math.min(Math.floor(quantity) || 1, Math.max(this.stock, 1))));
    this.error.set('');
    this.isSubmitting.set(false);
  }

  close(): void {
    if (this.isSubmitting()) return;
    this.request.set(null);
    this.selectedVariant.set(null);
    this.quantity.set(1);
    this.error.set('');
  }

  selectVariant(variant: CartVariant): void {
    if (this.isSubmitting() || Number(variant.stock ?? 0) < 1) return;
    this.selectedVariant.set(variant);
    this.quantity.set(Math.min(this.quantity(), variant.stock ?? 1));
    this.error.set('');
  }

  changeQuantity(delta: number): void {
    if (this.isSubmitting()) return;
    const next = this.quantity() + delta;
    if (next >= 1 && next <= this.stock) this.quantity.set(next);
  }

  get stock(): number {
    const request = this.request();
    return Number(this.selectedVariant()?.stock ?? request?.product.stock ?? 0);
  }

  get price(): number {
    const product = this.request()?.product;
    return Number(this.selectedVariant()?.price ?? product?.price ?? product?.minPrice ?? 0);
  }

  async confirmPurchase(): Promise<void> {
    const request = this.request();
    if (!request || this.isSubmitting()) return;
    if (this.stock < 1) {
      this.error.set('Phân loại này đang hết hàng. Vui lòng chọn phân loại khác.');
      return;
    }

    const variant = this.selectedVariant();
    const quantity = Math.min(this.quantity(), this.stock);
    this.isSubmitting.set(true);
    this.error.set('');

    if (!this.cartService.addProduct(request.product, variant, quantity, request.image)) {
      this.error.set(this.cartService.cartMessage() || 'Không thể mua sản phẩm này. Vui lòng thử lại.');
      this.isSubmitting.set(false);
      return;
    }

    const product = request.product;
    const productId = product._id || product.id || product.sku || product.slug || '';
    const sku = variant?.sku || product.sku || productId;
    const checkoutItem = {
      id: sku,
      productId,
      sku,
      name: product.name || product.title || 'Trà thảo mộc Floralia',
      title: product.name || product.title || 'Trà thảo mộc Floralia',
      image: request.image,
      thumbnail: request.image,
      variant: variant?.label || '',
      variantLabel: variant?.label || '',
      price: this.price,
      quantity,
      total: this.price * quantity,
    };

    try {
      sessionStorage.setItem('checkout_items', JSON.stringify([checkoutItem]));
      const navigated = await this.router.navigate(['/checkout']);
      if (navigated) {
        this.request.set(null);
        this.selectedVariant.set(null);
        this.quantity.set(1);
      } else {
        this.error.set('Chưa thể chuyển đến trang thanh toán. Vui lòng thử lại.');
      }
    } catch (error) {
      console.error('Không thể bắt đầu thanh toán sản phẩm:', error);
      this.error.set('Chưa thể chuyển đến trang thanh toán. Vui lòng thử lại.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private hasStock(product: CartProduct): boolean {
    return product.variants?.length
      ? product.variants.some((variant) => Number(variant.stock ?? 0) > 0)
      : Number(product.stock ?? 0) > 0;
  }
}
