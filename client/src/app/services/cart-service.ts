import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';

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
  discount?: number;
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
  discount?: number;
  quantity: number;
  stock?: number;
  image?: string;
  thumbnail?: string;
  variantLabel?: string;
  variantCount?: number;
  selected?: boolean;
  productSku?: string;
  variants?: CartVariant[];
  [key: string]: unknown;
}

interface CartUser {
  email?: string;
  id?: string;
  _id?: string;
  fullName?: string;
  name?: string;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly http = inject(HttpClient, { optional: true });
  private readonly apiUrl = 'http://localhost:3002/products/cart';
  private readonly syncedKeys = new Set<string>();
  readonly cartMessage = signal('');
  private cartMessageTimeout: number | undefined;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('auth-changed', () => this.syncFromServer());
      window.addEventListener('focus', () => this.syncFromServer());
      this.syncFromServer();
    }
  }

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
      existing.stock = stock;
    } else {
      const price = Number(variant?.price ?? product.price ?? product.minPrice ?? 0);
      const discount = Math.max(0, Math.min(99, Number(product.discount) || 0));
      const variantOldPrice = Number(variant?.oldPrice) || 0;
      const productOldPrice = Number(product.oldPrice) || 0;
      const suppliedOldPrice = variantOldPrice > price ? variantOldPrice : productOldPrice;
      const oldPrice = suppliedOldPrice > price
        ? suppliedOldPrice
        : discount > 0 ? Math.round(price / (1 - discount / 100)) : price;
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
        discount,
        quantity: quantityToAdd,
        stock,
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

    target.quantity = Math.max(1, Number(target.quantity || 1) + delta);
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
      target.stock = stock;
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
    const suppliedOldPrice = Number(variant.oldPrice || 0);
    const discount = Math.max(0, Math.min(99, Number(target.discount) || 0));
    target.oldPrice = suppliedOldPrice > target.price
      ? suppliedOldPrice
      : discount > 0 ? Math.round(target.price / (1 - discount / 100)) : target.price;
    target.quantity = quantityToSet;
    target.stock = stock;
    this.saveCart(cart);
    this.showCartMessage('Đã đổi phân loại trong giỏ hàng.');
    return true;
  }

  removeItem(item: CartItem): void {
    const cart = this.getCart();
    const updatedCart = cart.filter((candidate) => !this.matches(candidate, item));
    if (updatedCart.length !== cart.length) this.saveCart(updatedCart);
  }

  private getCurrentUser(): CartUser | null {
    const raw = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CartUser;
    } catch (error) {
      console.error('Không đọc được thông tin người dùng đã lưu:', error);
      return null;
    }
  }

  private isLoggedInUser(): boolean {
    const user = this.getCurrentUser();
    return Boolean(user && (user.email || user.id || user._id));
  }

  private get cartKey(): string {
    const user = this.getCurrentUser();
    const identifier = user?.email || user?.id || user?._id;
    return identifier ? `cart_user_${identifier}` : 'cart_guest';
  }

  syncFromServer(): void {
    const user = this.getCurrentUser();
    if (!this.http || !user || (!user.email && !user.id && !user._id)) return;
    const targetKey = this.cartKey;
    const params = new HttpParams()
      .set('userId', String(user.id || user._id || ''))
      .set('email', String(user.email || ''));

    this.http
      .get<{ success: boolean; exists?: boolean; items?: CartItem[] }>(this.apiUrl, { params })
      .subscribe({
        next: (res) => {
          if (!res?.success || !Array.isArray(res.items)) return;
          const isFirstSync = !this.syncedKeys.has(targetKey);
          this.syncedKeys.add(targetKey);

          if (res.exists === false || (isFirstSync && res.items.length === 0)) {
            const localItems = this.getCart();
            if (localItems.length > 0) {
              this.pushToServer(localItems);
              return;
            }
          }
          localStorage.setItem(targetKey, JSON.stringify(res.items));
          window.dispatchEvent(new Event('cart-updated'));
        },
        error: (err) => {
          console.error('Không thể đồng bộ giỏ hàng từ MongoDB:', err);
        },
      });
  }

  private pushToServer(cart: CartItem[]): void {
    const user = this.getCurrentUser();
    if (!this.http || !user || (!user.email && !user.id && !user._id)) return;
    this.http
      .put<{ success: boolean }>(this.apiUrl, {
        userId: String(user.id || user._id || ''),
        email: String(user.email || ''),
        fullName: String(user.fullName || user.name || ''),
        items: cart,
      })
      .subscribe({
        error: (err) => {
          console.error('Không thể lưu giỏ hàng lên MongoDB:', err);
        },
      });
  }

  private matches(left: CartItem, right: CartItem): boolean {
    const leftProductId = left.productId || left.productSku || left.slug || left.id;
    const rightProductId = right.productId || right.productSku || right.slug || right.id;
    return Boolean(rightProductId) &&
      leftProductId === rightProductId &&
      (left.variantSku || '') === (right.variantSku || '');
  }

  clearCart(): void {
    this.saveCart([]);
  }

  saveCart(cart: CartItem[]): void {
    localStorage.setItem(this.cartKey, JSON.stringify(cart));
    window.dispatchEvent(new Event('cart-updated'));
    if (this.isLoggedInUser()) {
      this.pushToServer(cart);
    }
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
