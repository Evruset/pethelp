import { MiddlewareConsumer, Module as NestModule, NestModule as NestModuleContract } from '@nestjs/common';
import { BookingCoreModule } from './booking-core/booking-core.module';
import { CorrelationIdMiddleware } from './common/correlation';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { OutboxModule } from './outbox/outbox.module';
import { WorkersModule } from './workers/workers.module';

@NestModule({
  imports: [DatabaseModule, BookingCoreModule, OutboxModule, WorkersModule],
  controllers: [HealthController],
})
export class NestRoot implements NestModuleContract {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
