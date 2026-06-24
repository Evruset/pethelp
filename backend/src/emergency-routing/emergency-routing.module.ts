import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClinicEmployeeAccessService } from '../booking-core/clinic-employee-access.service';
import { EmergencyRoutingController } from './emergency-routing.controller';
import { EmergencyProfileService } from './emergency-profile.service';
import { EmergencyRoutingService } from './emergency-routing.service';

@Module({
  imports: [AuthModule],
  controllers: [EmergencyRoutingController],
  providers: [
    ClinicEmployeeAccessService,
    EmergencyRoutingService,
    EmergencyProfileService,
  ],
  exports: [EmergencyRoutingService, EmergencyProfileService],
})
export class EmergencyRoutingModule {}
