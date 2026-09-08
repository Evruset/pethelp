import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { NotificationFoundationRepository } from './notification-foundation.repository';

@Injectable()
export class OwnerNotificationProjectorWorker {
  private running = false;
  constructor(private readonly notifications: NotificationFoundationRepository) {}

  @Interval(1_000)
  async projectCommittedBookingEvents(): Promise<void> {
    if (this.running || (process.env.WORKERS_ENABLED ?? 'true').toLowerCase() !== 'true') return;
    this.running = true;
    try {
      await this.notifications.projectPendingBatch(100);
    } finally {
      this.running = false;
    }
  }
}
