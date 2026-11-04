import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, timeout } from 'rxjs';
import { AdminSidebar } from '../../../components/admin-sidebar/admin-sidebar';
import { AdminUserService } from '../../../services/admin-user-service';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AdminSidebar],
  templateUrl: './user-form.html',
  styleUrl: './user-form.css',
})
export class AdminUserForm implements OnInit {
  id = '';
  editing = false;
  loading = false;
  saving = false;
  error = '';
  success = '';
  adminName = 'Admin Floralia';
  showPassword = false;
  showConfirmPassword = false;
  form = { fullName: '', email: '', phone: '', password: '', confirmPassword: '', role: 'customer' as 'customer' | 'admin', avatar: '', status: 'active' as 'active' | 'blocked' };
  readonly passwordPattern = '^(?=.*[A-Za-z])(?=.*\\d).{8,}$';

  get passwordHasMinimumLength(): boolean { return this.form.password.length >= 8; }
  get passwordHasLetter(): boolean { return /[A-Za-z]/.test(this.form.password); }
  get passwordHasNumber(): boolean { return /\d/.test(this.form.password); }
  get passwordMismatch(): boolean { return Boolean(this.form.confirmPassword) && this.form.password !== this.form.confirmPassword; }
  constructor(private readonly route: ActivatedRoute, private readonly router: Router, private readonly users: AdminUserService, private readonly changeDetector: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    this.editing = Boolean(this.id);
    const saved = localStorage.getItem('adminUser') || sessionStorage.getItem('adminUser');
    if (saved) {
      try { this.adminName = JSON.parse(saved)?.fullName || JSON.parse(saved)?.name || 'Admin'; } catch { this.adminName = 'Admin'; }
    }
    if (this.editing) this.loadUser();
  }

  private loadUser(): void {
    if (!this.id) {
      this.error = 'Không tìm thấy người dùng cần chỉnh sửa.';
      return;
    }
    this.loading = true;
    this.error = '';
    this.changeDetector.detectChanges();
    this.users.getAll().pipe(
      timeout(15000),
      finalize(() => {
        this.loading = false;
        this.changeDetector.detectChanges();
      }),
    ).subscribe({
      next: response => {
        const user = response.users.find(item => item.id === this.id);
        if (!user) {
          this.error = 'Không tìm thấy người dùng cần chỉnh sửa.';
        } else {
          this.form = { ...this.form, fullName: user.fullName || '', email: user.email || '', phone: user.phone || '', role: user.role === 'admin' ? 'admin' : 'customer', avatar: user.avatar || '', status: user.status || 'active' };
        }
      },
      error: err => {
        this.error = err?.error?.message || (err?.name === 'TimeoutError'
          ? 'Tải thông tin mất quá nhiều thời gian. Vui lòng thử tải lại.'
          : 'Không thể tải thông tin người dùng.');
      },
    });
  }

  async onAvatarSelected(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2_000_000) {
      this.error = 'Ảnh đại diện phải là JPG, PNG hoặc WEBP và tối đa 2 MB.';
      input.value = '';
      return;
    }
    this.form.avatar = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid image'));
      reader.onerror = () => reject(reader.error || new Error('Image read failed'));
      reader.readAsDataURL(file);
    }).catch(() => {
      this.error = 'Không thể đọc ảnh đã chọn.';
      return this.form.avatar;
    });
    this.error = '';
    input.value = '';
  }

  save(): void {
    if (this.saving) return;
    this.error = '';
    if (!this.form.fullName.trim() || !this.form.email.trim() || !this.form.phone.trim()) {
      this.error = 'Vui lòng nhập họ tên, email và số điện thoại.';
      return;
    }
    if (!this.editing && !new RegExp(this.passwordPattern).test(this.form.password)) {
      this.error = 'Mật khẩu cần tối thiểu 8 ký tự, gồm ít nhất một chữ cái và một chữ số.';
      return;
    }
    if (!this.editing && this.form.password !== this.form.confirmPassword) {
      this.error = 'Mật khẩu xác nhận không khớp.';
      return;
    }
    this.saving = true;
    this.changeDetector.detectChanges();
    const request = this.editing
      ? this.users.updateProfile(this.id, { fullName: this.form.fullName.trim(), phone: this.form.phone.trim(), avatar: this.form.avatar, role: this.form.role })
      : this.users.createUser({ fullName: this.form.fullName.trim(), email: this.form.email.trim(), phone: this.form.phone.replace(/\s+/g, ''), password: this.form.password, role: this.form.role, avatar: this.form.avatar, status: this.form.status });
    request.pipe(timeout(20000), finalize(() => {
      this.saving = false;
      this.changeDetector.detectChanges();
    })).subscribe({
      next: response => {
        this.success = response.message || (this.editing ? 'Đã cập nhật người dùng.' : 'Đã tạo tài khoản người dùng.');
        window.setTimeout(() => void this.router.navigate(this.editing ? ['/users', this.id] : ['/users']), 800);
      },
      error: err => {
        this.error = err?.error?.message || (err?.name === 'TimeoutError'
          ? 'Máy chủ phản hồi quá lâu. Vui lòng kiểm tra danh sách người dùng trước khi thử lại.'
          : err?.status === 0
            ? 'Không kết nối được máy chủ. Hãy kiểm tra backend ở cổng 3002.'
            : 'Không thể lưu thông tin người dùng.');
      },
    });
  }

  logout(): void {
    this.users.clearCache();
    localStorage.removeItem('adminToken'); localStorage.removeItem('adminUser');
    sessionStorage.removeItem('adminToken'); sessionStorage.removeItem('adminUser');
    void this.router.navigate(['/admin-login']);
  }
}
