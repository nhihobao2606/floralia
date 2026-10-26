import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

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

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  login(): void {
    this.errorMessage = '';

    if (!this.email.trim() || !this.password) {
      this.errorMessage = 'Vui lòng nhập đầy đủ email và mật khẩu.';
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
          const storage = this.rememberMe
            ? localStorage
            : sessionStorage;

          storage.setItem('currentUser', JSON.stringify(user));

          // Gộp giỏ hàng khách với giỏ hàng của người dùng
          const guestCart = JSON.parse(
            localStorage.getItem('cart_guest') || '[]'
          );

          if (guestCart.length > 0) {
            const userKey = `cart_user_${user.email || user.id}`;

            const userCart = JSON.parse(
              localStorage.getItem(userKey) || '[]'
            );

            guestCart.forEach((guestItem: any) => {
              const existingItem = userCart.find(
                (item: any) => item.id === guestItem.id
              );

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
          this.errorMessage =
            error.error?.message || 'Đăng nhập thất bại. Vui lòng thử lại.';
        }

        console.error('Lỗi đăng nhập:', error);
      }
    });
  }

  goToSignup(): void {
    this.router.navigate(['/signup']);
  }

  forgotPassword(): void {
    this.errorMessage = 'Chức năng quên mật khẩu hiện chưa được triển khai.';
  }
}