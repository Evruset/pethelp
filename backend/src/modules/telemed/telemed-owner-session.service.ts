import { Injectable } from '@nestjs/common';
import { DomainErrors } from '../../common/domain-error';
import { DatabaseService } from '../../database/database.service';
import { TelemedSessionState } from './telemed.service';

export interface OwnerTelemedSessionSnapshot {
  sessionId: string;
  state: TelemedSessionState;
  doctorJoinDeadlineAt: string;
  serverNow: string;
  version: number;
}

@Injectable()
export class TelemedOwnerSessionService {
  constructor(private readonly database: DatabaseService) {}

  async read(sessionId: string, ownerId: string): Promise<OwnerTelemedSessionSnapshot> {
    const result = await this.database.query<{
      id: string;
      state: TelemedSessionState;
      expires_at: Date;
      server_now: Date;
      version: number;
    }>(`
      SELECT
        id::text,
        state,
        expires_at,
        clock_timestamp() AS server_now,
        version
      FROM telemed_schema.telemed_sessions
      WHERE id = $1::uuid
        AND owner_id = $2::uuid
    `, [sessionId, ownerId]);
    const row = result.rows[0];
    if (!row) throw DomainErrors.holdNotFound();
    return {
      sessionId: row.id,
      state: row.state,
      doctorJoinDeadlineAt: row.expires_at.toISOString(),
      serverNow: row.server_now.toISOString(),
      version: row.version,
    };
  }
}
