import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { LiveKitWebhookController } from './livekit-webhook.controller';
import { LiveKitWebhookService } from './livekit-webhook.service';
import { LiveKitService } from './livekit.service';
import { TelemedOwnerController } from './telemed-owner.controller';
import { TelemedOwnerEndService } from './telemed-owner-end.service';
import { TelemedOwnerService } from './telemed-owner.service';
import { TelemedRoomCloseWorker } from './telemed-room-close.worker';
import { TelemedService } from './telemed.service';
import { TelemedSessionStartWorker } from './telemed-session-start.worker';
import { TelemedSlaWorker } from './telemed-sla.worker';

@Module({
  imports: [AuthModule],
  controllers: [LiveKitWebhookController, TelemedOwnerController],
  providers: [
    LiveKitService,
    LiveKitWebhookService,
    TelemedService,
    TelemedOwnerService,
    TelemedOwnerEndService,
    TelemedSessionStartWorker,
    TelemedSlaWorker,
    TelemedRoomCloseWorker,
  ],
  exports: [TelemedService, LiveKitService, TelemedOwnerService],
})
export class TelemedModule {}
