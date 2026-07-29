export function isDevLocalSessionEnabled(
  environment = process.env.NODE_ENV,
  enabled = process.env.VETHELP_ALLOW_DEV_SESSION,
): boolean {
  return environment !== 'production' && enabled === 'true';
}
