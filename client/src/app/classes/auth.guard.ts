import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const authGuard: CanActivateFn = (route, state) => {
  const currentUser = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
  if (currentUser) return true;

  const requestedOrderId = route.paramMap.get('id');
  const guestTrackedOrderId = localStorage.getItem('floralia_guest_tracked_order_id');
  if (requestedOrderId && requestedOrderId === guestTrackedOrderId) return true;

  const router = inject(Router);
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};
