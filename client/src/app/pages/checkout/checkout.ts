import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { OrderService, Order } from '../../services/order-service';
import { CartService } from '../../services/cart-service';
import { ProductService } from '../../services/product-service';

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
  shippingFee = 0;
  paymentMethod = 'paypal';

  items: CheckoutItem[] = [];

  constructor(
    private readonly orderService: OrderService,
    private readonly cartService: CartService,
    private readonly productService: ProductService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    let itemsToLoad: any[] = [];

    // 1. Kiểm tra sản phẩm được chọn từ giỏ hàng hoặc nút "Mua ngay"
    const rawSaved = sessionStorage.getItem('checkout_items');
    if (rawSaved) {
      try {
        const parsed = JSON.parse(rawSaved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          itemsToLoad = parsed;
        }
      } catch (e) {}
    }

    // 2. Nếu không có, đọc từ giỏ hàng của CartService
    if (itemsToLoad.length === 0) {
      const cartItems = this.cartService.getCart();
      if (cartItems && cartItems.length > 0) {
        itemsToLoad = cartItems;
      }
    }

    if (itemsToLoad.length > 0) {
      this.items = itemsToLoad.map((p: any) => ({
        sku: p.sku || p.productId || 'TTM001',
        name: p.name || p.title || 'Trà thảo mộc Floralia',
        image: p.image || p.thumbnail || '/assets/images/products/74.png',
        variant: p.variantLabel || p.variant || '',
        price: Number(p.price || 0),
        quantity: Number(p.quantity || 1),
        total: Number(p.price || 0) * Number(p.quantity || 1)
      }));
    } else {
      // 3. Nếu vẫn trống, tải trực tiếp sản phẩm từ MongoDB Atlas backend
      this.productService.getProducts().subscribe({
        next: (prods) => {
          if (prods && prods.length > 0) {
            this.items = prods.slice(0, 3).map(p => {
              const variant = p.variants?.find(v => (v.stock ?? 0) > 0) || p.variants?.[0];
              const price = Number(variant?.price || p.price || 200000);
              const img = p.imageUrl
                ? (p.imageUrl.startsWith('http') ? p.imageUrl : `http://localhost:3002${p.imageUrl.startsWith('/') ? '' : '/'}${p.imageUrl}`)
                : (p.thumbnail && /\.(jpg|png|webp|svg)$/i.test(p.thumbnail) ? p.thumbnail : '/assets/images/products/74.png');
              return {
                sku: variant?.sku || p.sku || 'TTM001',
                name: p.name,
                image: img,
                variant: variant?.label || '',
                price: price,
                quantity: 1,
                total: price
              };
            });
          }
        }
      });
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

  get discount(): number {
    if (this.subtotal <= 0) return 0;
    if (this.couponCode.trim()) {
      return Math.min(this.subtotal, 155000);
    }
    if (this.subtotal >= 500000) {
      return 155000;
    }
    return Math.min(this.subtotal, Math.floor(this.subtotal * 0.1));
  }

  get total(): number {
    const computed = this.subtotal - this.discount + this.shippingFee;
    return computed > 0 ? computed : 0;
  }

  formatPrice(num: number): string {
    return (num || 0).toLocaleString('vi-VN') + 'đ';
  }

  placeOrder(): void {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const orderId = String(randomNum);
    const orderCode = '#' + orderId;

    const orderData: Order = {
      id: orderId,
      code: orderCode,
      date: new Date().toLocaleDateString('vi-VN'),
      time: new Date().toLocaleTimeString('vi-VN'),
      status: 'processing',
      statusLabel: 'ĐANG XỬ LÝ',
      step: 2,
      paymentMethod: this.paymentMethod === 'paypal' ? 'Paypal' : (this.paymentMethod === 'cod' ? 'Thanh toán khi nhận hàng' : 'VnPay'),
      sender: {
        name: 'Floralia Herbal Tea',
        address: '11A Bế Văn Đàn, Dĩ An, Bình Dương',
        email: 'floralia@gmail.com',
        phone: '0901 234 567'
      },
      receiver: {
        name: this.fullName || 'Minh Trần',
        address: `${this.street || '12C, Võ Thị Sáu'}, ${this.ward || 'Phường An Nhơn'}, ${this.city || 'Tỉnh Hà Tĩnh'}`,
        email: this.email || 'MinhTran.thuu@gmail.com',
        phone: this.phone || '(671) 555-0110'
      },
      items: this.items.map(it => ({
        sku: it.sku,
        name: it.name,
        image: it.image,
        variant: it.variant || '',
        price: it.price,
        quantity: it.quantity,
        total: it.total || (it.price * it.quantity)
      })),
      subtotal: this.subtotal,
      discount: this.discount,
      shippingFee: this.shippingFee,
      total: this.total
    };

    // 1. Lưu ngay vào OrderService và LocalStorage để hiển thị tức thì không độ trễ
    this.orderService.saveOrderLocal(orderData);
    sessionStorage.removeItem('checkout_items');
    this.cartService.clearCart();

    // 2. Gửi request tạo đơn hàng lên MongoDB Atlas backend (FloraliaTea.Orders)
    this.orderService.createOrder(orderData).subscribe({
      next: (res) => {
        const targetId = res?.order?.id || orderId;
        this.router.navigate(['/order-success', targetId]);
      },
      error: () => {
        this.router.navigate(['/order-success', orderId]);
      }
    });
  }

  continueShopping(): void {
    this.router.navigate(['/products']);
  }
}
