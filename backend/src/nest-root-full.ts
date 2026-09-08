import { MiddlewareConsumer, Module as NestModule, NestModule as NestModuleContract } from '@nestjs/common';
import type { DynamicModule, ForwardReference, Type } from '@nestjs/common';
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
import { RateLimitModule } from './platform/rate-limit/rate-limit.module';
import { RegistryReferenceAccessLogMiddleware } from './observability/registry-reference-access-log.middleware';
import { mvpScope, type MvpScopeConfig } from './config/mvp-scope.config';
import { APP_GUARD } from '@nestjs/core';
import { MvpProductScopeGuard } from './config/mvp-product-scope.guard';
import { NotificationsModule } from './notifications/notifications.module';

type NestRootImport = Type<unknown> | DynamicModule | Promise<DynamicModule> | ForwardReference;

export function buildNestRootImports(scope: MvpScopeConfig = mvpScope): NestRootImport[] {
  return [
    ObservabilityModule,
    DatabaseModule,
    RateLimitModule,
    AuthModule,
    BookingCoreModule,
    NotificationsModule,
    ...(scope.runtimeModules.emergency ? [EmergencyRoutingModule] : []),
    OutboxModule,
    WorkersModule,
    ...(scope.runtimeModules.mis ? [MisIntegrationModule] : []),
    ...(scope.runtimeModules.payments ? [PaymentsModule] : []),
    ...(scope.runtimeModules.telemedicine ? [TelemedModule] : []),
    ...(scope.runtimeModules.insurance ? [InsuranceModule] : []),
    PublicCatalogModule,
    OwnerHomeModule,
  ];
}

@NestModule({
  imports: buildNestRootImports(),
  controllers: [HealthController],
  providers: [PermissionDeniedAuditFilter, { provide: APP_GUARD, useClass: MvpProductScopeGuard }],
})
export class NestRoot implements NestModuleContract {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TraceMiddleware, RegistryReferenceAccessLogMiddleware, ApiMetricsMiddleware).forRoutes('*');
  }
}
