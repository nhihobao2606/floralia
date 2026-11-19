import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import { getAuthReturnUrl } from '../../classes/auth-return-url';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login implements OnInit {
  identifier = '';
  password = '';

  showPassword = false;
  rememberMe = false;
  errorMessage = '';
  notice = '';
  identifierError = '';
  showPhoneLoginHint = false;


  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.notice = sessionStorage.getItem('blockedAccountNotice') || '';
    sessionStorage.removeItem('blockedAccountNotice');
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  login(form: NgForm): void {
    this.errorMessage = '';
    this.identifierError = '';
    this.showPhoneLoginHint = false;
    this.notice = '';

    // Chỉ đăng nhập khi cả hai ô đều hợp lệ.
    if (form.invalid) {
      form.form.markAllAsTouched();
      return;
    }

    const identifier = this.identifier.trim();
    this.http.post<any>('https://floralia-1.onrender.com/api/auth/login', {
      identifier,
      // Keep compatibility with API instances that still expect email instead of identifier.
      email: identifier.includes('@') ? identifier : undefined,
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

          // Báo hiệu cập nhật người dùng và giỏ hàng ngay lập tức trên giao diện
          window.dispatchEvent(new Event('auth-changed'));
          window.dispatchEvent(new Event('cart-updated'));
          alert('Đăng nhập thành công!');
          this.navigateAfterLogin();
        } else {
          this.errorMessage = result.message || 'Th\u00f4ng tin \u0111\u0103ng nh\u1eadp kh\u00f4ng ch\u00ednh x\u00e1c.';
        }
      },
      error: (error) => {
        if (error.status === 0) {
          this.errorMessage = 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
        } else if (error.status === 404 && error.error?.code === 'EMAIL_NOT_REGISTERED') {
          this.identifierError = 'Email chưa được đăng ký.';
          this.showPhoneLoginHint = true;
        } else {
          this.errorMessage = error.error?.message || 'Đăng nhập thất bại. Vui lòng thử lại.';
        }
        if (this.errorMessage) alert(this.errorMessage);
        console.error('Lỗi đăng nhập:', error);
      }
    });
  }

  clearIdentifierError(): void {
    this.identifierError = '';
    this.showPhoneLoginHint = false;
  }

  private navigateAfterLogin(): void {
    const returnUrl = getAuthReturnUrl(this.route, this.router);
    void this.router.navigateByUrl(returnUrl || '/');
  }

  // Đăng nhập bằng mạng xã hội (chưa nối API).
  socialLogin(provider: 'google' | 'facebook'): void {
    this.errorMessage = '';
    this.notice = `Đăng nhập bằng ${provider === 'google' ? 'Google' : 'Facebook'} sẽ sớm được hỗ trợ.`;
  }

  goToSignup(): void {
    const returnUrl = getAuthReturnUrl(this.route, this.router);
    void this.router.navigate(['/signup'], {
      queryParams: returnUrl ? { returnUrl } : undefined,
    });
  }

  forgotPassword(): void {
    this.errorMessage = '';
    this.notice = '';
    void this.router.navigate(['/forgot-password']);
  }
}

