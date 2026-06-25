import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OwnerAuthController, OwnerProfileController } from './owner-auth.controller';
import { OwnerAppointmentsService } from './owner-appointments.service';
import { OwnerAuthService } from './owner-auth.service';
import { OwnerPetController } from './owner-pet.controller';
import { OwnerPetService } from './owner-pet.service';
import { RolesGuard } from './roles.guard';
import { WorkerAuthGuard } from './worker-auth.guard';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [OwnerAuthController, OwnerProfileController, OwnerPetController],
  providers: [
    JwtAuthGuard,
    RolesGuard,
    WorkerAuthGuard,
    OwnerAuthService,
    OwnerAppointmentsService,
    OwnerPetService,
  ],
  exports: [
    JwtModule,
    JwtAuthGuard,
    RolesGuard,
    WorkerAuthGuard,
    OwnerAuthService,
    OwnerAppointmentsService,
    OwnerPetService,
  ],
})
export class AuthModule {}
