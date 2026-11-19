import { ChangeDetectorRef, Component, NgZone, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgControl, NgForm } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AdminLogoutDialog } from '../../components/admin-logout-dialog/admin-logout-dialog';
import { AdminSidebar } from '../../components/admin-sidebar/admin-sidebar';

@Component({
  selector: 'app-admin-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AdminSidebar, AdminLogoutDialog],
  templateUrl: './admin-profile.html',
  styleUrl: './admin-profile.css',
})
export class AdminProfile implements OnInit {
  private readonly API = 'https://floralia-1.onrender.com/api/admin/profile';

  user: any = null;
  adminName = '';
  adminEmail = '';
  adminAvatar = '';

  // Password change
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  show = { cur: false, new_: false, cf: false };
  wrongCurrent = false;

  // Security settings
  twoFactorEnabled = false;
  sessionTimeout = 480;
  loginNotification = true;

  // UI state
  activeTab: 'info' | 'password' | 'security' = 'info';
  avatarError = '';
  profileMsg = signal<{ type: 'ok' | 'err'; text: string }>({ type: 'ok', text: '' });
  passMsg = signal<{ type: 'ok' | 'err'; text: string }>({ type: 'ok', text: '' });
  securityMsg = signal<{ type: 'ok' | 'err'; text: string }>({ type: 'ok', text: '' });
  logoutConfirmVisible = false;
  notificationsOpen = false;

