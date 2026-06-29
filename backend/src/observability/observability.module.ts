import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { AlertForwarderService } from './alert-forwarder.service';
import { ApiMetricsMiddleware } from './api-metrics.middleware';
import { ContextLoggerService } from './context-logger.service';
import { ObservabilityMetricsService } from './observability.metrics';
import { OpsSloController } from './ops-slo.controller';
import { TraceContext } from './trace-context.context';

@Global()
@Module({
  imports: [HttpModule.register({ maxRedirects: 0 })],
  controllers: [OpsSloController],
  providers: [
    TraceContext,
    AlertForwarderService,
    ApiMetricsMiddleware,
    ContextLoggerService,
    ObservabilityMetricsService,
  ],
  exports: [
    TraceContext,
    AlertForwarderService,
    ApiMetricsMiddleware,
    ContextLoggerService,
    ObservabilityMetricsService,
  ],
})
export class ObservabilityModule {}
