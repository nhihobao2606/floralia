import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { NgControl, NgForm } from '@angular/forms';
import { Subscription, timeout } from 'rxjs';
import { getAuthReturnUrl } from '../../classes/auth-return-url';

@Component({
  selector: 'app-signup',
  standalone: false,
  templateUrl: './signup.html',
  styleUrl: './signup.css'
})
export class Signup implements OnDestroy {
  fullName = '';
  email = '';
  phone = '';
  password = '';
  confirmPassword = '';

  showPassword = false;
  showConfirm = false;
  emailTaken = false;
  emailAvailable = false;
  emailChecking = false;
  emailCheckError = '';
  phoneTaken = false;
  termsAccepted = false;
  notice = '';
  otpStep = false;
  demoOtp = '';
  enteredOtp = '';
  otpError = '';
  isCheckingAvailability = false;
  isCreatingAccount = false;
  private otpExpiresAt = 0;
  private emailCheckTimer: ReturnType<typeof setTimeout> | null = null;
  private phoneCheckTimer: ReturnType<typeof setTimeout> | null = null;
  private emailCheckSubscription: Subscription | null = null;
  private availabilityCheckSubscription: Subscription | null = null;
  private checkedPhone = '';
  private phoneCheckInFlight = '';
  private phoneCheckVersion = 0;
  private continueToOtpAfterPhoneCheck = false;
  private emailCheckVersion = 0;
  private checkingEmail = '';
  private lastCheckedEmail = '';

  // Họ tên: không chứa số/ký tự đặc biệt và không toàn khoảng trắng.
  readonly namePattern = '^(?=.*\\S)[^\\d!@#$%^&*()_+=\\[\\]{};:"\\\\|<>?/~]+$';
  // Email: có tên, @, tên miền và đuôi tối thiểu 2 ký tự.
  readonly emailPattern = '^\\s*[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}\\s*$';
  // SĐT Việt Nam: 10 chữ số, bắt đầu bằng 0.
  readonly phonePattern = '^0(3|5|7|8|9)\\d{8}$';
  // Mật khẩu: tối thiểu 8 ký tự, có cả chữ và số.
  readonly passwordPattern = '^(?=.*[A-Za-z])(?=.*\\d).{8,}$';

  private readonly API_URL = 'http://localhost:3002/api/auth/signup';

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnDestroy(): void {
    this.cancelEmailCheck();
    if (this.phoneCheckTimer !== null) clearTimeout(this.phoneCheckTimer);
    this.availabilityCheckSubscription?.unsubscribe();
  }

  onEmailChanged(): void {
    this.cancelEmailCheck();
    this.emailTaken = false;
    this.emailAvailable = false;
    this.emailCheckError = '';
    this.lastCheckedEmail = '';

    const email = this.email.trim().toLowerCase();
    if (!email || !new RegExp(this.emailPattern).test(email)) return;

    this.emailCheckTimer = setTimeout(() => {
      this.emailCheckTimer = null;
      this.checkEmailAvailability(email);
    }, 350);
  }

  onPhoneChanged(): void {
    if (this.phoneCheckTimer !== null) clearTimeout(this.phoneCheckTimer);
    this.phoneCheckTimer = null;
    this.phoneTaken = false;
    this.checkedPhone = '';
    this.isCheckingAvailability = false;
    this.continueToOtpAfterPhoneCheck = false;
    this.phoneCheckVersion++;
    this.availabilityCheckSubscription?.unsubscribe();
    this.availabilityCheckSubscription = null;
    this.phoneCheckInFlight = '';

    const phone = this.phone.trim();
    if (new RegExp(this.phonePattern).test(phone)) {
      this.phoneCheckTimer = setTimeout(() => {
        this.phoneCheckTimer = null;
        this.checkPhoneAvailabilityOnBlur();
      }, 250);
    }
  }

  checkPhoneAvailabilityOnBlur(): void {
    if (this.phoneCheckTimer !== null) clearTimeout(this.phoneCheckTimer);
    this.phoneCheckTimer = null;
    const phone = this.phone.trim();
    if (!new RegExp(this.phonePattern).test(phone) || this.checkedPhone === phone || this.phoneCheckInFlight === phone) return;
    this.startPhoneAvailabilityCheck(phone, false);
  }

  checkEmailAvailabilityNow(): void {
    const email = this.email.trim().toLowerCase();
    if (!email || !new RegExp(this.emailPattern).test(email) ||
        this.lastCheckedEmail === email || this.checkingEmail === email) {
      return;
    }

    this.cancelEmailCheck();
    this.checkEmailAvailability(email);
  }

