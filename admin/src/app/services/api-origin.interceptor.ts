import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable()
export class ApiOriginInterceptor implements HttpInterceptor {
  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const configuredOrigin = (window as Window & { FLORALIA_API_ORIGIN?: string }).FLORALIA_API_ORIGIN?.trim();
    const apiOrigin = configuredOrigin || `${window.location.protocol}//${window.location.hostname}:3002`;
    const url = request.url.replace(/^http:\/\/(?:localhost|127\.0\.0\.1):3002/, apiOrigin);

    return next.handle(url === request.url ? request : request.clone({ url }));
  }
}
