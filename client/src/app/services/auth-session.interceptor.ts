import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, throwError } from 'rxjs';

@Injectable()
export class AuthSessionInterceptor implements HttpInterceptor {
  private redirectingForBlockedAccount = false;

  constructor(private readonly router: Router) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const isLoginRequest = request.url.includes('/api/auth/login') || request.url.includes('/api/auth/signup');
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const authenticatedRequest = token && !isLoginRequest && request.url.includes('localhost:3002')
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : request;

    return next.handle(authenticatedRequest).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 403 && error.error?.code === 'ACCOUNT_BLOCKED') {
          this.handleBlockedAccount(error.error.message);
        }
        return throwError(() => error);
      }),
    );
  }

  private handleBlockedAccount(message?: string): void {
    if (this.redirectingForBlockedAccount) return;
    this.redirectingForBlockedAccount = true;

    for (const storage of [localStorage, sessionStorage]) {
      storage.removeItem('currentUser');
      storage.removeItem('token');
    }
    sessionStorage.setItem('blockedAccountNotice', message || 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.');
    window.dispatchEvent(new Event('auth-changed'));
    void this.router.navigate(['/login']).finally(() => {
      this.redirectingForBlockedAccount = false;
    });
  }
}
