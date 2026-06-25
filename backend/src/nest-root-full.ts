import { MiddlewareConsumer, Module as NestModule, NestModule as NestModuleContract } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BookingCoreModule } from './booking-core/booking-core.module';
import { DatabaseModule } from './database/database.module';
import { EmergencyRoutingModule } from './emergency-routing/emergency-routing.module';
import { HealthController } from './health.controller';
import { InsuranceModule } from './modules/insurance/insurance.module';
import { MisIntegrationModule } from './modules/mis-integration/mis-integration.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { TelemedModule } from './modules/telemed/telemed.module';
import { ObservabilityModule } from './observability/observability.module';
import { TraceMiddleware } from './observability/trace.middleware';
import { OutboxModule } from './outbox/outbox.module';
import { WorkersModule } from './workers/workers.module';

@NestModule({
  imports: [ObservabilityModule, DatabaseModule, AuthModule, BookingCoreModule, EmergencyRoutingModule, OutboxModule, WorkersModule, MisIntegrationModule, PaymentsModule, TelemedModule, InsuranceModule],
  controllers: [HealthController],
})
export class NestRoot implements NestModuleContract {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TraceMiddleware).forRoutes('*');
  }
}
