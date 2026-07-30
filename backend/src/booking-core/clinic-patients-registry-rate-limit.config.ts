import { loadSharedRateLimitConfig } from '../platform/rate-limit/rate-limit.config';

export const ADMINISTRATIVE_REFERENCE_RATE_LIMIT_NAMESPACE =
  'clinic.patient-registry.administrative-reference-exact';

export type ClinicPatientsRegistryReferenceRateLimitConfig = Readonly<{
  namespace: typeof ADMINISTRATIVE_REFERENCE_RATE_LIMIT_NAMESPACE;
  shortWindowSeconds: number;
  shortLimit: number;
  sustainedWindowSeconds: number;
  sustainedLimit: number;
  logicalStateRetentionSeconds: number;
}>;

function positiveInteger(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export function loadClinicPatientsRegistryReferenceRateLimitConfig(
  env: NodeJS.ProcessEnv = process.env,
): ClinicPatientsRegistryReferenceRateLimitConfig {
  const shortWindowSeconds = positiveInteger(
    env,
    'VETHELP_CLINIC_PATIENT_REFERENCE_RATE_LIMIT_SHORT_WINDOW_SECONDS',
    60,
  );
  const shortLimit = positiveInteger(
    env,
    'VETHELP_CLINIC_PATIENT_REFERENCE_RATE_LIMIT_SHORT_LIMIT',
    20,
  );
  const sustainedWindowSeconds = positiveInteger(
    env,
    'VETHELP_CLINIC_PATIENT_REFERENCE_RATE_LIMIT_SUSTAINED_WINDOW_SECONDS',
    3_600,
  );
  const sustainedLimit = positiveInteger(
    env,
    'VETHELP_CLINIC_PATIENT_REFERENCE_RATE_LIMIT_SUSTAINED_LIMIT',
    200,
  );
  const logicalStateRetentionSeconds =
    loadSharedRateLimitConfig(env).logicalStateRetentionSeconds;

  if (
    shortWindowSeconds >= sustainedWindowSeconds
    || sustainedLimit < shortLimit
    || sustainedWindowSeconds > logicalStateRetentionSeconds
  ) {
    throw new Error('Clinic patient reference rate limit configuration is invalid');
  }

  return Object.freeze({
    namespace: ADMINISTRATIVE_REFERENCE_RATE_LIMIT_NAMESPACE,
    shortWindowSeconds,
    shortLimit,
    sustainedWindowSeconds,
    sustainedLimit,
    logicalStateRetentionSeconds,
  });
}
