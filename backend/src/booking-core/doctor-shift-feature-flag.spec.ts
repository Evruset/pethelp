describe('DoctorShift inventory rollout flag',()=>{
  it('defaults fail-closed when the flag is absent',()=>{
    const prior=process.env.DOCTOR_SHIFT_INVENTORY_V1;delete process.env.DOCTOR_SHIFT_INVENTORY_V1;
    jest.isolateModules(()=>{const {featureFlags}=require('../config/feature-flags.config') as typeof import('../config/feature-flags.config');expect(featureFlags.DOCTOR_SHIFT_INVENTORY_V1).toBe(false);});
    if(prior===undefined)delete process.env.DOCTOR_SHIFT_INVENTORY_V1;else process.env.DOCTOR_SHIFT_INVENTORY_V1=prior;
  });
});
