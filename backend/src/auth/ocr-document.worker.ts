import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';

interface OcrDocumentJob {
  id: string;
  pet_id: string;
  file_url: string;
  doc_type: 'PASSPORT' | 'HISTORY';
}

@Injectable()
export class OcrDocumentWorker {
  private readonly logger = new Logger(OcrDocumentWorker.name);
  private running = false;

  constructor(private readonly database: DatabaseService) {}

  @Cron('*/10 * * * * *')
  async processDocuments(): Promise<void> {
    if ((process.env.WORKERS_ENABLED ?? 'true').toLowerCase() !== 'true' || this.running) return;
    this.running = true;
    try {
      const processed = await this.database.withTransaction(async (client) => {
        await client.query("SET LOCAL lock_timeout = '50ms'");
        await client.query("SET LOCAL statement_timeout = '500ms'");
        const jobs = await client.query<OcrDocumentJob>(`
          SELECT id, pet_id, file_url, doc_type
          FROM pet_schema.pet_documents
          WHERE status = 'PROCESSING'
          ORDER BY created_at ASC, id ASC
          LIMIT 10
          FOR UPDATE SKIP LOCKED
        `);

        for (const job of jobs.rows) {
          const ocrResult = this.simulateOcr(job);
          await client.query(`
            UPDATE pet_schema.pets
            SET medical_history_ocr = $2::jsonb,
                updated_at = clock_timestamp()
            WHERE id = $1::uuid
          `, [job.pet_id, JSON.stringify(ocrResult)]);
          await client.query(`
            UPDATE pet_schema.pet_documents
            SET status = 'PROCESSED',
                ocr_result = $2::jsonb,
                processed_at = clock_timestamp(),
                updated_at = clock_timestamp()
            WHERE id = $1::uuid
          `, [job.id, JSON.stringify(ocrResult)]);
        }
        return jobs.rowCount ?? 0;
      });
      if (processed > 0) {
        this.logger.log(`Processed ${processed} pet OCR document(s)`);
      }
    } catch (error) {
      this.logger.error('OCR document worker failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }

  private simulateOcr(job: OcrDocumentJob): Record<string, unknown> {
    return {
      documentId: job.id,
      documentType: job.doc_type,
      sourceUrl: job.file_url,
      text: job.doc_type === 'PASSPORT'
        ? 'OCR simulated: veterinary passport fields detected.'
        : 'OCR simulated: medical history notes detected.',
      provider: 'SIMULATED_OCR',
      processedAt: new Date().toISOString(),
    };
  }
}
