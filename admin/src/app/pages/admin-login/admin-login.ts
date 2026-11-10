import { HttpClient } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

export interface AdminLoginResponse {
  success: boolean;
  token?: string;
  message?: string;
  user?: {
    id?: string;
    fullName?: string;
    email?: string;
    role?: string;
  };
}

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-login.html',
})
export class AdminLogin {
  email = '';
  password = '';
  rememberMe = false;
  showPassword = false;
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly emailPattern = '^\\s*[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}\\s*$';

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
  ) {}

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  updateRememberMe(event: Event): void {
    const input = event.currentTarget;
    if (input instanceof HTMLInputElement) {
      this.rememberMe = input.checked;
    }
  }

  login(form: NgForm): void {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (this.isSubmitting()) return;
    if (form.invalid) {
      form.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.http.post<AdminLoginResponse>('http://localhost:3002/api/auth/login', {
      email: this.email.trim(),
      password: this.password,
    }).pipe(
      finalize(() => this.isSubmitting.set(false)),
    ).subscribe({
      next: (result) => {
        if (!result.success || !result.user || !result.token) {
          this.errorMessage.set(result.message || 'Không thể xác thực tài khoản. Vui lòng thử lại.');
          return;
        }

        if (result.user.role !== 'admin') {
          this.errorMessage.set('Tài khoản này không có quyền truy cập khu vực quản trị.');
          return;
        }

        const storage = this.rememberMe ? localStorage : sessionStorage;
        localStorage.removeItem('adminUser');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminAuthSource');
        sessionStorage.removeItem('adminUser');
        sessionStorage.removeItem('adminToken');
        sessionStorage.removeItem('adminAuthSource');
        storage.setItem('adminUser', JSON.stringify(result.user));
        storage.setItem('adminToken', result.token);
        storage.setItem('adminAuthSource', 'interactive-login-v1');
        this.successMessage.set(`Xác thực thành công. Xin chào ${result.user.fullName || 'Quản trị viên'}!`);
        void this.router.navigate(['/overview']);
      },
      error: (error: { status?: number; error?: { message?: string } }) => {
        this.errorMessage.set(error.status === 0
          ? 'Không thể kết nối đến máy chủ. Vui lòng thử lại.'
          : error.error?.message || 'Email hoặc mật khẩu không chính xác.');
      },
    });
  }
}
