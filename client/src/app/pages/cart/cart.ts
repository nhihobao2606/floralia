import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CartItem, CartService } from '../../services/cart-service';

export interface CartDisplayItem extends CartItem {
  selected?: boolean;
}

@Component({
  selector: 'app-cart',
  standalone: false,
  templateUrl: './cart.html',
  styleUrl: './cart.css'
})
export class CartComponent implements OnInit {
  items: CartDisplayItem[] = [];
  currentPage = 1;
  totalPages = 3;

  private readonly sampleItems: CartDisplayItem[] = [
    {
      id: 'TTM004',
      productId: 'TTM004',
      sku: 'TTM004',
      name: 'Lục Mễ Trà - Trà Xanh Gạo Lứt Rang',
      price: 200000,
      quantity: 1,
      image: '/assets/images/products/74.png',
      selected: true
    },
    {
      id: 'HQ020',
      productId: 'HQ020',
      sku: 'HQ020',
      name: 'Set Quà Tặng Trà Hoa Hồng',
      price: 630000,
      quantity: 1,
      image: '/assets/images/products/131.png',
      selected: false
    },
    {
      id: 'TTM010',
      productId: 'TTM010',
      sku: 'TTM010',
      name: 'Lam Diệp Trà - Trà Hắc Kỷ Tử',
      price: 250000,
      quantity: 1,
      image: '/assets/images/products/34.png',
      selected: true
    },
    {
      id: 'TTM021',
      productId: 'TTM021',
      sku: 'TTM021',
      name: 'Huyết Ngọc Trà - Trà Bổ Huyết Dưỡng Nhan',
      price: 250000,
      quantity: 1,
      image: '/assets/images/products/79.png',
      selected: true
    }
  ];

  constructor(
    private readonly cartService: CartService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadCart();
  }

  loadCart(): void {
    const rawCart = this.cartService.getCart();
    if (rawCart && rawCart.length > 0) {
      this.items = rawCart.map(item => ({
        ...item,
        selected: item['selected'] !== false
      }));
    } else {
      // Dùng dữ liệu mẫu như trong hình thiết kế nếu giỏ hàng hiện tại trống
      this.items = [...this.sampleItems];
    }
  }

  toggleSelect(item: CartDisplayItem): void {
    item.selected = !item.selected;
  }

  changeQty(item: CartDisplayItem, delta: number): void {
    const newQty = (item.quantity || 1) + delta;
    if (newQty < 1) {
      this.removeItem(item);
      return;
    }
    item.quantity = newQty;
    this.cartService.changeQuantity(item, delta);
  }

  removeItem(item: CartDisplayItem): void {
    this.items = this.items.filter(i => i !== item);
    this.cartService.changeQuantity(item, -item.quantity);
  }

  get selectedSubtotal(): number {
    return this.items
      .filter(item => item.selected)
      .reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  get shippingFee(): number {
    return 0; // Free
  }

  get total(): number {
    return this.selectedSubtotal + this.shippingFee;
  }

  formatPrice(num: number): string {
    return (num || 0).toLocaleString('vi-VN') + 'đ';
  }

  proceedToCheckout(): void {
    const selected = this.items.filter(item => item.selected);
    if (selected.length === 0) {
      alert('Vui lòng chọn ít nhất một sản phẩm để tiến hành thanh toán.');
      return;
    }
    // Lưu các sản phẩm đã chọn vào sessionStorage để trang thanh toán đọc
    sessionStorage.setItem('checkout_items', JSON.stringify(selected));
    this.router.navigate(['/checkout']);
  }

  continueShopping(): void {
    this.router.navigate(['/products']);
  }

  setPage(page: number): void {
    this.currentPage = page;
  }
}
