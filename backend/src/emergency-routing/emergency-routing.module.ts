import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from '../auth/auth.module';
import { ClinicEmployeeAccessService } from '../booking-core/clinic-employee-access.service';
import { EmergencyFreshnessWorker } from './emergency-freshness.worker';
import { EmergencyOpsController } from './emergency-ops.controller';
import { EmergencyOpsService } from './emergency-ops.service';
import { EmergencyProfileService } from './emergency-profile.service';
import { EmergencyPublicRoutingService } from './emergency-public-routing.service';
import { EmergencyReviewCommand } from './emergency-review.command';
import { EmergencyRoutingController } from './emergency-routing.controller';
import { EmergencyRoutingService } from './emergency-routing.service';

@Module({
  imports: [AuthModule, ScheduleModule.forRoot()],
  controllers: [EmergencyRoutingController, EmergencyOpsController],
  providers: [
    ClinicEmployeeAccessService,
    EmergencyRoutingService,
    EmergencyPublicRoutingService,
    EmergencyProfileService,
    EmergencyReviewCommand,
    EmergencyOpsService,
    EmergencyFreshnessWorker,
  ],
  exports: [EmergencyRoutingService, EmergencyPublicRoutingService, EmergencyProfileService, EmergencyOpsService],
})
export class EmergencyRoutingModule {}
