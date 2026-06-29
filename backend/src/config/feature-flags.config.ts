export const featureFlags = Object.freeze({
  FEATURE_MIS_INTEGRATION: false,
  FEATURE_ONLINE_PAYMENTS: false,
  FEATURE_EMERGENCY_OPS: true,
});

export type FeatureFlags = typeof featureFlags;
