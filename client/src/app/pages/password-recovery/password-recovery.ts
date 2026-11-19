import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TimeoutError, finalize, timeout } from 'rxjs';

interface RecoveryResponse {
  success: boolean;
  message: string;
}

@Component({
  selector: 'app-password-recovery',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './password-recovery.html',
  styleUrl: './password-recovery.css',
})
export class PasswordRecovery implements OnInit {
  email = '';
  password = '';
  confirmPassword = '';
  token = '';
  isResetMode = false;
  isSubmitting = false;
  requestSent = false;
  resetComplete = false;
  showPassword = false;
  showConfirmPassword = false;
  errorMessage = '';
  successMessage = '';

  readonly emailPattern = '^\\s*[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}\\s*$';
  readonly passwordPattern = '^(?=.*[A-Za-z])(?=.*\\d).{8,}$';

  private readonly apiUrl = 'https://floralia-1.onrender.com/api/auth';

  constructor(
    private readonly http: HttpClient,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.isResetMode = this.router.url.split('?')[0] === '/reset-password';
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (this.isResetMode && !/^[a-f0-9]{64}$/i.test(this.token)) {
      this.errorMessage = 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.';
    }
  }

  get passwordsMismatch(): boolean {
    return this.confirmPassword !== this.password;
  }

  requestReset(form: NgForm): void {
    this.errorMessage = '';
    this.successMessage = '';
    if (form.invalid || this.isSubmitting) {
      form.form.markAllAsTouched();
      return;
    }

    this.requestSent = true;
    this.successMessage = 'Chức năng gửi liên kết đặt lại mật khẩu sẽ sớm được hoàn thiện.';
  }

  resetPassword(form: NgForm): void {
    this.errorMessage = '';
    this.successMessage = '';
    if (!this.token || form.invalid || this.passwordsMismatch || this.isSubmitting) {
      form.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.http.post<RecoveryResponse>(`${this.apiUrl}/reset-password`, {
      token: this.token,
      password: this.password,
    }).pipe(
      timeout({ first: 20_000 }),
      finalize(() => this.isSubmitting = false),
    ).subscribe({
      next: (result) => {
        this.resetComplete = true;
        this.successMessage = result.message;
      },
      error: (error: { name?: string; status?: number; error?: { message?: string } }) => {
        this.errorMessage = error instanceof TimeoutError
          ? 'Yêu cầu mất quá nhiều thời gian. Vui lòng thử lại.'
          : error.status === 0
            ? 'Không thể kết nối đến máy chủ. Vui lòng thử lại.'
            : error.error?.message || 'Không thể đặt lại mật khẩu. Vui lòng thử lại.';
      },
    });
  }

  goToLogin(): void {
    void this.router.navigate(['/login']);
  }
}

