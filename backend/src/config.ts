export interface AppConfig {
  readonly port: number;
  readonly databaseUrl: string;
  readonly holdTtlMinutes: number;
  readonly workersEnabled: boolean;
  readonly outboxPollIntervalMs: number;
  readonly outboxBatchSize: number;
  readonly jwtSecret: string;
  readonly jwtIssuer: string;
  readonly jwtAudience: string;
  readonly otpPepper: string;
  readonly otpPepperVersion: string;
  readonly ownerPetIdempotencyHmacKey: string;
  readonly otpPreviousPepper?: string;
  readonly otpPreviousPepperVersion?: string;
  readonly otpAntiFraudPepper: string;
  readonly otpAntiFraudPepperVersion: string;
  readonly otpAntiFraudPreviousPepper?: string;
  readonly otpAntiFraudPreviousPepperVersion?: string;
  readonly otpPhoneHourlyLimit: number;
  readonly otpPhoneDailyLimit: number;
  readonly otpIpHourlyLimit: number;
  readonly otpInitialBlockSeconds: number;
  readonly otpEscalatedBlockSeconds: number;
  readonly workerServiceToken: string;
  readonly misVetManagerBaseUrl?: string;
  readonly misVetManagerApiKey?: string;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

function boundedIntEnv(name: string, fallback: number, maximum: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (!/^[1-9][0-9]*$/.test(raw)) throw new Error(`${name} must be a positive integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > maximum) throw new Error(`${name} is outside the supported range`);
  return value;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured`);
  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function otpVersionEnv(name: string, fallback?: string): string | undefined {
  const value = optionalEnv(name) ?? fallback;
  if (value !== undefined && !/^v[1-9][0-9]{0,3}$/.test(value)) {
    throw new Error(`${name} must match v<positive integer>`);
  }
  return value;
}

const jwtSecret = requiredEnv('JWT_SECRET');
const otpPepper = requiredEnv('AUTH_OTP_PEPPER');
const ownerPetIdempotencyHmacKey = requiredEnv('OWNER_PET_IDEMPOTENCY_HMAC_KEY');
const otpPepperVersion = otpVersionEnv('AUTH_OTP_PEPPER_VERSION', 'v1')!;
const otpPreviousPepper = optionalEnv('AUTH_OTP_PREVIOUS_PEPPER');
const otpPreviousPepperVersion = otpVersionEnv('AUTH_OTP_PREVIOUS_PEPPER_VERSION');
const otpAntiFraudPepper = requiredEnv('AUTH_OTP_ANTI_FRAUD_PEPPER');
const otpAntiFraudPepperVersion = otpVersionEnv('AUTH_OTP_ANTI_FRAUD_PEPPER_VERSION', 'v1')!;
const otpAntiFraudPreviousPepper = optionalEnv('AUTH_OTP_ANTI_FRAUD_PREVIOUS_PEPPER');
const otpAntiFraudPreviousPepperVersion = otpVersionEnv('AUTH_OTP_ANTI_FRAUD_PREVIOUS_PEPPER_VERSION');
const workerServiceToken = requiredEnv('WORKER_SERVICE_TOKEN');
const localOtpMode = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
const otpPhoneHourlyLimit = boundedIntEnv('AUTH_OTP_PHONE_HOURLY_LIMIT', 5, 10_000);
const otpPhoneDailyLimit = boundedIntEnv('AUTH_OTP_PHONE_DAILY_LIMIT', 10, 10_000);
const otpIpHourlyLimit = boundedIntEnv('AUTH_OTP_IP_HOURLY_LIMIT', 20, 10_000);
const otpInitialBlockSeconds = boundedIntEnv('AUTH_OTP_INITIAL_BLOCK_SECONDS', 900, 3_600);
const otpEscalatedBlockSeconds = boundedIntEnv('AUTH_OTP_ESCALATED_BLOCK_SECONDS', 3_600, 3_600);

if (process.env.AUTH_DEV_OTP_CODE !== undefined && !localOtpMode) {
  throw new Error('AUTH_DEV_OTP_CODE is permitted only in explicit test/development mode');
}

if (otpPepper.length < 32) throw new Error('AUTH_OTP_PEPPER must contain at least 32 characters');
if (ownerPetIdempotencyHmacKey.length < 32 || [jwtSecret, otpPepper, otpPreviousPepper, otpAntiFraudPepper, otpAntiFraudPreviousPepper, workerServiceToken].includes(ownerPetIdempotencyHmacKey)) throw new Error('OWNER_PET_IDEMPOTENCY_HMAC_KEY must be at least 32 characters and domain-distinct');
if (otpPepper === jwtSecret) throw new Error('AUTH_OTP_PEPPER must be distinct from JWT_SECRET');
if (otpAntiFraudPepper.length < 32) throw new Error('AUTH_OTP_ANTI_FRAUD_PEPPER must contain at least 32 characters');
if ([otpPepper, jwtSecret, otpPreviousPepper, workerServiceToken].includes(otpAntiFraudPepper)) throw new Error('AUTH_OTP_ANTI_FRAUD_PEPPER must be distinct from authentication secrets');
if ((otpAntiFraudPreviousPepper === undefined) !== (otpAntiFraudPreviousPepperVersion === undefined)) throw new Error('AUTH_OTP_ANTI_FRAUD_PREVIOUS_PEPPER and version must be configured together');
if (otpAntiFraudPreviousPepper) {
  if (otpAntiFraudPreviousPepper.length < 32 || [otpAntiFraudPepper, otpPepper, otpPreviousPepper, jwtSecret, workerServiceToken].includes(otpAntiFraudPreviousPepper)) throw new Error('AUTH_OTP_ANTI_FRAUD_PREVIOUS_PEPPER must be long and distinct');
  if (otpAntiFraudPreviousPepperVersion === otpAntiFraudPepperVersion) throw new Error('AUTH_OTP_ANTI_FRAUD previous version must differ');
}
if (otpPhoneDailyLimit < otpPhoneHourlyLimit) throw new Error('AUTH_OTP_PHONE_DAILY_LIMIT must not be lower than the hourly limit');
if (otpEscalatedBlockSeconds < otpInitialBlockSeconds) throw new Error('AUTH_OTP_ESCALATED_BLOCK_SECONDS must not be lower than the initial block');
if (otpPhoneHourlyLimit > 5 || otpPhoneDailyLimit > 10 || otpIpHourlyLimit > 20) throw new Error('OTP anti-fraud limits cannot weaken the approved contract');
if (otpInitialBlockSeconds < 900 || otpEscalatedBlockSeconds < 3600) throw new Error('OTP anti-fraud blocks cannot weaken the approved contract');
if ((otpPreviousPepper === undefined) !== (otpPreviousPepperVersion === undefined)) {
  throw new Error('AUTH_OTP_PREVIOUS_PEPPER and AUTH_OTP_PREVIOUS_PEPPER_VERSION must be configured together');
}
if (otpPreviousPepper !== undefined) {
  if (otpPreviousPepper.length < 32) throw new Error('AUTH_OTP_PREVIOUS_PEPPER must contain at least 32 characters');
  if (otpPreviousPepper === otpPepper || otpPreviousPepper === jwtSecret) {
    throw new Error('AUTH_OTP_PREVIOUS_PEPPER must be distinct from current OTP pepper and JWT_SECRET');
  }
  if (otpPreviousPepperVersion === otpPepperVersion) {
    throw new Error('AUTH_OTP_PREVIOUS_PEPPER_VERSION must differ from AUTH_OTP_PEPPER_VERSION');
  }
}

export const config: AppConfig = Object.freeze({
  port: intEnv('PORT', 3000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://vethelp:vethelp@localhost:5432/vethelp',
  holdTtlMinutes: intEnv('HOLD_TTL_MINUTES', 10),
  workersEnabled: (process.env.WORKERS_ENABLED ?? 'true').toLowerCase() === 'true',
  outboxPollIntervalMs: intEnv('OUTBOX_POLL_INTERVAL_MS', 3000),
  outboxBatchSize: intEnv('OUTBOX_BATCH_SIZE', 20),
  jwtSecret,
  jwtIssuer: requiredEnv('JWT_ISSUER'),
  jwtAudience: requiredEnv('JWT_AUDIENCE'),
  otpPepper,
  otpPepperVersion,
  ownerPetIdempotencyHmacKey,
  otpPreviousPepper,
  otpPreviousPepperVersion,
  otpAntiFraudPepper,
  otpAntiFraudPepperVersion,
  otpAntiFraudPreviousPepper,
  otpAntiFraudPreviousPepperVersion,
  otpPhoneHourlyLimit,
  otpPhoneDailyLimit,
  otpIpHourlyLimit,
  otpInitialBlockSeconds,
  otpEscalatedBlockSeconds,
  workerServiceToken,
  misVetManagerBaseUrl: optionalEnv('MIS_VET_MANAGER_BASE_URL'),
  misVetManagerApiKey: optionalEnv('MIS_VET_MANAGER_API_KEY'),
});

export function isClinicAppointmentsRegistryEnabled(): boolean {
  return (process.env.VETHELP_CLINIC_APPOINTMENTS_REGISTRY ?? 'false').toLowerCase() === 'true';
}

export function isClinicPatientsRegistryEnabled(): boolean {
  return (process.env.VETHELP_CLINIC_PATIENTS_REGISTRY ?? 'false').trim().toLowerCase() === 'true';
}

export function isClinicPatientAdminMutationsEnabled(): boolean {
  return (process.env.VETHELP_CLINIC_PATIENT_ADMIN_MUTATIONS ?? 'false').trim().toLowerCase() === 'true';
}

export function isClinicPatientAdminReferenceSearchEnabled(): boolean {
  return (process.env.VETHELP_CLINIC_PATIENT_ADMIN_REFERENCE_SEARCH ?? 'false').trim().toLowerCase() === 'true';
}
