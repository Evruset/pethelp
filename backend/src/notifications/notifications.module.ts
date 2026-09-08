import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationFoundationRepository } from './notification-foundation.repository';
import { OwnerNotificationsController } from './owner-notifications.controller';
import { ScheduleModule } from '@nestjs/schedule';
import { OwnerNotificationProjectorWorker } from './owner-notification-projector.worker';

@Module({
  imports: [AuthModule, ScheduleModule.forRoot()],
  controllers: [OwnerNotificationsController],
  providers: [NotificationFoundationRepository, OwnerNotificationProjectorWorker],
  exports: [NotificationFoundationRepository],
})
export class NotificationsModule {}
