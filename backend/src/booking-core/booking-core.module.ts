import { Module as NestModule } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AlternativeSlotExpirationWorker } from './alternative-slot-expiration.worker';
import { AlternativeSlotService } from './alternative-slot.service';
import { BookingController } from './booking.controller.secure';
import { BookingHoldCreationService } from './booking-hold-creation.service';
import { BookingRepository } from './booking.repository';
import { BookingSecurityService } from './booking-security.service';
import { BookingService } from './booking.service';
import { ClinicEmployeeAccessService } from './clinic-employee-access.service';
import { ClinicPortalService } from './clinic-portal.service';
import { ClinicSlaMonitorWorker } from './clinic-sla-monitor.worker';
import { ClinicPortalController } from './clinic-portal.controller';

@NestModule({
  imports: [AuthModule],
  controllers: [BookingController, ClinicPortalController],
  providers: [
    BookingRepository,
    BookingService,
    BookingHoldCreationService,
    BookingSecurityService,
    ClinicEmployeeAccessService,
    ClinicPortalService,
    ClinicSlaMonitorWorker,
    AlternativeSlotService,
    AlternativeSlotExpirationWorker,
  ],
  exports: [BookingService, ClinicPortalService, AlternativeSlotService],
})
export class BookingCoreModule {}
