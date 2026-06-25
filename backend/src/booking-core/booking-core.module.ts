import { Module as NestModule } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AlternativeSlotExpirationWorker } from './alternative-slot-expiration.worker';
import { AlternativeSlotService } from './alternative-slot.service';
import { BookingController } from './booking.controller.secure';
import { BookingHoldCreationService } from './booking-hold-creation.service';
import { BookingHoldReadService } from './booking-hold-read.service';
import { BookingRepository } from './booking.repository';
import { BookingSecurityService } from './booking-security.service';
import { BookingService } from './booking.service';
import { ClinicEmployeeAccessService } from './clinic-employee-access.service';
import { ClinicPortalController } from './clinic-portal.controller';
import { ClinicPortalService } from './clinic-portal.service';
import { ClinicQueueController } from './clinic-queue.controller';
import { ClinicQueueService } from './clinic-queue.service';
import { ClinicSlaMonitorWorker } from './clinic-sla-monitor.worker';
import { OwnerAlternativeAcceptanceService } from './owner-alternative-acceptance.service';
import { OwnerAlternativeSnapshotController } from './owner-alternative-snapshot.controller';
import { OwnerAlternativeSnapshotService } from './owner-alternative-snapshot.service';

@NestModule({
  imports: [AuthModule],
  controllers: [BookingController, ClinicPortalController, ClinicQueueController, OwnerAlternativeSnapshotController],
  providers: [
    BookingRepository,
    BookingService,
    BookingHoldCreationService,
    BookingHoldReadService,
    BookingSecurityService,
    ClinicEmployeeAccessService,
    ClinicPortalService,
    ClinicQueueService,
    ClinicSlaMonitorWorker,
    AlternativeSlotService,
    AlternativeSlotExpirationWorker,
    OwnerAlternativeSnapshotService,
    OwnerAlternativeAcceptanceService,
  ],
  exports: [BookingService, ClinicPortalService, AlternativeSlotService, ClinicQueueService, OwnerAlternativeSnapshotService],
})
export class BookingCoreModule {}
