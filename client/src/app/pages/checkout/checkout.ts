import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { GUEST_TRACKED_ORDER_KEY, getOrderSlug, OrderService, Order } from '../../services/order-service';
import { CartService } from '../../services/cart-service';
import { CheckoutProduct, ProductService, ValidatedVoucher } from '../../services/product-service';
import { forkJoin } from 'rxjs';

interface CheckoutItem {
  sku: string;
  name: string;
  image: string;
  variant?: string;
  price: number;
  productDiscount?: number;
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
  isSubmitting = false;
  submitError = '';
  fullName = '';
  email = '';
  phone = '';
  street = '';
  city = '';
  ward = '';
  note = '';

  hasAddress = false; // Whether user has any saved address or has filled address manually
  isEditingAddress = false;
  isLoadingAddress = false;
  addressLoadError = '';

  savedAddresses: any[] = [];
  selectedAddressId: string | null = null;
  showAddressModal = false;

  // QR Payment Modal
  showQRModal = false;
  copiedText = false;

  couponCode = '';
  couponApplied = false; // Only true after user clicks "Áp dụng" with valid code
  couponMessage = '';
  couponApplying = false;
  appliedVoucher: ValidatedVoucher | null = null;
  paymentMethod = 'cod';

  items: CheckoutItem[] = [];
  checkoutItemsError = '';
  checkoutItemsLoading = false;

  constructor(
    private readonly orderService: OrderService,
    private readonly cartService: CartService,
    private readonly productService: ProductService,
    private readonly http: HttpClient,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadUserAddressData();
    this.loadCheckoutItems();
  }

  loadUserAddressData(): void {
    this.addressLoadError = '';
    const raw = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    let user: any = null;

    if (raw) {
      try {
        user = JSON.parse(raw);
        this.fullName = user.fullName || user.name || '';
        this.email = user.email || '';
        this.phone = user.phone || '';
      } catch (e) {}
    }

    if (token) {
      this.isLoadingAddress = true;
      const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
      this.http.get<any>('http://localhost:3002/api/addresses', { headers }).subscribe({
        next: (res) => {
          this.isLoadingAddress = false;
          if (res.success && Array.isArray(res.addresses) && res.addresses.length > 0) {
            this.savedAddresses = res.addresses;
            const def = res.addresses.find((a: any) => a.isDefault) || res.addresses[0];
            if (def) {
              this.applyAddress(def);
            }
          } else {
            // Thực sự chưa có địa chỉ nào trong database
            this.savedAddresses = [];
            this.hasAddress = false;
            this.isEditingAddress = true;
          }
        },
        error: (error) => {
          this.isLoadingAddress = false;
          this.addressLoadError = error?.error?.message || 'Không thể tải địa chỉ từ tài khoản.';
          if (!this.hasAddress) {
            this.savedAddresses = [];
            this.hasAddress = false;
            this.isEditingAddress = true;
          }
        }
      });
    }
    if (!token) this.isEditingAddress = true;
  }

  applyAddress(addr: any): void {
    if (!addr) return;
    this.selectedAddressId = addr._id || null;
    if (addr.fullName) this.fullName = addr.fullName;
    if (addr.phone) this.phone = addr.phone;
    if (addr.address) this.street = addr.address;
    if (addr.province) this.city = addr.province;
    if (addr.ward) this.ward = addr.ward;
    this.hasAddress = true;
    this.isEditingAddress = false;
  }

  openAddressModal(): void {
    this.showAddressModal = true;
  }

  closeAddressModal(): void {
    this.showAddressModal = false;
  }

  selectAddress(addr: any): void {
    this.applyAddress(addr);
    this.closeAddressModal();
  }

  openQRModal(): void {
    this.showQRModal = this.paymentMethod === 'paypal' || this.paymentMethod === 'vnpay';
  }

  onPaymentMethodChange(): void {
    this.showQRModal = this.paymentMethod === 'paypal' || this.paymentMethod === 'vnpay';
  }

  closeQRModal(): void {
    this.showQRModal = false;
  }

  copyAccountNumber(): void {
    navigator.clipboard.writeText('PSP2605813700000226');
    this.copiedText = true;
    setTimeout(() => {
      this.copiedText = false;
    }, 2500);
  }

