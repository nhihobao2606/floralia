import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, map, of } from 'rxjs';

const ADMIN_AUTH_MARKER = 'interactive-login-v1';

function clearAdminSession(): void {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem('adminToken');
    storage.removeItem('adminUser');
    storage.removeItem('adminAuthSource');
  }
}

export const adminAuthGuard: CanActivateFn = () => {
  const router = inject(Router);
  const http = inject(HttpClient);
  const localToken = localStorage.getItem('adminToken');
  const storage = localToken ? localStorage : sessionStorage;
  const token = localToken || sessionStorage.getItem('adminToken');

  if (!token || storage.getItem('adminAuthSource') !== ADMIN_AUTH_MARKER) {
    clearAdminSession();
    return router.createUrlTree(['/admin-login']);
  }

  return http.get<{ success: boolean; user?: { role?: string } }>(
    'http://localhost:3002/api/users/me',
    { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
  ).pipe(
    map(result => {
      if (!result.success || result.user?.role !== 'admin') {
        clearAdminSession();
        return router.createUrlTree(['/admin-login']);
      }
      return true;
    }),
    catchError(() => {
      clearAdminSession();
      return of(router.createUrlTree(['/admin-login']));
    }),
  );
};
