import { Module } from '@nestjs/common';
import { LiveKitWebhookController } from './livekit-webhook.controller';
import { LiveKitWebhookService } from './livekit-webhook.service';
import { LiveKitService } from './livekit.service';
import { TelemedService } from './telemed.service';
import { TelemedSessionStartWorker } from './telemed-session-start.worker';
import { TelemedSlaWorker } from './telemed-sla.worker';

@Module({
  controllers: [LiveKitWebhookController],
  providers: [
    LiveKitService,
    LiveKitWebhookService,
    TelemedService,
    TelemedSessionStartWorker,
    TelemedSlaWorker,
  ],
  exports: [TelemedService, LiveKitService],
})
export class TelemedModule {}
