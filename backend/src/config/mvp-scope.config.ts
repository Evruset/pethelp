import type { FeatureFlags } from './feature-flags.config';
import { featureFlags } from './feature-flags.config';

export type MvpScopeProfile = 'LEGACY_COMPAT' | 'PILOT_V1';

export interface MvpScopeConfig {
  readonly profile: MvpScopeProfile;
  readonly pilot: boolean;
  readonly capabilities: {
    readonly mis: boolean;
    readonly onlinePayments: boolean;
    readonly telemedicine: boolean;
    readonly insurance: boolean;
    readonly emergency: boolean;
  };
  readonly runtimeModules: {
    readonly mis: boolean;
    readonly payments: boolean;
    readonly telemedicine: boolean;
    readonly insurance: boolean;
    readonly emergency: boolean;
  };
}

export function resolveMvpScope(
  env: NodeJS.ProcessEnv = process.env,
  rawFlags: Pick<FeatureFlags, 'FEATURE_MIS_INTEGRATION' | 'FEATURE_ONLINE_PAYMENTS' | 'FEATURE_EMERGENCY_OPS'> = featureFlags,
): MvpScopeConfig {
  const rawProfile = env.MVP_SCOPE_PROFILE;
  const profile: MvpScopeProfile = rawProfile === undefined
    ? 'LEGACY_COMPAT'
    : parseProfile(rawProfile.trim());
  const pilot = profile === 'PILOT_V1';

  return Object.freeze({
    profile,
    pilot,
    capabilities: Object.freeze({
      mis: !pilot && rawFlags.FEATURE_MIS_INTEGRATION,
      onlinePayments: !pilot && rawFlags.FEATURE_ONLINE_PAYMENTS,
      telemedicine: !pilot,
      insurance: !pilot,
      emergency: !pilot && rawFlags.FEATURE_EMERGENCY_OPS,
    }),
    runtimeModules: Object.freeze({
      mis: !pilot,
      payments: !pilot,
      telemedicine: !pilot,
      insurance: !pilot,
      emergency: !pilot,
    }),
  });
}

function parseProfile(value: string): MvpScopeProfile {
  if (value === 'LEGACY_COMPAT' || value === 'PILOT_V1') return value;
  throw new Error('MVP_SCOPE_PROFILE must be either "LEGACY_COMPAT" or "PILOT_V1"');
}

export const mvpScope = resolveMvpScope();
