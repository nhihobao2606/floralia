import { ActivatedRoute, Router } from '@angular/router';

export function getAuthReturnUrl(route: ActivatedRoute, router: Router): string | null {
  const candidate = route.snapshot.queryParamMap.get('returnUrl');
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) return null;

  try {
    const path = router.parseUrl(candidate).root.children['primary']?.segments
      .map((segment) => segment.path)
      .join('/');
    if (path === 'login' || path === 'signup' || path === 'guest-order-tracking') return null;
    return candidate;
  } catch {
    return null;
  }
}

export function getCurrentPageReturnUrl(router: Router): string {
  const current = router.parseUrl(router.url);
  const path = current.root.children['primary']?.segments
    .map((segment) => segment.path)
    .join('/');

  if (path === 'login' || path === 'signup') {
    const inherited = current.queryParams['returnUrl'];
    return typeof inherited === 'string' && inherited.startsWith('/') && !inherited.startsWith('//') &&
      !inherited.startsWith('/guest-order-tracking')
      ? inherited
      : '/';
  }

  if (path === 'guest-order-tracking') return '/orders';

  return router.url || '/';
}
