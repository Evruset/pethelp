export type MvpProductScopeProfile = 'LEGACY_COMPAT' | 'PILOT_V1';

export type MvpProductSurface =
  | 'telemedicine'
  | 'quality'
  | 'clinical-workspace'
  | 'alternative-time'
  | 'booking-replay';

export function resolveMvpProductScope(env: NodeJS.ProcessEnv = process.env): MvpProductScopeProfile {
  const raw = env.MVP_SCOPE_PROFILE;
  if (raw === undefined) return 'LEGACY_COMPAT';
  const profile = raw.trim();
  if (profile === 'LEGACY_COMPAT' || profile === 'PILOT_V1') return profile;
  throw new Error('MVP_SCOPE_PROFILE must be either "LEGACY_COMPAT" or "PILOT_V1"');
}

export function isProductSurfaceEnabled(
  surface: MvpProductSurface,
  profile: MvpProductScopeProfile = resolveMvpProductScope(),
): boolean {
  void surface;
  return profile === 'LEGACY_COMPAT';
}

export function isPilotProductPath(pathname: string): boolean {
  const clinicalVisitRoutes = [
    /^\/clinics\/[^/]+\/locations\/[^/]+\/vet\/visits(?:\/[^/]+)?\/?$/,
    /^\/api\/clinic\/[^/]+\/locations\/[^/]+\/vet\/visits(?:\/[^/]+)?\/?$/,
    /^\/api\/clinic\/booking-holds\/[^/]+\/complete\/?$/,
    /^\/api\/clinic\/visits\/[^/]+\/results\/?$/,
    /^\/api\/clinic\/visits\/[^/]+\/results\/[^/]+\/?$/,
    /^\/api\/clinic\/visits\/[^/]+\/results\/[^/]+\/(?:publish|amendments)\/?$/,
  ];
  if (clinicalVisitRoutes.some((pattern) => pattern.test(pathname))) return true;

  const blocked = [
    /^\/telemed(?:\/|$)/,
    /^\/clinics\/[^/]+\/locations\/[^/]+\/(?:telemed|quality|vet\/visits)(?:\/|$)/,
    /^\/api\/telemed(?:\/|$)/,
    /^\/api\/clinic\/[^/]+\/locations\/[^/]+\/(?:telemed|quality-dashboard|vet\/visits)(?:\/|$)/,
    /^\/api\/clinic\/visits(?:\/|$)/,
    /^\/api\/clinic\/booking-holds\/[^/]+\/(?:alternative-slot|complete)(?:\/|$)/,
    /^\/api\/clinic\/[^/]+\/locations\/[^/]+\/booking-holds\/[^/]+\/audit-trail(?:\/|$)/,
  ];
  return !blocked.some((pattern) => pattern.test(pathname));
}
