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
import { OwnerHomeModule } from './owner-home/owner-home.module';
import { ApiMetricsMiddleware } from './observability/api-metrics.middleware';
import { TraceMiddleware } from './observability/trace.middleware';
import { OutboxModule } from './outbox/outbox.module';
import { PublicCatalogModule } from './public-catalog/public-catalog.module';
import { WorkersModule } from './workers/workers.module';
import { PermissionDeniedAuditFilter } from './common/permission-denied-audit.filter';

@NestModule({
  imports: [ObservabilityModule, DatabaseModule, AuthModule, BookingCoreModule, EmergencyRoutingModule, OutboxModule, WorkersModule, MisIntegrationModule, PaymentsModule, TelemedModule, InsuranceModule, PublicCatalogModule, OwnerHomeModule],
  controllers: [HealthController],
  providers: [PermissionDeniedAuditFilter],
})
export class NestRoot implements NestModuleContract {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TraceMiddleware, ApiMetricsMiddleware).forRoutes('*');
  }
}
