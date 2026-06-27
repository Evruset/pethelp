import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { LiveKitWebhookController } from './livekit-webhook.controller';
import { LiveKitWebhookService } from './livekit-webhook.service';
import { LiveKitService } from './livekit.service';
import { TelemedOwnerRoomController } from './telemed-owner-room.controller';
import { TelemedOwnerRoomService } from './telemed-owner-room.service';
import { TelemedOwnerSessionController } from './telemed-owner-session.controller';
import { TelemedOwnerSessionService } from './telemed-owner-session.service';
import { TelemedPaymentWebhookController } from './telemed-payment-webhook.controller';
import { TelemedIntakeService } from './telemed-intake.service';
import { TelemedPaymentService } from './telemed-payment.service';
import { TelemedVetWorkspaceController } from './telemed-vet-workspace.controller';
import { TelemedVetWorkspaceService } from './telemed-vet-workspace.service';
import { ClinicEmployeeAccessService } from '../../booking-core/clinic-employee-access.service';
import { TelemedService } from './telemed.service';
import { TelemedSessionStartWorker } from './telemed-session-start.worker';
import { TelemedSlaWorker } from './telemed-sla.worker';

@Module({
  imports: [PaymentsModule],
  controllers: [
    LiveKitWebhookController,
    TelemedOwnerSessionController,
    TelemedOwnerRoomController,
    TelemedPaymentWebhookController,
    TelemedVetWorkspaceController,
  ],
  providers: [
    ClinicEmployeeAccessService,
    LiveKitService,
    LiveKitWebhookService,
    TelemedService,
    TelemedIntakeService,
    TelemedPaymentService,
    TelemedVetWorkspaceService,
    TelemedOwnerSessionService,
    TelemedOwnerRoomService,
    TelemedSessionStartWorker,
    TelemedSlaWorker,
  ],
  exports: [TelemedService, TelemedIntakeService, TelemedPaymentService, TelemedVetWorkspaceService, TelemedOwnerSessionService, TelemedOwnerRoomService, LiveKitService],
})
export class TelemedModule {}
