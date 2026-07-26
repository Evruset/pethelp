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
import { ClinicAppointmentsRegistryController } from './clinic-appointments-registry.controller';
import { ClinicAppointmentsRegistryService } from './clinic-appointments-registry.service';
import { ClinicPatientAssociationLifecycleService } from './clinic-patient-association-lifecycle.service';
import { ClinicPatientDetailController } from './clinic-patient-detail.controller';
import { ClinicPatientDetailService } from './clinic-patient-detail.service';
import { ClinicPatientLocalAliasController } from './clinic-patient-local-alias.controller';
import { ClinicPatientLocalAliasService } from './clinic-patient-local-alias.service';
import { ClinicPatientAdministrativeReferenceController } from './clinic-patient-administrative-reference.controller';
import { ClinicPatientAdministrativeReferenceService } from './clinic-patient-administrative-reference.service';
import { ClinicPatientsRegistryController } from './clinic-patients-registry.controller';
import { ClinicPatientsRegistryService } from './clinic-patients-registry.service';
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
  controllers: [BookingController, OwnerBookingCancellationController, ClinicPortalController, ClinicAppointmentsRegistryController, ClinicPatientsRegistryController, ClinicPatientDetailController, ClinicPatientLocalAliasController, ClinicPatientAdministrativeReferenceController, ClinicQualityController, ClinicQueueController, ClinicScheduleController, OwnerAlternativeSnapshotController, BookingEventReplayController, VeterinarianVisitReadController],
  providers: [BookingRepository, BookingService, BookingHoldCreationService, BookingHoldReadService, BookingSecurityService, ClinicEmployeeAccessService, ClinicAppointmentsRegistryService, ClinicPatientsRegistryService, ClinicPatientDetailService, ClinicPatientLocalAliasService, ClinicPatientAdministrativeReferenceService, ClinicPatientAssociationLifecycleService, ClinicPortalService, ClinicQualityService, ClinicQueueService, ClinicScheduleService, ClinicSlaMonitorWorker, AlternativeSlotService, AlternativeSlotExpirationWorker, OwnerAlternativeSnapshotService, OwnerAlternativeAcceptanceService, BookingEventReplayService, VeterinarianVisitReadService],
  exports: [BookingService, ClinicPortalService, AlternativeSlotService, ClinicQueueService, ClinicQualityService, ClinicScheduleService, OwnerAlternativeSnapshotService, BookingEventReplayService, ClinicPatientAssociationLifecycleService],
})
export class BookingCoreModule {}
