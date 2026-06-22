import { Module as NestModule } from '@nestjs/common';
import { BookingController } from './booking.controller.secure';
import { BookingRepository } from './booking.repository';
import { BookingSecurityService } from './booking-security.service';
import { BookingService } from './booking.service';

@NestModule({
  controllers: [BookingController],
  providers: [BookingRepository, BookingService, BookingSecurityService],
  exports: [BookingService],
})
export class BookingCoreModule {}
