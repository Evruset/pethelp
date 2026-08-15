describe('T126 anti-fraud configuration', () => {
  const original = { ...process.env };
  const baseline = () => Object.assign(process.env, {
    JWT_SECRET: 'config-test-jwt-secret-at-least-32-characters',
    JWT_ISSUER: 'test', JWT_AUDIENCE: 'test', WORKER_SERVICE_TOKEN: 'test-worker',
    AUTH_OTP_PEPPER: 'config-test-otp-pepper-at-least-32-characters',
    AUTH_OTP_ANTI_FRAUD_PEPPER: 'config-test-anti-fraud-pepper-32-characters',
  });
  afterEach(() => { process.env = { ...original }; jest.resetModules(); });

  it('loads the approved quantitative defaults', () => {
    baseline();
    jest.isolateModules(() => {
      const { config } = require('../config') as typeof import('../config');
      expect(config).toMatchObject({ otpPhoneHourlyLimit: 5, otpPhoneDailyLimit: 10, otpIpHourlyLimit: 20, otpInitialBlockSeconds: 900, otpEscalatedBlockSeconds: 3600 });
    });
  });

  it.each(['', 'short', 'config-test-otp-pepper-at-least-32-characters'])('rejects missing, weak, or reused identity secret', (secret) => {
    baseline(); process.env.AUTH_OTP_ANTI_FRAUD_PEPPER = secret;
    jest.isolateModules(() => expect(() => require('../config')).toThrow(/ANTI_FRAUD_PEPPER/));
  });

  it.each([['AUTH_OTP_PHONE_HOURLY_LIMIT', '0'], ['AUTH_OTP_PHONE_HOURLY_LIMIT', '6'], ['AUTH_OTP_IP_HOURLY_LIMIT', '20x'], ['AUTH_OTP_IP_HOURLY_LIMIT', '21'], ['AUTH_OTP_INITIAL_BLOCK_SECONDS', '899'], ['AUTH_OTP_ESCALATED_BLOCK_SECONDS', '3601']])('rejects insecure %s=%s', (name, value) => {
    baseline(); process.env[name] = value;
    jest.isolateModules(() => expect(() => require('../config')).toThrow());
  });

  it('rejects an invalid anti-fraud key version',()=>{
    baseline(); process.env.AUTH_OTP_ANTI_FRAUD_PEPPER_VERSION='latest';
    jest.isolateModules(()=>expect(()=>require('../config')).toThrow(/VERSION/));
  });

  it.each([
    ['missing previous version',{AUTH_OTP_ANTI_FRAUD_PREVIOUS_PEPPER:'previous-anti-fraud-pepper-at-least-32-chars'}],
    ['missing previous pepper',{AUTH_OTP_ANTI_FRAUD_PREVIOUS_PEPPER_VERSION:'v2'}],
    ['same version',{AUTH_OTP_ANTI_FRAUD_PREVIOUS_PEPPER:'previous-anti-fraud-pepper-at-least-32-chars',AUTH_OTP_ANTI_FRAUD_PREVIOUS_PEPPER_VERSION:'v1'}],
    ['reused previous secret',{AUTH_OTP_ANTI_FRAUD_PREVIOUS_PEPPER:'config-test-anti-fraud-pepper-32-characters',AUTH_OTP_ANTI_FRAUD_PREVIOUS_PEPPER_VERSION:'v2'}],
  ])('rejects unsafe rotation configuration: %s',(_label,values)=>{
    baseline(); Object.assign(process.env,values);
    jest.isolateModules(()=>expect(()=>require('../config')).toThrow(/ANTI_FRAUD/));
  });
  it('rejects current or previous anti-fraud secrets reused from the worker credential',()=>{
    baseline(); process.env.AUTH_OTP_ANTI_FRAUD_PEPPER=process.env.WORKER_SERVICE_TOKEN='worker-token-that-is-at-least-32-characters';
    jest.isolateModules(()=>expect(()=>require('../config')).toThrow(/ANTI_FRAUD/));
    jest.resetModules(); baseline(); process.env.WORKER_SERVICE_TOKEN='worker-token-that-is-at-least-32-characters'; process.env.AUTH_OTP_ANTI_FRAUD_PREVIOUS_PEPPER=process.env.WORKER_SERVICE_TOKEN; process.env.AUTH_OTP_ANTI_FRAUD_PREVIOUS_PEPPER_VERSION='v2';
    jest.isolateModules(()=>expect(()=>require('../config')).toThrow(/ANTI_FRAUD/));
  });
});