  loadCheckoutItems(): void {
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

    if (itemsToLoad.length === 0) {
      this.router.navigate(['/cart']);
      return;
    }

    this.items = itemsToLoad.map(item => this.toProvisionalCheckoutItem(item));
    this.checkoutItemsLoading = true;
    const requestedItems = itemsToLoad.map((item: any) => ({
      sku: String(item.sku || item.variantSku || item.productSku || item.productId || ''),
      variant: String(item.variantLabel || item.variant || ''),
      quantity: Math.max(1, Number(item.quantity) || 1)
    }));
    if (requestedItems.some(item => !item.sku)) {
      this.checkoutItemsError = 'Sản phẩm trong giỏ hàng thiếu mã SKU hợp lệ.';
      this.checkoutItemsLoading = false;
      return;
    }

    forkJoin(requestedItems.map(item => this.productService.getProductBySku(item.sku, item.variant))).subscribe({
      next: products => {
        this.checkoutItemsLoading = false;
        const outOfStockIndex = products.findIndex((product, index) =>
          !Number.isFinite(product.stock) || product.stock < requestedItems[index].quantity
        );
        if (outOfStockIndex >= 0) {
          this.checkoutItemsError = `Sản phẩm "${products[outOfStockIndex].name}" không đủ tồn kho. Vui lòng cập nhật giỏ hàng.`;
          return;
        }
        this.items = products.map((product, index) => this.toCheckoutItem(product, requestedItems[index].quantity));
      },
      error: error => {
        this.checkoutItemsLoading = false;
        this.checkoutItemsError = error?.error?.message || 'Không thể tải sản phẩm từ MongoDB. Vui lòng thử lại.';
      }
    });
  }

  private toProvisionalCheckoutItem(item: any): CheckoutItem {
    const price = Math.max(0, Number(item.price) || 0);
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const image = item.image || item.thumbnail || '/assets/images/no-image.svg';
    return {
      sku: String(item.sku || item.variantSku || item.productSku || item.productId || ''),
      name: String(item.name || item.title || 'Sản phẩm'),
      image: image.startsWith('/products/')
        ? `http://localhost:3002${image}`
        : image,
      variant: String(item.variantLabel || item.variant || ''),
      price,
      productDiscount: Math.max(0, Number(item.productDiscount) || 0),
      quantity,
      total: price * quantity
    };
  }

  private toCheckoutItem(product: CheckoutProduct, quantity: number): CheckoutItem {
    return {
      sku: product.sku,
      name: product.name,
      image: product.imageUrl
        ? `http://localhost:3002${product.imageUrl}`
        : '/assets/images/no-image.svg',
      variant: product.variant,
      price: product.price,
      productDiscount: product.productDiscount,
      quantity,
      total: product.price * quantity
    };
  }

  toggleEditAddress(): void {
    this.isEditingAddress = !this.isEditingAddress;
  }

  applyCoupon(): void {
    const code = this.couponCode.trim().toUpperCase();
    if (!code) {
      this.couponMessage = 'Vui lòng nhập mã voucher.';
      this.couponApplied = false;
      this.appliedVoucher = null;
      return;
    }
    this.couponApplied = false;
    this.appliedVoucher = null;
    this.couponApplying = true;
    this.productService.validateVoucher(code, this.subtotal, this.items.map(item => ({ sku: item.sku, quantity: item.quantity, variant: item.variant }))).subscribe({
      next: response => {
        this.couponApplying = false;
        this.appliedVoucher = response.voucher;
        this.couponCode = response.voucher.code;
        this.couponApplied = true;
        this.couponMessage = `✓ Áp dụng mã "${response.voucher.code}" thành công!`;
      },
      error: error => {
        this.couponApplying = false;
        this.appliedVoucher = null;
        this.couponApplied = false;
        this.couponMessage = error?.error?.message || 'Không thể xác thực voucher. Vui lòng thử lại.';
      }
    });
  }

  removeCoupon(): void {
    this.couponCode = '';
    this.couponApplied = false;
    this.appliedVoucher = null;
    this.couponMessage = '';
  }