  readonly passwordPattern = '^(?=.*[A-Za-z])(?=.*\\d).{8,}$';

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    const raw = localStorage.getItem('adminUser') || sessionStorage.getItem('adminUser');
    const token = this.token;
    if (!raw || !token) {
      this.router.navigate(['/admin-login']);
      return;
    }
    try {
      const u = JSON.parse(raw);
      this.fillLocal(u);
    } catch {
      this.router.navigate(['/admin-login']);
      return;
    }
    this.loadProfile();
  }

  /* ========== GETTERS ========== */
  get token(): string {
    return localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken') || '';
  }

  get headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.token}` });
  }

  get initial(): string {
    const parts = (this.adminName || '?').trim().split(/\s+/);
    return parts[0].charAt(0).toUpperCase();
  }

  get mismatch(): boolean { return this.confirmPassword !== this.newPassword; }
  get samePassword(): boolean { return !!this.newPassword && this.newPassword === this.currentPassword; }

  confirmInvalid(ctrl: NgControl, form: NgForm): boolean {
    return (!!ctrl.touched || form.submitted) && (!this.confirmPassword || this.mismatch);
  }

  /* ========== LOAD ========== */
  private fillLocal(u: any): void {
    this.user = u;
    this.adminName = u.fullName || 'Admin Floralia';
    this.adminEmail = u.email || '';
    this.adminAvatar = u.avatar || '';
  }

  loadProfile(): void {
    this.http.get<any>(this.API, { headers: this.headers }).subscribe({
      next: (res) => {
        if (res.success) {
          this.ngZone.run(() => {
            this.fillLocal(res.user);
            this.syncStorage(res.user);
            // Khôi phục cài đặt bảo mật nếu có
            if (res.user.security) {
              this.twoFactorEnabled = !!res.user.security.twoFactorEnabled;
              this.sessionTimeout = res.user.security.sessionTimeout || 480;
              this.loginNotification = res.user.security.loginNotification !== false;
            }
            this.cdr.detectChanges();
          });
        }
      },
      error: (err) => { if (err.status === 401 || err.status === 403) this.logout(); }
    });
  }

  private syncStorage(u: any): void {
    const store = localStorage.getItem('adminUser') ? localStorage : sessionStorage;
    store.setItem('adminUser', JSON.stringify(u));
  }

  /* ========== AVATAR ========== */
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
      this.ngZone.run(() => {
        this.adminAvatar = dataUrl;
        this.cdr.detectChanges();
      });

      const img = new Image();
      img.onload = () => {
        const size = 256;
        const side = Math.min(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          this.ngZone.run(() => {
            this.adminAvatar = compressed;
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
    this.adminAvatar = '';
    this.cdr.detectChanges();
  }

  /* ========== UPDATE PROFILE ========== */
  updateProfile(form: NgForm): void {
    this.profileMsg.set({ type: 'ok', text: '' });
    if (form.invalid) { form.form.markAllAsTouched(); return; }

    // Optimistic update
    const updated = { ...this.user, fullName: this.adminName.trim(), avatar: this.adminAvatar };
    this.fillLocal(updated);
    this.syncStorage(updated);
    this.profileMsg.set({ type: 'ok', text: 'Cập nhật thông tin thành công!' });
    this.cdr.detectChanges();

    this.http.put<any>(this.API, {
      fullName: this.adminName.trim(),
      avatar: this.adminAvatar,
    }, { headers: this.headers }).subscribe({
      next: (res) => {
        if (res.success) {
          this.ngZone.run(() => {
            this.fillLocal(res.user);
            this.syncStorage(res.user);
            this.cdr.detectChanges();
          });
        }
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.flash('profileMsg', 'err', err.error?.message || 'Không thể lưu. Vui lòng thử lại.');
          this.cdr.detectChanges();
        });
      }
    });

    setTimeout(() => {
      this.profileMsg.set({ type: 'ok', text: '' });
      this.cdr.detectChanges();
    }, 5000);
  }

  /* ========== CHANGE PASSWORD ========== */
  changePassword(form: NgForm): void {
    this.passMsg.set({ type: 'ok', text: '' });
    this.wrongCurrent = false;
    if (form.invalid || this.mismatch || this.samePassword) { form.form.markAllAsTouched(); return; }

    this.http.put<any>(`${this.API}/password`, {
      currentPassword: this.currentPassword,
      newPassword: this.newPassword,
    }, { headers: this.headers }).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.currentPassword = '';
          this.newPassword = '';
          this.confirmPassword = '';
          form.resetForm();
          this.show = { cur: false, new_: false, cf: false };
          this.flash('passMsg', 'ok', res.message || 'Đổi mật khẩu thành công!');
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          if (err.status === 400 && err.error?.field === 'currentPassword') {
            this.wrongCurrent = true;
            this.flash('passMsg', 'err', 'Mật khẩu hiện tại không chính xác.');
          } else {
            this.flash('passMsg', 'err', err.error?.message || 'Không thể đổi mật khẩu. Vui lòng thử lại.');
          }
          this.cdr.detectChanges();
        });
      }
    });
  }

  /* ========== SECURITY ========== */
  updateSecurity(): void {
    this.securityMsg.set({ type: 'ok', text: '' });
    this.http.put<any>(`${this.API}/security`, {
      twoFactorEnabled: this.twoFactorEnabled,
      sessionTimeout: this.sessionTimeout,
      loginNotification: this.loginNotification,
    }, { headers: this.headers }).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.flash('securityMsg', 'ok', res.message || 'Cập nhật bảo mật thành công!');
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.flash('securityMsg', 'err', err.error?.message || 'Không thể cập nhật. Vui lòng thử lại.');
          this.cdr.detectChanges();
        });
      }
    });
  }

  /* ========== FLASH ========== */
  private flash(target: 'profileMsg' | 'passMsg' | 'securityMsg', type: 'ok' | 'err', text: string): void {
    this[target].set({ type, text });
    this.cdr.detectChanges();
    if (type === 'ok') {
      setTimeout(() => { this[target].set({ type: 'ok', text: '' }); this.cdr.detectChanges(); }, 5000);
    }
  }

  /* ========== LOGOUT ========== */
  requestLogoutConfirmation(): void { this.logoutConfirmVisible = true; }
  cancelLogout(): void { this.logoutConfirmVisible = false; }

  confirmLogout(): void {
    ['adminToken', 'adminUser', 'adminAuthSource'].forEach(k => {
      localStorage.removeItem(k); sessionStorage.removeItem(k);
    });
    this.router.navigate(['/admin-login']);
  }

  logout(e?: Event): void {
    e?.preventDefault();
    this.confirmLogout();
  }

  get unreadNotificationsCount(): number { return 0; }
  toggleNotifications(): void { this.notificationsOpen = !this.notificationsOpen; }
}

