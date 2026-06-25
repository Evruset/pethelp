import { Module } from '@nestjs/common';
import { LiveKitWebhookController } from './livekit-webhook.controller';
import { LiveKitWebhookService } from './livekit-webhook.service';
import { LiveKitService } from './livekit.service';
import { TelemedOwnerRoomController } from './telemed-owner-room.controller';
import { TelemedOwnerRoomService } from './telemed-owner-room.service';
import { TelemedOwnerSessionController } from './telemed-owner-session.controller';
import { TelemedOwnerSessionService } from './telemed-owner-session.service';
import { TelemedService } from './telemed.service';
import { TelemedSessionStartWorker } from './telemed-session-start.worker';
import { TelemedSlaWorker } from './telemed-sla.worker';

@Module({
  controllers: [
    LiveKitWebhookController,
    TelemedOwnerSessionController,
    TelemedOwnerRoomController,
  ],
  providers: [
    LiveKitService,
    LiveKitWebhookService,
    TelemedService,
    TelemedOwnerSessionService,
    TelemedOwnerRoomService,
    TelemedSessionStartWorker,
    TelemedSlaWorker,
  ],
  exports: [TelemedService, TelemedOwnerSessionService, TelemedOwnerRoomService, LiveKitService],
})
export class TelemedModule {}
