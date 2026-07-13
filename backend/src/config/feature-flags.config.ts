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
  CAPABILITY_EVALUATOR_V1: readBooleanFlag('CAPABILITY_EVALUATOR_V1', true),
  QUALITY_READ_CAPABILITY_V1: readBooleanFlag('QUALITY_READ_CAPABILITY_V1', true),
  SCHEDULE_READ_CAPABILITY_V1: readBooleanFlag('SCHEDULE_READ_CAPABILITY_V1', true),
  BOOKING_REPLAY_READ_CAPABILITY_V1: readBooleanFlag('BOOKING_REPLAY_READ_CAPABILITY_V1', true),
  BOOKING_HOLD_READ_CAPABILITY_V1: readBooleanFlag('BOOKING_HOLD_READ_CAPABILITY_V1', true),
  TELEMED_VET_QUEUE_READ_CAPABILITY_V1: readBooleanFlag('TELEMED_VET_QUEUE_READ_CAPABILITY_V1', true),
  TELEMED_VET_AUDIT_TRAIL_READ_CAPABILITY_V1: readBooleanFlag('TELEMED_VET_AUDIT_TRAIL_READ_CAPABILITY_V1', true),
  OPS_SLO_SNAPSHOT_READ_CAPABILITY_V1: readBooleanFlag('OPS_SLO_SNAPSHOT_READ_CAPABILITY_V1', true),
});

export type FeatureFlags = typeof featureFlags;