  private checkEmailAvailability(email: string): void {
    const version = ++this.emailCheckVersion;
    this.emailChecking = true;
    this.checkingEmail = email;
    this.emailCheckError = '';
    this.emailCheckSubscription = this.http.post<any>(
      'http://localhost:3002/api/auth/check-availability',
      { email }
    ).pipe(timeout(5000)).subscribe({
      next: () => {
        if (version !== this.emailCheckVersion) return;
        this.emailChecking = false;
        this.checkingEmail = '';
        this.emailAvailable = true;
        this.lastCheckedEmail = email;
      },
      error: error => {
        if (version !== this.emailCheckVersion) return;
        this.emailChecking = false;
        this.checkingEmail = '';
        if (error.status === 409 && error.error?.field === 'email') {
          this.emailTaken = true;
          this.emailAvailable = false;
          this.lastCheckedEmail = email;
          return;
        }
        this.emailCheckError = error.error?.message ||
          (error.name === 'TimeoutError'
            ? 'Máy chủ phản hồi chậm khi kiểm tra email. Vui lòng thử lại.'
            : 'Chưa thể kiểm tra email lúc này. Hệ thống sẽ kiểm tra lại khi bạn tiếp tục.');
      }
    });
  }

  private cancelEmailCheck(): void {
    if (this.emailCheckTimer !== null) {
      clearTimeout(this.emailCheckTimer);
      this.emailCheckTimer = null;
    }
    this.emailCheckVersion++;
    this.emailCheckSubscription?.unsubscribe();
    this.emailCheckSubscription = null;
    this.emailChecking = false;
    this.checkingEmail = '';
  }

  // Xác nhận mật khẩu không trùng với mật khẩu.
  get mismatch(): boolean {
    return this.confirmPassword !== this.password;
  }

  // Hiện lỗi ô xác nhận: để trống hoặc không khớp (sau khi rời ô / bấm Đăng ký).
  confirmInvalid(ctrl: NgControl, form: NgForm): boolean {
    return (!!ctrl.touched || form.submitted) && (!this.confirmPassword || this.mismatch);
  }

  signup(form: NgForm): void {
    if (form.invalid || this.mismatch || this.isCheckingAvailability) {
      form.form.markAllAsTouched();
      return;
    }
    if (this.emailTaken) return;
    if (this.phoneTaken && this.checkedPhone === this.phone.trim()) {
      alert('Số điện thoại này đã được đăng ký.');
      return;
    }

    const phone = this.phone.trim();
    if (this.checkedPhone === phone) {
      this.openOtpStep();
      return;
    }
    this.isCheckingAvailability = true;
    if (this.phoneCheckInFlight === phone) {
      this.continueToOtpAfterPhoneCheck = true;
      return;
    }
    this.startPhoneAvailabilityCheck(phone, true);
  }

  private startPhoneAvailabilityCheck(phone: string, continueToOtp: boolean): void {
    this.availabilityCheckSubscription?.unsubscribe();
    const version = ++this.phoneCheckVersion;
    this.phoneCheckInFlight = phone;
    this.continueToOtpAfterPhoneCheck = continueToOtp;
    this.availabilityCheckSubscription = this.http.post<any>('http://localhost:3002/api/auth/check-availability', {
      phone
    }).pipe(timeout(5000)).subscribe({
      next: () => {
        if (version !== this.phoneCheckVersion) return;
        this.phoneCheckInFlight = '';
        this.checkedPhone = phone;
        this.phoneTaken = false;
        this.isCheckingAvailability = false;
        if (this.continueToOtpAfterPhoneCheck) this.openOtpStep();
        this.continueToOtpAfterPhoneCheck = false;
      },
      error: error => {
        if (version !== this.phoneCheckVersion) return;
        this.phoneCheckInFlight = '';
        this.isCheckingAvailability = false;
        if (error.status === 409 && error.error?.field === 'phone') {
          this.checkedPhone = phone;
          this.phoneTaken = true;
          if (this.continueToOtpAfterPhoneCheck) this.showAlertAfterRender('Số điện thoại này đã được đăng ký.');
          this.continueToOtpAfterPhoneCheck = false;
          return;
        }
        const shouldAlert = this.continueToOtpAfterPhoneCheck;
        this.continueToOtpAfterPhoneCheck = false;
        const message = error.name === 'TimeoutError'
          ? 'Máy chủ phản hồi chậm. Vui lòng thử lại.'
          : error.error?.message || 'Không thể kiểm tra thông tin đăng ký. Vui lòng thử lại.';
        if (shouldAlert) this.showAlertAfterRender(message);
      }
    });
  }

  private openOtpStep(): void {
    this.isCheckingAvailability = false;
    this.issueDemoOtp();
    setTimeout(() => document.getElementById('signupOtp')?.focus(), 0);
  }

