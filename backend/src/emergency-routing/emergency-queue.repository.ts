import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface PendingEmergencyReview {
  reviewId: string;
  clinicId: string;
  clinicName: string;
  clinicStatus: string;
  evidenceUrl: string;
  submittedAt: string;
  queueAgeSeconds: number;
}

export interface PendingEmergencyReviewsPage {
  page: number;
  limit: number;
  total: number;
  items: PendingEmergencyReview[];
}

@Injectable()
export class EmergencyQueueRepository {
  constructor(private readonly database: DatabaseService) {}

  async getPendingReviews(page: number, limit: number): Promise<PendingEmergencyReviewsPage> {
    if (!Number.isInteger(page) || page < 1 || page > 10_000) throw new BadRequestException('page must be an integer from 1 to 10000');
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new BadRequestException('limit must be an integer from 1 to 100');

    const offset = (page - 1) * limit;
    const result = await this.database.query<{
      review_id: string;
      clinic_id: string;
      clinic_name: string;
      clinic_status: string;
      evidence_url: string;
      created_at: Date;
      queue_age_seconds: string;
      total_count: string;
    }>(`
      SELECT r.id::text AS review_id,
             r.clinic_id::text AS clinic_id,
             COALESCE(c.public_name, c.legal_name) AS clinic_name,
             c.status AS clinic_status,
             r.evidence_url,
             r.created_at,
             FLOOR(EXTRACT(EPOCH FROM (clock_timestamp() - r.created_at)))::bigint::text AS queue_age_seconds,
             COUNT(*) OVER()::bigint::text AS total_count
      FROM clinic_schema.emergency_capabilities_reviews r
      JOIN clinic_schema.clinics c ON c.id = r.clinic_id
      WHERE r.status = 'PENDING_REVIEW'
      ORDER BY r.created_at ASC, r.id ASC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    return {
      page,
      limit,
      total: Number(result.rows[0]?.total_count ?? 0),
      items: result.rows.map((row) => ({
        reviewId: row.review_id,
        clinicId: row.clinic_id,
        clinicName: row.clinic_name,
        clinicStatus: row.clinic_status,
        evidenceUrl: row.evidence_url,
        submittedAt: row.created_at.toISOString(),
        queueAgeSeconds: Number(row.queue_age_seconds),
      })),
    };
  }
}
