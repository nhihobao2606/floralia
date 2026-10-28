import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { NgForm } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  email = '';
  password = '';

  showPassword = false;
  rememberMe = false;
  loading = false;
  errorMessage = '';
  notice = '';

  // Email hợp lệ: có phần tên, ký tự @, tên miền và đuôi tối thiểu 2 ký tự (vd: ten@gmail.com).
  readonly emailPattern = '^\\s*[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}\\s*$';

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  login(form: NgForm): void {
    this.errorMessage = '';
    this.notice = '';

    // Chỉ đăng nhập khi cả hai ô đều hợp lệ; ngược lại hiện lỗi inline ở từng ô.
    if (form.invalid) {
      form.form.markAllAsTouched();
      return;
    }

    this.loading = true;

    this.http.post<any>('http://localhost:3002/api/auth/login', {
      email: this.email.trim(),
      password: this.password
    }).subscribe({
      next: (result) => {
        this.loading = false;

        if (result.success) {
          const user = result.user;

          // Lưu thông tin người dùng sau khi đăng nhập
          const storage = this.rememberMe ? localStorage : sessionStorage;
          storage.setItem('currentUser', JSON.stringify(user));

          // Gộp giỏ hàng khách với giỏ hàng của người dùng
          const guestCart = JSON.parse(localStorage.getItem('cart_guest') || '[]');

          if (guestCart.length > 0) {
            const userKey = `cart_user_${user.email || user.id}`;
            const userCart = JSON.parse(localStorage.getItem(userKey) || '[]');

            guestCart.forEach((guestItem: any) => {
              const existingItem = userCart.find((item: any) => item.id === guestItem.id);

              if (existingItem) {
                existingItem.quantity += guestItem.quantity;
              } else {
                userCart.push(guestItem);
              }
            });

            localStorage.setItem(userKey, JSON.stringify(userCart));
            localStorage.removeItem('cart_guest');
          }

          alert('Đăng nhập thành công!');
          this.router.navigate(['/']);
        } else {
          this.errorMessage = result.message || 'Email hoặc mật khẩu không chính xác.';
        }
      },
      error: (error) => {
        this.loading = false;

        if (error.status === 0) {
          this.errorMessage = 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
        } else {
          this.errorMessage = error.error?.message || 'Đăng nhập thất bại. Vui lòng thử lại.';
        }

        console.error('Lỗi đăng nhập:', error);
      }
    });
  }

  // Đăng nhập bằng mạng xã hội (chưa nối API).
  socialLogin(provider: 'google' | 'facebook'): void {
    this.errorMessage = '';
    this.notice = `Đăng nhập bằng ${provider === 'google' ? 'Google' : 'Facebook'} sẽ sớm được hỗ trợ.`;
  }

  goToSignup(): void {
    this.router.navigate(['/signup']);
  }

  forgotPassword(): void {
    this.errorMessage = '';
    this.notice = 'Chức năng quên mật khẩu hiện chưa được triển khai.';
  }
}