  verifyOtp(form: NgForm): void {
    this.otpError = '';
    if (form.invalid) {
      form.form.markAllAsTouched();
      return;
    }
    if (Date.now() > this.otpExpiresAt) {
      this.otpError = 'Mã xác thực đã hết hạn. Vui lòng tạo mã mới.';
      return;
    }
    if (this.enteredOtp.trim() !== this.demoOtp) {
      this.otpError = 'Mã xác thực chưa chính xác. Vui lòng kiểm tra lại.';
      return;
    }

    this.createAccount();
  }

  resendDemoOtp(): void {
    this.enteredOtp = '';
    this.otpError = '';
    this.issueDemoOtp();
  }

  private issueDemoOtp(): void {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    this.demoOtp = String(values[0] % 1_000_000).padStart(6, '0');
    this.otpExpiresAt = Date.now() + 5 * 60 * 1000;
    this.enteredOtp = '';
    this.otpError = '';
    this.otpStep = true;
  }

  private createAccount(): void {
    if (this.isCreatingAccount) return;
    this.availabilityCheckSubscription?.unsubscribe();
    this.availabilityCheckSubscription = null;
    this.isCheckingAvailability = false;
    this.isCreatingAccount = true;
    this.http.post<any>(this.API_URL, {
      fullName: this.fullName.trim().replace(/\s+/g, ' '),
      email: this.email.trim().toLowerCase(),
      phone: this.phone.trim(),
      password: this.password,
      termsAccepted: this.termsAccepted
    }).subscribe({
      next: (result) => {
        this.isCreatingAccount = false;
        if (result.success) {
          this.loginAfterSignup();
        } else {
          alert(result.message || 'Đăng ký thất bại!');
        }
      },
      error: (error) => {
        this.isCreatingAccount = false;
        if (error.status === 409) {
          this.otpStep = false;
          if (error.error?.field === 'email') {
            this.emailTaken = true;
            this.showAlertAfterRender('Email này đã được sử dụng cho tài khoản khác.');
          } else if (error.error?.field === 'phone') {
            this.phoneTaken = true;
            this.showAlertAfterRender('Số điện thoại này đã được đăng ký.');
          } else {
            const message = error.error?.message || 'Thông tin tài khoản đã được sử dụng.';
            this.showAlertAfterRender(message);
          }
        } else if (error.status === 0) {
          alert('Không thể kết nối đến máy chủ!');
        } else {
          alert(error.error?.message || 'Đăng ký thất bại. Vui lòng thử lại!');
        }

        console.error('Lỗi đăng ký:', error);
      }
    });
  }

  backToSignup(): void {
    if (this.isCreatingAccount) return;
    this.otpStep = false;
    this.otpError = '';
  }

  private showAlertAfterRender(message: string): void {
    this.cdr.detectChanges();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => alert(message));
    });
  }

  private loginAfterSignup(): void {
    const returnUrl = getAuthReturnUrl(this.route, this.router);
    this.http.post<any>('http://localhost:3002/api/auth/login', {
      identifier: this.phone.trim(),
      password: this.password,
    }).subscribe({
      next: (result) => {
        if (!result.success || !result.token || !result.user) {
          this.continueToLogin(returnUrl);
          return;
        }

        localStorage.removeItem('currentUser');
        localStorage.removeItem('token');
        sessionStorage.setItem('currentUser', JSON.stringify(result.user));
        sessionStorage.setItem('token', result.token);
        window.dispatchEvent(new Event('auth-changed'));
        window.dispatchEvent(new Event('cart-updated'));
        void this.router.navigateByUrl(returnUrl || '/account');
      },
      error: () => this.continueToLogin(returnUrl),
    });
  }

  private continueToLogin(returnUrl: string | null): void {
    alert('\u0054\u1ea1o t\u00e0i kho\u1ea3n th\u00e0nh c\u00f4ng. Vui l\u00f2ng \u0111\u0103ng nh\u1eadp \u0111\u1ec3 ti\u1ebfp t\u1ee5c.');
    void this.router.navigate(['/login'], {
      queryParams: returnUrl ? { returnUrl } : undefined,
    });
  }

  socialLogin(provider: 'google' | 'facebook'): void {
    this.notice = `Đăng ký bằng ${provider === 'google' ? 'Google' : 'Facebook'} sẽ sớm được hỗ trợ.`;
  }
  goToLogin(): void {
    const returnUrl = getAuthReturnUrl(this.route, this.router);
    void this.router.navigate(['/login'], {
      queryParams: returnUrl ? { returnUrl } : undefined,
    });
  }
}
