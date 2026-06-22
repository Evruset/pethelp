import { Module as NestModule } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BookingController } from './booking.controller.secure';
import { BookingRepository } from './booking.repository';
import { BookingSecurityService } from './booking-security.service';
import { BookingService } from './booking.service';

@NestModule({
  imports: [AuthModule],
  controllers: [BookingController],
  providers: [BookingRepository, BookingService, BookingSecurityService],
  exports: [BookingService],
})
export class BookingCoreModule {}
