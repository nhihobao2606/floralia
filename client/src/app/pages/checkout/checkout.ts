import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
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
  oldPrice: number;
  price: number;
  salePrice: number;
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
  showAddAddressModal = false;
  editingAddressId: string | null = null;
  addAddressFullName = '';
  addAddressPhone = '';
  addAddressStreet = '';
  addAddressProvince: any = null;
  addAddressWard: any = null;
  addAddressProvinces: any[] = [];
  addAddressWards: any[] = [];
  addAddressIsDefault = false;
  addAddressProvinceDropdownOpen = false;
  addAddressWardDropdownOpen = false;
  addAddressLoadingProvinces = false;
  addAddressLoadingWards = false;
  addAddressSaving = false;
  addAddressError = '';

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
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly ngZone: NgZone
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
          this.ngZone.run(() => {
            this.isLoadingAddress = false;
            if (res.success && Array.isArray(res.addresses) && res.addresses.length > 0) {
              this.savedAddresses = res.addresses;
              const def = res.addresses.find((a: any) => a.isDefault) || res.addresses[0];
              if (def) this.applyAddress(def);
            } else {
              this.savedAddresses = [];
              this.hasAddress = false;
              this.isEditingAddress = true;
            }
            this.cdr.markForCheck();
          });
        },
        error: (error) => {
          this.ngZone.run(() => {
            this.isLoadingAddress = false;
            this.addressLoadError = error?.error?.message || 'Không thể tải địa chỉ từ tài khoản.';
            if (!this.hasAddress) {
              this.savedAddresses = [];
              this.hasAddress = false;
              this.isEditingAddress = true;
            }
            this.cdr.markForCheck();
          });
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

  openAddAddressModal(): void {
    this.showAddressModal = false;
    this.showAddAddressModal = true;
    this.editingAddressId = null;
    this.addAddressFullName = '';
    this.addAddressPhone = '';
    this.addAddressStreet = '';
    this.addAddressProvince = null;
    this.addAddressWard = null;
    this.addAddressWards = [];
    this.addAddressIsDefault = false;
    this.addAddressError = '';
    this.addAddressProvinceDropdownOpen = false;
    this.addAddressWardDropdownOpen = false;
    if (!this.addAddressProvinces.length) this.loadAddressProvinces();
  }

  openEditAddressModal(address: any, event: MouseEvent): void {
    event.stopPropagation();
    this.showAddressModal = false;
    this.showAddAddressModal = true;
    this.editingAddressId = String(address._id);
    this.addAddressFullName = address.fullName || '';
    this.addAddressPhone = address.phone || '';
    this.addAddressStreet = address.address || '';
    this.addAddressProvince = address.province
      ? { code: address.provinceCode ?? null, name: address.province }
      : null;
    this.addAddressWard = address.ward
      ? { code: address.wardCode ?? null, name: address.ward }
      : null;
    this.addAddressWards = [];
    this.addAddressIsDefault = !!address.isDefault;
    this.addAddressError = '';
    this.addAddressProvinceDropdownOpen = false;
    this.addAddressWardDropdownOpen = false;

    if (this.addAddressProvinces.length) {
      this.restoreAddressLocation(address);
    } else {
      this.loadAddressProvinces(address);
    }
  }

  private restoreAddressLocation(address: any): void {
    const savedProvinceName = String(address.province || '');
    const savedProvinceCode = address.provinceCode;
    this.addAddressProvince = this.addAddressProvinces.find(province =>
      (savedProvinceCode != null && String(province.code) === String(savedProvinceCode)) ||
      this.normalizeAdministrativeName(province.name) === this.normalizeAdministrativeName(savedProvinceName)
    ) || (savedProvinceName ? { code: null, name: savedProvinceName } : null);

    const savedWardName = String(address.ward || '');
    const savedWardCode = address.wardCode;
    this.addAddressWard = savedWardName
      ? { code: null, name: savedWardName }
      : null;
    if (!this.addAddressProvince?.code) return;

    this.addAddressLoadingWards = true;
    this.http.get<any[]>(`https://provinces.open-api.vn/api/v2/w/?province=${this.addAddressProvince.code}`).subscribe({
      next: wards => this.ngZone.run(() => {
        this.addAddressWards = (wards || []).map(ward => ({ code: ward.code, name: ward.name }));
        this.addAddressWard = this.addAddressWards.find(ward =>
          (savedWardCode != null && String(ward.code) === String(savedWardCode)) ||
          this.normalizeAdministrativeName(ward.name) === this.normalizeAdministrativeName(savedWardName)
        ) || (savedWardName ? { code: null, name: savedWardName } : null);
        this.addAddressLoadingWards = false;
        this.cdr.markForCheck();
      }),
      error: () => this.ngZone.run(() => {
        this.addAddressLoadingWards = false;
        this.addAddressError = 'Không tải được danh sách phường/xã. Vui lòng thử lại.';
        this.cdr.markForCheck();
      })
    });
  }

  private normalizeAdministrativeName(name: string): string {
    return String(name)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/^(tinh|thanh pho|tp\.?)\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  closeAddAddressModal(): void {
    if (this.addAddressSaving) return;
    this.showAddAddressModal = false;
    this.showAddressModal = true;
    this.addAddressProvinceDropdownOpen = false;
    this.addAddressWardDropdownOpen = false;
  }

  loadAddressProvinces(address?: any): void {
    this.addAddressLoadingProvinces = true;
    this.http.get<any[]>('https://provinces.open-api.vn/api/v2/p/').subscribe({
      next: provinces => this.ngZone.run(() => {
        this.addAddressProvinces = (provinces || []).map(province => ({
          code: province.code,
          name: province.name
        }));
        this.addAddressLoadingProvinces = false;
        if (address) this.restoreAddressLocation(address);
        this.cdr.markForCheck();
      }),
      error: () => this.ngZone.run(() => {
        this.addAddressLoadingProvinces = false;
        this.addAddressError = 'Không tải được danh sách tỉnh/thành. Vui lòng thử lại.';
        this.cdr.markForCheck();
      })
    });
  }

  toggleAddAddressProvinceDropdown(): void {
    this.addAddressProvinceDropdownOpen = !this.addAddressProvinceDropdownOpen;
    this.addAddressWardDropdownOpen = false;
  }

  selectAddAddressProvince(province: any): void {
    this.addAddressProvince = province;
    this.addAddressWard = null;
    this.addAddressError = '';
    this.addAddressWards = [];
    this.addAddressProvinceDropdownOpen = false;
    this.addAddressWardDropdownOpen = false;
    this.addAddressLoadingWards = true;
    this.http.get<any[]>(`https://provinces.open-api.vn/api/v2/w/?province=${province.code}`).subscribe({
      next: wards => this.ngZone.run(() => {
        this.addAddressWards = (wards || []).map(ward => ({ code: ward.code, name: ward.name }));
        this.addAddressLoadingWards = false;
        this.cdr.markForCheck();
      }),
      error: () => this.ngZone.run(() => {
        this.addAddressLoadingWards = false;
        this.addAddressError = 'Không tải được danh sách phường/xã. Vui lòng thử lại.';
        this.cdr.markForCheck();
      })
    });
  }

  toggleAddAddressWardDropdown(): void {
    if (!this.addAddressProvince || this.addAddressLoadingWards || !this.addAddressWards.length) return;
    this.addAddressWardDropdownOpen = !this.addAddressWardDropdownOpen;
    this.addAddressProvinceDropdownOpen = false;
  }

  selectAddAddressWard(ward: any): void {
    this.addAddressWard = ward;
    this.addAddressWardDropdownOpen = false;
  }

  submitNewAddress(): void {
    if (
      !this.addAddressFullName.trim() ||
      !this.addAddressPhone.trim() ||
      !this.addAddressStreet.trim() ||
      !this.addAddressProvince ||
      !this.addAddressWard
    ) {
      this.addAddressError = 'Vui lòng điền đầy đủ các trường bắt buộc.';
      return;
    }
    if (!/^(0|\+84)(3|5|7|8|9)\d{8}$/.test(this.addAddressPhone.trim())) {
      this.addAddressError = 'Số điện thoại không hợp lệ.';
      return;
    }
    if (!this.addAddressProvinces.length) {
      this.addAddressError = 'Danh sách tỉnh/thành chưa tải được. Vui lòng thử lại.';
      return;
    }

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) {
      this.addAddressError = 'Vui lòng đăng nhập để lưu địa chỉ vào sổ địa chỉ.';
      return;
    }

    this.addAddressSaving = true;
    this.addAddressError = '';
    const headers = new HttpHeaders({ Authorization: 'Bearer ' + token });
    const body = {
      fullName: this.addAddressFullName.trim(),
      phone: this.addAddressPhone.trim(),
      address: this.addAddressStreet.trim(),
      province: this.addAddressProvince.name,
      provinceCode: this.addAddressProvince.code,
      ward: this.addAddressWard.name,
      wardCode: this.addAddressWard.code,
      isDefault: this.addAddressIsDefault
    };

    const request = this.editingAddressId
      ? this.http.put<any>(`http://localhost:3002/api/addresses/${this.editingAddressId}`, body, { headers })
      : this.http.post<any>('http://localhost:3002/api/addresses', body, { headers });
    request.subscribe({
      next: response => this.ngZone.run(() => {
        this.addAddressSaving = false;
        if (!response.success || !response.address) {
          this.addAddressError = response.message || (this.editingAddressId
            ? 'Không thể cập nhật địa chỉ.'
            : 'Không thể thêm địa chỉ.');
          this.cdr.markForCheck();
          return;
        }

        const address = response.address;
        if (address.isDefault) {
          this.savedAddresses = this.savedAddresses.map(saved => ({ ...saved, isDefault: false }));
        }
        const addressIndex = this.savedAddresses.findIndex(saved => String(saved._id) === String(address._id));
        if (addressIndex >= 0) {
          this.savedAddresses = this.savedAddresses.map((saved, index) => index === addressIndex ? address : saved);
        } else {
          this.savedAddresses = [...this.savedAddresses, address];
        }
        this.applyAddress(address);
        this.showAddAddressModal = false;
        this.editingAddressId = null;
        this.addAddressProvinceDropdownOpen = false;
        this.addAddressWardDropdownOpen = false;
        try {
          localStorage.setItem('floralia_cached_addresses', JSON.stringify(this.savedAddresses));
          localStorage.setItem('floralia_cached_address', JSON.stringify(address));
        } catch (error) {
          console.error('Không thể lưu địa chỉ vào bộ nhớ đệm:', error);
        }
        this.showAddressModal = false;
        this.cdr.markForCheck();
      }),
      error: error => this.ngZone.run(() => {
        this.addAddressSaving = false;
        this.addAddressError = error?.error?.message || (this.editingAddressId
          ? 'Không thể cập nhật địa chỉ. Vui lòng thử lại.'
          : 'Không thể thêm địa chỉ. Vui lòng thử lại.');
        this.cdr.markForCheck();
      })
    });
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
        this.ngZone.run(() => {
          this.checkoutItemsLoading = false;
          const outOfStockIndex = products.findIndex((product, index) =>
            !Number.isFinite(product.stock) || product.stock < requestedItems[index].quantity
          );
          if (outOfStockIndex >= 0) {
            this.checkoutItemsError = `Sản phẩm "${products[outOfStockIndex].name}" không đủ tồn kho. Vui lòng cập nhật giỏ hàng.`;
          } else {
            this.items = products.map((product, index) => this.toCheckoutItem(product, requestedItems[index].quantity));
          }
          this.cdr.markForCheck();
        });
      },
      error: error => {
        this.ngZone.run(() => {
          this.checkoutItemsLoading = false;
          this.checkoutItemsError = error?.error?.message || 'Không thể tải sản phẩm từ MongoDB. Vui lòng thử lại.';
          this.cdr.markForCheck();
        });
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
      oldPrice: Math.max(price, Number(item.oldPrice) || price),
      price: Math.max(price, Number(item.oldPrice) || price),
      salePrice: price,
      productDiscount: Math.max(0, Number(item.productDiscount) || 0),
      quantity,
      total: Math.max(price, Number(item.oldPrice) || price) * quantity
    };
  }

  private toCheckoutItem(product: CheckoutProduct, quantity: number): CheckoutItem {
    const oldPrice = Math.max(Number(product.price) || 0, Number(product.oldPrice) || 0);
    const salePrice = Number(product.price) || 0;
    return {
      sku: product.sku,
      name: product.name,
      image: product.imageUrl
        ? `http://localhost:3002${product.imageUrl}`
        : '/assets/images/no-image.svg',
      variant: product.variant,
      oldPrice,
      price: oldPrice,
      salePrice,
      productDiscount: Math.max(0, oldPrice - salePrice) * quantity,
      quantity,
      total: oldPrice * quantity
    };
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
<<<<<<< HEAD
    this.productService.validateVoucher(code, this.subtotal, this.items.map(item => ({ sku: item.sku, quantity: item.quantity, variant: item.variant }))).subscribe({
=======
    this.productService.validateVoucher(code, this.saleSubtotal).subscribe({
>>>>>>> d8b712c2e3626c761721e9c750ba391fbee365bf
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

  get productDiscount(): number {
    return this.items.reduce((sum, item) => sum + (item.productDiscount || 0), 0);
  }

  get saleSubtotal(): number {
    return Math.max(0, this.subtotal - this.productDiscount);
  }

  get voucherDiscount(): number {
    return this.couponApplied
      ? Math.min(this.saleSubtotal, this.appliedVoucher?.discount || 0)
      : 0;
  }

  get discount(): number {
    return Math.min(this.subtotal, this.productDiscount + this.voucherDiscount);
  }

  readonly shippingFee = 30_000;

  get total(): number {
    const computed = this.subtotal - this.discount + this.shippingFee;
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
        oldPrice: item.oldPrice,
        price: item.price,
        salePrice: item.salePrice,
        productDiscount: item.productDiscount || 0,
        quantity: item.quantity,
        total: item.total || item.price * item.quantity
      })),
      notice: 'Đơn hàng đang chờ cửa hàng xác nhận',
      ...(this.note.trim() ? { customerNote: this.note.trim() } : {}),
      shippingFee: this.shippingFee,
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
