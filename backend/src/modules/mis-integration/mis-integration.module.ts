import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { VetManagerAdapter } from './adapters/vet-manager.adapter';
import { MisAdapterFactory } from './mis-adapter.factory';
import { MisCommandDispatcherService } from './mis-command-dispatcher.service';
import { MisOutboxRelayWorker } from './outbox-relay.worker';

@Module({
  imports: [
    HttpModule.register({ maxRedirects: 0 }),
    ScheduleModule.forRoot(),
  ],
  providers: [
    VetManagerAdapter,
    MisAdapterFactory,
    MisCommandDispatcherService,
    MisOutboxRelayWorker,
  ],
  exports: [MisCommandDispatcherService],
})
export class MisIntegrationModule {}
