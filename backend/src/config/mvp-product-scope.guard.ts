import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { mvpScope, type MvpScopeConfig } from './mvp-scope.config';

const pilotBlockedRoutes: Array<{ pattern: RegExp; method?: string }> = [
  { pattern: /^\/v1\/booking-holds\/[^/]+\/alternative(?:\/|$)/ },
  { pattern: /^\/v1\/booking-holds\/[^/]+\/(?:release|cancellation-requests)(?:\/|$)/ },
  { pattern: /^\/v1\/clinic\/booking-holds\/[^/]+\/alternative-slot(?:\/|$)/ },
  { pattern: /^\/v1\/clinic\/[^/]+\/locations\/[^/]+\/quality-dashboard(?:\/|$)/ },
  { pattern: /^\/v1\/clinic\/[^/]+\/locations\/[^/]+\/booking-holds\/[^/]+\/audit-trail(?:\/|$)/ },
  { pattern: /^\/v1\/owner\/pets\/[^/]+$/, method: 'PATCH' },
  { pattern: /^\/v1\/owner\/pets\/[^/]+\/(?:archive|restore|photo|care-summary|documents)(?:\/|$)/ },
];

export function isPilotBackendRouteAllowed(pathname: string, method?: string): boolean {
  // BP-15 foundation opens only these explicit Owner OCR methods; legacy document routes stay closed.
  if (/^\/v1\/owner\/pets\/[^/]+\/documents\/[^/]+\/ocr$/.test(pathname) && ['GET','POST'].includes(method?.toUpperCase() ?? '')) return true;
  if (/^\/v1\/owner\/pets\/[^/]+\/documents\/[^/]+\/ocr\/retry$/.test(pathname) && method?.toUpperCase() === 'POST') return true;
  const review = /^\/v1\/owner\/pets\/[^/]+\/documents\/[^/]+\/ocr\/candidates\/[^/]+\/review/;
  if (new RegExp(review.source+'$').test(pathname) && method?.toUpperCase()==='GET') return true;
  if (new RegExp(review.source+'/(start|corrections|confirm|reject)$').test(pathname) && method?.toUpperCase()==='POST') return true;
  return !pilotBlockedRoutes.some((route) => route.pattern.test(pathname) && (!route.method || route.method === method?.toUpperCase()));
}

export function assertMvpProductRoute(scope: MvpScopeConfig, pathname: string, method?: string): true {
  if (scope.pilot && !isPilotBackendRouteAllowed(pathname, method)) throw new NotFoundException();
  return true;
}

@Injectable()
export class MvpProductScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ url?: string; originalUrl?: string; method?: string }>();
    const pathname = (request.originalUrl ?? request.url ?? '').split('?', 1)[0];
    return assertMvpProductRoute(mvpScope, pathname, request.method);
  }
}
