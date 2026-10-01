import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AlternativeSlotService } from './alternative-slot.service';
import { ContextLoggerService } from '../observability/context-logger.service';
import { AppointmentLifecycleService } from './appointment-lifecycle.service';

/** Releases both source and proposed slot when the owner does not respond. */
@Injectable()
export class AlternativeSlotExpirationWorker {
  private running = false;

  constructor(
    private readonly alternatives: AlternativeSlotService,
    private readonly appointmentLifecycle: AppointmentLifecycleService,
    private readonly logger: ContextLoggerService,
  ) {}

  @Cron('*/30 * * * * *')
  async expireUnacceptedAlternatives(): Promise<void> {
    if ((process.env.WORKERS_ENABLED ?? 'true').toLowerCase() !== 'true' || this.running) return;
    this.running = true;
    try {
      const expired = await this.alternatives.expireAlternativeHolds();
      const expiredAppointments = await this.appointmentLifecycle.expireRescheduleProposals();
      if (expired + expiredAppointments > 0) {
        this.logger.event('warn', AlternativeSlotExpirationWorker.name, 'Expired unaccepted alternative booking slot proposal(s)', { expired, expiredAppointments });
      }
    } catch (error) {
      this.logger.event('error', AlternativeSlotExpirationWorker.name, 'Alternative slot expiration worker failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      this.running = false;
    }
  }
}
