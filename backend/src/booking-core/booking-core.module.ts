import { Module as NestModule } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { BookingRepository } from './booking.repository';
import { BookingService } from './booking.service';

@NestModule({
  controllers: [BookingController],
  providers: [BookingRepository, BookingService],
  exports: [BookingService],
})
export class BookingCoreModule {}
