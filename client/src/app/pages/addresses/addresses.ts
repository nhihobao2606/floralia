import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-addresses',
  standalone: false,
  templateUrl: './addresses.html',
  styleUrl: './addresses.css',
})
export class Addresses implements OnInit {
  showLogoutConfirm = false;
  private readonly API = 'http://localhost:3002/api';
  private readonly PROVINCES_API = 'https://provinces.open-api.vn/api/v2';

  menu = [
    { label: 'Tổng quan', icon: 'bi-grid', link: '/account' },
    { label: 'Đơn hàng', icon: 'bi-box-seam', link: '/orders' },
    { label: 'Sổ địa chỉ', icon: 'bi-geo-alt', link: '/addresses' },
    { label: 'Sản phẩm yêu thích', icon: 'bi-heart', link: '/wishlist' },
  ];

  user: any = null;
  avatar = '';
  fullName = '';
  email = '';

  addresses: any[] = [];
  loadingAddresses = true;

  // Province/ward data
  provinces: any[] = [];
  wards: any[] = [];
  loadingProvinces = false;
  loadingWards = false;
  provinceDropdownOpen = false;
  wardDropdownOpen = false;

  // Modal state
  showModal = false;
  isEditMode = false;
  editingAddressId: string | null = null;

  // Form fields
  formFullName = '';
  formPhone = '';
  formStreet = '';
  formProvince: any = null;
  formWard: any = null;
  formIsDefault = false;

  // UI state
  saving = false;
  validating = false;
  deleteConfirmId: string | null = null;
  msg: { type: 'ok' | 'err'; text: string } = { type: 'ok', text: '' };
  formError = '';

  readonly phonePattern = '^(0|\\+84)(3|5|7|8|9)\\d{8}$';

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    const raw = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    if (!raw || !this.token) {
      this.router.navigate(['/login']);
      return;
    }
    try {
      const u = JSON.parse(raw);
      this.fillUser(u);
    } catch {
      this.router.navigate(['/login']);
      return;
    }

    // Tải thông tin user mới nhất
    this.http.get<any>(`${this.API}/users/me`, { headers: this.headers }).subscribe({
      next: (res) => {
        if (res.success) {
          this.fillUser(res.user);
          this.syncStorage(res.user);
        }
      },
      error: (err) => { if (err.status === 401) this.logout(); }
    });

