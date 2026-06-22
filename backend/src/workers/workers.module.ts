import { Module as NestModule } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BookingCoreModule } from '../booking-core/booking-core.module';
import { WorkerRoutesController } from '../internal/worker-routes.controller';
import { HoldExpirationService } from './hold-expiration.service';

@NestModule({
  imports: [AuthModule, BookingCoreModule],
  controllers: [WorkerRoutesController],
  providers: [HoldExpirationService],
})
export class WorkersModule {}
