import { Module } from '@nestjs/common';
import { TelemedService } from './telemed.service';
import { TelemedSessionStartWorker } from './telemed-session-start.worker';
import { TelemedSlaWorker } from './telemed-sla.worker';

@Module({
  providers: [
    TelemedService,
    TelemedSessionStartWorker,
    TelemedSlaWorker,
  ],
  exports: [TelemedService],
})
export class TelemedModule {}
