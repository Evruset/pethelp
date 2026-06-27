function readBooleanFlag(name: string, fallback: boolean): boolean {
  const raw = process.env[name];

  if (raw == null || raw.trim() === '') {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  throw new Error(`${name} must be either "true" or "false"`);
}

export const featureFlags = Object.freeze({
  FEATURE_MIS_INTEGRATION: readBooleanFlag('FEATURE_MIS_INTEGRATION', false),
  FEATURE_ONLINE_PAYMENTS: readBooleanFlag('FEATURE_ONLINE_PAYMENTS', false),
  FEATURE_EMERGENCY_OPS: readBooleanFlag('FEATURE_EMERGENCY_OPS', true),
});
