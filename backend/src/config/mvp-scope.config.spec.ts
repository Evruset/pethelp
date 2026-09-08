import { resolveMvpScope } from './mvp-scope.config';

const allLegacyFlags = {
  FEATURE_MIS_INTEGRATION: true,
  FEATURE_ONLINE_PAYMENTS: true,
  FEATURE_EMERGENCY_OPS: true,
};

describe('MVP scope profile', () => {
  it('defaults an absent profile to legacy compatibility', () => {
    const scope = resolveMvpScope({}, allLegacyFlags);
    expect(scope.profile).toBe('LEGACY_COMPAT');
    expect(Object.values(scope.runtimeModules).every(Boolean)).toBe(true);
  });

  it('preserves raw legacy domain flags in LEGACY_COMPAT', () => {
    const scope = resolveMvpScope(
      { MVP_SCOPE_PROFILE: 'LEGACY_COMPAT' },
      { ...allLegacyFlags, FEATURE_MIS_INTEGRATION: false },
    );
    expect(scope.capabilities.mis).toBe(false);
    expect(scope.runtimeModules.mis).toBe(true);
  });

  it('forces every external capability and module off in PILOT_V1', () => {
    const scope = resolveMvpScope({ MVP_SCOPE_PROFILE: 'PILOT_V1' }, allLegacyFlags);
    expect(scope.pilot).toBe(true);
    expect(Object.values(scope.capabilities).every((value) => value === false)).toBe(true);
    expect(Object.values(scope.runtimeModules).every((value) => value === false)).toBe(true);
  });

  it('does not allow stale raw flags to override PILOT_V1', () => {
    const scope = resolveMvpScope({ MVP_SCOPE_PROFILE: 'PILOT_V1' }, allLegacyFlags);
    expect(scope.capabilities).toEqual({
      mis: false,
      onlinePayments: false,
      telemedicine: false,
      insurance: false,
      emergency: false,
    });
  });

  it('does not read or expose provider credentials', () => {
    const scope = resolveMvpScope(
      {
        MVP_SCOPE_PROFILE: 'PILOT_V1',
        LIVEKIT_API_SECRET: 'must-not-be-read',
        ACQUIRING_API_KEY: 'must-not-be-read',
        MIS_VET_MANAGER_API_KEY: 'must-not-be-read',
      },
      allLegacyFlags,
    );
    expect(JSON.stringify(scope)).not.toContain('must-not-be-read');
  });

  it('fails closed for an unknown profile', () => {
    expect(() => resolveMvpScope({ MVP_SCOPE_PROFILE: 'pilot' }, allLegacyFlags)).toThrow(
      'MVP_SCOPE_PROFILE must be either "LEGACY_COMPAT" or "PILOT_V1"',
    );
  });

  it.each(['', '   ', '\t'])('fails closed for an explicitly malformed profile %j', (value) => {
    expect(() => resolveMvpScope({ MVP_SCOPE_PROFILE: value }, allLegacyFlags)).toThrow(
      'MVP_SCOPE_PROFILE must be either "LEGACY_COMPAT" or "PILOT_V1"',
    );
  });
});
