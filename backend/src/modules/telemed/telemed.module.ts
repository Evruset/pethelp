import { Module } from '@nestjs/common';
import { LiveKitWebhookController } from './livekit-webhook.controller';
import { LiveKitWebhookService } from './livekit-webhook.service';
import { LiveKitService } from './livekit.service';
import { TelemedOwnerSessionController } from './telemed-owner-session.controller';
import { TelemedOwnerSessionService } from './telemed-owner-session.service';
import { TelemedService } from './telemed.service';
import { TelemedSessionStartWorker } from './telemed-session-start.worker';
import { TelemedSlaWorker } from './telemed-sla.worker';

@Module({
  controllers: [LiveKitWebhookController, TelemedOwnerSessionController],
  providers: [
    LiveKitService,
    LiveKitWebhookService,
    TelemedService,
    TelemedOwnerSessionService,
    TelemedSessionStartWorker,
    TelemedSlaWorker,
  ],
  exports: [TelemedService, TelemedOwnerSessionService, LiveKitService],
})
export class TelemedModule {}
