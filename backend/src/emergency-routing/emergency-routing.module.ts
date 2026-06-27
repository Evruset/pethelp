import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClinicEmployeeAccessService } from '../booking-core/clinic-employee-access.service';
import { EmergencyReviewCommand } from './emergency-review.command';
import { EmergencyRouteActionService } from './emergency-route-action.service';
import { EmergencyRoutingController } from './emergency-routing.controller';
import { EmergencyProfileService } from './emergency-profile.service';
import { EmergencyRoutingService } from './emergency-routing.service';
import { EmergencyTriageService } from './emergency-triage.service';

@Module({
  imports: [AuthModule],
  controllers: [EmergencyRoutingController],
  providers: [
    ClinicEmployeeAccessService,
    EmergencyRoutingService,
    EmergencyProfileService,
    EmergencyReviewCommand,
    EmergencyTriageService,
    EmergencyRouteActionService,
  ],
  exports: [EmergencyRoutingService, EmergencyProfileService, EmergencyTriageService, EmergencyRouteActionService],
})
export class EmergencyRoutingModule {}
