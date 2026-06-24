import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EmergencyOpsService } from './emergency-ops.service';

@Injectable()
export class EmergencyFreshnessWorker {
  private readonly logger = new Logger(EmergencyFreshnessWorker.name);
  private running = false;

  constructor(private readonly emergencyOps: EmergencyOpsService) {}

  @Cron('0 * * * *')
  async expireStaleProfiles(): Promise<void> {
    if ((process.env.WORKERS_ENABLED ?? 'true').toLowerCase() !== 'true' || this.running) return;
    this.running = true;
    try {
      for (let index = 0; index < 100; index += 1) {
        if (!await this.emergencyOps.expireOneDueReview()) break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Emergency profile freshness worker failed';
      this.logger.error(message);
    } finally {
      this.running = false;
    }
  }
}
