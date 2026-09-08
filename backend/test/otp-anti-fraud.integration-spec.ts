import { HttpException } from '@nestjs/common';
import { DatabaseService } from '../src/database/database.service';
import { OtpAntiFraudService } from '../src/auth/otp-anti-fraud.service';
import { createHmac } from 'node:crypto';
import { config } from '../src/config';

jest.setTimeout(60_000);

describe('T126 replica-safe OTP anti-fraud (PostgreSQL)', () => {
  const database = new DatabaseService();
  const limiterA = new OtpAntiFraudService(database);
  const limiterB = new OtpAntiFraudService(database);

  beforeEach(async () => database.query('TRUNCATE identity_schema.otp_rate_limit_attempts, identity_schema.otp_rate_limit_blocks'));
  afterAll(async () => database.onModuleDestroy());

  const decision = async (promise: Promise<void>) => {
    try { await promise; return 'ALLOWED'; }
    catch (error) { return (error as HttpException).getResponse() as { code: string; retryAt?: string }; }
  };

  it('allows exactly five of 20 concurrent same-phone requests across service instances with no 5xx', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, (_, index) =>
      decision((index % 2 ? limiterA : limiterB).enforce('+79991110000', `10.0.0.${index + 1}`))));
    expect(results.filter((value) => value === 'ALLOWED')).toHaveLength(5);
    expect(results.filter((value) => value !== 'ALLOWED')).toHaveLength(15);
    expect(results.every((value) => value === 'ALLOWED' || value.code === 'OTP_RATE_LIMITED' || value.code === 'OTP_TEMPORARILY_BLOCKED')).toBe(true);
  });

  it('enforces independent IP/hour and leaves unrelated identities unaffected', async () => {
    for (let index = 0; index < 20; index += 1) await expect(limiterA.enforce(`+79992${String(index).padStart(6, '0')}`, '10.2.0.1')).resolves.toBeUndefined();
    await expect(decision(limiterB.enforce('+79993330000', '10.2.0.1'))).resolves.toMatchObject({ code: 'OTP_RATE_LIMITED' });
    await expect(limiterA.enforce('+79993330000', '10.2.0.2')).resolves.toBeUndefined();
  });

  it('uses rolling DB time, expires windows, and escalates a repeated breach from 15 to 60 minutes', async () => {
    for (let index = 0; index < 5; index += 1) await limiterA.enforce('+79994440000', `10.3.0.${index + 1}`);
    const first = await decision(limiterA.enforce('+79994440000', '10.3.0.9')) as { code: string; retryAt: string };
    expect(first.code).toBe('OTP_RATE_LIMITED');
    const initial = await database.query<{ seconds: number }>(`SELECT EXTRACT(EPOCH FROM (blocked_until-clock_timestamp()))::int seconds FROM identity_schema.otp_rate_limit_blocks WHERE dimension='PHONE'`);
    expect(initial.rows[0].seconds).toBeGreaterThanOrEqual(895);
    await database.query(`UPDATE identity_schema.otp_rate_limit_blocks SET blocked_until=clock_timestamp()-interval '1 second'`);
    const repeated = await decision(limiterB.enforce('+79994440000', '10.3.0.10')) as { code: string };
    expect(repeated.code).toBe('OTP_RATE_LIMITED');
    const escalated = await database.query<{ seconds: number; violation_count: number }>(`SELECT EXTRACT(EPOCH FROM (blocked_until-clock_timestamp()))::int seconds,violation_count FROM identity_schema.otp_rate_limit_blocks WHERE dimension='PHONE'`);
    expect(escalated.rows[0]).toMatchObject({ violation_count: 2 });
    expect(escalated.rows[0].seconds).toBeGreaterThanOrEqual(3595);
    await database.query(`UPDATE identity_schema.otp_rate_limit_blocks SET blocked_until=clock_timestamp()-interval '1 second'; UPDATE identity_schema.otp_rate_limit_attempts SET attempted_at=clock_timestamp()-interval '25 hours'`);
    await expect(limiterA.enforce('+79994440000', '10.3.0.11')).resolves.toBeUndefined();
  });

  it('enforces the rolling 24-hour phone limit independently of the hourly window', async () => {
    for (let batch = 0; batch < 2; batch += 1) {
      for (let index = 0; index < 5; index += 1) await limiterA.enforce('+79996660000', `10.4.${batch}.${index + 1}`);
      await database.query(`UPDATE identity_schema.otp_rate_limit_attempts SET attempted_at=attempted_at-interval '2 hours' WHERE attempted_at>clock_timestamp()-interval '1 hour'`);
    }
    const limited = await decision(limiterB.enforce('+79996660000', '10.4.3.1')) as { code: string };
    expect(limited.code).toBe('OTP_RATE_LIMITED');
    await database.query(`UPDATE identity_schema.otp_rate_limit_blocks SET blocked_until=clock_timestamp()-interval '1 second'; UPDATE identity_schema.otp_rate_limit_attempts SET attempted_at=clock_timestamp()-interval '25 hours'`);
    await expect(limiterA.enforce('+79996660000', '10.4.3.2')).resolves.toBeUndefined();
  });

  it('persists only domain-separated pseudonyms, never raw phone or IP', async () => {
    await limiterA.enforce('+79995550000', '203.0.113.42');
    const row = await database.query<{ phone_identity: string; ip_identity: string }>('SELECT phone_identity,ip_identity FROM identity_schema.otp_rate_limit_attempts LIMIT 1');
    expect(row.rows[0].phone_identity).toMatch(/^[0-9a-f]{64}$/);
    expect(row.rows[0].ip_identity).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row.rows[0])).not.toContain('+79995550000');
    expect(JSON.stringify(row.rows[0])).not.toContain('203.0.113.42');
    expect(row.rows[0].phone_identity).not.toBe(row.rows[0].ip_identity);
  });

  it('uses identity-scoped indexes instead of a global recent-attempt scan', async () => {
    await limiterA.enforce('+79997770000', '10.5.0.1');
    const plan = await database.query<{ 'QUERY PLAN': string }>(`
      EXPLAIN (COSTS OFF, FORMAT TEXT)
      SELECT COUNT(*) FROM identity_schema.otp_rate_limit_attempts
      WHERE phone_identity=ANY(ARRAY[(SELECT phone_identity FROM identity_schema.otp_rate_limit_attempts LIMIT 1)]::bpchar[])
        AND attempted_at>clock_timestamp()-interval '24 hours'
    `);
    const text = plan.rows.map((row) => row['QUERY PLAN']).join('\n');
    expect(text).toContain('otp_rate_limit_attempts_phone_time_idx');
    expect(text).toContain('Index Cond:');
  });

  it('honors rolling hour boundaries immediately inside and after expiry', async () => {
    for (let index=0;index<5;index+=1) await limiterA.enforce('+79990001001',`10.6.0.${index+1}`);
    await database.query(`UPDATE identity_schema.otp_rate_limit_attempts SET attempted_at=clock_timestamp()-interval '59 minutes 55 seconds'`);
    await expect(decision(limiterA.enforce('+79990001001','10.6.0.8'))).resolves.toMatchObject({code:'OTP_RATE_LIMITED'});
    await database.query(`TRUNCATE identity_schema.otp_rate_limit_blocks; UPDATE identity_schema.otp_rate_limit_attempts SET attempted_at=clock_timestamp()-interval '1 hour 5 seconds'`);
    await expect(limiterB.enforce('+79990001001','10.6.0.9')).resolves.toBeUndefined();
  });

  it('honors rolling 24-hour boundaries immediately inside and after expiry', async () => {
    for(let index=0;index<10;index+=1) {
      await limiterA.enforce('+79990001002',`10.7.${Math.floor(index/5)}.${index+1}`);
      if(index===4) await database.query(`UPDATE identity_schema.otp_rate_limit_attempts SET attempted_at=attempted_at-interval '2 hours'`);
    }
    await database.query(`UPDATE identity_schema.otp_rate_limit_attempts SET attempted_at=clock_timestamp()-interval '23 hours 59 minutes 55 seconds'`);
    await expect(decision(limiterA.enforce('+79990001002','10.7.3.1'))).resolves.toMatchObject({code:'OTP_RATE_LIMITED'});
    await database.query(`TRUNCATE identity_schema.otp_rate_limit_blocks; UPDATE identity_schema.otp_rate_limit_attempts SET attempted_at=clock_timestamp()-interval '24 hours 5 seconds'`);
    await expect(limiterB.enforce('+79990001002','10.7.3.2')).resolves.toBeUndefined();
  });

  it('cleans multiple expired attempt/block batches while retaining active state', async () => {
    await database.query(`
      INSERT INTO identity_schema.otp_rate_limit_attempts(phone_identity,ip_identity,attempted_at,expires_at)
      SELECT repeat('a',64),repeat('b',64),clock_timestamp()-interval '26 hours',clock_timestamp()-interval '1 hour'
      FROM generate_series(1,1500);
      INSERT INTO identity_schema.otp_rate_limit_blocks(dimension,identity_hash,blocked_until,violation_count,last_violation_at,expires_at)
      SELECT 'PHONE',md5(i::text)||md5(('x'||i)::text),clock_timestamp()-interval '1 hour',1,clock_timestamp()-interval '26 hours',clock_timestamp()-interval '1 hour'
      FROM generate_series(1,1200) i;
      INSERT INTO identity_schema.otp_rate_limit_attempts(phone_identity,ip_identity) VALUES(repeat('c',64),repeat('d',64));
    `);
    await expect(limiterA.cleanupExpired()).resolves.toBe(2700);
    const remaining=await database.query<{attempts:number;blocks:number}>(`SELECT (SELECT count(*)::int FROM identity_schema.otp_rate_limit_attempts) attempts,(SELECT count(*)::int FROM identity_schema.otp_rate_limit_blocks) blocks`);
    expect(remaining.rows[0]).toEqual({attempts:1,blocks:0});
  });

  it('has the additive constraints and lookup/expiry indexes required by enforcement',async()=>{
    const constraints=await database.query<{name:string}>(`SELECT conname name FROM pg_constraint WHERE conrelid IN ('identity_schema.otp_rate_limit_attempts'::regclass,'identity_schema.otp_rate_limit_blocks'::regclass)`);
    expect(constraints.rows.map(row=>row.name)).toEqual(expect.arrayContaining(['otp_rate_limit_attempts_expiry_check','otp_rate_limit_blocks_dimension_check','otp_rate_limit_blocks_pkey']));
    const indexes=await database.query<{indexname:string}>(`SELECT indexname FROM pg_indexes WHERE schemaname='identity_schema' AND tablename IN ('otp_rate_limit_attempts','otp_rate_limit_blocks')`);
    expect(indexes.rows.map(row=>row.indexname)).toEqual(expect.arrayContaining(['otp_rate_limit_attempts_phone_time_idx','otp_rate_limit_attempts_ip_time_idx','otp_rate_limit_attempts_expiry_idx','otp_rate_limit_blocks_expiry_idx']));
  });

  (config.otpAntiFraudPreviousPepper ? it : it.skip)('preserves previous-key attempts, active blocks, and escalation during coordinated rotation',async()=>{
    const previousPepper=config.otpAntiFraudPreviousPepper!;
    const previousVersion=config.otpAntiFraudPreviousPepperVersion!;
    const phone='+79990001003',ip='10.8.0.1';
    const previousPhone=createHmac('sha256',previousPepper).update(`vethelp-otp-anti-fraud:${previousVersion}:phone:${phone}`).digest('hex');
    const previousIp=createHmac('sha256',previousPepper).update(`vethelp-otp-anti-fraud:${previousVersion}:ip:${ip}`).digest('hex');
    await database.query(`INSERT INTO identity_schema.otp_rate_limit_attempts(phone_identity,ip_identity) SELECT $1,$2 FROM generate_series(1,5)`,[previousPhone,previousIp]);
    await expect(decision(limiterA.enforce(phone,'10.8.0.2'))).resolves.toMatchObject({code:'OTP_RATE_LIMITED'});
    await database.query(`TRUNCATE identity_schema.otp_rate_limit_attempts,identity_schema.otp_rate_limit_blocks`);
    const seeded=await database.query(`INSERT INTO identity_schema.otp_rate_limit_blocks(dimension,identity_hash,blocked_until,violation_count,last_violation_at,expires_at) VALUES('PHONE',$1,clock_timestamp()+interval '5 minutes',1,clock_timestamp(),clock_timestamp()+interval '25 hours') RETURNING identity_hash`,[previousPhone]);
    expect(seeded.rowCount).toBe(1);
    await expect(decision(limiterA.enforce(phone,'10.8.0.4'))).resolves.toMatchObject({code:'OTP_TEMPORARILY_BLOCKED'});
    await database.query(`UPDATE identity_schema.otp_rate_limit_blocks SET blocked_until=clock_timestamp()-interval '1 second'`);
    await database.query(`INSERT INTO identity_schema.otp_rate_limit_attempts(phone_identity,ip_identity) SELECT $1,$2 FROM generate_series(1,5)`,[previousPhone,previousIp]);
    const current=await decision(limiterB.enforce(phone,'10.8.0.3')) as {code:string};
    expect(current.code).toBe('OTP_RATE_LIMITED');
    const escalation=await database.query<{seconds:number}>(`SELECT EXTRACT(EPOCH FROM(blocked_until-clock_timestamp()))::int seconds FROM identity_schema.otp_rate_limit_blocks ORDER BY updated_at DESC LIMIT 1`);
    expect(escalation.rows[0].seconds).toBeGreaterThanOrEqual(3595);
  });
});
