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
    const configuredOrigin = (window as Window & { FLORALIA_API_ORIGIN?: string }).FLORALIA_API_ORIGIN?.trim();
    const apiOrigin = configuredOrigin || `${window.location.protocol}//${window.location.hostname}:3002`;
    const apiRequest = request.url.startsWith('https://floralia-1.onrender.com') || request.url.startsWith('http://127.0.0.1:3002')
      ? request.clone({ url: request.url.replace(/^http:\/\/(?:localhost|127\.0\.0\.1):3002/, apiOrigin) })
      : request;
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const authenticatedRequest = token && !isLoginRequest && apiRequest.url.startsWith(apiOrigin)
      ? apiRequest.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : apiRequest;

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

