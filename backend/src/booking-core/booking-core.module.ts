import { Module as NestModule } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AlternativeSlotExpirationWorker } from './alternative-slot-expiration.worker';
import { AlternativeSlotService } from './alternative-slot.service';
import { BookingController, OwnerBookingCancellationController } from './booking.controller.secure';
import { BookingEventReplayController } from './booking-event-replay.controller';
import { BookingEventReplayService } from './booking-event-replay.service';
import { BookingHoldCreationService } from './booking-hold-creation.service';
import { BookingHoldReadService } from './booking-hold-read.service';
import { BookingRepository } from './booking.repository';
import { BookingSecurityService } from './booking-security.service';
import { BookingService } from './booking.service';
import { ClinicEmployeeAccessService } from './clinic-employee-access.service';
import { ClinicPortalController } from './clinic-portal.controller';
import { ClinicPortalService } from './clinic-portal.service';
import { ClinicQualityController } from './clinic-quality.controller';
import { ClinicQualityService } from './clinic-quality.service';
import { ClinicQueueController } from './clinic-queue.controller';
import { ClinicQueueService } from './clinic-queue.service';
import { ClinicScheduleController } from './clinic-schedule.controller';
import { ClinicScheduleService } from './clinic-schedule.service';
import { ClinicSlaMonitorWorker } from './clinic-sla-monitor.worker';
import { OwnerAlternativeAcceptanceService } from './owner-alternative-acceptance.service';
import { OwnerAlternativeSnapshotController } from './owner-alternative-snapshot.controller';
import { OwnerAlternativeSnapshotService } from './owner-alternative-snapshot.service';
import { VeterinarianVisitReadController } from './veterinarian-visit-read.controller';
import { VeterinarianVisitReadService } from './veterinarian-visit-read.service';

@NestModule({
  imports: [AuthModule],
  controllers: [BookingController, OwnerBookingCancellationController, ClinicPortalController, ClinicQualityController, ClinicQueueController, ClinicScheduleController, OwnerAlternativeSnapshotController, BookingEventReplayController, VeterinarianVisitReadController],
  providers: [BookingRepository, BookingService, BookingHoldCreationService, BookingHoldReadService, BookingSecurityService, ClinicEmployeeAccessService, ClinicPortalService, ClinicQualityService, ClinicQueueService, ClinicScheduleService, ClinicSlaMonitorWorker, AlternativeSlotService, AlternativeSlotExpirationWorker, OwnerAlternativeSnapshotService, OwnerAlternativeAcceptanceService, BookingEventReplayService, VeterinarianVisitReadService],
  exports: [BookingService, ClinicPortalService, AlternativeSlotService, ClinicQueueService, ClinicQualityService, ClinicScheduleService, OwnerAlternativeSnapshotService, BookingEventReplayService],
})
export class BookingCoreModule {}
