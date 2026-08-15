import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';
import { config } from '../config';
import { DatabaseService } from '../database/database.service';
import { JwtPayload, Role } from './auth.types';
import { OTP_DELIVERY_PORT, OtpDeliveryOutcome, OtpDeliveryPort } from './otp-delivery.port';
import { OtpAntiFraudService } from './otp-anti-fraud.service';

const phonePattern = /^\+[1-9]\d{7,14}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const otpPattern = /^\d{6}$/;
const sessionPattern = /^vh_[A-Za-z0-9_-]{64}$/;

type ChallengeResult = {
  challengeId: string;
  expiresAt: Date;
  resendAvailableAt: Date;
  deliveryOutcome: OtpDeliveryOutcome;
};

export type OwnerSessionResult = {
  sessionToken: string;
  expiresAt: string;
  owner: { id: string };
};

@Injectable()
export class OwnerAuthService {
  constructor(
    private readonly database: DatabaseService,
    @Inject(OTP_DELIVERY_PORT) private readonly delivery: OtpDeliveryPort,
    private readonly antiFraud: OtpAntiFraudService,
  ) {}

  async requestOtp(input: { phone: string; clientIp: string; correlationId?: string }): Promise<{
    challengeId: string;
    expiresAt: string;
    resendAvailableAt: string;
  }> {
    const phone = this.normalizePhone(input.phone);
    await this.antiFraud.enforce(phone, input.clientIp);
    const code = this.otpCode();
    const challengeId = randomUUID();
    const deliveryAttemptId = randomUUID();
    const correlationId = uuidPattern.test(input.correlationId ?? '') ? input.correlationId! : randomUUID();

    const result = await this.database.withTransaction(async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`owner-otp:${phone}`]);
      const recent = await client.query<{ resend_available_at: Date }>(`
        SELECT resend_available_at
        FROM identity_schema.otp_challenges
        WHERE phone_e164 = $1
          AND consumed_at IS NULL
          AND superseded_at IS NULL
          AND resend_available_at > clock_timestamp()
        ORDER BY created_at DESC
        LIMIT 1
      `, [phone]);
      if (recent.rows[0]) this.failCooldown(recent.rows[0].resend_available_at);

      await client.query(`
        UPDATE identity_schema.otp_challenges
        SET superseded_at = clock_timestamp(), updated_at = clock_timestamp()
        WHERE phone_e164 = $1 AND consumed_at IS NULL AND superseded_at IS NULL
      `, [phone]);

