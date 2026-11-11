import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const authGuard: CanActivateFn = (_route, state) => {
  const currentUser = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
  if (currentUser) return true;

  const router = inject(Router);
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};
