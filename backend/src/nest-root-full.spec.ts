process.env.JWT_SECRET ??= 'mvp-scope-test-secret-at-least-32-bytes';
process.env.JWT_ISSUER ??= 'mvp-scope-test';
process.env.JWT_AUDIENCE ??= 'mvp-scope-test';
process.env.WORKER_SERVICE_TOKEN ??= 'mvp-scope-worker-token';

const { EmergencyRoutingModule } = require('./emergency-routing/emergency-routing.module') as typeof import('./emergency-routing/emergency-routing.module');
const { InsuranceModule } = require('./modules/insurance/insurance.module') as typeof import('./modules/insurance/insurance.module');
const { MisIntegrationModule } = require('./modules/mis-integration/mis-integration.module') as typeof import('./modules/mis-integration/mis-integration.module');
const { PaymentsModule } = require('./modules/payments/payments.module') as typeof import('./modules/payments/payments.module');
const { TelemedModule } = require('./modules/telemed/telemed.module') as typeof import('./modules/telemed/telemed.module');
const { OwnerHomeModule } = require('./owner-home/owner-home.module') as typeof import('./owner-home/owner-home.module');
const { resolveMvpScope } = require('./config/mvp-scope.config') as typeof import('./config/mvp-scope.config');
const { buildNestRootImports } = require('./nest-root-full') as typeof import('./nest-root-full');

const enabledFlags = {
  FEATURE_MIS_INTEGRATION: true,
  FEATURE_ONLINE_PAYMENTS: true,
  FEATURE_EMERGENCY_OPS: true,
};

const optionalModules = [
  MisIntegrationModule,
  PaymentsModule,
  TelemedModule,
  InsuranceModule,
  EmergencyRoutingModule,
];

describe('NestRoot MVP scope composition', () => {
  it('does not register external routes, workers or providers in PILOT_V1', () => {
    const imports = buildNestRootImports(
      resolveMvpScope({ MVP_SCOPE_PROFILE: 'PILOT_V1' }, enabledFlags),
    );
    for (const module of optionalModules) expect(imports).not.toContain(module);
    expect(imports).toContain(OwnerHomeModule);
  });

  it('preserves the legacy module composition in LEGACY_COMPAT', () => {
    const imports = buildNestRootImports(
      resolveMvpScope({ MVP_SCOPE_PROFILE: 'LEGACY_COMPAT' }, enabledFlags),
    );
    for (const module of optionalModules) expect(imports).toContain(module);
  });
});
