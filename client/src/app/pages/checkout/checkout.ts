import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { OrderService, Order } from '../../services/order-service';
import { CartService } from '../../services/cart-service';

interface CheckoutItem {
  sku: string;
  name: string;
  image: string;
  variant?: string;
  price: number;
  quantity: number;
  total: number;
}

@Component({
  selector: 'app-checkout',
  standalone: false,
  templateUrl: './checkout.html',
  styleUrl: './checkout.css'
})
export class CheckoutComponent implements OnInit {
  fullName = 'Minh Trần';
  email = 'MinhTran.thuu@gmail.com';
  phone = '(671) 555-0110';
  street = '12C, Võ Thị Sáu';
  city = 'Tỉnh Hà Tĩnh';
  ward = 'Phường An Nhơn';
  note = 'Giao giờ hành chính';

  isEditingAddress = false;

  couponCode = '';
  discount = 155000;
  shippingFee = 0;
  paymentMethod = 'paypal';

  items: CheckoutItem[] = [
    {
      sku: 'TTM004',
      name: 'Lục Mễ Trà – Trà Xanh Gạo Lứt Rang',
      image: '/assets/images/products/74.png',
      price: 200000,
      quantity: 1,
      total: 200000
    },
    {
      sku: 'TTM010',
      name: 'Lam Diệp Trà – Trà Hắc Kỷ Tử',
      image: '/assets/images/products/34.png',
      price: 250000,
      quantity: 1,
      total: 250000
    },
    {
      sku: 'TTM021',
      name: 'Huyết Ngọc Trà – Trà Bổ Huyết Dưỡng Nhan',
      image: '/assets/images/products/79.png',
      price: 250000,
      quantity: 1,
      total: 250000
    }
  ];

  constructor(
    private readonly orderService: OrderService,
    private readonly cartService: CartService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    const rawSaved = sessionStorage.getItem('checkout_items');
    if (rawSaved) {
      try {
        const parsed = JSON.parse(rawSaved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.items = parsed.map((p: any) => ({
            sku: p.sku || p.productId || 'TTM001',
            name: p.name || p.title || 'Trà thảo mộc Floralia',
            image: p.image || p.thumbnail || '/assets/images/products/74.png',
            variant: p.variantLabel || '',
            price: Number(p.price || 0),
            quantity: Number(p.quantity || 1),
            total: Number(p.price || 0) * Number(p.quantity || 1)
          }));
        }
      } catch (e) {
        // Giữ danh sách mẫu
      }
    }
  }

  toggleEditAddress(): void {
    this.isEditingAddress = !this.isEditingAddress;
  }

  applyCoupon(): void {
    if (this.couponCode.trim()) {
      alert(`Đã áp dụng mã giảm giá "${this.couponCode.trim()}" thành công!`);
    } else {
      alert('Vui lòng nhập mã giảm giá.');
    }
  }

  get subtotal(): number {
    return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  get total(): number {
    const computed = this.subtotal - this.discount + this.shippingFee;
    return computed > 0 ? computed : 0;
  }

  formatPrice(num: number): string {
    return (num || 0).toLocaleString('vi-VN') + 'đ';
  }

  placeOrder(): void {
    const orderData: Partial<Order> = {
      id: '4152',
      code: '#4152',
      date: new Date().toLocaleDateString('vi-VN'),
      time: new Date().toLocaleTimeString('vi-VN'),
      status: 'processing',
      statusLabel: 'ĐANG XỬ LÝ',
      step: 2,
      paymentMethod: this.paymentMethod === 'paypal' ? 'Paypal' : (this.paymentMethod === 'cod' ? 'Thanh toán khi nhận hàng' : 'VnPay'),
      sender: {
        name: 'Hà Anh',
        address: '11A Bế Văn Đàn, Dĩ An, Bình Dương',
        email: 'Haanh.BD@gmail.com',
        phone: '(671) 555-0110'
      },
      receiver: {
        name: this.fullName || 'Minh Trần',
        address: `${this.street || '12C, Võ Thị Sáu'}, ${this.ward || 'Phường An Nhơn'}, ${this.city || 'Tỉnh Hà Tĩnh'}`,
        email: this.email || 'MinhTran.thuu@gmail.com',
        phone: this.phone || '(671) 555-0110'
      },
      items: this.items,
      subtotal: this.subtotal,
      discount: this.discount,
      shippingFee: this.shippingFee,
      total: this.total
    };

    // Save synchronously first so order is immediately present
    this.orderService.saveOrderLocal(orderData);
    sessionStorage.removeItem('checkout_items');
    this.cartService.clearCart();

    // Navigate immediately to Order Success page
    this.router.navigate(['/order-success', '4152']);

    // Persist to backend asynchronously
    this.orderService.createOrder(orderData).subscribe();
  }

  continueShopping(): void {
    this.router.navigate(['/products']);
  }
}
