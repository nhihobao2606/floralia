import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { NgForm } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { PasswordRecovery } from './password-recovery';

describe('PasswordRecovery', () => {
  let fixture: ComponentFixture<PasswordRecovery>;
  let component: PasswordRecovery;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule, PasswordRecovery],
    }).compileComponents();

    fixture = TestBed.createComponent(PasswordRecovery);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('creates the recovery page', () => {
    expect(component).toBeTruthy();
  });

  it('shows a generic confirmation after requesting a reset link', () => {
    component.email = 'customer@example.com';
    const form = {
      invalid: false,
      form: { markAllAsTouched: vi.fn() },
    } as unknown as NgForm;

    component.requestReset(form);

    const request = http.expectOne('https://floralia-1.onrender.com/api/auth/forgot-password');
    expect(request.request.body).toEqual({ email: 'customer@example.com' });
    request.flush({
      success: true,
      message: 'Nếu email này đã đăng ký, hướng dẫn đặt lại mật khẩu sẽ được gửi đến hộp thư của bạn.',
    });

    expect(component.requestSent).toBe(true);
    expect(component.successMessage).toContain('Nếu email này đã đăng ký');
    expect(component.isSubmitting).toBe(false);
  });

  it('clears the loading state and shows an error when the request fails', () => {
    component.email = 'customer@example.com';
    const form = {
      invalid: false,
      form: { markAllAsTouched: vi.fn() },
    } as unknown as NgForm;

    component.requestReset(form);
    http.expectOne('https://floralia-1.onrender.com/api/auth/forgot-password').flush(
      { message: 'Chưa thể gửi email đặt lại mật khẩu.' },
      { status: 503, statusText: 'Service Unavailable' },
    );

    expect(component.isSubmitting).toBe(false);
    expect(component.errorMessage).toBe('Chưa thể gửi email đặt lại mật khẩu.');
  });
});

