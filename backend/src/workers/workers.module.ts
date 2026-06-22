import { Module as NestModule } from '@nestjs/common';
import { BookingCoreModule } from '../booking-core/booking-core.module';
import { HoldExpirationService } from './hold-expiration.service';
import { WorkersController } from './workers.controller';

@NestModule({
  imports: [BookingCoreModule],
  controllers: [WorkersController],
  providers: [HoldExpirationService],
})
export class WorkersModule {}
