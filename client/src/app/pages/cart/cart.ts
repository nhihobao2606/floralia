import { Component, OnInit } from '@angular/core';
import { HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { CartItem, CartService, CartVariant } from '../../services/cart-service';
import { ProductNavigationService } from '../../services/product-navigation-service';

export interface CartDisplayItem extends CartItem {
  selected: boolean;
}

@Component({
  selector: 'app-cart',
  standalone: false,
  templateUrl: './cart.html',
  styleUrl: './cart.css'
})
export class CartComponent implements OnInit {
  items: CartDisplayItem[] = [];
  pageSize = 4;
  currentPage = 1;
  readonly defaultShippingFee = 30000;
  openVariantItem: CartDisplayItem | null = null;

  constructor(
    readonly cartService: CartService,
    readonly productNavigation: ProductNavigationService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadCart();
  }

  loadCart(): void {
    this.items = this.cartService.getCart().map(item => ({
      ...item,
      selected: false,
    }));
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
  }

  get allSelected(): boolean {
    return this.items.length > 0 && this.items.every(item => item.selected);
  }

  toggleSelect(item: CartDisplayItem): void {
    item.selected = !item.selected;
    this.persistSelection();
  }

  toggleSelectAll(): void {
    const selected = !this.allSelected;
    this.items.forEach(item => item.selected = selected);
    this.persistSelection();
  }

  private persistSelection(): void {
    this.cartService.saveCart(this.items);
  }

  changeQty(item: CartDisplayItem, delta: number): void {
    const nextQuantity = item.quantity + delta;
    const stock = this.stock(item);
    if (nextQuantity < 1 || (delta > 0 && stock > 0 && nextQuantity > stock)) return;
    this.cartService.changeQuantity(item, delta);
    item.quantity = nextQuantity;
  }

  stock(item: CartDisplayItem): number {
    return Number(item.variants?.find(variant => variant.sku === item.variantSku)?.stock ?? 0);
  }

  isVariantDropdownOpen(item: CartDisplayItem): boolean {
    return this.openVariantItem === item;
  }

  toggleVariantDropdown(item: CartDisplayItem, event: MouseEvent): void {
    event.stopPropagation();
    this.openVariantItem = this.openVariantItem === item ? null : item;
  }

  selectVariant(item: CartDisplayItem, variantSku: string, event: MouseEvent): void {
    event.stopPropagation();
    const variant = item.variants?.find(option => option.sku === variantSku);
    if (!variant) return;
    this.openVariantItem = null;
    if (this.cartService.changeVariant(item, variant, item.quantity)) this.loadCart();
  }

  selectedVariantLabel(item: CartDisplayItem): string {
    return item.variants?.find(variant => variant.sku === item.variantSku)?.label || item.variantLabel || 'Chọn phân loại';
  }

  @HostListener('document:click')
  closeVariantDropdown(): void {
    this.openVariantItem = null;
  }

  @HostListener('document:keydown.escape')
  closeVariantDropdownOnEscape(): void {
    this.openVariantItem = null;
  }

  removeItem(item: CartDisplayItem): void {
    this.cartService.removeItem(item);
    this.loadCart();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.items.length / this.pageSize));
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index + 1);
  }

  get pagedItems(): CartDisplayItem[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.items.slice(start, start + this.pageSize);
  }

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) this.currentPage = page;
  }

  unitSalePrice(item: CartDisplayItem): number {
    return Number(item.price) || 0;
  }

  unitOriginalPrice(item: CartDisplayItem): number {
    const oldPrice = Number(item.oldPrice) || 0;
    return oldPrice > this.unitSalePrice(item) ? oldPrice : this.unitSalePrice(item);
  }

  lineDiscount(item: CartDisplayItem): number {
    return Math.max(0, this.unitOriginalPrice(item) - this.unitSalePrice(item)) * item.quantity;
  }

  lineOriginalTotal(item: CartDisplayItem): number {
    return this.unitOriginalPrice(item) * item.quantity;
  }

  get selectedItems(): CartDisplayItem[] {
    return this.items.filter(item => item.selected);
  }

  get selectedSubtotal(): number {
    return this.selectedItems.reduce((sum, item) => sum + this.lineOriginalTotal(item), 0);
  }

  get productDiscount(): number {
    return this.selectedItems.reduce((sum, item) => sum + this.lineDiscount(item), 0);
  }

  get shippingFee(): number {
    return this.selectedItems.length ? this.defaultShippingFee : 0;
  }

  get total(): number {
    return Math.max(0, this.selectedSubtotal - this.productDiscount + this.shippingFee);
  }

  formatPrice(num: number): string {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(num || 0) + ' ₫';
  }

  proceedToCheckout(): void {
    if (!this.selectedItems.length) return;
    const checkoutItems = this.selectedItems.map(item => ({
      ...item,
      price: this.unitOriginalPrice(item),
      oldPrice: this.unitOriginalPrice(item),
      productDiscount: this.lineDiscount(item),
      total: this.lineOriginalTotal(item),
    }));
    sessionStorage.setItem('checkout_items', JSON.stringify(checkoutItems));
    sessionStorage.setItem('checkout_shipping_fee', String(this.defaultShippingFee));
    void this.router.navigate(['/checkout']);
  }

  continueShopping(): void {
    void this.router.navigate(['/products']);
  }
}
