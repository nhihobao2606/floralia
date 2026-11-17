import { ChangeDetectorRef, Component, HostListener, NgZone, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { NgControl, NgForm } from '@angular/forms';

@Component({
  selector: 'app-profile',
  standalone: false,
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit {
  showLogoutConfirm = false;
  private readonly API = 'http://localhost:3002/api/users';

  // Menu bên trái
  menu = [
    { label: 'Tổng quan', icon: 'bi-grid', link: '/account' },
    { label: 'Đơn hàng', icon: 'bi-box-seam', link: '/orders' },
    { label: 'Sổ địa chỉ', icon: 'bi-geo-alt', link: '/addresses' },
    { label: 'Sản phẩm yêu thích', icon: 'bi-heart', link: '/wishlist' },
  ];

  user: any = null;

  // Thông tin tài khoản
  fullName = '';
  email = '';
  phone = '';
  gender = '';
  birthDate = '';
  birthDay: number | null = null;
  birthMonth: number | null = null;
  birthYear: number | null = null;
  openBirthPart: 'day' | 'month' | 'year' | null = null;
  readonly currentBirthYear = new Date().getFullYear();
  readonly currentBirthMonth = new Date().getMonth() + 1;
  readonly currentBirthDay = new Date().getDate();
  readonly birthMonths = Array.from({ length: 12 }, (_, index) => ({
    value: index + 1,
    label: `Tháng ${String(index + 1).padStart(2, '0')}`
  }));
  readonly birthYears = Array.from({ length: this.currentBirthYear - 1899 }, (_, index) => this.currentBirthYear - index);
  avatar = '';
  avatarError = '';
  profileMsg: { type: 'ok' | 'err'; text: string } = { type: 'ok', text: '' };

  // Đổi mật khẩu
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  show = { cur: false, new: false, cf: false };
  wrongCurrent = false;
  passMsg: { type: 'ok' | 'err'; text: string } = { type: 'ok', text: '' };

  readonly namePattern = '^(?=.*\\S)[^\\d!@#$%^&*()_+=\\[\\]{};:"\\\\|<>?/~]+$';
  readonly phonePattern = '^0(3|5|7|8|9)\\d{8}$';
  readonly passwordPattern = '^(?=.*[A-Za-z])(?=.*\\d).{8,}$';

  get maxBirthDate(): string {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  get birthDays(): number[] {
    const monthLength = this.birthMonth && this.birthYear
      ? new Date(this.birthYear, this.birthMonth, 0).getDate()
      : 31;
    const limit = this.birthYear === this.currentBirthYear && this.birthMonth === this.currentBirthMonth
      ? this.currentBirthDay
      : monthLength;
    return Array.from({ length: limit }, (_, index) => index + 1);
  }

  updateBirthDateParts(): void {
    if (this.birthYear === this.currentBirthYear && this.birthMonth && this.birthMonth > this.currentBirthMonth) {
      this.birthMonth = null;
    }
    if (!this.birthDay || !this.birthMonth || !this.birthYear) {
      this.birthDate = '';
      return;
    }

    const monthLength = new Date(this.birthYear, this.birthMonth, 0).getDate();
    const maxDay = this.birthYear === this.currentBirthYear && this.birthMonth === this.currentBirthMonth
      ? Math.min(monthLength, this.currentBirthDay)
      : monthLength;
    this.birthDay = Math.min(this.birthDay, maxDay);
    const value = `${this.birthYear}-${String(this.birthMonth).padStart(2, '0')}-${String(this.birthDay).padStart(2, '0')}`;
    this.birthDate = value <= this.maxBirthDate ? value : '';
  }

  toggleBirthPart(part: 'day' | 'month' | 'year', event: Event): void {
    event.stopPropagation();
    this.openBirthPart = this.openBirthPart === part ? null : part;
  }

  selectBirthPart(part: 'day' | 'month' | 'year', value: number): void {
    if (part === 'day') this.birthDay = value;
    if (part === 'month') this.birthMonth = value;
    if (part === 'year') this.birthYear = value;
    this.updateBirthDateParts();
    this.openBirthPart = null;
  }

  @HostListener('document:click')
  closeBirthPartDropdown(): void {
    this.openBirthPart = null;
  }

  @HostListener('document:keydown.escape')
  closeBirthPartDropdownOnEscape(): void {
    this.openBirthPart = null;
  }

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    // 1) Hiện ngay thông tin đã lưu lúc đăng nhập
    const raw = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    if (!raw || !this.token) {
      this.router.navigate(['/login']);
      return;
    }
    try { this.fill(JSON.parse(raw)); } catch { this.router.navigate(['/login']); return; }

    // 2) Lấy bản mới nhất từ MongoDB
    this.http.get<any>(`${this.API}/me`, { headers: this.headers }).subscribe({
      next: (res) => { if (res.success) { this.fill(res.user); this.syncStorage(res.user); } },
      error: (err) => this.handleAuthError(err),
    });
  }

  /* ================= TIỆN ÍCH ================= */
  private get token(): string {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  }

  private get headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.token}` });
  }

  private fill(u: any): void {
    this.user = u;
    this.fullName = u.fullName || '';
    this.email = u.email || '';
    this.phone = u.phone || '';
    this.gender = u.gender || '';
    this.birthDate = u.birthDate || '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(this.birthDate)) {
      const [year, month, day] = this.birthDate.split('-').map(Number);
      this.birthYear = year;
      this.birthMonth = month;
      this.birthDay = day;
    } else {
      this.birthYear = this.birthMonth = this.birthDay = null;
    }
    this.avatar = u.avatar || '';
    this.cdr.detectChanges();
  }

  // Cập nhật lại thông tin trong bộ nhớ trình duyệt để header và các component hiện đúng tức thì
  private syncStorage(u: any): void {
    const store = localStorage.getItem('currentUser') ? localStorage : sessionStorage;
    store.setItem('currentUser', JSON.stringify(u));
    window.dispatchEvent(new Event('cart-updated'));
    window.dispatchEvent(new Event('auth-changed'));
  }

  private handleAuthError(err: any): void {
    if (err.status === 401) this.logout();
  }

  get initial(): string {
    const parts = (this.fullName || this.user?.fullName || '?').trim().split(/\s+/);
    return parts[parts.length - 1].charAt(0).toUpperCase();
  }

  /* ================= ẢNH ĐẠI DIỆN ================= */
  onFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    this.avatarError = '';
    if (!file) return;

    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      this.avatarError = 'Vui lòng chọn ảnh JPG, PNG hoặc WEBP.';
      input.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.avatarError = 'Ảnh quá lớn (tối đa 10 MB).';
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;

      // 1. Hiển thị ảnh xem trước ngay lập tức trên giao diện không cần chờ click thêm lần nào
      this.ngZone.run(() => {
        this.avatar = dataUrl;
        this.cdr.detectChanges();
      });

      // 2. Tối ưu ảnh vuông kích thước 256px
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const side = Math.min(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(
            img,
            (img.width - side) / 2,
            (img.height - side) / 2,
            side,
            side,
            0,
            0,
            size,
            size
          );
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          this.ngZone.run(() => {
            this.avatar = compressed;
            this.cdr.detectChanges();
          });
        }
      };
      img.src = dataUrl;
      input.value = '';
    };
    reader.readAsDataURL(file);
  }

  removeAvatar(): void {
    this.avatar = '';
    if (this.user) {
      this.user.avatar = '';
      this.syncStorage(this.user);
    }
    this.cdr.detectChanges();

    // Xóa ảnh trực tiếp trong cơ sở dữ liệu MongoDB
    this.http.put<any>(`${this.API}/me`, {
      fullName: this.fullName.trim(),
      phone: this.phone.trim(),
      avatar: ''
    }, { headers: this.headers }).subscribe({
      next: (res) => {
        if (res.success) {
          this.fill(res.user);
          this.syncStorage(res.user);
        }
      }
    });

    this.flash('profileMsg', 'ok', 'Đã xóa ảnh đại diện thành công!');
  }

  /* ================= CẬP NHẬT THÔNG TIN ================= */
  updateProfile(form: NgForm): void {
    this.profileMsg.text = '';
    if (form.invalid) {
      form.form.markAllAsTouched();
      return;
    }

    // Cập nhật ngay lập tức giao diện người dùng
    const updated = {
      ...this.user,
      fullName: this.fullName.trim().replace(/\s+/g, ' '),
      email: this.email.trim().toLowerCase(),
      phone: this.phone.trim(),
      gender: this.gender,
      birthDate: this.birthDate,
      avatar: this.avatar,
    };
    // Chỉ báo thành công sau khi server đã ghi và trả lại dữ liệu từ MongoDB.
    this.http.put<any>(`${this.API}/me`, {
      fullName: this.fullName.trim().replace(/\s+/g, ' '),
      email: this.email.trim().toLowerCase(),
      phone: this.phone.trim(),
      gender: this.gender,
      birthDate: this.birthDate,
      avatar: this.avatar,
    }, { headers: this.headers }).subscribe({
      next: (res) => {
        if (res.success) {
          this.fill(res.user);
          this.syncStorage(res.user);
          this.flash('profileMsg', 'ok', 'Cập nhật thông tin thành công!');
        } else {
          this.flash('profileMsg', 'err', res.message || 'Không thể lưu thông tin. Vui lòng thử lại.');
        }
      },
      error: (err) => {
        this.handleAuthError(err);
        this.flash('profileMsg', 'err', err.error?.message || 'Không thể lưu lên máy chủ. Vui lòng thử lại.');
      },
    });
  }

  /* ================= ĐỔI MẬT KHẨU ================= */
  get mismatch(): boolean { return this.confirmPassword !== this.newPassword; }
  get samePassword(): boolean { return !!this.newPassword && this.newPassword === this.currentPassword; }

  confirmInvalid(ctrl: NgControl, form: NgForm): boolean {
    return (!!ctrl.touched || form.submitted) && (!this.confirmPassword || this.mismatch);
  }

  changePassword(form: NgForm): void {
    this.passMsg.text = '';
    if (form.invalid || this.mismatch || this.samePassword) {
      form.form.markAllAsTouched();
      return;
    }

    this.http.put<any>(`${this.API}/me/password`, {
      currentPassword: this.currentPassword,
      newPassword: this.newPassword,
    }, { headers: this.headers }).subscribe({
      next: (res) => {
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        form.resetForm();
        this.show = { cur: false, new: false, cf: false };
        this.wrongCurrent = false;
        this.flash('passMsg', 'ok', res.message || 'Cập nhật mật khẩu thành công!');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.handleAuthError(err);
        if (err.status === 400 && err.error?.field === 'currentPassword') {
          this.wrongCurrent = true;
          this.flash('passMsg', 'err', 'Mật khẩu hiện tại không chính xác.');
        } else {
          this.flash('passMsg', 'err', err.error?.message || 'Không thể đổi mật khẩu. Vui lòng thử lại.');
        }
        this.cdr.detectChanges();
      },
    });
  }

  private flash(target: 'profileMsg' | 'passMsg', type: 'ok' | 'err', text: string): void {
    this[target] = { type, text };
    this.cdr.detectChanges();
    if (type === 'ok') {
      setTimeout(() => {
        this[target] = { type: 'ok', text: '' };
        this.cdr.detectChanges();
      }, 5000);
    }
  }

  /* ================= ĐĂNG XUẤT ================= */
  logout(e?: Event): void {
    e?.preventDefault();
    ['currentUser', 'token'].forEach((k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
    window.dispatchEvent(new Event('cart-updated'));
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
