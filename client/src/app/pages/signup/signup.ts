import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { NgControl, NgForm } from '@angular/forms';

@Component({
  selector: 'app-signup',
  standalone: false,
  templateUrl: './signup.html',
  styleUrl: './signup.css'
})
export class Signup {
  fullName = '';
  email = '';
  phone = '';
  password = '';
  confirmPassword = '';

  showPassword = false;
  showConfirm = false;
  emailTaken = false;
  notice = '';

  // Họ tên: không chứa số/ký tự đặc biệt và không toàn khoảng trắng.
  readonly namePattern = '^(?=.*\\S)[^\\d!@#$%^&*()_+=\\[\\]{};:"\\\\|<>?/~]+$';
  // Email: có tên, @, tên miền và đuôi tối thiểu 2 ký tự.
  readonly emailPattern = '^\\s*[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}\\s*$';
  // SĐT Việt Nam: 0xxxxxxxxx hoặc +84xxxxxxxxx (đầu số 3, 5, 7, 8, 9).
  readonly phonePattern = '^(0|\\+84)(3|5|7|8|9)\\d{8}$';
  // Mật khẩu: tối thiểu 8 ký tự, có cả chữ và số.
  readonly passwordPattern = '^(?=.*[A-Za-z])(?=.*\\d).{8,}$';

  private readonly API_URL = 'http://localhost:3002/api/auth/signup';

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  // Xác nhận mật khẩu không trùng với mật khẩu.
  get mismatch(): boolean {
    return this.confirmPassword !== this.password;
  }

  // Hiện lỗi ô xác nhận: để trống hoặc không khớp (sau khi rời ô / bấm Đăng ký).
  confirmInvalid(ctrl: NgControl, form: NgForm): boolean {
    return (!!ctrl.touched || form.submitted) && (!this.confirmPassword || this.mismatch);
  }

  signup(form: NgForm): void {
    if (form.invalid || this.mismatch) {
      form.form.markAllAsTouched();
      return;
    }

    this.http.post<any>(this.API_URL, {
      fullName: this.fullName.trim().replace(/\s+/g, ' '),
      email: this.email.trim().toLowerCase(),
      phone: this.phone.trim(),
      password: this.password
    }).subscribe({
      next: (result) => {
        if (result.success) {
          alert('Đăng ký thành công!');
          this.router.navigate(['/login']);
        } else {
          alert(result.message || 'Đăng ký thất bại!');
        }
      },
      error: (error) => {
        if (error.status === 409) {
          alert(error.error?.message || 'Email này đã được đăng ký!');
        } else if (error.status === 0) {
          alert('Không thể kết nối đến máy chủ!');
        } else {
          alert(error.error?.message || 'Đăng ký thất bại. Vui lòng thử lại!');
        }

        console.error('Lỗi đăng ký:', error);
      }
    });
  }

  socialLogin(provider: 'google' | 'facebook'): void {
    this.notice = `Đăng ký bằng ${provider === 'google' ? 'Google' : 'Facebook'} sẽ sớm được hỗ trợ.`;
  }
  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}