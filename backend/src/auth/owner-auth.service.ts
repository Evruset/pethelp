import { BadRequestException, HttpException, HttpStatus, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';
import { config } from '../config';
import { DatabaseService } from '../database/database.service';
import { JwtPayload, Role } from './auth.types';

const phonePattern = /^\+[1-9]\d{7,14}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const otpPattern = /^\d{6}$/;
const accessLifetimeSeconds = 15 * 60;

type RequestedChallenge = {
  challengeId: string;
  expiresAt: Date;
  resendAvailableAt: Date;
};

type SessionMaterial = {
  sessionId: string;
  userId: string;
  refreshToken: string;
};

export type OwnerAuthTokens = {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  refreshToken: string;
  owner: { id: string; phone: string };
};

@Injectable()
export class OwnerAuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwt: JwtService,
  ) {}

  async requestOtp(input: { phone: string }): Promise<{
    challengeId: string;
    expiresAt: string;
    resendAvailableAt: string;
    developmentCode?: string;
  }> {
    const phone = this.normalizePhone(input.phone);
    const code = this.developmentOtpCode();
    const challengeId = randomUUID();
    const requested = await this.database.withTransaction(async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`owner-otp:${phone}`]);
      const recent = await client.query<{ resend_available_at: Date }>(`
        SELECT created_at + interval '60 seconds' AS resend_available_at
        FROM identity_schema.otp_challenges
        WHERE phone_e164 = $1
          AND created_at > clock_timestamp() - interval '60 seconds'
        ORDER BY created_at DESC
        LIMIT 1
      `, [phone]);
      if (recent.rows[0]) {
        return { kind: 'RATE_LIMITED' as const, resendAvailableAt: recent.rows[0].resend_available_at };
      }

      const row = await client.query<RequestedChallenge>(`
        INSERT INTO identity_schema.otp_challenges (
          id, phone_e164, code_hash, expires_at, attempts_remaining
        ) VALUES (
          $1::uuid, $2, $3, clock_timestamp() + interval '5 minutes', 5
        )
        RETURNING id AS "challengeId", expires_at AS "expiresAt", created_at + interval '60 seconds' AS "resendAvailableAt"
      `, [challengeId, phone, this.otpHash(challengeId, phone, code)]);
      return { kind: 'CREATED' as const, value: row.rows[0] };
    });

    if (requested.kind === 'RATE_LIMITED') {
      throw new HttpException({
        code: 'OTP_RATE_LIMITED',
        message: 'A verification code was recently requested. Please wait before retrying.',
        resendAvailableAt: requested.resendAvailableAt.toISOString(),
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    return {
      challengeId: requested.value.challengeId,
      expiresAt: requested.value.expiresAt.toISOString(),
      resendAvailableAt: requested.value.resendAvailableAt.toISOString(),
      ...(this.isDevelopment() ? { developmentCode: code } : {}),
    };
  }

  async verifyOtp(input: { phone: string; challengeId: string; code: string; deviceName?: string }): Promise<OwnerAuthTokens> {
    const phone = this.normalizePhone(input.phone);
    if (!uuidPattern.test(input.challengeId)) {
      throw new BadRequestException({ code: 'INVALID_OTP_CHALLENGE', message: 'challengeId must be a UUID.' });
    }
    if (!otpPattern.test(input.code)) {
      throw new BadRequestException({ code: 'INVALID_OTP_CODE', message: 'code must contain exactly six digits.' });
    }

    const outcome = await this.database.withTransaction(async (client) => {
      const challenge = await client.query<{
        id: string;
        phone_e164: string;
        code_hash: string;
        expires_at: Date;
        attempts_remaining: number;
        consumed_at: Date | null;
      }>(`
        SELECT id, phone_e164, code_hash, expires_at, attempts_remaining, consumed_at
        FROM identity_schema.otp_challenges
        WHERE id = $1::uuid
        FOR UPDATE
      `, [input.challengeId]);
      const row = challenge.rows[0];
      if (!row || row.phone_e164 !== phone || row.consumed_at || row.expires_at <= new Date() || row.attempts_remaining <= 0) {
        return { kind: 'INVALID' as const };
      }

      if (!this.equalHash(row.code_hash, this.otpHash(input.challengeId, phone, input.code))) {
        await client.query(`
          UPDATE identity_schema.otp_challenges
          SET attempts_remaining = GREATEST(attempts_remaining - 1, 0)
          WHERE id = $1::uuid
        `, [input.challengeId]);
        return { kind: 'INVALID' as const };
      }

      await client.query(`
        UPDATE identity_schema.otp_challenges
        SET consumed_at = clock_timestamp()
        WHERE id = $1::uuid
      `, [input.challengeId]);
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`owner-phone:${phone}`]);
      const owner = await this.findOrCreateOwner(client, phone);
      const session = await this.createSession(client, owner.id, input.deviceName);
      await this.writeAuthAudit(client, owner.id, 'user.authenticated', {
        method: 'otp',
        sessionId: session.sessionId,
        challengeId: input.challengeId,
        deviceName: input.deviceName?.trim() || null,
      });
      return { kind: 'VERIFIED' as const, owner, session };
    });

    if (outcome.kind !== 'VERIFIED') {
      throw new UnauthorizedException({ code: 'OTP_VERIFICATION_FAILED', message: 'The code is invalid, expired, already used, or has no attempts remaining.' });
    }
    return this.tokens(outcome.session, outcome.owner.phone);
  }

  async refresh(input: { refreshToken: string; deviceName?: string }): Promise<OwnerAuthTokens> {
    const refreshToken = input.refreshToken.trim();
    if (refreshToken.length < 32 || refreshToken.length > 512) {
      throw new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token is invalid.' });
    }

    const outcome = await this.database.withTransaction(async (client) => {
      const active = await client.query<{ id: string; user_id: string; phone_e164: string }>(`
        SELECT session.id, session.user_id, identity.phone_e164
        FROM identity_schema.owner_sessions session
        JOIN identity_schema.owner_identities identity ON identity.user_id = session.user_id
        WHERE session.refresh_token_hash = $1
          AND session.revoked_at IS NULL
          AND session.expires_at > clock_timestamp()
        FOR UPDATE OF session
      `, [this.tokenHash(refreshToken)]);
      const row = active.rows[0];
      if (!row) return { kind: 'INVALID' as const };

      await client.query(`
        UPDATE identity_schema.owner_sessions
        SET revoked_at = clock_timestamp(), last_seen_at = clock_timestamp()
        WHERE id = $1::uuid AND revoked_at IS NULL
      `, [row.id]);
      const session = await this.createSession(client, row.user_id, input.deviceName);
      await this.writeAuthAudit(client, row.user_id, 'user.authenticated', {
        method: 'refresh',
        sessionId: session.sessionId,
        rotatedFromSessionId: row.id,
        deviceName: input.deviceName?.trim() || null,
      });
      return { kind: 'REFRESHED' as const, owner: { id: row.user_id, phone: row.phone_e164 }, session };
    });

    if (outcome.kind !== 'REFRESHED') {
      throw new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token is invalid, expired, or revoked.' });
    }
    return this.tokens(outcome.session, outcome.owner.phone);
  }

  async revoke(input: { refreshToken: string }): Promise<void> {
    const refreshToken = input.refreshToken.trim();
    if (refreshToken.length < 32 || refreshToken.length > 512) return;
    await this.database.query(`
      UPDATE identity_schema.owner_sessions
      SET revoked_at = COALESCE(revoked_at, clock_timestamp()), last_seen_at = clock_timestamp()
      WHERE refresh_token_hash = $1
    `, [this.tokenHash(refreshToken)]);
  }

  async profile(owner: JwtPayload): Promise<{ owner: { id: string; phone: string }; petsCount: number }> {
    const result = await this.database.query<{ phone_e164: string; pets_count: number }>(`
      SELECT identity.phone_e164,
             (SELECT count(*)::int FROM pet_schema.pets WHERE owner_id = identity.user_id) AS pets_count
      FROM identity_schema.owner_identities identity
      WHERE identity.user_id = $1::uuid
    `, [owner.sub]);
    const row = result.rows[0];
    if (!row) {
      throw new UnauthorizedException({ code: 'OWNER_IDENTITY_NOT_FOUND', message: 'Owner identity is unavailable.' });
    }
    return { owner: { id: owner.sub, phone: row.phone_e164 }, petsCount: row.pets_count };
  }

  private async findOrCreateOwner(client: PoolClient, phone: string): Promise<{ id: string; phone: string }> {
    const existing = await client.query<{ user_id: string; phone_e164: string }>(`
      SELECT user_id, phone_e164
      FROM identity_schema.owner_identities
      WHERE phone_e164 = $1
      FOR UPDATE
    `, [phone]);
    if (existing.rows[0]) {
      return { id: existing.rows[0].user_id, phone: existing.rows[0].phone_e164 };
    }

    const user = await client.query<{ id: string }>(`
      INSERT INTO identity_schema.users (id)
      VALUES (gen_random_uuid())
      RETURNING id
    `);
    await client.query(`
      INSERT INTO identity_schema.owner_identities (user_id, phone_e164)
      VALUES ($1::uuid, $2)
    `, [user.rows[0].id, phone]);
    return { id: user.rows[0].id, phone };
  }

  private async createSession(client: PoolClient, userId: string, deviceName?: string): Promise<SessionMaterial> {
    const refreshToken = randomBytes(48).toString('base64url');
    const sessionId = randomUUID();
    await client.query(`
      INSERT INTO identity_schema.owner_sessions (
        id, user_id, refresh_token_hash, device_name, expires_at
      ) VALUES (
        $1::uuid, $2::uuid, $3, $4, clock_timestamp() + interval '30 days'
      )
    `, [sessionId, userId, this.tokenHash(refreshToken), deviceName?.trim() || null]);
    return { sessionId, userId, refreshToken };
  }

  private async writeAuthAudit(client: PoolClient, ownerId: string, action: string, payload: Record<string, unknown>): Promise<void> {
    await client.query(`
      INSERT INTO audit_schema.audit_log (
        actor_type, actor_id, action, aggregate_type, aggregate_id, payload_json
      ) VALUES (
        'OWNER', $1::text, $2::text, 'owner_identity', $1::uuid, $3::jsonb
      )
    `, [ownerId, action, JSON.stringify(payload)]);
  }

  private async tokens(session: SessionMaterial, phone: string): Promise<OwnerAuthTokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: session.userId, roles: [Role.OWNER] },
      {
        algorithm: 'HS256',
        secret: config.jwtSecret,
        issuer: config.jwtIssuer,
        audience: config.jwtAudience,
        expiresIn: accessLifetimeSeconds,
      },
    );
    return {
      accessToken,
      accessTokenExpiresInSeconds: accessLifetimeSeconds,
      refreshToken: session.refreshToken,
      owner: { id: session.userId, phone },
    };
  }

  private normalizePhone(value: string): string {
    const phone = value.trim().replace(/[\s()-]/g, '');
    if (!phonePattern.test(phone)) {
      throw new BadRequestException({ code: 'INVALID_PHONE', message: 'phone must be in E.164 format, for example +79991234567.' });
    }
    return phone;
  }

  private developmentOtpCode(): string {
    if (!this.isDevelopment()) {
      throw new ServiceUnavailableException({
        code: 'OTP_DELIVERY_UNAVAILABLE',
        message: 'OTP delivery provider is not configured for this environment.',
      });
    }
    const code = process.env.AUTH_DEV_OTP_CODE ?? '000000';
    if (!otpPattern.test(code)) {
      throw new Error('AUTH_DEV_OTP_CODE must contain exactly six digits.');
    }
    return code;
  }

  private isDevelopment(): boolean {
    return (process.env.NODE_ENV ?? 'development') !== 'production';
  }

  private otpHash(challengeId: string, phone: string, code: string): string {
    return createHmac('sha256', config.jwtSecret)
      .update(`vethelp-owner-otp:v1:${challengeId}:${phone}:${code}`)
      .digest('hex');
  }

  private tokenHash(value: string): string {
    return createHash('sha256').update(`vethelp-owner-refresh:v1:${value}`).digest('hex');
  }

  private equalHash(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }
}