      const inserted = await client.query<{
        challenge_id: string;
        expires_at: Date;
        resend_available_at: Date;
      }>(`
        INSERT INTO identity_schema.otp_challenges (
          id, phone_e164, code_hash, expires_at, resend_available_at,
          attempts_remaining, delivery_attempt_id, verifier_key_version
        ) VALUES (
          $1::uuid, $2, $3, clock_timestamp() + interval '5 minutes',
          clock_timestamp() + interval '60 seconds', 5, $4::uuid, $5
        )
        RETURNING id::text AS challenge_id, expires_at, resend_available_at
      `, [challengeId, phone, this.otpHash(challengeId, phone, code, config.otpPepperVersion), deliveryAttemptId, config.otpPepperVersion]);
      const row = inserted.rows[0];
      return {
        challengeId: row.challenge_id,
        expiresAt: row.expires_at,
        resendAvailableAt: row.resend_available_at,
        deliveryOutcome: 'PROVIDER_FINAL_FAILURE' as OtpDeliveryOutcome,
      };
    });

    const delivery = await this.delivery.sendOtp({
      deliveryAttemptId, challengeId, destination: phone, otpCode: code,
      expiresAt: result.expiresAt, correlationId,
    });
    const recorded = await this.recordDeliveryOutcome(challengeId, deliveryAttemptId, delivery.outcome);
    if (!recorded) this.failAlreadyUsed();
    result.deliveryOutcome = delivery.outcome;

    this.assertDeliveryAccepted(result.deliveryOutcome);
    return this.publicChallenge(result);
  }

  async resendOtp(input: { challengeId: string; clientIp: string; correlationId?: string }): Promise<{
    challengeId: string;
    expiresAt: string;
    resendAvailableAt: string;
  }> {
    if (!uuidPattern.test(input.challengeId)) this.failNotFound();
    const identity = await this.database.query<{ phone_e164: string }>('SELECT phone_e164 FROM identity_schema.otp_challenges WHERE id = $1::uuid', [input.challengeId]);
    if (!identity.rows[0]) this.failNotFound();
    await this.antiFraud.enforce(identity.rows[0].phone_e164, input.clientIp);
    const code = this.otpCode();
    const deliveryAttemptId = randomUUID();
    const correlationId = uuidPattern.test(input.correlationId ?? '') ? input.correlationId! : randomUUID();

    const result = await this.database.withTransaction(async (client) => {
      const challenge = await client.query<{
        phone_e164: string;
        consumed_at: Date | null;
        superseded_at: Date | null;
        resend_available_at: Date;
        server_now: Date;
      }>(`
        SELECT phone_e164, consumed_at, superseded_at, resend_available_at,
               clock_timestamp() AS server_now
        FROM identity_schema.otp_challenges
        WHERE id = $1::uuid
        FOR UPDATE
      `, [input.challengeId]);
      const row = challenge.rows[0];
      if (!row) this.failNotFound();
      if (row.consumed_at || row.superseded_at) this.failAlreadyUsed();
      if (row.resend_available_at > row.server_now) this.failCooldown(row.resend_available_at);

      const updated = await client.query<{ expires_at: Date; resend_available_at: Date }>(`
        UPDATE identity_schema.otp_challenges
        SET code_hash = $2,
            expires_at = clock_timestamp() + interval '5 minutes',
            resend_available_at = clock_timestamp() + interval '60 seconds',
            attempts_remaining = 5,
            generation = generation + 1,
            delivery_attempt_id = $3::uuid,
            delivery_outcome = NULL,
            verifier_key_version = $4,
            updated_at = clock_timestamp()
        WHERE id = $1::uuid
        RETURNING expires_at, resend_available_at
      `, [input.challengeId, this.otpHash(input.challengeId, row.phone_e164, code, config.otpPepperVersion), deliveryAttemptId, config.otpPepperVersion]);
      const timestamps = updated.rows[0];
      return {
        challengeId: input.challengeId,
        expiresAt: timestamps.expires_at,
        resendAvailableAt: timestamps.resend_available_at,
        deliveryOutcome: 'PROVIDER_FINAL_FAILURE' as OtpDeliveryOutcome,
        destination: row.phone_e164,
      };
    });

    const delivery = await this.delivery.sendOtp({
      deliveryAttemptId, challengeId: input.challengeId, destination: result.destination,
      otpCode: code, expiresAt: result.expiresAt, correlationId,
    });
    const recorded = await this.recordDeliveryOutcome(input.challengeId, deliveryAttemptId, delivery.outcome);
    if (!recorded) this.failAlreadyUsed();
    result.deliveryOutcome = delivery.outcome;

    this.assertDeliveryAccepted(result.deliveryOutcome);
    return this.publicChallenge(result);
  }

  async verifyOtp(input: { challengeId: string; code: string; deviceName?: string }): Promise<OwnerSessionResult> {
    if (!uuidPattern.test(input.challengeId)) this.failNotFound();
    if (!otpPattern.test(input.code)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'code must contain exactly six digits.' });
    }

    const outcome = await this.database.withTransaction(async (client) => {
      const challenge = await client.query<{
        phone_e164: string;
        code_hash: string;
        expires_at: Date;
        attempts_remaining: number;
        consumed_at: Date | null;
        superseded_at: Date | null;
        delivery_outcome: OtpDeliveryOutcome | null;
        verifier_key_version: string;
        server_now: Date;
      }>(`
        SELECT phone_e164, code_hash, expires_at, attempts_remaining,
               consumed_at, superseded_at, delivery_outcome, verifier_key_version,
               clock_timestamp() AS server_now
        FROM identity_schema.otp_challenges
        WHERE id = $1::uuid
        FOR UPDATE
      `, [input.challengeId]);
      const row = challenge.rows[0];
      if (!row) return { kind: 'NOT_FOUND' as const };
      if (row.consumed_at || row.superseded_at) return { kind: 'ALREADY_USED' as const };
      if (row.expires_at <= row.server_now) return { kind: 'EXPIRED' as const };
      if (row.delivery_outcome !== 'ACCEPTED') this.assertDeliveryAccepted(row.delivery_outcome ?? 'PROVIDER_FINAL_FAILURE');
      if (row.attempts_remaining <= 0) return { kind: 'INVALID' as const, remaining: 0 };

      if (!this.equalHash(row.code_hash, this.otpHash(input.challengeId, row.phone_e164, input.code, row.verifier_key_version))) {
        const decremented = await client.query<{ attempts_remaining: number }>(`
          UPDATE identity_schema.otp_challenges
          SET attempts_remaining = GREATEST(attempts_remaining - 1, 0), updated_at = clock_timestamp()
          WHERE id = $1::uuid
          RETURNING attempts_remaining
        `, [input.challengeId]);
        return { kind: 'INVALID' as const, remaining: decremented.rows[0].attempts_remaining };
      }

      await client.query(`
        UPDATE identity_schema.otp_challenges
        SET consumed_at = clock_timestamp(), updated_at = clock_timestamp()
        WHERE id = $1::uuid AND consumed_at IS NULL
      `, [input.challengeId]);
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`owner-phone:${row.phone_e164}`]);
      const owner = await this.findOrCreateOwner(client, row.phone_e164);
      const session = await this.createSession(client, owner.id, input.deviceName);
      await this.writeAuthAudit(client, owner.id, 'user.authenticated', {
        method: 'otp', sessionId: session.sessionId, challengeId: input.challengeId,
      });
      return { kind: 'VERIFIED' as const, ownerId: owner.id, session };
    });

    if (outcome.kind === 'NOT_FOUND') this.failNotFound();
    if (outcome.kind === 'ALREADY_USED') this.failAlreadyUsed();
    if (outcome.kind === 'EXPIRED') this.failExpired();
    if (outcome.kind === 'INVALID') this.failInvalid(outcome.remaining);
    return {
      sessionToken: outcome.session.token,
      expiresAt: outcome.session.expiresAt.toISOString(),
      owner: { id: outcome.ownerId },
    };
  }

  async authenticateSession(token: string): Promise<JwtPayload> {
    if (!sessionPattern.test(token)) this.failSession();
    const result = await this.database.query<{ id: string; user_id: string }>(`
      UPDATE identity_schema.owner_sessions
      SET last_seen_at = clock_timestamp()
      WHERE session_token_hash = $1
        AND revoked_at IS NULL
        AND expires_at > clock_timestamp()
      RETURNING id::text, user_id::text
    `, [this.sessionTokenHash(token)]);
    if (!result.rows[0]) this.failSession();
    return { sub: result.rows[0].user_id, roles: [Role.OWNER] };
  }

  async revokeSession(token: string): Promise<void> {
    if (!sessionPattern.test(token)) return;
    await this.database.query(`
      UPDATE identity_schema.owner_sessions
      SET revoked_at = COALESCE(revoked_at, clock_timestamp()), last_seen_at = clock_timestamp()
      WHERE session_token_hash = $1
    `, [this.sessionTokenHash(token)]);
  }

  async profile(owner: JwtPayload): Promise<{ owner: { id: string; phone: string }; petsCount: number }> {
    const result = await this.database.query<{ phone_e164: string; pets_count: number }>(`
      SELECT identity.phone_e164,
             (SELECT count(*)::int FROM pet_schema.pets WHERE owner_id = identity.user_id) AS pets_count
      FROM identity_schema.owner_identities identity
      WHERE identity.user_id = $1::uuid
    `, [owner.sub]);
    const row = result.rows[0];
    if (!row) throw new UnauthorizedException({ code: 'OWNER_IDENTITY_NOT_FOUND', message: 'Owner identity is unavailable.' });
    return { owner: { id: owner.sub, phone: row.phone_e164 }, petsCount: row.pets_count };
  }

  private async findOrCreateOwner(client: PoolClient, phone: string): Promise<{ id: string }> {
    const existing = await client.query<{ user_id: string }>(`
      SELECT user_id::text FROM identity_schema.owner_identities WHERE phone_e164 = $1 FOR UPDATE
    `, [phone]);
    if (existing.rows[0]) return { id: existing.rows[0].user_id };
    const user = await client.query<{ id: string }>(`INSERT INTO identity_schema.users (id) VALUES (gen_random_uuid()) RETURNING id::text`);
    await client.query(`INSERT INTO identity_schema.owner_identities (user_id, phone_e164) VALUES ($1::uuid, $2)`, [user.rows[0].id, phone]);
    return { id: user.rows[0].id };
  }

  private async createSession(client: PoolClient, userId: string, deviceName?: string): Promise<{
    sessionId: string; token: string; expiresAt: Date;
  }> {
    const token = `vh_${randomBytes(48).toString('base64url')}`;
    const sessionId = randomUUID();
    const hash = this.sessionTokenHash(token);
    const inserted = await client.query<{ expires_at: Date }>(`
      INSERT INTO identity_schema.owner_sessions (
        id, user_id, refresh_token_hash, session_token_hash, device_name, expires_at
      ) VALUES (
        $1::uuid, $2::uuid, $3, $3, $4, clock_timestamp() + interval '30 days'
      ) RETURNING expires_at
    `, [sessionId, userId, hash, deviceName?.trim().slice(0, 120) || null]);
    return { sessionId, token, expiresAt: inserted.rows[0].expires_at };
  }

  private async writeAuthAudit(client: PoolClient, ownerId: string, action: string, payload: Record<string, unknown>): Promise<void> {
    await client.query(`
      INSERT INTO audit_schema.audit_log (actor_type, actor_id, action, aggregate_type, aggregate_id, payload_json)
      VALUES ('OWNER', $1::text, $2::text, 'owner_identity', $1::uuid, $3::jsonb)
    `, [ownerId, action, JSON.stringify(payload)]);
  }

  private async recordDeliveryOutcome(challengeId: string, deliveryAttemptId: string, outcome: OtpDeliveryOutcome): Promise<boolean> {
    const updated = await this.database.query(`
      UPDATE identity_schema.otp_challenges
      SET delivery_outcome = $3, updated_at = clock_timestamp()
      WHERE id = $1::uuid
        AND delivery_attempt_id = $2::uuid
        AND consumed_at IS NULL
        AND superseded_at IS NULL
        AND expires_at > clock_timestamp()
      RETURNING id
    `, [challengeId, deliveryAttemptId, outcome]);
    return updated.rowCount === 1;
  }

  private publicChallenge(result: ChallengeResult) {
    return {
      challengeId: result.challengeId,
      expiresAt: result.expiresAt.toISOString(),
      resendAvailableAt: result.resendAvailableAt.toISOString(),
    };
  }

  private normalizePhone(value: string): string {
    const phone = value.trim().replace(/[\s()-]/g, '');
    if (!phonePattern.test(phone)) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'phone must be valid E.164.' });
    return phone;
  }

  private otpCode(): string {
    const localOtpMode = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
    const configured = localOtpMode ? process.env.AUTH_DEV_OTP_CODE : undefined;
    if (configured !== undefined) {
      if (!otpPattern.test(configured)) throw new Error('AUTH_DEV_OTP_CODE must contain exactly six digits.');
      return configured;
    }
    return String(randomBytes(4).readUInt32BE() % 1_000_000).padStart(6, '0');
  }

  private otpHash(challengeId: string, phone: string, code: string, version: string): string {
    const pepper = version === config.otpPepperVersion
      ? config.otpPepper
      : version === config.otpPreviousPepperVersion
        ? config.otpPreviousPepper
        : undefined;
    if (!pepper) throw new HttpException({ code: 'INTERNAL_ERROR', message: 'Authentication is temporarily unavailable.' }, HttpStatus.INTERNAL_SERVER_ERROR);
    return createHmac('sha256', pepper).update(`vethelp-owner-otp:${version}:${challengeId}:${phone}:${code}`).digest('hex');
  }

  private sessionTokenHash(token: string): string {
    return createHash('sha256').update(`vethelp-owner-session:v1:${token}`).digest('hex');
  }

  private equalHash(left: string, right: string): boolean {
    const a = Buffer.from(left, 'hex');
    const b = Buffer.from(right, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private assertDeliveryAccepted(outcome: OtpDeliveryOutcome): void {
    if (outcome === 'ACCEPTED') return;
    if (outcome === 'PROVIDER_TIMEOUT') {
      throw new HttpException({ code: 'OTP_PROVIDER_TIMEOUT', message: 'Delivery outcome is uncertain.' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (outcome === 'OUTCOME_UNKNOWN') {
      throw new HttpException({ code: 'OTP_PROVIDER_OUTCOME_UNKNOWN', message: 'Delivery outcome is uncertain.' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
    throw new HttpException({ code: 'OTP_PROVIDER_UNAVAILABLE', message: 'OTP delivery is unavailable.' }, HttpStatus.SERVICE_UNAVAILABLE);
  }

  private failCooldown(at: Date): never {
    throw new HttpException({ code: 'OTP_RESEND_COOLDOWN', message: 'Resend is not available yet.', retryAt: at.toISOString() }, HttpStatus.TOO_MANY_REQUESTS);
  }
  private failNotFound(): never { throw new HttpException({ code: 'OTP_CHALLENGE_NOT_FOUND', message: 'Challenge was not found.' }, HttpStatus.NOT_FOUND); }
  private failAlreadyUsed(): never { throw new HttpException({ code: 'OTP_ALREADY_USED', message: 'Challenge is no longer active.' }, HttpStatus.CONFLICT); }
  private failExpired(): never { throw new HttpException({ code: 'OTP_EXPIRED', message: 'Challenge has expired.' }, HttpStatus.GONE); }
  private failInvalid(remaining: number): never { throw new UnauthorizedException({ code: 'OTP_INVALID', message: 'OTP is invalid.', attemptsRemaining: remaining }); }
  private failSession(): never { throw new UnauthorizedException({ code: 'INVALID_SESSION', message: 'Session is invalid, expired or revoked.' }); }
}
