import { HttpStatus, Injectable } from '@nestjs/common';
import { DomainException } from '../../common/domain-error';
import { DatabaseService } from '../../database/database.service';
import { LiveKitService } from './livekit.service';

export interface OwnerTelemedRoomAccess {
  sessionId: string;
  version: number;
  accessToken: string;
  tokenExpiresAt: string;
  livekitUrl: string;
}

@Injectable()
export class TelemedOwnerRoomService {
  private static constTokenTtlSeconds = 30 * 60;

  constructor(
    private readonly database: DatabaseService,
    private readonly liveKit: LiveKitService,
  ) {}

  async createRoomAccess(sessionId: string, ownerId: string): Promise<OwnerTelemedRoomAccess> {
    const session = await this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL lock_timeout = '50ms'");
      await client.query("SET LOCAL statement_timeout = '250ms'");
      const result = await client.query<{
        id: string;
        owner_id: string;
        room_name: string;
        state: string;
        version: number;
      }>(`
        SELECT id::text, owner_id::text, room_name, state, version
        FROM telemed_schema.telemed_sessions
        WHERE id = $1::uuid
          AND owner_id = $2::uuid
        FOR SHARE
      `, [sessionId, ownerId]);
      const row = result.rows[0];
      if (!row) {
        throw new DomainException(HttpStatus.NOT_FOUND, 'TELEMED_SESSION_NOT_FOUND', 'Telemedicine session not found');
      }
      if (row.state !== 'CONNECTED') {
        throw new DomainException(HttpStatus.CONFLICT, 'TELEMED_DOCTOR_NOT_CONNECTED', 'Doctor has not joined yet');
      }
      return row;
    });

    const accessToken = await this.liveKit.generateLiveKitToken(session.room_name, ownerId, false);
    return {
      sessionId: session.id,
      version: session.version,
      accessToken,
      tokenExpiresAt: new Date(Date.now() + TelemedOwnerRoomService.constTokenTtlSeconds * 1000).toISOString(),
      livekitUrl: this.liveKit.apiUrl(),
    };
  }
}
