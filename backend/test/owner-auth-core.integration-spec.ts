import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../src/database/database.service';
import { OwnerAuthService } from '../src/auth/owner-auth.service';
import { OtpDeliveryCommand, OtpDeliveryOutcome, OtpDeliveryPort } from '../src/auth/otp-delivery.port';
import { OtpAntiFraudService } from '../src/auth/otp-anti-fraud.service';

jest.setTimeout(60_000);

class CapturingDelivery implements OtpDeliveryPort {
  outcome: OtpDeliveryOutcome = 'ACCEPTED';
  calls: OtpDeliveryCommand[] = [];
  pending?: Promise<void>;
  async sendOtp(command: OtpDeliveryCommand) {
    this.calls.push(command);
    if (this.pending) {
      const pending = this.pending;
      this.pending = undefined;
      await pending;
    }
    return { outcome: this.outcome };
  }
  latestCode() { return this.calls.at(-1)?.otpCode ?? ''; }
}

describe('T018 Owner OTP and opaque session core (PostgreSQL)', () => {
  const database = new DatabaseService();
  const delivery = new CapturingDelivery();
  const service = new OwnerAuthService(database, delivery, new OtpAntiFraudService(database));
  const phones = ['+79990000001', '+79990000002', '+79990000003', '+79990000004'];

  beforeEach(async () => {
    delivery.outcome = 'ACCEPTED';
    delivery.calls = [];
    delivery.pending = undefined;
    const owners = await database.query<{ user_id: string }>(`SELECT user_id::text FROM identity_schema.owner_identities WHERE phone_e164 = ANY($1::text[])`, [phones]);
    if (owners.rows.length) {
      const ids = owners.rows.map((row) => row.user_id);
      await database.query(`DELETE FROM identity_schema.owner_sessions WHERE user_id = ANY($1::uuid[])`, [ids]);
    }
    await database.query(`DELETE FROM identity_schema.otp_challenges WHERE phone_e164 = ANY($1::text[])`, [phones]);
    await database.query(`TRUNCATE identity_schema.otp_rate_limit_attempts, identity_schema.otp_rate_limit_blocks`);
  });
  afterAll(async () => database.onModuleDestroy());

  it('creates, cools down, resends and supersedes old verifier material', async () => {
    const first = await service.requestOtp({ phone: phones[0], clientIp: '127.0.0.1' });
    const oldCode = delivery.latestCode();
    expect(first).toMatchObject({ challengeId: expect.any(String), expiresAt: expect.any(String), resendAvailableAt: expect.any(String) });
    expect(first).not.toHaveProperty('developmentCode');
    await expect(service.requestOtp({ phone: phones[0], clientIp: '127.0.0.1' })).rejects.toMatchObject({ response: { code: 'OTP_RESEND_COOLDOWN' } });
    await expect(service.resendOtp({ challengeId: first.challengeId, clientIp: '127.0.0.1' })).rejects.toMatchObject({ response: { code: 'OTP_RESEND_COOLDOWN' } });

    await database.query(`UPDATE identity_schema.otp_challenges SET resend_available_at=clock_timestamp()-interval '1 second' WHERE id=$1::uuid`, [first.challengeId]);
    const resent = await service.resendOtp({ challengeId: first.challengeId, clientIp: '127.0.0.1' });
    const newCode = delivery.latestCode();
    expect(resent.challengeId).toBe(first.challengeId);
    expect(newCode).not.toBe(oldCode);
    await expect(service.verifyOtp({ challengeId: first.challengeId, code: oldCode })).rejects.toMatchObject({ response: { code: 'OTP_INVALID' } });
    await expect(service.verifyOtp({ challengeId: first.challengeId, code: newCode })).resolves.toMatchObject({ sessionToken: expect.stringMatching(/^vh_/), owner: { id: expect.any(String) } });
  });

  it('uses DB expiry, bounds attempts at five and hides absent challenges', async () => {
    const expired = await service.requestOtp({ phone: phones[1], clientIp: '127.0.0.1' });
    await database.query(`UPDATE identity_schema.otp_challenges SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1::uuid`, [expired.challengeId]);
    await expect(service.verifyOtp({ challengeId: expired.challengeId, code: delivery.latestCode() })).rejects.toMatchObject({ response: { code: 'OTP_EXPIRED' } });
    await expect(service.verifyOtp({ challengeId: randomUUID(), code: '000000' })).rejects.toMatchObject({ response: { code: 'OTP_CHALLENGE_NOT_FOUND' } });

    const bounded = await service.requestOtp({ phone: phones[2], clientIp: '127.0.0.1' });
    for (let remaining = 4; remaining >= 0; remaining -= 1) {
      await expect(service.verifyOtp({ challengeId: bounded.challengeId, code: '999999' }))
        .rejects.toMatchObject({ response: { code: 'OTP_INVALID', attemptsRemaining: remaining } });
    }
    await expect(service.verifyOtp({ challengeId: bounded.challengeId, code: delivery.latestCode() }))
      .rejects.toMatchObject({ response: { code: 'OTP_INVALID', attemptsRemaining: 0 } });
  });

  it('allows one concurrent verify winner, one session and rejects replay', async () => {
    const challenge = await service.requestOtp({ phone: phones[3], clientIp: '127.0.0.1' });
    const code = delivery.latestCode();
    const attempts = await Promise.allSettled(Array.from({ length: 12 }, () => service.verifyOtp({ challengeId: challenge.challengeId, code })));
    expect(attempts.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((item) => item.status === 'rejected')).toHaveLength(11);
    const evidence = await database.query<{ sessions: string; consumed: boolean }>(`
      SELECT (SELECT count(*)::text FROM identity_schema.owner_sessions s JOIN identity_schema.owner_identities i ON i.user_id=s.user_id WHERE i.phone_e164=$1) AS sessions,
             consumed_at IS NOT NULL AS consumed
      FROM identity_schema.otp_challenges WHERE id=$2::uuid
    `, [phones[3], challenge.challengeId]);
    expect(evidence.rows[0]).toEqual({ sessions: '1', consumed: true });
    await expect(service.verifyOtp({ challengeId: challenge.challengeId, code })).rejects.toMatchObject({ response: { code: 'OTP_ALREADY_USED' } });
  });

  it('never reports success for a delayed delivery superseded by a newer request', async () => {
    let release!: () => void;
    delivery.pending = new Promise<void>((resolve) => { release = resolve; });
    const delayed = service.requestOtp({ phone: phones[0], clientIp: '127.0.0.1' });
    for (let attempt = 0; delivery.calls.length === 0 && attempt < 400; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(delivery.calls).toHaveLength(1);
    await database.query(`UPDATE identity_schema.otp_challenges SET resend_available_at=clock_timestamp()-interval '1 second' WHERE phone_e164=$1`, [phones[0]]);
    await expect(service.requestOtp({ phone: phones[0], clientIp: '127.0.0.1' })).resolves.toMatchObject({ challengeId: expect.any(String) });
    release();
    await expect(delayed).rejects.toMatchObject({ response: { code: 'OTP_ALREADY_USED' } });
  });

  it.each([
    ['PROVIDER_REJECTED', 'OTP_PROVIDER_UNAVAILABLE'],
    ['PROVIDER_UNAVAILABLE', 'OTP_PROVIDER_UNAVAILABLE'],
    ['PROVIDER_RETRYABLE_FAILURE', 'OTP_PROVIDER_UNAVAILABLE'],
    ['PROVIDER_FINAL_FAILURE', 'OTP_PROVIDER_UNAVAILABLE'],
    ['PROVIDER_TIMEOUT', 'OTP_PROVIDER_TIMEOUT'],
    ['OUTCOME_UNKNOWN', 'OTP_PROVIDER_OUTCOME_UNKNOWN'],
  ] as Array<[OtpDeliveryOutcome, string]>)('does not verify or create a session after %s', async (outcome, code) => {
    delivery.outcome = outcome;
    const phone = phones[0];
    await expect(service.requestOtp({ phone, clientIp: '127.0.0.1' })).rejects.toMatchObject({ response: { code } });
    const state = await database.query<{ sessions: string; accepted: string }>(`
      SELECT (SELECT count(*)::text FROM identity_schema.owner_sessions s JOIN identity_schema.owner_identities i ON i.user_id=s.user_id WHERE i.phone_e164=$1) AS sessions,
             count(*) FILTER (WHERE delivery_outcome='ACCEPTED')::text AS accepted
      FROM identity_schema.otp_challenges WHERE phone_e164=$1
    `, [phone]);
    expect(state.rows[0]).toEqual({ sessions: '0', accepted: '0' });
  });

  it('validates and idempotently revokes only the hashed opaque session', async () => {
    const challenge = await service.requestOtp({ phone: phones[0], clientIp: '127.0.0.1' });
    const session = await service.verifyOtp({ challengeId: challenge.challengeId, code: delivery.latestCode() });
    await expect(service.authenticateSession(session.sessionToken)).resolves.toMatchObject({ sub: session.owner.id, roles: ['OWNER'] });
    await expect(service.authenticateSession('vh_' + 'x'.repeat(64))).rejects.toMatchObject({ response: { code: 'INVALID_SESSION' } });
    await service.revokeSession(session.sessionToken);
    await service.revokeSession(session.sessionToken);
    await expect(service.authenticateSession(session.sessionToken)).rejects.toMatchObject({ response: { code: 'INVALID_SESSION' } });
    const stored = await database.query<{ raw: string }>(`SELECT count(*)::text AS raw FROM identity_schema.owner_sessions WHERE session_token_hash=$1 OR refresh_token_hash=$1`, [session.sessionToken]);
    expect(stored.rows[0].raw).toBe('0');
    const audit = await database.query<{ payload_json: Record<string, unknown> }>(`
      SELECT payload_json FROM audit_schema.audit_log
      WHERE aggregate_type='owner_identity' AND aggregate_id=$1::uuid
      ORDER BY occurred_at DESC LIMIT 1
    `, [session.owner.id]);
    const serialized = JSON.stringify(audit.rows[0].payload_json);
    expect(serialized).not.toContain(delivery.latestCode());
    expect(serialized).not.toContain(phones[0]);
    expect(serialized).not.toContain(session.sessionToken);

    const second = await service.requestOtp({ phone: phones[1], clientIp: '127.0.0.1' });
    const expiring = await service.verifyOtp({ challengeId: second.challengeId, code: delivery.latestCode() });
    await database.query(`UPDATE identity_schema.owner_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE session_token_hash IS NOT NULL AND user_id=$1::uuid`, [expiring.owner.id]);
    await expect(service.authenticateSession(expiring.sessionToken)).rejects.toMatchObject({ response: { code: 'INVALID_SESSION' } });
  });
});
