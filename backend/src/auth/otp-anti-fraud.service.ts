import { HttpException, HttpStatus, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { config } from '../config';
import { DatabaseService } from '../database/database.service';
import { OtpAntiFraudTelemetry } from './otp-anti-fraud.telemetry';

type DecisionRow = { decision: 'ALLOWED' | 'RATE_LIMITED' | 'BLOCK_ACTIVE'; retry_at: Date | null };

@Injectable()
export class OtpAntiFraudService implements OnModuleInit, OnModuleDestroy {
  private cleanupTimer?: NodeJS.Timeout;
  private cleanupRunning?: Promise<void>;
  constructor(private readonly database: DatabaseService, private readonly telemetry: OtpAntiFraudTelemetry = new OtpAntiFraudTelemetry()) {}
  async onModuleInit(): Promise<void> {
    if (!config.workersEnabled) return;
    void this.startCleanup();
    this.cleanupTimer = setInterval(() => void this.startCleanup(), 60_000);
    this.cleanupTimer.unref();
  }
  async onModuleDestroy(): Promise<void> { if (this.cleanupTimer) clearInterval(this.cleanupTimer); await this.cleanupRunning; }
  async enforce(phone: string, rawIp: string): Promise<void> {
    const ip = this.normalizeIp(rawIp);
    const phoneIdentity = this.identity(config.otpAntiFraudPepper,config.otpAntiFraudPepperVersion,'phone', phone);
    const ipIdentity = this.identity(config.otpAntiFraudPepper,config.otpAntiFraudPepperVersion,'ip', ip);
    const phoneIdentities=[phoneIdentity,...(config.otpAntiFraudPreviousPepper?[this.identity(config.otpAntiFraudPreviousPepper,config.otpAntiFraudPreviousPepperVersion!,'phone',phone)]:[])];
    const ipIdentities=[ipIdentity,...(config.otpAntiFraudPreviousPepper?[this.identity(config.otpAntiFraudPreviousPepper,config.otpAntiFraudPreviousPepperVersion!,'ip',ip)]:[])];
    try {
      const result = await this.database.withTransaction(async (client) => {
        await client.query("SET LOCAL lock_timeout = '5s'");
        await client.query("SET LOCAL statement_timeout = '10s'");
        for (const lock of [...phoneIdentities.map(v=>`PHONE:${v}`),...ipIdentities.map(v=>`IP:${v}`)].sort()) {
          await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 126))', [lock]);
        }
        return client.query<DecisionRow>(`
          WITH db_time AS MATERIALIZED (SELECT clock_timestamp() AS now), active_block AS MATERIALIZED (
            SELECT MAX(blocked_until) AS retry_at FROM identity_schema.otp_rate_limit_blocks, db_time
            WHERE ((dimension='PHONE' AND identity_hash=ANY($8::bpchar[])) OR (dimension='IP' AND identity_hash=ANY($9::bpchar[]))) AND blocked_until>now
          ), inserted AS (
            INSERT INTO identity_schema.otp_rate_limit_attempts (phone_identity,ip_identity,attempted_at,expires_at)
            SELECT $1,$2,now,now+interval '25 hours' FROM db_time
            WHERE NOT EXISTS (SELECT 1 FROM active_block WHERE retry_at IS NOT NULL) RETURNING id
          ), counts AS MATERIALIZED (
            SELECT
              ((SELECT COUNT(*) FROM identity_schema.otp_rate_limit_attempts a,db_time WHERE a.phone_identity=ANY($8::bpchar[]) AND a.attempted_at>now-interval '1 hour')+(SELECT COUNT(*) FROM inserted))::int phone_hour,
              ((SELECT COUNT(*) FROM identity_schema.otp_rate_limit_attempts a,db_time WHERE a.phone_identity=ANY($8::bpchar[]) AND a.attempted_at>now-interval '24 hours')+(SELECT COUNT(*) FROM inserted))::int phone_day,
              ((SELECT COUNT(*) FROM identity_schema.otp_rate_limit_attempts a,db_time WHERE a.ip_identity=ANY($9::bpchar[]) AND a.attempted_at>now-interval '1 hour')+(SELECT COUNT(*) FROM inserted))::int ip_hour
          ), breaches AS MATERIALIZED (
            SELECT dimension FROM counts,active_block CROSS JOIN LATERAL
              (VALUES ('PHONE',phone_hour>$3 OR phone_day>$4),('IP',ip_hour>$5)) v(dimension,breached)
            WHERE active_block.retry_at IS NULL AND breached
          ), blocked AS (
            INSERT INTO identity_schema.otp_rate_limit_blocks
              (dimension,identity_hash,blocked_until,violation_count,last_violation_at,expires_at,updated_at)
            SELECT b.dimension,CASE b.dimension WHEN 'PHONE' THEN $1 ELSE $2 END,
              now+CASE WHEN old.last_violation_at>now-interval '24 hours' THEN make_interval(secs=>$7) ELSE make_interval(secs=>$6) END,
              CASE WHEN old.last_violation_at>now-interval '24 hours' THEN old.violation_count+1 ELSE 1 END,
              now,now+interval '25 hours',now FROM breaches b CROSS JOIN db_time
            LEFT JOIN LATERAL (
              SELECT last_violation_at,violation_count FROM identity_schema.otp_rate_limit_blocks s
              WHERE s.dimension=b.dimension AND s.identity_hash=ANY(CASE b.dimension WHEN 'PHONE' THEN $8::bpchar[] ELSE $9::bpchar[] END)
              ORDER BY last_violation_at DESC LIMIT 1
            ) old ON true
            ON CONFLICT (dimension,identity_hash) DO UPDATE SET blocked_until=EXCLUDED.blocked_until,
              violation_count=EXCLUDED.violation_count,last_violation_at=EXCLUDED.last_violation_at,
              expires_at=EXCLUDED.expires_at,updated_at=EXCLUDED.updated_at RETURNING blocked_until
          ) SELECT CASE WHEN active_block.retry_at IS NOT NULL THEN 'BLOCK_ACTIVE'
              WHEN EXISTS(SELECT 1 FROM blocked) THEN 'RATE_LIMITED' ELSE 'ALLOWED' END decision,
            COALESCE(active_block.retry_at,(SELECT MAX(blocked_until) FROM blocked)) retry_at FROM active_block
        `,[phoneIdentity,ipIdentity,config.otpPhoneHourlyLimit,config.otpPhoneDailyLimit,config.otpIpHourlyLimit,
          config.otpInitialBlockSeconds,config.otpEscalatedBlockSeconds,phoneIdentities,ipIdentities]);
      });
      const decision=result.rows[0];
      this.telemetry.record(decision.decision);
      if(decision.decision!=='ALLOWED') this.reject(decision.decision,decision.retry_at!);
    } catch(error) {
      if(error instanceof HttpException) throw error;
      this.telemetry.record('DATABASE_FAILURE');
      throw new HttpException({code:'INTERNAL_ERROR',message:'Authentication is temporarily unavailable.'},HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
  private normalizeIp(value:string):string { const ip=value.startsWith('::ffff:')?value.slice(7):value; if(!isIP(ip)) throw new HttpException({code:'INTERNAL_ERROR',message:'Authentication is temporarily unavailable.'},503); return ip.toLowerCase(); }
  async cleanupExpired():Promise<number> {
    let deleted=0;
    for(let batch=0;batch<10;batch+=1) {
      const count=await this.cleanupExpiredBatch(); deleted+=count.attempts+count.blocks;
      if(count.attempts<1_000 && count.blocks<1_000) break;
    }
    return deleted;
  }
  private startCleanup():Promise<void> {
    if(this.cleanupRunning) return this.cleanupRunning;
    this.cleanupRunning=this.cleanupExpired().then(()=>undefined).catch(()=>{ this.telemetry.record('DATABASE_FAILURE'); }).finally(()=>{ this.cleanupRunning=undefined; });
    return this.cleanupRunning;
  }
  private async cleanupExpiredBatch():Promise<{attempts:number;blocks:number}> {
    const result=await this.database.withTransaction(async client=>{
      await client.query("SET LOCAL lock_timeout='250ms'"); await client.query("SET LOCAL statement_timeout='2s'");
      return client.query<{attempt_count:number;block_count:number}>(`
      WITH attempt_candidates AS (
        SELECT id FROM identity_schema.otp_rate_limit_attempts WHERE expires_at<=clock_timestamp()
        ORDER BY expires_at,id FOR UPDATE SKIP LOCKED LIMIT 1000
      ), deleted_attempts AS (
        DELETE FROM identity_schema.otp_rate_limit_attempts a USING attempt_candidates c WHERE a.id=c.id RETURNING a.id
      ), block_candidates AS (
        SELECT dimension,identity_hash FROM identity_schema.otp_rate_limit_blocks WHERE expires_at<=clock_timestamp()
        ORDER BY expires_at,dimension,identity_hash FOR UPDATE SKIP LOCKED LIMIT 1000
      ), deleted_blocks AS (
        DELETE FROM identity_schema.otp_rate_limit_blocks b USING block_candidates c
        WHERE b.dimension=c.dimension AND b.identity_hash=c.identity_hash RETURNING b.identity_hash
      ) SELECT (SELECT COUNT(*)::int FROM deleted_attempts) attempt_count,(SELECT COUNT(*)::int FROM deleted_blocks) block_count
    `); });
    return {attempts:result.rows[0].attempt_count,blocks:result.rows[0].block_count};
  }
  private identity(pepper:string,version:string,dimension:'phone'|'ip',value:string):string { return createHmac('sha256',pepper).update(`vethelp-otp-anti-fraud:${version}:${dimension}:${value}`).digest('hex'); }
  private reject(decision:'RATE_LIMITED'|'BLOCK_ACTIVE',retryAt:Date):never { throw new HttpException({code:decision==='BLOCK_ACTIVE'?'OTP_TEMPORARILY_BLOCKED':'OTP_RATE_LIMITED',message:'OTP request is temporarily unavailable. Try again later.',retryAt:retryAt.toISOString()},HttpStatus.TOO_MANY_REQUESTS); }
}
