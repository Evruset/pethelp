describe('Owner specialist projection feature flag',()=>{
  const original=process.env.OWNER_R2E_SPECIALIST_PROJECTION;

  afterEach(()=>{
    if(original===undefined) delete process.env.OWNER_R2E_SPECIALIST_PROJECTION;
    else process.env.OWNER_R2E_SPECIALIST_PROJECTION=original;
    jest.resetModules();
  });

  it('is default-off and accepts an explicit enable',()=>{
    delete process.env.OWNER_R2E_SPECIALIST_PROJECTION;
    jest.isolateModules(()=>{
      const {featureFlags}=require('./feature-flags.config') as typeof import('./feature-flags.config');
      expect(featureFlags.OWNER_R2E_SPECIALIST_PROJECTION).toBe(false);
    });
    process.env.OWNER_R2E_SPECIALIST_PROJECTION='true';
    jest.isolateModules(()=>{
      const {featureFlags}=require('./feature-flags.config') as typeof import('./feature-flags.config');
      expect(featureFlags.OWNER_R2E_SPECIALIST_PROJECTION).toBe(true);
    });
  });
});
