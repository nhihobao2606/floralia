import { Injectable, signal } from '@angular/core';

export interface CartProduct {
  _id?: string;
  id?: string;
  sku?: string;
  slug?: string;
  name?: string;
  title?: string;
  price?: number;
  minPrice?: number;
  oldPrice?: number;
  stock?: number;
  variants?: CartVariant[];
}

export interface CartVariant {
  sku?: string;
  label?: string;
  price?: number;
  oldPrice?: number;
  stock?: number;
  isDefault?: boolean;
}

export interface CartItem {
  id?: string;
  productId?: string;
  variantSku?: string;
  sku?: string;
  name?: string;
  title?: string;
  slug?: string;
  price: number;
  oldPrice?: number;
  quantity: number;
  image?: string;
  thumbnail?: string;
  variantLabel?: string;
  variantCount?: number;
  productSku?: string;
  variants?: CartVariant[];
  [key: string]: unknown;
}

interface CartUser {
  email?: string;
  id?: string;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  readonly cartMessage = signal('');
  private cartMessageTimeout: number | undefined;

  getCart(): CartItem[] {
    const raw = localStorage.getItem(this.cartKey);
    if (!raw) return [];

    try {
      const cart: unknown = JSON.parse(raw);
      if (Array.isArray(cart)) return cart as CartItem[];
      console.error('Dữ liệu giỏ hàng không đúng định dạng.');
      return [];
    } catch (error) {
      console.error('Không đọc được dữ liệu giỏ hàng:', error);
      return [];
    }
  }

  addProduct(
    product: CartProduct,
    variant: CartVariant | null,
    quantity: number,
    image: string,
  ): boolean {
    const variantSku = variant?.sku || '';
    const productId = product._id || product.id || product.sku || product.slug || '';
    const stock = Number(variant?.stock ?? product.stock ?? 0);
    if (!productId) {
      this.showCartMessage('Không thể thêm sản phẩm vào giỏ hàng.');
      return false;
    }
    if (stock < 1) {
      this.showCartMessage('Sản phẩm đang hết hàng.');
      return false;
    }

    const cart = this.getCart();
    const existing = cart.find((item) =>
      item.productId === productId && (item.variantSku || '') === variantSku
    );
    const quantityToAdd = Math.min(Math.max(1, Math.floor(quantity)), stock);

    if (existing) {
      existing.quantity = Math.min(
        Number(existing.quantity || 0) + quantityToAdd,
        stock,
      );
      existing.variants = product.variants?.map((option) => ({ ...option }));
      existing.variantCount = product.variants?.length ?? existing.variantCount ?? 0;
    } else {
      const price = Number(variant?.price ?? product.price ?? product.minPrice ?? 0);
      const oldPrice = Number(variant?.oldPrice ?? product.oldPrice ?? 0);
      cart.push({
        id: variantSku || productId,
        productId,
        productSku: product.sku,
        variantSku,
        sku: variant?.sku || product.sku,
        name: product.name,
        title: product.name || product.title,
        slug: product.slug,
        price,
        oldPrice,
        quantity: quantityToAdd,
        image,
        thumbnail: image,
        variantLabel: variant?.label || '',
        variantCount: product.variants?.length ?? 0,
        variants: product.variants?.map((option) => ({ ...option })),
      });
    }

    this.saveCart(cart);
    this.showCartMessage('Đã thêm sản phẩm vào giỏ hàng.');
    return true;
  }

  changeQuantity(item: CartItem, delta: number): void {
    const cart = this.getCart();
    const target = cart.find((candidate) => this.matches(candidate, item));
    if (!target) return;

    const quantity = Number(target.quantity || 0) + delta;
    if (quantity < 1) {
      this.saveCart(cart.filter((candidate) => candidate !== target));
      return;
    }

    target.quantity = quantity;
    this.saveCart(cart);
  }

  changeVariant(item: CartItem, variant: CartVariant, quantity = item.quantity): boolean {
    const cart = this.getCart();
    const target = cart.find((candidate) => this.matches(candidate, item));
    const variantSku = variant.sku || '';
    const stock = Number(variant.stock || 0);

    if (!target || !variantSku) {
      this.showCartMessage('Không thể đổi phân loại sản phẩm.');
      return false;
    }

    if (stock < 1) {
      this.showCartMessage('Phân loại này đang hết hàng.');
      return false;
    }

    const quantityToSet = Math.min(Math.max(1, Math.floor(Number(quantity) || 1)), stock);
    if ((target.variantSku || '') === variantSku) {
      target.quantity = quantityToSet;
      this.saveCart(cart);
      return true;
    }

    const productId = target.productId || target.productSku || target.slug || target.id || '';
    const existing = cart.find((candidate) =>
      candidate !== target &&
      (candidate.productId || candidate.productSku || candidate.slug || candidate.id) === productId &&
      (candidate.variantSku || '') === variantSku
    );
    if (existing) {
      existing.quantity = Math.min(Number(existing.quantity || 0) + quantityToSet, stock);
      this.saveCart(cart.filter((candidate) => candidate !== target));
      this.showCartMessage('Đã đổi phân loại trong giỏ hàng.');
      return true;
    }

    target.productId = productId;
    target.variantSku = variantSku;
    target.sku = variantSku;
    target.id = variantSku;
    target.variantLabel = variant.label || '';
    target.price = Number(variant.price || 0);
    target.oldPrice = Number(variant.oldPrice || 0);
    target.quantity = quantityToSet;
    this.saveCart(cart);
    this.showCartMessage('Đã đổi phân loại trong giỏ hàng.');
    return true;
  }

  removeItem(item: CartItem): void {
    const cart = this.getCart();
    const updatedCart = cart.filter((candidate) => !this.matches(candidate, item));
    if (updatedCart.length !== cart.length) this.saveCart(updatedCart);
  }

  private get cartKey(): string {
    const raw = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    let user: CartUser | null = null;
    if (raw) {
      try {
        user = JSON.parse(raw) as CartUser;
      } catch (error) {
        console.error('Không đọc được thông tin người dùng đã lưu:', error);
      }
    }
    return user ? `cart_user_${user.email || user.id}` : 'cart_guest';
  }

  private matches(left: CartItem, right: CartItem): boolean {
    const leftProductId = left.productId || left.productSku || left.slug || left.id;
    const rightProductId = right.productId || right.productSku || right.slug || right.id;
    return Boolean(rightProductId) &&
      leftProductId === rightProductId &&
      (left.variantSku || '') === (right.variantSku || '');
  }

  private saveCart(cart: CartItem[]): void {
    localStorage.setItem(this.cartKey, JSON.stringify(cart));
    window.dispatchEvent(new Event('cart-updated'));
  }

  private showCartMessage(message: string): void {
    this.cartMessage.set(message);
    if (this.cartMessageTimeout !== undefined) {
      window.clearTimeout(this.cartMessageTimeout);
    }
    this.cartMessageTimeout = window.setTimeout(() => {
      this.cartMessage.set('');
      this.cartMessageTimeout = undefined;
    }, 3000);
  }
}
