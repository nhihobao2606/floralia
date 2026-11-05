import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const adminAuthGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');

  return token ? true : router.createUrlTree(['/admin-login']);
};