  get subtotal(): number {
    return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  get discount(): number {
    if (this.subtotal <= 0) return 0;
    return this.couponApplied ? Math.min(this.subtotal, this.appliedVoucher?.discount || 0) : 0;
  }

  get total(): number {
    const computed = this.subtotal - this.discount;
    return computed > 0 ? computed : 0;
  }

  formatPrice(num: number): string {
    return (num || 0).toLocaleString('vi-VN') + 'đ';
  }

  getPaymentMethodLabel(): string {
    switch (this.paymentMethod) {
      case 'paypal':
        return 'Paypal';
      case 'cod':
        return 'Thanh toán khi nhận hàng (COD)';
      case 'vnpay':
        return 'VnPay';
      default:
        return 'Thanh toán khi nhận hàng (COD)';
    }
  }

  placeOrder(): void {
    if (this.isSubmitting) return;
    if (this.checkoutItemsLoading) {
      this.submitError = 'Vui lòng đợi xác nhận giá và tồn kho sản phẩm.';
      return;
    }
    if (this.checkoutItemsError) {
      this.submitError = this.checkoutItemsError;
      return;
    }

    if (
      !this.fullName.trim() ||
      !/^(0|\+84)(3|5|7|8|9)\d{8}$/.test(this.phone.trim()) ||
      !this.street.trim() ||
      !this.city.trim() ||
      !this.ward.trim()
    ) {
      this.submitError = 'Vui lòng nhập họ tên, số điện thoại hợp lệ, số nhà/tên đường, tỉnh/thành phố và phường/xã.';
      this.isEditingAddress = true;
      return;
    }
    if (this.items.length === 0) {
      this.submitError = 'Giỏ hàng đang trống. Vui lòng chọn sản phẩm trước khi đặt hàng.';
      return;
    }

    const fullAddr = [this.street.trim(), this.ward.trim(), this.city.trim()].join(', ');
    const orderData: Partial<Order> = {
      paymentMethod: this.getPaymentMethodLabel(),
      sender: {
        name: 'Floralia Herbal Tea',
        address: '11A Bế Văn Đàn, Dĩ An, Bình Dương',
        email: 'floralia@gmail.com',
        phone: '0901 234 567'
      },
      receiver: {
        name: this.fullName.trim(),
        address: fullAddr,
        email: this.email.trim(),
        phone: this.phone.trim()
      },
      items: this.items.map(item => ({
        sku: item.sku,
        name: item.name,
        image: item.image,
        variant: item.variant || '',
        price: item.price,
        quantity: item.quantity,
        total: item.total || item.price * item.quantity
      })),
      discount: this.discount,
      shippingFee: 0,
      ...(this.couponApplied && this.appliedVoucher ? { voucherCode: this.appliedVoucher.code } : {})
    };

    this.isSubmitting = true;
    this.submitError = '';
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const submit = () => this.submitOrder(orderData);

    if (token && (!this.hasAddress || this.isEditingAddress)) {
      const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
      const addressData = {
        fullName: this.fullName.trim(),
        phone: this.phone.trim(),
        address: this.street.trim(),
        province: this.city.trim(),
        ward: this.ward.trim(),
        isDefault: true
      };
      const request = this.selectedAddressId
        ? this.http.put<any>(`http://localhost:3002/api/addresses/${this.selectedAddressId}`, addressData, { headers })
        : this.http.post<any>('http://localhost:3002/api/addresses', addressData, { headers });

      request.subscribe({
        next: response => {
          if (!response.success || !response.address) {
            this.isSubmitting = false;
            this.submitError = response.message || 'Không thể lưu địa chỉ nhận hàng.';
            return;
          }
          this.applyAddress(response.address);
          submit();
        },
        error: error => {
          this.isSubmitting = false;
          this.submitError = error?.error?.message || 'Không thể lưu địa chỉ vào tài khoản. Vui lòng thử lại.';
        }
      });
      return;
    }

    submit();
  }

  private submitOrder(orderData: Partial<Order>): void {
    this.orderService.createOrder(orderData).subscribe({
      next: response => {
        if (!response.order?.id) {
          this.isSubmitting = false;
          this.submitError = 'Máy chủ chưa trả về mã đơn hàng đã lưu. Vui lòng kiểm tra đơn hàng trước khi thử lại.';
          return;
        }
        if (response.persisted) this.productService.invalidateCache();
        sessionStorage.removeItem('checkout_items');
        sessionStorage.removeItem('checkout_shipping_fee');
        this.cartService.clearCart();
        const targetId = response.order.id;
        localStorage.setItem(GUEST_TRACKED_ORDER_KEY, targetId);
        window.dispatchEvent(new Event('guest-order-tracked'));
        this.router.navigate(['/order-success', getOrderSlug(response.order)]);
      },
      error: error => {
        this.isSubmitting = false;
        this.submitError = error?.error?.message || 'Không thể tạo đơn hàng. Vui lòng thử lại sau.';
      }
    });
  }

  continueShopping(): void {
    this.router.navigate(['/products']);
  }
}
