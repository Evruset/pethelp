import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OcrDocumentWorker } from './ocr-document.worker';
import { OwnerAuthController, OwnerProfileController } from './owner-auth.controller';
import { OwnerAppointmentsService } from './owner-appointments.service';
import { OwnerAuthService } from './owner-auth.service';
import { OwnerPetController } from './owner-pet.controller';
import { OwnerPetService } from './owner-pet.service';
import { RolesGuard } from './roles.guard';
import { WorkerAuthGuard } from './worker-auth.guard';
import { CapabilityEvaluatorService } from './capability-evaluator.service';
import { EffectiveSessionController } from './effective-session.controller';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [OwnerAuthController, OwnerProfileController, OwnerPetController, EffectiveSessionController],
  providers: [
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
    WorkerAuthGuard,
    OwnerAuthService,
    OwnerAppointmentsService,
    OwnerPetService,
    OcrDocumentWorker,
    CapabilityEvaluatorService,
  ],
  exports: [
    JwtModule,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
    WorkerAuthGuard,
    OwnerAuthService,
    OwnerAppointmentsService,
    OwnerPetService,
    CapabilityEvaluatorService,
  ],
})
export class AuthModule {}
