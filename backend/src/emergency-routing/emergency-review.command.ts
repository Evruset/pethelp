import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class EmergencyReviewCommand {
  constructor(private readonly database: DatabaseService) {}

  async execute(locationId: string, actorId: string, decision: string, note?: string): Promise<void> {
    await this.database.query(
      'SELECT clinic_schema.review_emergency_profile($1::uuid, $2::uuid, $3::text, $4::text)',
      [locationId, actorId, decision, note ?? null],
    );
  }
}
