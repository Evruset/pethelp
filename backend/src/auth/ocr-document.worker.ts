import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OwnerOcrService } from './owner-ocr.service';
import { OcrProvider } from './ocr-provider';

@Injectable()
export class OcrDocumentWorker {
  private readonly logger = new Logger(OcrDocumentWorker.name);
  private running = false;
  constructor(private readonly jobs: OwnerOcrService, private readonly provider: OcrProvider) {}

  @Cron('*/10 * * * * *')
  async processDocuments(): Promise<void> {
    if ((process.env.WORKERS_ENABLED ?? 'true').toLowerCase() !== 'true' || this.running) return;
    this.running = true;
    try {
      const claim = await this.jobs.claim();
      if (!claim) return;
      if(await this.jobs.processBound(claim,this.provider))return;
      const abort = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        // claim transaction has COMMITTED before invoking even the simulated provider.
        const extraction = await Promise.race([
          this.provider.extract(claim.source_snapshot, abort.signal),
          new Promise<never>((_, reject) => { timer = setTimeout(() => { abort.abort(); reject(new Error('OCR timeout')); }, 30000); }),
        ]);
        await this.jobs.finish(claim, extraction);
      } catch {
        // Never log/store provider error messages: they may contain medical text or credentials.
        await this.jobs.finish(claim, undefined, 'PROVIDER_FAILED');
      } finally { if (timer) clearTimeout(timer); }
    } catch {
      this.logger.error('OCR processing checkpoint failed; durable lease recovery will retry.');
    } finally { this.running = false; }
  }
}