    this.loadAddresses(true);
    this.loadProvinces();
  }

  /* ==================== GETTERS ==================== */
  private get token(): string {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  }

  private get headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.token}` });
  }

  get initial(): string {
    const parts = (this.fullName || '?').trim().split(/\s+/);
    return parts[parts.length - 1].charAt(0).toUpperCase();
  }

  /* ==================== USER ==================== */
  private fillUser(u: any): void {
    this.user = u;
    this.fullName = u.fullName || '';
    this.email = u.email || '';
    this.avatar = u.avatar || '';
    this.cdr.markForCheck();
  }

  private syncStorage(u: any): void {
    const store = localStorage.getItem('currentUser') ? localStorage : sessionStorage;
    store.setItem('currentUser', JSON.stringify(u));
  }

  /* ==================== PROVINCES ==================== */
  loadProvinces(): void {
    this.loadingProvinces = true;
    this.http.get<any[]>(`${this.PROVINCES_API}/p/`).subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          this.provinces = (data || []).map((province: any) => ({
            code: province.code, name: province.name,
          }));
          this.loadingProvinces = false;
          this.cdr.markForCheck();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.provinces = [];
          this.loadingProvinces = false;
          this.formError = 'Không tải được danh sách tỉnh/thành. Vui lòng đóng và mở lại biểu mẫu để thử lại.';
          this.cdr.markForCheck();
        });
      }
    });
  }

  onProvinceChange(): void {
    this.formWard = null;
    this.wards = [];
    if (!this.formProvince) return;
    this.loadingWards = true;
    this.http.get<any[]>(`${this.PROVINCES_API}/w/?province=${this.formProvince.code}`).subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          this.wards = (data || []).map((ward: any) => ({ code: ward.code, name: ward.name }));
          this.loadingWards = false;
          this.cdr.markForCheck();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.wards = [];
          this.loadingWards = false;
          this.cdr.markForCheck();
        });
      }
    });
  }

  compareById(a: any, b: any): boolean {
    return a === b || (!!a && !!b && String(a.code) === String(b.code));
  }

  toggleProvinceDropdown(): void {
    this.provinceDropdownOpen = !this.provinceDropdownOpen;
    this.wardDropdownOpen = false;
  }

  toggleWardDropdown(): void {
    if (!this.formProvince || this.loadingWards) return;
    this.wardDropdownOpen = !this.wardDropdownOpen;
    this.provinceDropdownOpen = false;
  }

  selectProvince(province: any): void {
    this.formProvince = province;
    this.provinceDropdownOpen = false;
    this.onProvinceChange();
  }

  selectWard(ward: any): void {
    this.formWard = ward;
    this.wardDropdownOpen = false;
  }

  /* ==================== ADDRESSES ==================== */
  loadAddresses(showInitialLoader = false): void {
    if (showInitialLoader) this.loadingAddresses = true;
    this.http.get<any>(`${this.API}/addresses`, { headers: this.headers }).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) {
            this.addresses = res.addresses || [];
            try {
              localStorage.setItem('floralia_cached_addresses', JSON.stringify(this.addresses));
              const def = this.addresses.find((a: any) => a.isDefault) || this.addresses[0];
              if (def) localStorage.setItem('floralia_cached_address', JSON.stringify(def));
            } catch (e) {}
          }
          this.loadingAddresses = false;
          this.cdr.markForCheck();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.loadingAddresses = false;
          if (err.status === 401) this.logout();
          else this.flash('err', err.error?.message || 'Không tải được danh sách địa chỉ. Vui lòng thử lại.');
          this.cdr.markForCheck();
        });
      }
    });
  }

  /* ==================== MODAL ==================== */
  openAddModal(): void {
    if (!this.provinces.length && !this.loadingProvinces) this.loadProvinces();
    this.isEditMode = false;
    this.editingAddressId = null;
    this.resetForm();
    this.showModal = true;
    this.cdr.markForCheck();
  }

  openEditModal(addr: any): void {
    this.isEditMode = true;
    this.editingAddressId = addr._id;
    this.formFullName = addr.fullName || '';
    this.formPhone = addr.phone || '';
    this.formStreet = addr.address || '';
    this.formIsDefault = addr.isDefault || false;
    this.formError = '';

    // Khôi phục tỉnh và phường
    this.formProvince = this.provinces.find(p => p.code === addr.provinceCode || p.name === addr.province) || null;
    this.wards = [];
    this.formWard = null;
    if (this.formProvince) {
      this.loadingWards = true;
      this.http.get<any[]>(`${this.PROVINCES_API}/w/?province=${this.formProvince.code}`).subscribe({
        next: (data) => {
          this.ngZone.run(() => {
            this.wards = (data || []).map((ward: any) => ({ code: ward.code, name: ward.name }));
            this.formWard = this.wards.find(w => w.code === addr.wardCode || w.name === addr.ward) || null;
            this.loadingWards = false;
            this.cdr.markForCheck();
          });
        },
        error: () => {
          this.ngZone.run(() => {
            this.wards = [];
            this.loadingWards = false;
            this.cdr.markForCheck();
          });
        }
      });
    }

    this.showModal = true;
    this.cdr.markForCheck();
  }

  closeModal(): void {
    this.showModal = false;
    this.provinceDropdownOpen = false;
    this.wardDropdownOpen = false;
    this.saving = false;
    this.formError = '';
    this.cdr.markForCheck();
  }

  resetForm(): void {
    this.formFullName = '';
    this.formPhone = '';
    this.formStreet = '';
    this.formProvince = null;
    this.formWard = null;
    this.formIsDefault = false;
    this.wards = [];
    this.formError = '';
  }

  /* ==================== SUBMIT ==================== */
  submitAddress(): void {
    if (!this.formFullName.trim() || !this.formPhone.trim() || !this.formStreet.trim()
        || !this.formProvince || !this.formWard) {
      this.formError = 'Vui lòng điền đầy đủ tất cả các trường bắt buộc.';
      return;
    }

    const phoneRe = new RegExp(this.phonePattern);
    if (!phoneRe.test(this.formPhone.trim())) {
      this.formError = 'Số điện thoại không hợp lệ.';
      return;
    }

    this.formError = '';
    this.saving = true;
    this.cdr.markForCheck();

    const body = {
      fullName: this.formFullName.trim(),
      phone: this.formPhone.trim(),
      address: this.formStreet.trim(),
      province: this.formProvince.name,
      provinceCode: this.formProvince.code,
      ward: this.formWard.name,
      wardCode: this.formWard.code,
      isDefault: this.formIsDefault,
    };

    if (this.isEditMode && this.editingAddressId) {
      this.http.put<any>(`${this.API}/addresses/${this.editingAddressId}`, body, { headers: this.headers })
        .subscribe({
          next: (res) => {
            this.ngZone.run(() => {
              this.saving = false;
              if (res.success) {
                this.closeModal();
                this.loadAddresses();
                this.flash('ok', 'Cập nhật địa chỉ thành công!');
              } else {
                this.formError = res.message || 'Cập nhật thất bại.';
              }
              this.cdr.markForCheck();
            });
          },
          error: (err) => {
            this.ngZone.run(() => {
              this.saving = false;
              this.formError = err.error?.message || 'Lỗi kết nối. Vui lòng thử lại.';
              this.cdr.markForCheck();
            });
          }
        });
    } else {
      this.http.post<any>(`${this.API}/addresses`, body, { headers: this.headers })
        .subscribe({
          next: (res) => {
            this.ngZone.run(() => {
              this.saving = false;
              if (res.success) {
                this.closeModal();
                this.loadAddresses();
                this.flash('ok', 'Thêm địa chỉ thành công!');
              } else {
                this.formError = res.message || 'Thêm địa chỉ thất bại.';
              }
              this.cdr.markForCheck();
            });
          },
          error: (err) => {
            this.ngZone.run(() => {
              this.saving = false;
              this.formError = err.error?.message || 'Lỗi kết nối. Vui lòng thử lại.';
              this.cdr.markForCheck();
            });
          }
        });
    }
  }

  /* ==================== DELETE ==================== */
  confirmDelete(id: string): void {
    this.deleteConfirmId = id;
  }

  cancelDelete(): void {
    this.deleteConfirmId = null;
  }

  doDelete(id: string): void {
    this.deleteConfirmId = null;
    this.http.delete<any>(`${this.API}/addresses/${id}`, { headers: this.headers }).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) {
            this.loadAddresses();
            this.flash('ok', 'Đã xóa địa chỉ.');
          } else {
            this.flash('err', res.message || 'Không thể xóa địa chỉ.');
          }
          this.cdr.markForCheck();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.flash('err', err.error?.message || 'Lỗi kết nối. Vui lòng thử lại.');
          this.cdr.markForCheck();
        });
      }
    });
  }

  /* ==================== SET DEFAULT ==================== */
  setDefault(id: string): void {
    this.http.put<any>(`${this.API}/addresses/${id}/default`, {}, { headers: this.headers }).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) {
            this.loadAddresses();
            this.flash('ok', 'Đã đặt làm địa chỉ mặc định!');
          } else {
            this.flash('err', res.message || 'Không thể đặt mặc định.');
          }
          this.cdr.markForCheck();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.flash('err', 'Lỗi kết nối. Vui lòng thử lại.');
          this.cdr.markForCheck();
        });
      }
    });
  }

  /* ==================== FLASH MESSAGE ==================== */
  private flash(type: 'ok' | 'err', text: string): void {
    this.msg = { type, text };
    this.cdr.markForCheck();
    if (type === 'ok') {
      setTimeout(() => {
        this.msg = { type: 'ok', text: '' };
        this.cdr.markForCheck();
      }, 4000);
    }
  }

  /* ==================== LOGOUT ==================== */
  logout(e?: Event): void {
    e?.preventDefault();
    ['currentUser', 'token'].forEach(k => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
    window.dispatchEvent(new Event('auth-changed'));
    this.router.navigate(['/login']);
  }

  requestLogout(e: Event): void {
    e.preventDefault();
    this.showLogoutConfirm = true;
  }

  confirmLogout(): void {
    this.showLogoutConfirm = false;
    this.logout();
  }
}
