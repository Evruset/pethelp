import { HttpException, HttpStatus } from '@nestjs/common';
import { OwnerAuthService } from './owner-auth.service';
import type { OtpDeliveryPort } from './otp-delivery.port';

describe('T128 fail-closed OTP composition',()=>{
  it('does not mutate challenge state or call provider when limiter infrastructure is unavailable',async()=>{
    const withTransaction=jest.fn();
    const database={withTransaction,query:jest.fn()} as never;
    const delivery:OtpDeliveryPort={sendOtp:jest.fn()};
    const antiFraud={enforce:jest.fn().mockRejectedValue(new HttpException({code:'INTERNAL_ERROR',message:'Authentication is temporarily unavailable.'},HttpStatus.SERVICE_UNAVAILABLE))} as never;
    const service=new OwnerAuthService(database,delivery,antiFraud);
    await expect(service.requestOtp({phone:'+79990002001',clientIp:'127.0.0.1'})).rejects.toMatchObject({status:503,response:{code:'INTERNAL_ERROR'}});
    expect(withTransaction).not.toHaveBeenCalled();
    expect(delivery.sendOtp).not.toHaveBeenCalled();
  });
  it('does not mutate challenge or call provider when resend limiter is unavailable',async()=>{
    const withTransaction=jest.fn();
    const database={withTransaction,query:jest.fn().mockResolvedValue({rows:[{phone_e164:'+79990002002'}]})} as never;
    const delivery:OtpDeliveryPort={sendOtp:jest.fn()};
    const antiFraud={enforce:jest.fn().mockRejectedValue(new HttpException({code:'INTERNAL_ERROR',message:'Authentication is temporarily unavailable.'},503))} as never;
    const service=new OwnerAuthService(database,delivery,antiFraud);
    await expect(service.resendOtp({challengeId:'11111111-1111-4111-8111-111111111111',clientIp:'127.0.0.1'})).rejects.toMatchObject({status:503});
    expect(withTransaction).not.toHaveBeenCalled(); expect(delivery.sendOtp).not.toHaveBeenCalled();
  });

  it('catches cleanup failure, prevents overlap, and records only a bounded failure counter',async()=>{
    let reject!:()=>void; const pending=new Promise<never>((_resolve,r)=>{reject=r;});
    const database={withTransaction:jest.fn().mockReturnValue(pending),query:jest.fn()} as never;
    const telemetry={record:jest.fn()};
    const {OtpAntiFraudService}=await import('./otp-anti-fraud.service');
    const limiter=new OtpAntiFraudService(database,telemetry as never);
    const start=(limiter as unknown as {startCleanup():Promise<void>}).startCleanup.bind(limiter);
    const first=start(),second=start(); expect(first).toBe(second); reject();
    await expect(first).resolves.toBeUndefined();
    expect(telemetry.record).toHaveBeenCalledWith('DATABASE_FAILURE');
  });
  it('translates raw limiter DB failure to a safe 503 and bounded telemetry',async()=>{
    const telemetry={record:jest.fn()};
    const database={withTransaction:jest.fn().mockRejectedValue(new Error('postgres secret detail')),query:jest.fn()} as never;
    const {OtpAntiFraudService}=await import('./otp-anti-fraud.service');
    const limiter=new OtpAntiFraudService(database,telemetry as never);
    await expect(limiter.enforce('+79990002003','127.0.0.1')).rejects.toMatchObject({status:503,response:{code:'INTERNAL_ERROR',message:'Authentication is temporarily unavailable.'}});
    expect(telemetry.record).toHaveBeenCalledWith('DATABASE_FAILURE');
  });
});
