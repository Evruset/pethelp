import { MiddlewareConsumer, Module as NestModule, NestModule as NestModuleContract } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BookingCoreModule } from './booking-core/booking-core.module';
import { CorrelationIdMiddleware } from './common/correlation';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { MisIntegrationModule } from './modules/mis-integration/mis-integration.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { OutboxModule } from './outbox/outbox.module';
import { WorkersModule } from './workers/workers.module';

@NestModule({
  imports: [DatabaseModule, AuthModule, BookingCoreModule, OutboxModule, WorkersModule, MisIntegrationModule, PaymentsModule],
  controllers: [HealthController],
})
export class NestRoot implements NestModuleContract {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
