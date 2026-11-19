import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { FormControl, NgForm, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { AdminLogin } from './admin-login';

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

describe('AdminLogin', () => {
  let component: AdminLogin;
  let httpTestingController: HttpTestingController;

  beforeEach(async () => {
    const localStorageMock = createStorage();
    const sessionStorageMock = createStorage();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorageMock });
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: sessionStorageMock });
    Object.defineProperty(window, 'localStorage', { configurable: true, value: localStorageMock });
    Object.defineProperty(window, 'sessionStorage', { configurable: true, value: sessionStorageMock });
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [provideRouter([{ path: 'orders', children: [] }, { path: 'articles', children: [] }])],
    }).compileComponents();
    component = new AdminLogin(TestBed.inject(HttpClient), TestBed.inject(Router));
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTestingController.verify());

  function createForm(email: string, password: string): NgForm {
    const form = new NgForm([], []);
    form.form.addControl('email', new FormControl(email, [
      Validators.required,
      Validators.pattern(component.emailPattern),
    ]));
    form.form.addControl('password', new FormControl(password, [
      Validators.required,
      Validators.minLength(8),
    ]));
    return form;
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('toggles password visibility', () => {
    component.togglePassword();
    expect(component.showPassword).toBe(true);
    component.togglePassword();
    expect(component.showPassword).toBe(false);
  });

  it('marks invalid fields and does not submit invalid credentials', () => {
    component.email = 'not-an-email';
    component.password = 'short';
    const form = createForm(component.email, component.password);
    component.login(form);

    expect(form.invalid).toBe(true);
    expect(form.form.controls['email'].touched).toBe(true);
    expect(form.form.controls['password'].touched).toBe(true);
    httpTestingController.expectNone('https://floralia-1.onrender.com/api/auth/login');
  });

  it('accepts administrator credentials and stores the session', () => {
    component.email = 'admin@floralia.vn';
    component.password = 'secure-password';
    component.login(createForm(component.email, component.password));

    const request = httpTestingController.expectOne('https://floralia-1.onrender.com/api/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: 'admin@floralia.vn',
      password: 'secure-password',
    });
    request.flush({
      success: true,
      token: 'admin-token',
      user: { id: 'admin-1', fullName: 'Admin Floralia', email: 'admin@floralia.vn', role: 'admin' },
    });

    expect(sessionStorage.getItem('adminToken')).toBe('admin-token');
    expect(component.successMessage()).toContain('Admin Floralia');
    expect(component.isSubmitting()).toBe(false);
  });

  it('rejects authenticated non-administrator accounts', () => {
    component.email = 'user@floralia.vn';
    component.password = 'secure-password';
    component.login(createForm(component.email, component.password));
    httpTestingController.expectOne('https://floralia-1.onrender.com/api/auth/login').flush({
      success: true,
      token: 'user-token',
      user: { id: 'user-1', email: 'user@floralia.vn', role: 'user' },
    });

    expect(localStorage.getItem('adminToken')).toBeNull();
    expect(sessionStorage.getItem('adminToken')).toBeNull();
    expect(component.errorMessage()).toContain('không có quyền');
    expect(component.isSubmitting()).toBe(false);
  });

  it('clears the submitting state when the login request fails', () => {
    component.email = 'admin@floralia.vn';
    component.password = 'secure-password';
    component.login(createForm(component.email, component.password));

    expect(component.isSubmitting()).toBe(true);
    httpTestingController.expectOne('https://floralia-1.onrender.com/api/auth/login')
      .error(new ProgressEvent('error'));

    expect(component.isSubmitting()).toBe(false);
    expect(component.errorMessage()).toContain('Không thể kết nối');
  });
});

