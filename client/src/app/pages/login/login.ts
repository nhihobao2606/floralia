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
  errorMessage = '';
  notice = '';

  // Email hợp lệ: có phần tên, ký tự @, tên miền và đuôi tối thiểu 2 ký tự.
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

    // Chỉ đăng nhập khi cả hai ô đều hợp lệ.
    if (form.invalid) {
      form.form.markAllAsTouched();
      return;
    }

    this.http.post<any>('http://localhost:3002/api/auth/login', {
      email: this.email.trim(),
      password: this.password
    }).subscribe({
      next: (result) => {
        if (result.success) {
          const user = result.user;

          // Lưu thông tin người dùng sau khi đăng nhập.
          const storage = this.rememberMe ? localStorage : sessionStorage;

          // Xóa dữ liệu đăng nhập cũ ở cả hai nơi.
          localStorage.removeItem('currentUser');
          localStorage.removeItem('token');
          sessionStorage.removeItem('currentUser');
          sessionStorage.removeItem('token');

          // Lưu thông tin người dùng và token đăng nhập.
          storage.setItem('currentUser', JSON.stringify(user));
          
          storage.setItem('token', result.token);

          // Gộp giỏ hàng khách với giỏ hàng của người dùng.
          const guestCart = JSON.parse(localStorage.getItem('cart_guest') || '[]');

          if (guestCart.length > 0) {
            const userKey = `cart_user_${user.email || user.id}`;
            const userCart = JSON.parse(localStorage.getItem(userKey) || '[]');

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

          // Báo hiệu cập nhật người dùng và giỏ hàng ngay lập tức trên giao diện
          window.dispatchEvent(new Event('auth-changed'));
          window.dispatchEvent(new Event('cart-updated'));

          alert('Đăng nhập thành công!');
          this.router.navigate(['/']);
        } else {
          this.errorMessage = result.message || 'Email hoặc mật khẩu không chính xác.';
        }
      },
      error: (error) => {
        if (error.status === 0) {
          this.errorMessage = 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
        } else {
          this.errorMessage = error.error?.message || 'Đăng nhập thất bại. Vui lòng thử lại.';
        }
        alert(this.errorMessage);
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
