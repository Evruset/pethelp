export const featureFlags = Object.freeze({
  FEATURE_MIS_INTEGRATION: false,
  FEATURE_ONLINE_PAYMENTS: false,
  FEATURE_EMERGENCY_OPS: true,
  CAPABILITY_EVALUATOR_V1: (process.env.CAPABILITY_EVALUATOR_V1 ?? 'true').toLowerCase() === 'true',
  QUALITY_READ_CAPABILITY_V1: (process.env.QUALITY_READ_CAPABILITY_V1 ?? 'true').toLowerCase() === 'true',
  SCHEDULE_READ_CAPABILITY_V1: (process.env.SCHEDULE_READ_CAPABILITY_V1 ?? 'true').toLowerCase() === 'true',
  BOOKING_REPLAY_READ_CAPABILITY_V1: (process.env.BOOKING_REPLAY_READ_CAPABILITY_V1 ?? 'true').toLowerCase() === 'true',
  BOOKING_HOLD_READ_CAPABILITY_V1: (process.env.BOOKING_HOLD_READ_CAPABILITY_V1 ?? 'true').toLowerCase() === 'true',
  TELEMED_VET_QUEUE_READ_CAPABILITY_V1: (process.env.TELEMED_VET_QUEUE_READ_CAPABILITY_V1 ?? 'true').toLowerCase() === 'true',
  TELEMED_VET_AUDIT_TRAIL_READ_CAPABILITY_V1: (process.env.TELEMED_VET_AUDIT_TRAIL_READ_CAPABILITY_V1 ?? 'true').toLowerCase() === 'true',
  OPS_SLO_SNAPSHOT_READ_CAPABILITY_V1: (process.env.OPS_SLO_SNAPSHOT_READ_CAPABILITY_V1 ?? 'true').toLowerCase() === 'true',
});

export type FeatureFlags = typeof featureFlags;
