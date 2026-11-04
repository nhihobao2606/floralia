import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of } from 'rxjs';

export const adminAuthGuard: CanActivateFn = () => {
  const router = inject(Router);
  const http = inject(HttpClient);
  const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');

  if (token) {
    return true;
  }

  return http.post<{ success: boolean; token?: string; user?: { role?: string } }>(
    'http://localhost:3002/api/auth/login',
    { email: 'floraliatea@gmail.com', password: 'floralia123' }
  ).pipe(
    map((result) => {
      if (!result.success || !result.token || result.user?.role !== 'admin') {
        return router.createUrlTree(['/admin-login']);
      }

      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      sessionStorage.removeItem('adminToken');
      sessionStorage.removeItem('adminUser');
      sessionStorage.setItem('adminToken', result.token);
      sessionStorage.setItem('adminUser', JSON.stringify(result.user));
      return true;
    }),
    catchError(() => of(router.createUrlTree(['/admin-login']))),
  );
};
