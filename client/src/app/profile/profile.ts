import { Component, OnInit } from '@angular/core';
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
  private readonly API = 'http://localhost:3002/api/users';

  // Menu bên trái: thêm mục mới chỉ cần thêm một dòng vào mảng này.
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
  avatar = '';
  avatarError = '';
  savingProfile = false;
  profileMsg: { type: 'ok' | 'err'; text: string } = { type: 'ok', text: '' };

  // Đổi mật khẩu
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  show = { cur: false, new: false, cf: false };
  wrongCurrent = false;
  savingPass = false;
  passMsg: { type: 'ok' | 'err'; text: string } = { type: 'ok', text: '' };

  readonly namePattern = '^(?=.*\\S)[^\\d!@#$%^&*()_+=\\[\\]{};:"\\\\|<>?/~]+$';
  readonly phonePattern = '^(0|\\+84)(3|5|7|8|9)\\d{8}$';
  readonly passwordPattern = '^(?=.*[A-Za-z])(?=.*\\d).{8,}$';

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    // 1) Hiện ngay thông tin đã lưu lúc đăng nhập/đăng ký.
    const raw = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    if (!raw || !this.token) {
      this.router.navigate(['/login']);
      return;
    }
    try { this.fill(JSON.parse(raw)); } catch { this.router.navigate(['/login']); return; }

    // 2) Lấy bản mới nhất từ MongoDB.
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
    this.avatar = u.avatar || '';
  }

  // Cập nhật lại thông tin trong bộ nhớ trình duyệt để header hiện đúng tên.
  private syncStorage(u: any): void {
    const store = localStorage.getItem('currentUser') ? localStorage : sessionStorage;
    store.setItem('currentUser', JSON.stringify(u));
    window.dispatchEvent(new Event('cart-updated'));
  }

  private handleAuthError(err: any): void {
    if (err.status === 401) this.logout();
  }

  get initial(): string {
    const parts = (this.fullName || this.user?.fullName || '?').trim().split(/\s+/);
    return parts[parts.length - 1].charAt(0).toUpperCase();
  }

  get profileChanged(): boolean {
    return !!this.user && (
      this.fullName.trim() !== (this.user.fullName || '') ||
      this.phone.trim() !== (this.user.phone || '') ||
      this.avatar !== (this.user.avatar || '')
    );
  }

  /* ================= ẢNH ĐẠI DIỆN ================= */
  onFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    this.avatarError = '';
    if (!file) return;

    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      this.avatarError = 'Vui lòng chọn ảnh JPG, PNG hoặc WEBP.';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.avatarError = 'Ảnh quá lớn (tối đa 5MB).';
      return;
    }

    // Cắt vuông và thu nhỏ về 256px để lưu gọn vào MongoDB.
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const side = Math.min(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        canvas.getContext('2d')!.drawImage(
          img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size
        );
        this.avatar = canvas.toDataURL('image/jpeg', 0.85);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  removeAvatar(): void {
    this.avatar = '';
  }

  /* ================= CẬP NHẬT THÔNG TIN ================= */
  updateProfile(form: NgForm): void {
    this.profileMsg.text = '';
    if (form.invalid) { form.form.markAllAsTouched(); return; }

    this.savingProfile = true;
    this.http.put<any>(`${this.API}/me`, {
      fullName: this.fullName.trim().replace(/\s+/g, ' '),
      phone: this.phone.trim(),
      avatar: this.avatar,
    }, { headers: this.headers }).subscribe({
      next: (res) => {
        this.savingProfile = false;
        if (res.success) {
          this.fill(res.user);
          this.syncStorage(res.user);
          this.flash('profileMsg', 'ok', res.message || 'Cập nhật thông tin thành công!');
        }
      },
      error: (err) => {
        this.savingProfile = false;
        this.handleAuthError(err);
        this.flash('profileMsg', 'err', err.error?.message || 'Không thể cập nhật. Vui lòng thử lại.');
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
    if (form.invalid || this.mismatch || this.samePassword) { form.form.markAllAsTouched(); return; }

    this.savingPass = true;
    this.http.put<any>(`${this.API}/me/password`, {
      currentPassword: this.currentPassword,
      newPassword: this.newPassword,
    }, { headers: this.headers }).subscribe({
      next: (res) => {
        this.savingPass = false;
        form.resetForm();
        this.show = { cur: false, new: false, cf: false };
        this.flash('passMsg', 'ok', res.message || 'Đổi mật khẩu thành công!');
      },
      error: (err) => {
        this.savingPass = false;
        this.handleAuthError(err);
        if (err.status === 400 && err.error?.field === 'currentPassword') this.wrongCurrent = true;
        else this.flash('passMsg', 'err', err.error?.message || 'Không thể đổi mật khẩu. Vui lòng thử lại.');
      },
    });
  }

  private flash(target: 'profileMsg' | 'passMsg', type: 'ok' | 'err', text: string): void {
    this[target] = { type, text };
    if (type === 'ok') setTimeout(() => (this[target] = { type: 'ok', text: '' }), 4000);
  }

  /* ================= ĐĂNG XUẤT ================= */
  logout(e?: Event): void {
    e?.preventDefault();
    ['currentUser', 'token'].forEach((k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
    window.dispatchEvent(new Event('cart-updated'));
    this.router.navigate(['/login']);
  }
}